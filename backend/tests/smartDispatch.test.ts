import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import Incident from "../src/models/Incident.js";
import Assignment from "../src/models/Assignment.js";
import { createTokens } from "../src/services/authService.js";
import { Severity, IncidentCategory, IncidentStatus, AssignmentStatus } from "../src/types/models.js";

const createTestToken = (userId: string, role: string) => {
  return createTokens(userId, role).accessToken;
};

describe("Smart Emergency Dispatch System", () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("should calculate recommendations and allow coordinator to assign or reject", async () => {
    // 1. Create coordinator and responder
    const coordinator = await User.create({
      name: "Coordinator Test",
      email: "coord@test.com",
      password: "password123",
      role: "COORDINATOR",
    });

    const responder = await User.create({
      name: "Responder Test",
      email: "resp@test.com",
      password: "password123",
      role: "RESPONDER",
      isAvailable: true,
      skills: ["medical", "rescue"],
      location: { type: "Point", coordinates: [-122.4, 37.7] },
    });

    const viewer = await User.create({
      name: "Viewer Test",
      email: "viewer@test.com",
      password: "password123",
      role: "VIEWER",
    });

    // 2. Create an incident
    const incident = await Incident.create({
      title: "Test Emergency Incident",
      description: "A test emergency requiring medical assistance.",
      severity: Severity.HIGH,
      category: IncidentCategory.MEDICAL,
      status: IncidentStatus.REPORTED,
      location: { type: "Point", coordinates: [-122.41, 37.71] },
      requiredSkills: ["medical"],
      reportedBy: viewer._id,
    });

    const coordToken = createTestToken(coordinator._id.toString(), coordinator.role);

    // 3. Test recommendations endpoint
    const recResponse = await request(app)
      .get(`/api/v1/assignments/recommendations/${incident._id}`)
      .set("Authorization", `Bearer coordToken ${coordToken}`); // wait, "Bearer <token>"

    // Let's fix token header format below
    const responseRec = await request(app)
      .get(`/api/v1/assignments/recommendations/${incident._id}`)
      .set("Authorization", `Bearer ${coordToken}`);

    expect(responseRec.status).toBe(200);
    expect(responseRec.body.success).toBe(true);
    expect(responseRec.body.data.length).toBeGreaterThan(0);
    expect(responseRec.body.data[0].responder._id).toBe(responder._id.toString());
    expect(responseRec.body.data[0].score).toBeGreaterThan(0);

    // 4. Assign recommendation (Create assignment)
    const assignResponse = await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordToken}`)
      .send({
        responderId: responder._id.toString(),
        notes: "Automated dispatch recommendation.",
      });

    expect(assignResponse.status).toBe(201);
    expect(assignResponse.body.success).toBe(true);
    const assignmentId = assignResponse.body.data._id;
    expect(assignResponse.body.data.status).toBe(AssignmentStatus.PENDING);

    // 5. Responder accepts assignment
    const respToken = createTestToken(responder._id.toString(), responder.role);
    const acceptResponse = await request(app)
      .put(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${respToken}`)
      .send({
        status: AssignmentStatus.ACCEPTED,
      });

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.success).toBe(true);
    expect(acceptResponse.body.data.status).toBe(AssignmentStatus.ACCEPTED);

    // 6. Verify assignment history
    const historyResponse = await request(app)
      .get(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data.length).toBe(1);
    expect(historyResponse.body.data[0].status).toBe(AssignmentStatus.ACCEPTED);
  });
});
