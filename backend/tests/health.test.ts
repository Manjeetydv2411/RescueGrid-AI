import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Health Endpoint", () => {
  it("should return health status", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: "healthy",
      timestamp: expect.any(String),
      environment: expect.any(String),
    });
  });
});

describe("Readiness Endpoint", () => {
  it("should return not ready status for database check", async () => {
    const response = await request(app).get("/api/v1/ready");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: "not_ready",
      timestamp: expect.any(String),
    });
    // The readiness check shows database connection status
    expect(response.body.data.message).toBeDefined();
    expect(response.body.data.database).toBeDefined();
  });
});
