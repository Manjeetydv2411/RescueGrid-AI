import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import { createTokens } from "../src/services/authService.js";

describe("Phase 2: Emergency Broadcast API & Security", () => {
  let adminUser: any;
  let viewerUser: any;
  let adminToken: string;
  let viewerToken: string;

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

    viewerUser = await User.create({
      name: "Viewer Citizen",
      email: "viewer@example.com",
      password: "password123",
      role: "VIEWER",
    });

    adminToken = createTokens(adminUser._id.toString(), "ADMIN").accessToken;
    viewerToken = createTokens(viewerUser._id.toString(), "VIEWER").accessToken;
  });

  it("should forbid non-admin/non-coordinator users from creating broadcasts (RBAC)", async () => {
    const res = await request(app)
      .post("/api/v1/broadcasts")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        title: "Test Alert",
        message: "Test message",
        severity: "HIGH",
        channels: ["SMS"],
        scope: { targetRoles: ["VIEWER"] },
      });

    expect(res.status).toBe(403);
  });

  it("should allow admin to create emergency broadcast", async () => {
    const res = await request(app)
      .post("/api/v1/broadcasts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Severe Weather Warning",
        message: "High winds expected in sector 4.",
        severity: "CRITICAL",
        channels: ["SMS", "EMAIL"],
        scope: { targetRoles: ["VIEWER"] },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Severe Weather Warning");
    expect(res.body.data.status).toBe("COMPLETED");
  });

  it("should list broadcasts with pagination and filters", async () => {
    await request(app)
      .post("/api/v1/broadcasts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Evacuation Alert",
        message: "Mandatory evacuation.",
        severity: "CRITICAL",
        channels: ["SMS"],
        scope: { targetRoles: ["VIEWER"] },
      });

    const res = await request(app)
      .get("/api/v1/broadcasts?severity=CRITICAL")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBe(1);
    expect(res.body.data.data[0].title).toBe("Evacuation Alert");
  });
});
