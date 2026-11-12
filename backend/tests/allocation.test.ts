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

describe("Intelligent Resource Allocation API", () => {
  let admin: any;
  let adminToken: string;
  let incident: any;
  let resource: any;

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
      name: "Admin Allocation",
      email: "admin-allocation@example.com",
      password: "password123",
      role: "ADMIN",
    });

    adminToken = createTokens(admin._id.toString(), "ADMIN").accessToken;

    incident = await Incident.create({
      title: "Medical Emergency",
      description: "Cardiac arrest in downtown requiring urgent medical assistance.",
      severity: Severity.CRITICAL,
      category: IncidentCategory.MEDICAL,
      status: "ACTIVE",
      priority: 9,
      reportedBy: admin._id,
      location: { type: "Point", coordinates: [-122.4, 37.77] },
    });

    resource = await Resource.create({
      name: "Ambulance Alpha",
      type: "AMBULANCE",
      category: "MEDICAL",
      status: ResourceStatus.AVAILABLE,
      location: { type: "Point", coordinates: [-122.41, 37.78] },
    });
  });

  it("should return resource recommendations for an incident", async () => {
    const res = await request(app)
      .get(`/api/v1/allocation/recommendations/${incident._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].resource._id).toBe(resource._id.toString());
    expect(res.body.data[0].matchScore).toBeGreaterThan(50);
  });

  it("should successfully allocate resource to incident", async () => {
    const res = await request(app)
      .post("/api/v1/allocation/allocate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        incidentId: incident._id,
        resourceId: resource._id,
        notes: "Dispatching Ambulance Alpha immediately",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resourceId).toBe(resource._id.toString());
  });

  it("should successfully deallocate resource", async () => {
    // First allocate
    await request(app)
      .post("/api/v1/allocation/allocate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        incidentId: incident._id,
        resourceId: resource._id,
      });

    // Now deallocate
    const res = await request(app)
      .post(`/api/v1/allocation/deallocate/${resource._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(ResourceStatus.AVAILABLE);
  });
});
