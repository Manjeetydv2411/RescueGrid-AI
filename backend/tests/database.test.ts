import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectDatabase, disconnectDatabase, clearDatabase, isDatabaseConnected } from "../src/config/database.js";
import User, { IUserDocument } from "../src/models/User.js";
import Incident, { IIncidentDocument } from "../src/models/Incident.js";
import Resource, { IResourceDocument } from "../src/models/Resource.js";
import Assignment, { IAssignmentDocument } from "../src/models/Assignment.js";
import AuditLog, { IAuditLogDocument } from "../src/models/AuditLog.js";

describe("Database Connection", () => {
  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("should be connected to database", () => {
    expect(isDatabaseConnected()).toBe(true);
  });

  it("should clear the database", async () => {
    await clearDatabase();
    expect(true).toBe(true);
  });
});

describe("User Model", () => {
  let user: IUserDocument;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("should create a valid user", async () => {
    user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      role: "VIEWER",
    });

    expect(user._id).toBeDefined();
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
    expect(user.role).toBe("VIEWER");
    expect(user.isAvailable).toBe(true);
  });

  it("should require unique email", async () => {
    await User.create({
      name: "Another User",
      email: "unique@example.com",
      password: "password123",
      role: "VIEWER",
    });

    await expect(
      User.create({
        name: "Duplicate User",
        email: "unique@example.com",
        password: "password123",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("should validate email format", async () => {
    await expect(
      User.create({
        name: "Invalid Email User",
        email: "invalid-email",
        password: "password123",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("should require minimum password length", async () => {
    await expect(
      User.create({
        name: "Short Password User",
        email: "short@example.com",
        password: "short",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("should support all valid roles", async () => {
    const roles = ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"];
    for (const role of roles) {
      const user = await User.create({
        name: `${role} User`,
        email: `${role.toLowerCase()}@example.com`,
        password: "password123",
        role,
      });
      expect(user.role).toBe(role);
    }
  });

  it("should have timestamps", async () => {
    user = await User.create({
      name: "Timestamp User",
      email: "timestamp@example.com",
      password: "password123",
      role: "VIEWER",
    });

    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });
});

describe("Incident Model", () => {
  let user: IUserDocument;
  let incident: IIncidentDocument;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    user = await User.create({
      name: "Test User",
      email: "incident@example.com",
      password: "password123",
      role: "VIEWER",
    });
  });

  it("should create a valid incident", async () => {
    incident = await Incident.create({
      title: "Test Incident",
      description: "This is a test incident for database testing purposes.",
      severity: "LOW",
      category: "FLOOD",
      status: "REPORTED",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
      reportedBy: user._id,
    });

    expect(incident._id).toBeDefined();
    expect(incident.title).toBe("Test Incident");
    expect(incident.severity).toBe("LOW");
    expect(incident.category).toBe("FLOOD");
    expect(incident.status).toBe("REPORTED");
    expect(incident.location.type).toBe("Point");
    expect(Array.isArray(incident.location.coordinates)).toBe(true);
  });

  it("should require minimum title length", async () => {
    await expect(
      Incident.create({
        title: "Ab",
        description: "This is a test incident description.",
        severity: "LOW",
        category: "FIRE",
        status: "REPORTED",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        reportedBy: user._id,
      })
    ).rejects.toThrow();
  });

  it("should require minimum description length", async () => {
    await expect(
      Incident.create({
        title: "Valid Title",
        description: "Short",
        severity: "LOW",
        category: "EARTHQUAKE",
        status: "REPORTED",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        reportedBy: user._id,
      })
    ).rejects.toThrow();
  });

  it("should support all valid severity levels", async () => {
    const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    for (const severity of severities) {
      const incident = await Incident.create({
        title: `${severity} Incident`,
        description: "Test incident description.",
        severity,
        category: "LANDSLIDE",
        status: "REPORTED",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        reportedBy: user._id,
      });
      expect(incident.severity).toBe(severity);
    }
  });

  it("should support all valid status values", async () => {
    const statuses = ["REPORTED", "VERIFIED", "ACTIVE", "RESOLVED", "CLOSED"];
    for (const status of statuses) {
      const incident = await Incident.create({
        title: `${status} Incident`,
        description: "Test incident description.",
        severity: "LOW",
        category: "MEDICAL",
        status,
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        reportedBy: user._id,
      });
      expect(incident.status).toBe(status);
    }
  });

  it("should support all valid categories", async () => {
    const categories = ["FLOOD", "FIRE", "EARTHQUAKE", "LANDSLIDE", "MEDICAL", "OTHER"];
    for (const category of categories) {
      const incident = await Incident.create({
        title: `${category} Incident`,
        description: "Test incident description.",
        severity: "LOW",
        category,
        status: "REPORTED",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        reportedBy: user._id,
      });
      expect(incident.category).toBe(category);
    }
  });
});

describe("Resource Model", () => {
  let resource: IResourceDocument;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it("should create a valid resource", async () => {
    resource = await Resource.create({
      name: "Test Resource",
      type: "Vehicle",
      category: "Transportation",
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });

    expect(resource._id).toBeDefined();
    expect(resource.name).toBe("Test Resource");
    expect(resource.status).toBe("AVAILABLE");
  });

  it("should support all valid resource statuses", async () => {
    const statuses = ["AVAILABLE", "ON_MISSION", "MAINTENANCE", "UNAVAILABLE"];
    for (const status of statuses) {
      const resource = await Resource.create({
        name: `${status} Resource`,
        type: "Vehicle",
        category: "Transportation",
        status,
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
      });
      expect(resource.status).toBe(status);
    }
  });

  it("should have timestamps", async () => {
    resource = await Resource.create({
      name: "Timestamp Resource",
      type: "Vehicle",
      category: "Transportation",
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });

    expect(resource.createdAt).toBeDefined();
    expect(resource.updatedAt).toBeDefined();
  });
});

describe("Assignment Model", () => {
  let user: IUserDocument;
  let resource: IResourceDocument;
  let incident: IIncidentDocument;
  let assignment: IAssignmentDocument;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    user = await User.create({
      name: "Test User",
      email: "assignment@example.com",
      password: "password123",
      role: "RESPONDER",
    });
    resource = await Resource.create({
      name: "Test Resource",
      type: "Vehicle",
      category: "Transportation",
      status: "AVAILABLE",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
    });
    incident = await Incident.create({
      title: "Test Incident",
      description: "Test incident description.",
      severity: "LOW",
      category: "FLOOD",
      status: "REPORTED",
      location: {
        type: "Point",
        coordinates: [0, 0],
      },
      reportedBy: user._id,
    });
  });

  it("should create a valid assignment", async () => {
    assignment = await Assignment.create({
      incidentId: incident._id,
      responderId: user._id,
      resourceId: resource._id,
      status: "PENDING",
    });

    expect(assignment._id).toBeDefined();
    expect(assignment.incidentId.toString()).toBe(incident._id.toString());
    expect(assignment.responderId.toString()).toBe(user._id.toString());
  });

  it("should support all valid assignment statuses", async () => {
    const statuses = ["PENDING", "ACCEPTED", "DECLINED", "COMPLETED", "CANCELLED"];
    for (const status of statuses) {
      const assignment = await Assignment.create({
        incidentId: incident._id,
        responderId: user._id,
        status,
      });
      expect(assignment.status).toBe(status);
    }
  });

  it("should have timestamps", async () => {
    assignment = await Assignment.create({
      incidentId: incident._id,
      responderId: user._id,
      status: "PENDING",
    });

    expect(assignment.createdAt).toBeDefined();
    expect(assignment.updatedAt).toBeDefined();
  });
});

describe("AuditLog Model", () => {
  let user: IUserDocument;
  let auditLog: IAuditLogDocument;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    user = await User.create({
      name: "Test User",
      email: "audit@example.com",
      password: "password123",
      role: "ADMIN",
    });
  });

  it("should create a valid audit log", async () => {
    auditLog = await AuditLog.create({
      action: "USER_CREATED",
      entity: "User",
      entityId: user._id.toString(),
      actorId: user._id,
      actorRole: "ADMIN",
      details: { newName: "New User" },
    });

    expect(auditLog._id).toBeDefined();
    expect(auditLog.action).toBe("USER_CREATED");
    expect(auditLog.entity).toBe("User");
  });

  it("should support all valid roles for actor", async () => {
    const roles = ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"];
    for (const role of roles) {
      const auditLog = await AuditLog.create({
        action: "TEST_ACTION",
        entity: "Test",
        entityId: "test-id",
        actorId: user._id,
        actorRole: role,
      });
      expect(auditLog.actorRole).toBe(role);
    }
  });

  it("should have timestamps", async () => {
    auditLog = await AuditLog.create({
      action: "TEST_ACTION",
      entity: "Test",
      entityId: "test-id",
      actorId: user._id,
      actorRole: "ADMIN",
    });

    expect(auditLog.createdAt).toBeDefined();
  });
});
