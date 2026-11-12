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
import { ResourceStatus, IncidentCategory, Severity } from "../src/types/models.js";

describe("Intelligent Resource Allocation Comprehensive Tests", () => {
  let admin: any;
  let adminToken: string;
  let incident: any;
  let resource1: any;
  let resource2: any;

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
      name: "Admin Comprehensive",
      email: "admin-comprehensive@example.com",
      password: "password123",
      role: "ADMIN",
    });

    adminToken = createTokens(admin._id.toString(), "ADMIN").accessToken;

    incident = await Incident.create({
      title: "Major Earthquake",
      description: "Structural collapse and medical emergency in sector 4 requiring response.",
      severity: Severity.CRITICAL,
      category: IncidentCategory.MEDICAL,
      status: "ACTIVE",
      priority: 10,
      reportedBy: admin._id,
      location: { type: "Point", coordinates: [-122.4, 37.77] },
    });

    resource1 = await Resource.create({
      name: "Paramedic Unit 1",
      type: "AMBULANCE",
      category: "MEDICAL",
      status: ResourceStatus.AVAILABLE,
      location: { type: "Point", coordinates: [-122.401, 37.771] },
      capacity: 4,
    });

    resource2 = await Resource.create({
      name: "Fire Truck 4",
      type: "FIRE_UNIT",
      category: "FIRE",
      status: ResourceStatus.AVAILABLE,
      location: { type: "Point", coordinates: [-122.5, 37.8] },
      capacity: 6,
    });
  });

  it("should rank resource recommendations accurately based on distance and category", async () => {
    const res = await request(app)
      .get(`/api/v1/allocation/recommendations/${incident._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    // Resource 1 matches category MEDICAL and is closer, so it should rank higher than Resource 2
    expect(res.body.data[0].resource._id).toBe(resource1._id.toString());
    expect(res.body.data[0].matchScore).toBeGreaterThan(res.body.data[1].matchScore);
  });

  it("should prevent double allocation of busy resources", async () => {
    // First allocation
    const res1 = await request(app)
      .post("/api/v1/allocation/allocate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        incidentId: incident._id,
        resourceId: resource1._id,
      });

    expect(res1.status).toBe(201);

    // Attempt second allocation of same resource
    const res2 = await request(app)
      .post("/api/v1/allocation/allocate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        incidentId: incident._id,
        resourceId: resource1._id,
      });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });
});
