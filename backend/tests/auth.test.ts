import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User, { hashUserPassword } from "../src/models/User.js";
import { createTokens } from "../src/services/authService.js";

// Mock JWT verification
const createTestToken = (userId: string, role: string) => {
  return createTokens(userId, role).accessToken;
};

describe("Authentication System", () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user with VIEWER role by default", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "register@example.com",
          password: "password123",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe("Test User");
      expect(response.body.data.email).toBe("register@example.com");
      expect(response.body.data.role).toBe("VIEWER");
    });

    it("should reject registration with invalid email format", async () => {
      // A malformed request body is the caller's mistake: 400, not 500.
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "invalid-email",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject registration with short password", async () => {
      // A malformed request body is the caller's mistake: 400, not 500.
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "short@example.com",
          password: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject duplicate email registration", async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "First User",
          email: "duplicate@example.com",
          password: "password123",
        });

      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Second User",
          email: "duplicate@example.com",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject attempts to self-assign privileged roles", async () => {
      // A malformed request body is the caller's mistake: 400, not 500.
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Admin User",
          email: "admin@example.com",
          password: "password123",
          role: "ADMIN",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Administrator provisioning and management", () => {
    it("allows an admin to create coordinator and responder accounts", async () => {
      const admin = await User.create({
        name: "Admin User",
        email: "provisioner@example.com",
        password: "password123",
        role: "ADMIN",
      });
      const token = createTestToken(admin._id.toString(), admin.role);

      for (const [role, email] of [["COORDINATOR", "coord-created@example.com"], ["RESPONDER", "resp-created@example.com"]] as const) {
        const response = await request(app)
          .post("/api/v1/admin/users")
          .set("Authorization", `Bearer ${token}`)
          .send({
            name: `${role} User`,
            email,
            password: "a-strong-password-long",
            role,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.role).toBe(role);
        expect(response.body.data.password).toBeUndefined();
      }
    });

    it("rejects account creation by a coordinator", async () => {
      const coordinator = await User.create({
        name: "Coordinator User",
        email: "coord-provisioner@example.com",
        password: "password123",
        role: "COORDINATOR",
      });
      const token = createTestToken(coordinator._id.toString(), coordinator.role);

      const response = await request(app)
        .post("/api/v1/admin/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Attempted Admin",
          email: "attempted-admin@example.com",
          password: "a-strong-password-long",
          role: "ADMIN",
        });

      expect(response.status).toBe(403);
    });

    it("allows each provisioned role to sign in through the same login endpoint", async () => {
      await User.create({
        name: "Admin User",
        email: "login-admin@example.com",
        password: await hashUserPassword("admin-password-long"),
        role: "ADMIN",
      });
      await User.create({
        name: "Coordinator User",
        email: "login-coordinator@example.com",
        password: await hashUserPassword("coordinator-password-long"),
        role: "COORDINATOR",
      });
      await User.create({
        name: "Responder User",
        email: "login-responder@example.com",
        password: await hashUserPassword("responder-password-long"),
        role: "RESPONDER",
      });

      for (const [email, password, role] of [
        ["login-admin@example.com", "admin-password-long", "ADMIN"],
        ["login-coordinator@example.com", "coordinator-password-long", "COORDINATOR"],
        ["login-responder@example.com", "responder-password-long", "RESPONDER"],
      ] as const) {
        const response = await request(app)
          .post("/api/v1/auth/login")
          .send({ email, password });

        expect(response.status).toBe(200);
        expect(response.body.data.user.role).toBe(role);
      }

    });

    it("does not allow public registration to choose a privileged role", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Public Admin",
          email: "public-admin@example.com",
          password: "password123",
          role: "ADMIN",
        });

      expect(response.status).toBe(400);
      expect(await User.findOne({ email: "public-admin@example.com" })).toBeNull();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials", async () => {
      // First register a user
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "login@example.com",
          password: "password123",
        });

      // Then login
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@example.com",
          password: "password123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("login@example.com");
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it("should reject login with invalid credentials", async () => {
      // Valid email format but user doesn't exist - generic error
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "password123",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject login with wrong password", async () => {
      // First register a user
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "password@example.com",
          password: "password123",
        });

      // Then try wrong password
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "password@example.com",
          password: "wrongpassword",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return user info with valid token", async () => {
      const user = await User.create({
        name: "Token User",
        email: "token@example.com",
        password: "password123",
        role: "VIEWER",
      });

      const token = createTestToken(user._id.toString(), user.role);

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(user._id.toString());
      expect(response.body.data.role).toBe(user.role);
    });

    it("should reject request with no token", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject request with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should return success for logout", async () => {
      const user = await User.create({
        name: "Logout User",
        email: "logout@example.com",
        password: "password123",
        role: "VIEWER",
      });

      const token = createTestToken(user._id.toString(), user.role);

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should exchange a refresh token for a new token pair", async () => {
      const user = await User.create({
        name: "Refresh User",
        email: "refresh@example.com",
        password: "password123",
        role: "COORDINATOR",
      });

      const { refreshToken } = createTokens(user._id.toString(), user.role);

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.role).toBe("COORDINATOR");
    });

    it("should reject a refresh request with no token", async () => {
      const response = await request(app).post("/api/v1/auth/refresh").send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should reject an access token presented as a refresh token", async () => {
      const user = await User.create({
        name: "Access Token User",
        email: "accesstoken@example.com",
        password: "password123",
        role: "VIEWER",
      });

      const { accessToken } = createTokens(user._id.toString(), user.role);

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: accessToken });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Refresh token isolation", () => {
    it("should not accept a refresh token as an API session credential", async () => {
      const user = await User.create({
        name: "Isolation User",
        email: "isolation@example.com",
        password: "password123",
        role: "VIEWER",
      });

      const { refreshToken } = createTokens(user._id.toString(), user.role);

      // A refresh token carries no role claim, so accepting it as a bearer
      // credential would let it stand in for a full session.
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${refreshToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Role-based Authorization", () => {
    it("should allow ADMIN to access protected routes", async () => {
      const admin = await User.create({
        name: "Admin User",
        email: "admin@example.com",
        password: "password123",
        role: "ADMIN",
      });

      const token = createTestToken(admin._id.toString(), "ADMIN");

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe("ADMIN");
    });

    it("should allow VIEWER to access protected routes", async () => {
      const viewer = await User.create({
        name: "Viewer User",
        email: "viewer@example.com",
        password: "password123",
        role: "VIEWER",
      });

      const token = createTestToken(viewer._id.toString(), "VIEWER");

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe("VIEWER");
    });

    it("should refuse a non-ADMIN on an ADMIN-only route with 403, not 401", async () => {
      // A 401 here would tell the client to refresh its session, which cannot
      // help: the caller is authenticated, just not permitted.
      const coordinator = await User.create({
        name: "Coord User",
        email: "coord-forbidden@example.com",
        password: "password123",
        role: "COORDINATOR",
      });

      const token = createTestToken(coordinator._id.toString(), "COORDINATOR");

      const response = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
