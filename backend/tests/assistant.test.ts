import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { config } from "../src/config/environment.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";

describe("Assistant API", () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    testUser = await User.create({
      name: "Admin Assistant Tester",
      email: "assistant-admin@example.test",
      password: "password123",
      role: "ADMIN",
    });
    authToken = jwt.sign(
      { id: testUser._id.toString(), role: testUser.role, email: testUser.email },
      config.jwtSecret,
      { expiresIn: "1h" }
    );
  });

  it("should reject unauthenticated chat requests with 401", async () => {
    const response = await request(app)
      .post("/api/v1/assistant/chat")
      .send({ message: "Hello assist" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject empty or missing messages with 400 validation error", async () => {
    const response = await request(app)
      .post("/api/v1/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject oversized messages (>1000 characters) with 400 validation error", async () => {
    const longMessage = "a".repeat(1005);
    const response = await request(app)
      .post("/api/v1/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: longMessage });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should successfully answer valid queries with role-aware context", async () => {
    const response = await request(app)
      .post("/api/v1/assistant/chat")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ message: "How do I use the location picker?" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.response).toBeDefined();
    expect(response.body.data.role).toBe("ADMIN");
  });
});
