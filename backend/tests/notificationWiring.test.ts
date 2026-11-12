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
import Notification from "../src/models/Notification.js";
import { createTokens } from "../src/services/authService.js";

/**
 * Notifications used to exist only as seeded rows: no service created one at
 * runtime, so the Notifications screen and the header's unread badge could
 * only ever show the demo data. These tests pin the operational wiring — a
 * report reaches the coordinators, a dispatch reaches the responder, and a
 * responder's answer reaches the coordinators.
 */
describe("Runtime notification wiring", () => {
  let admin: any;
  let coordinator: any;
  let responder: any;
  let otherResponder: any;

  let adminToken: string;
  let coordinatorToken: string;
  let responderToken: string;

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
    const r2 = await makeUser("Resp Two", "resp2@example.com", "RESPONDER");

    admin = a.user;
    coordinator = c.user;
    responder = r.user;
    otherResponder = r2.user;

    adminToken = a.token;
    coordinatorToken = c.token;
    responderToken = r.token;

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

  it("notifies the coordinators when an incident is reported", async () => {
    await request(app)
      .post("/api/v1/incidents")
      .set("Authorization", `Bearer ${responderToken}`)
      .send({
        title: "Fictional demo gas leak",
        description:
          "FICTIONAL DEMO INCIDENT. A strong smell of gas near the depot.",
        severity: "HIGH",
        category: "OTHER",
        location: { type: "Point", coordinates: [-122.4, 37.77] },
        contactPhone: "+15551234567",
      });

    // The reporter is a responder, so the coordinators are the recipients.
    const coordinatorNotifications = await Notification.find({
      userId: coordinator._id,
    });
    expect(coordinatorNotifications).toHaveLength(1);
    expect(coordinatorNotifications[0].type).toBe("INCIDENT");
    expect(coordinatorNotifications[0].isRead).toBe(false);

    const adminNotifications = await Notification.find({ userId: admin._id });
    expect(adminNotifications).toHaveLength(1);
  });

  it("does not notify the reporter about their own report", async () => {
    await request(app)
      .post("/api/v1/incidents")
      .set("Authorization", `Bearer ${responderToken}`)
      .send({
        title: "Fictional demo gas leak",
        description:
          "FICTIONAL DEMO INCIDENT. A strong smell of gas near the depot.",
        severity: "HIGH",
        category: "OTHER",
        location: { type: "Point", coordinates: [-122.4, 37.77] },
        contactPhone: "+15551234567",
      });

    const responderNotifications = await Notification.find({
      userId: responder._id,
    });
    expect(responderNotifications).toHaveLength(0);
  });

  it("notifies the responder when they are dispatched", async () => {
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString(), notes: "Bring the pump" });

    const responderNotifications = await Notification.find({
      userId: responder._id,
    });
    expect(responderNotifications).toHaveLength(1);
    expect(responderNotifications[0].type).toBe("ASSIGNMENT");
    expect(responderNotifications[0].relatedId?.toString()).toBe(
      incident._id.toString()
    );
  });

  it("notifies the coordinators when the responder accepts the dispatch", async () => {
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString() });

    await Notification.deleteMany({});

    await request(app)
      .put(`/api/v1/assignments/${(await Assignment.findOne({ incidentId: incident._id }))._id}`)
      .set("Authorization", `Bearer ${responderToken}`)
      .send({ status: "ACCEPTED" });

    const coordinatorNotifications = await Notification.find({
      userId: coordinator._id,
    });
    expect(coordinatorNotifications).toHaveLength(1);
    expect(coordinatorNotifications[0].type).toBe("ASSIGNMENT");
    expect(coordinatorNotifications[0].message).toContain("Resp One");
  });

  it("notifies the responder when a coordinator advances the dispatch", async () => {
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString() });

    await Notification.deleteMany({});

    const assignment = await Assignment.findOne({ incidentId: incident._id });
    await request(app)
      .put(`/api/v1/assignments/${assignment._id}`)
      .set("Authorization", `Bearer ${responderToken}`)
      .send({ status: "ACCEPTED" });

    await Notification.deleteMany({});

    await request(app)
      .put(`/api/v1/assignments/${assignment._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ status: "DISPATCHED" });

    const responderNotifications = await Notification.find({
      userId: responder._id,
    });
    expect(responderNotifications).toHaveLength(1);
    expect(responderNotifications[0].message).toContain("dispatched");
  });

  it("does not notify the actor about their own action", async () => {
    // The coordinator dispatched the responder; telling the coordinator about
    // their own dispatch would be noise.
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString() });

    const coordinatorNotifications = await Notification.find({
      userId: coordinator._id,
    });
    expect(coordinatorNotifications).toHaveLength(0);
  });

  it("surfaces the notification to the recipient through the API", async () => {
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString() });

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${responderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].type).toBe("ASSIGNMENT");
    expect(res.body.data.pagination.unreadCount).toBe(1);
  });

  it("does not expose another user's notifications", async () => {
    await request(app)
      .post(`/api/v1/assignments/incidents/${incident._id}`)
      .set("Authorization", `Bearer ${coordinatorToken}`)
      .send({ responderId: responder._id.toString() });

    const otherToken = createTokens(
      otherResponder._id.toString(),
      "RESPONDER"
    ).accessToken;

    const res = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
  });
});
