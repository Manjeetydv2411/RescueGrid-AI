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

describe("Dynamic Evacuation Route Planning", () => {
  let coordinator: any;
  let coordinatorToken: string;

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
      name: "Coord Evac",
      email: "coord-evac@example.com",
      password: "password123",
      role: "COORDINATOR",
    });

    coordinatorToken = createTokens(
      coordinator._id.toString(),
      "COORDINATOR"
    ).accessToken;

    // Create a critical incident that generates a hazard zone and roadblock
    await Incident.create({
      title: "Major Wildfire Hazard",
      description: "Severe fire spreading across the valley requiring evacuation planning.",
      severity: "CRITICAL",
      category: "FIRE",
      status: "ACTIVE",
      priority: 10,
      location: { type: "Point", coordinates: [-122.41, 37.77] },
      reportedBy: coordinator._id,
    });
  });

  it("calculates safe evacuation routes avoiding hazard zones", async () => {
    const response = await request(app)
      .get("/api/v1/evacuation/plan")
      .query({
        originLat: 37.75,
        originLng: -122.45,
        destLat: 37.80,
        destLng: -122.38,
      })
      .set("Authorization", `Bearer ${coordinatorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.origin).toBeDefined();
    expect(response.body.data.destination).toBeDefined();
    expect(response.body.data.safeRoutes.length).toBeGreaterThan(0);
    expect(response.body.data.hazardZones.length).toBeGreaterThan(0);
    expect(response.body.data.blockedRoads.length).toBeGreaterThan(0);
  });

  it("requires authentication for evacuation plans", async () => {
    const response = await request(app)
      .get("/api/v1/evacuation/plan")
      .query({
        originLat: 37.75,
        originLng: -122.45,
        destLat: 37.80,
        destLng: -122.38,
      });

    expect(response.status).toBe(401);
  });
});
