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
import Resource from "../src/models/Resource.js";
import { createTokens } from "../src/services/authService.js";

describe("Real-Time Emergency Analytics API", () => {
  let admin: any;
  let viewer: any;
  let adminToken: string;
  let viewerToken: string;

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

    admin = await User.create({
      name: "Admin Analytics",
      email: "admin-analytics@example.com",
      password: "password123",
      role: "ADMIN",
    });

    viewer = await User.create({
      name: "Viewer Analytics",
      email: "viewer-analytics@example.com",
      password: "password123",
      role: "VIEWER",
    });

    adminToken = createTokens(admin._id.toString(), "ADMIN").accessToken;
    viewerToken = createTokens(viewer._id.toString(), "VIEWER").accessToken;

    // Seed some test data
    await Incident.create({
      title: "Flood Alert Test",
      description: "Severe flooding in downtown area requiring response.",
      severity: "HIGH",
      category: "FLOOD",
      status: "ACTIVE",
      priority: 8,
      reportedBy: admin._id,
      location: { type: "Point", coordinates: [-122.4, 37.77] },
    });

    await Resource.create({
      name: "Ambulance 101",
      type: "Ambulance",
      category: "Medical",
      status: "AVAILABLE",
      location: { type: "Point", coordinates: [-122.41, 37.78] },
    });
  });

  it("should allow ADMIN to retrieve advanced analytics summary", async () => {
    const response = await request(app)
      .get("/api/v1/analytics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.incidents.total).toBe(1);
    expect(response.body.data.resources.total).toBe(1);
    expect(response.body.data.performance).toBeDefined();
  });

  it("should forbid VIEWER from accessing advanced analytics summary", async () => {
    const response = await request(app)
      .get("/api/v1/analytics")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
