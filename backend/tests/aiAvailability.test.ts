import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import {
  connectDatabase,
  disconnectDatabase,
  clearDatabase,
} from "../src/config/database.js";
import User from "../src/models/User.js";
import Incident from "../src/models/Incident.js";
import { createTokens } from "../src/services/authService.js";
import { aiClient } from "../src/services/aiService.js";

/**
 * The AI service is advisory, so a failure has to be reported rather than
 * papered over with a plausible-looking default: a placeholder summary, a
 * default priority of 5, or an empty list of missing fields all read as
 * genuine findings. These tests pin that the API reports the dependency
 * being unavailable instead of returning a fabricated result.
 *
 * The transport is mocked rather than the public methods, so the real
 * wrapper — the code that decides a failure is a 503 — is the code under
 * test.
 */
describe("AI service availability", () => {
  let token: string;
  let incident: any;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.restoreAllMocks();

    const user = await User.create({
      name: "Coord One",
      email: "coord@example.com",
      password: "password123",
      role: "COORDINATOR",
    });
    token = createTokens(user._id.toString(), "COORDINATOR").accessToken;

    incident = await Incident.create({
      title: "Fictional demo flood report",
      description:
        "FICTIONAL DEMO INCIDENT. Water is rising across the low-lying road.",
      severity: "HIGH",
      category: "FLOOD",
      status: "REPORTED",
      priority: 7,
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      reportedBy: user._id,
      tags: ["fictional-demo-data"],
    });
  });

  /**
   * The AI client's transport, which is private but reachable at runtime.
   * The public methods are what the controller calls, and they are the code
   * that decides a failure is a 503, so the failure is injected underneath
   * them rather than in place of them.
   */
  const transport = () =>
    aiClient as unknown as {
      makeRequest: (endpoint: string, data: unknown) => Promise<unknown>;
    };

  /** Make every call to the AI service fail at the transport level. */
  const failTransport = (message: string) =>
    vi
      .spyOn(transport(), "makeRequest")
      .mockRejectedValue(new Error(message));

  it("reports the summary service as unavailable instead of returning a placeholder", async () => {
    failTransport("connect ECONNREFUSED 127.0.0.1:8001");

    const res = await request(app)
      .post(`/api/v1/ai/summary/${incident._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe("The summary service is unavailable.");
    // The point of the test: no fabricated summary is handed back.
    expect(res.body.data).toBeUndefined();
  });

  it("reports the priority service as unavailable instead of a default score", async () => {
    failTransport("AI Service request timeout");

    const res = await request(app)
      .post(`/api/v1/ai/priority/${incident._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe("The priority service is unavailable.");
    expect(res.body.data).toBeUndefined();
  });

  it("reports the missing-details service as unavailable instead of an empty list", async () => {
    failTransport("AI Service error: internal");

    const res = await request(app)
      .post(`/api/v1/ai/missing-info/${incident._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe(
      "The missing-details service is unavailable."
    );
    // An empty list of missing fields would render as "all essential fields
    // have been reported", which is the opposite of the truth.
    expect(res.body.data).toBeUndefined();
  });

  it("reports the category suggestion service as unavailable", async () => {
    failTransport("connect ECONNREFUSED 127.0.0.1:8001");

    const res = await request(app)
      .post("/api/v1/ai/category-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Fictional demo gas leak", description: "Smell of gas." });

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe(
      "The category suggestion service is unavailable."
    );
    expect(res.body.data).toBeUndefined();
  });

  it("still returns a real result when the AI service is working", async () => {
    vi.spyOn(transport(), "makeRequest").mockResolvedValue({
      missing_fields: [
        {
          field: "access_notes",
          severity: "medium",
          verification_suggestion: "Confirm the access route.",
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/ai/missing-info/${incident._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.missing_fields).toHaveLength(1);
  });

  it("requires a session", async () => {
    const res = await request(app).post(
      `/api/v1/ai/summary/${incident._id}`
    );

    expect(res.status).toBe(401);
  });
});
