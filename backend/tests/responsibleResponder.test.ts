import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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

/**
 * The dashboard's "unassigned" count is derived from `incident.assignedTo`, and
 * the incident record has to name the person answerable for an incident
 * rather than leaving the operator to infer it from an identifier. These
 * tests prove the field arrives populated on every read path that the client
 * uses — the single-incident read, the list read, and the ranked-sort list
 * read, which is a separate code path from the plain list.
 */
describe("Responsible responder is populated on read", () => {
  let coordinator: any;
  let responder: any;
  let coordinatorToken: string;
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
  });

  beforeEach(async () => {
    await clearDatabase();

    coordinator = await User.create({
      name: "Coord Two",
      email: "coord-two@example.com",
      password: "password123",
      role: "COORDINATOR",
    });
    responder = await User.create({
      name: "Ravi Menon",
      email: "ravi-two@example.com",
      password: "password123",
      role: "RESPONDER",
      isAvailable: true,
    });

    coordinatorToken = createTokens(
      coordinator._id.toString(),
      "COORDINATOR"
    ).accessToken;

    incident = await Incident.create({
      title: "Fictional demo landslide report",
      description:
        "FICTIONAL DEMO INCIDENT. A fictional slope failure blocks the road.",
      severity: "HIGH",
      category: "LANDSLIDE",
      status: "REPORTED",
      priority: 7,
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      reportedBy: coordinator._id,
      tags: ["fictional-demo-data"],
    });
  });

  const assign = async () =>
    request(app)
      .post(`/api/v1/incidents/${incident._id}/assign`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ assignedTo: responder._id.toString() });

  it("names the responder in the assignment response", async () => {
    const response = await assign();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.assignedTo.name).toBe("Ravi Menon");
    expect(response.body.data.assignedTo.email).toBe("ravi-two@example.com");
  });

  it("names the responder when the incident is read back", async () => {
    await assign();

    const response = await request(app)
      .get(`/api/v1/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.assignedTo.name).toBe("Ravi Menon");
  });

  it("names the responder in the incident list", async () => {
    await assign();

    const response = await request(app)
      .get("/api/v1/incidents")
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    const listed = response.body.data.data.find(
      (entry: any) => entry._id === incident._id.toString()
    );
    expect(listed).toBeDefined();
    expect(listed.assignedTo.name).toBe("Ravi Menon");
  });

  it("names the responder in the incident list sorted by severity", async () => {
    // Sorting by severity runs an aggregation pipeline instead of a query, so
    // this path can drift from the plain list unless it is checked too.
    await assign();

    const response = await request(app)
      .get("/api/v1/incidents?sortBy=severity&sortOrder=desc")
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    const listed = response.body.data.data.find(
      (entry: any) => entry._id === incident._id.toString()
    );
    expect(listed).toBeDefined();
    expect(listed.assignedTo.name).toBe("Ravi Menon");
  });

  it("leaves an unassigned incident without a responder", async () => {
    const response = await request(app)
      .get(`/api/v1/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    // No person and no empty array — the field is simply absent, which is
    // what the dashboard's unassigned count reads.
    expect(response.body.data.assignedTo).toBeUndefined();
  });

  it("drops the responder from the record when it is cleared", async () => {
    await assign();

    const response = await request(app)
      .post(`/api/v1/incidents/${incident._id}/unassign`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.assignedTo).toBeUndefined();

    const reread = await request(app)
      .get(`/api/v1/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(reread.body.data.assignedTo).toBeUndefined();
  });

  it("does not expose the responder's password hash", async () => {
    await assign();

    const response = await request(app)
      .get(`/api/v1/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.body.data.assignedTo.password).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("$2b$");
  });

  it("does not expose the reporter's password hash", async () => {
    const response = await request(app)
      .get(`/api/v1/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.body.data.reportedBy.password).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("$2b$");
  });

  it("refuses to assign a responder who does not exist", async () => {
    const response = await request(app)
      .post(`/api/v1/incidents/${incident._id}/assign`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ assignedTo: "64b7f9f2a1c2d3e4f5a6b7c8" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
