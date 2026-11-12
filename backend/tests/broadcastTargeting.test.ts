import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import Incident from "../src/models/Incident.js";
import BroadcastDelivery from "../src/models/BroadcastDelivery.js";
import { createTokens } from "../src/services/authService.js";
import * as broadcastService from "../src/services/broadcast/broadcastService.js";

describe("Phase 1: Location-Based Broadcast Targeting & Preview", () => {
  let adminUser: any;
  let responderNearby: any;
  let responderFar: any;
  let responderNoLocation: any;
  let adminToken: string;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();

    adminUser = await User.create({
      name: "Admin Commander",
      email: "admin@example.com",
      password: "password123",
      role: "ADMIN",
    });

    responderNearby = await User.create({
      name: "Responder Near SF",
      email: "near@example.com",
      password: "password123",
      role: "RESPONDER",
      phone: "+15550101",
      location: {
        type: "Point",
        coordinates: [-122.4194, 37.7749], // San Francisco
      },
    });

    responderFar = await User.create({
      name: "Responder Far LA",
      email: "far@example.com",
      password: "password123",
      role: "RESPONDER",
      phone: "+15550102",
      location: {
        type: "Point",
        coordinates: [-118.2437, 34.0522], // Los Angeles (~560km away)
      },
    });

    responderNoLocation = await User.create({
      name: "Responder No Loc",
      email: "noloc@example.com",
      password: "password123",
      role: "RESPONDER",
      phone: "+15550103",
    });

    adminToken = createTokens(adminUser._id.toString(), "ADMIN").accessToken;
  });

  it("should calculate distance correctly using Haversine formula", () => {
    const dist = broadcastService.calculateDistanceKm(37.7749, -122.4194, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(600);
  });

  it("should target users within RADIUS and exclude users outside radius or with no location", async () => {
    const recipients = await broadcastService.resolveEligibleRecipients({
      targetingMode: "RADIUS",
      center: [-122.4194, 37.7749], // SF
      radiusKm: 50,
      targetRoles: ["RESPONDER"],
    });

    expect(recipients.length).toBe(1);
    expect(recipients[0]._id.toString()).toBe(responderNearby._id.toString());
  });

  it("should target users based on INCIDENT_LOCATION", async () => {
    const incident = await Incident.create({
      title: "SF Downtown Incident",
      description: "Emergency at Market Street",
      severity: "HIGH",
      category: "MEDICAL",
      location: {
        type: "Point",
        coordinates: [-122.4194, 37.7749],
      },
      reportedBy: adminUser._id,
    });

    const recipients = await broadcastService.resolveEligibleRecipients({
      targetingMode: "INCIDENT_LOCATION",
      incidentId: incident._id.toString(),
      radiusKm: 20,
      targetRoles: ["RESPONDER"],
    });

    expect(recipients.length).toBe(1);
    expect(recipients[0]._id.toString()).toBe(responderNearby._id.toString());
  });

  it("should preview broadcast recipient count without sending notifications", async () => {
    const res = await request(app)
      .post("/api/v1/broadcasts/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Preview Alert",
        message: "Testing preview endpoint",
        severity: "HIGH",
        channels: ["SMS"],
        scope: {
          targetingMode: "RADIUS",
          center: [-122.4194, 37.7749],
          radiusKm: 50,
          targetRoles: ["RESPONDER"],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRecipients).toBe(1);
    expect(res.body.data.byRole.RESPONDER).toBe(1);

    const deliveries = await BroadcastDelivery.find({});
    expect(deliveries.length).toBe(0);
  });
});
