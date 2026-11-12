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
import Assignment from "../src/models/Assignment.js";
import { createTokens } from "../src/services/authService.js";

/**
 * The dashboard hides actions the current role may not perform, but a hidden
 * button is not an authorization boundary. These tests exercise the API
 * directly to prove the server rejects the actions the UI does not offer.
 */
describe("Role-based authorization", () => {
  let admin: any;
  let coordinator: any;
  let responder: any;
  let viewer: any;

  let adminToken: string;
  let coordinatorToken: string;
  let responderToken: string;
  let viewerToken: string;

  let incident: any;

  const makeUser = async (
    name: string,
    email: string,
    role: "ADMIN" | "COORDINATOR" | "RESPONDER" | "VIEWER"
  ) => {
    const user = await User.create({
      name,
      email,
      password: "password123",
      role,
    });
    return {
      user,
      token: createTokens(user._id.toString(), role).accessToken,
    };
  };

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

    const a = await makeUser("Admin One", "admin@example.com", "ADMIN");
    const c = await makeUser("Coord One", "coord@example.com", "COORDINATOR");
    const r = await makeUser("Resp One", "resp@example.com", "RESPONDER");
    const v = await makeUser("View One", "viewer@example.com", "VIEWER");

    admin = a.user;
    coordinator = c.user;
    responder = r.user;
    viewer = v.user;

    adminToken = a.token;
    coordinatorToken = c.token;
    responderToken = r.token;
    viewerToken = v.token;

    incident = await Incident.create({
      title: "Fictional demo flood report",
      description:
        "FICTIONAL DEMO INCIDENT. Water is rising across the low-lying road.",
      severity: "HIGH",
      category: "FLOOD",
      status: "REPORTED",
      priority: 7,
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      reportedBy: admin._id,
      tags: ["fictional-demo-data"],
    });
  });

  describe("PUT /api/v1/incidents/:id", () => {
    it("lets a coordinator update an incident", async () => {
      const response = await request(app)
        .put(`/api/v1/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ title: "Updated flood report" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Updated flood report");
    });

    it("lets an administrator update an incident", async () => {
      const response = await request(app)
        .put(`/api/v1/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ severity: "CRITICAL" });

      expect(response.status).toBe(200);
      expect(response.body.data.severity).toBe("CRITICAL");
    });

    it("refuses a viewer", async () => {
      const response = await request(app)
        .put(`/api/v1/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ title: "Viewer rewrite" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("refuses a responder", async () => {
      const response = await request(app)
        .put(`/api/v1/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ title: "Responder rewrite" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("leaves the record untouched when it refuses", async () => {
      await request(app)
        .put(`/api/v1/incidents/${incident._id}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ title: "Viewer rewrite" });

      const stored = await Incident.findById(incident._id);
      expect(stored?.title).toBe("Fictional demo flood report");
    });
  });

  describe("Anonymous access", () => {
    // An incident record carries the reporter's name and email; a resource
    // record carries the contact details of the unit that owns it; an
    // assignment carries the responder's phone number. None of these may be
    // readable without a session.
    it("refuses an unauthenticated read of an incident", async () => {
      const response = await request(app).get(
        `/api/v1/incidents/${incident._id}`
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("refuses an unauthenticated incident list", async () => {
      const response = await request(app).get("/api/v1/incidents");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("refuses an unauthenticated resource list", async () => {
      const response = await request(app).get("/api/v1/resources");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("refuses an unauthenticated assignment list", async () => {
      const response = await request(app).get("/api/v1/assignments");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("does not leak the incident record to an anonymous caller", async () => {
      const response = await request(app).get(
        `/api/v1/incidents/${incident._id}`
      );

      expect(response.body.data).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain(
        "Fictional demo flood report"
      );
    });
  });

  describe("GET /api/v1/assignments", () => {
    let assignment: any;

    beforeEach(async () => {
      assignment = await Assignment.create({
        incidentId: incident._id,
        responderId: responder._id,
        status: "PENDING",
        notes: "Respond requested for the flood report",
      });
    });

    it("lets a coordinator see the whole dispatch list", async () => {
      const response = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data.length).toBe(1);
    });

    it("scopes a responder to their own dispatches", async () => {
      // The dispatch list exposes responder phone numbers, so a responder
      // must not see other people's dispatches.
      const other = await makeUser("Resp Two", "resp2@example.com", "RESPONDER");

      const response = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${other.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(0);
    });

    it("still shows a responder their own dispatch", async () => {
      const response = await request(app)
        .get("/api/v1/assignments")
        .set("Authorization", `Bearer ${responderToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0]._id).toBe(assignment._id.toString());
    });
  });

  describe("PUT /api/v1/assignments/:id", () => {
    let assignment: any;

    beforeEach(async () => {
      assignment = await Assignment.create({
        incidentId: incident._id,
        responderId: responder._id,
        status: "PENDING",
        notes: "Respond requested for the flood report",
      });
    });

    it("lets the assigned responder accept their own dispatch", async () => {
      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "ACCEPTED" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("ACCEPTED");
    });

    it("lets the assigned responder decline their own dispatch", async () => {
      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "DECLINED" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("DECLINED");
    });

    it("refuses a responder who is not the one dispatched", async () => {
      const other = await makeUser("Resp Two", "resp2@example.com", "RESPONDER");

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ status: "ACCEPTED" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("refuses a responder who tries to advance the dispatch themselves", async () => {
      // ACCEPTED is the only status a responder may set, and only on their
      // own pending dispatch. Moving it on is a dispatch decision.
      await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "ACCEPTED" });

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "ARRIVED" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      const stored = await Assignment.findById(assignment._id);
      expect(stored?.status).toBe("ACCEPTED");
    });

    it("refuses a viewer", async () => {
      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ status: "ACCEPTED" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("refuses a second response to the same dispatch", async () => {
      await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "ACCEPTED" });

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "DECLINED" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("lets a coordinator move the dispatch along the workflow", async () => {
      await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${responderToken}`)
        .send({ status: "ACCEPTED" });

      const response = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set("Authorization", `Bearer ${coordinatorToken}`)
        .send({ status: "DISPATCHED" });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("DISPATCHED");
    });
  });
});
