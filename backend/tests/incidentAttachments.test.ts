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
import { storageProvider } from "../src/services/storageService.js";

describe("Incident Attachments & Access Control", () => {
  let admin: any;
  let coordinator: any;
  let viewer: any;
  let closedViewer: any;

  let adminToken: string;
  let coordinatorToken: string;
  let viewerToken: string;
  let closedViewerToken: string;

  let incident: any;
  let closedIncident: any;
  let attachmentId: string;
  let storedKey: string;

  const makeUser = async (
    name: string,
    email: string,
    role: "ADMIN" | "COORDINATOR" | "RESPONDER" | "VIEWER"
  ) => {
    const user = await User.create({
      name,
      email,
      password: "password123",
      role,
    });
    return {
      user,
      token: createTokens(user._id.toString(), role).accessToken,
    };
  };

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

    const a = await makeUser("Admin User", "admin@example.com", "ADMIN");
    const c = await makeUser("Coord User", "coord@example.com", "COORDINATOR");
    const v = await makeUser("Viewer User", "viewer@example.com", "VIEWER");
    const cv = await makeUser("Closed Viewer", "closedviewer@example.com", "VIEWER");

    admin = a.user;
    coordinator = c.user;
    viewer = v.user;
    closedViewer = cv.user;

    adminToken = a.token;
    coordinatorToken = c.token;
    viewerToken = v.token;
    closedViewerToken = cv.token;

    // Save a dummy file via storageProvider
    const dummyBuffer = Buffer.from("fake-image-bytes-jpeg");
    const stored = await storageProvider.save(
      dummyBuffer,
      "test-evidence.jpg",
      "image/jpeg"
    );
    storedKey = stored.storageKey;

    incident = await Incident.create({
      title: "Active Incident with Attachment",
      description: "Description long enough for validation rules.",
      severity: "HIGH",
      category: "FLOOD",
      status: "REPORTED",
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      reportedBy: admin._id,
      contactPhone: "+15551234567",
      attachments: [
        {
          type: "IMAGE",
          originalName: "test-evidence.jpg",
          mimeType: "image/jpeg",
          size: dummyBuffer.length,
          storageKey: storedKey,
          createdAt: new Date(),
        },
      ],
    });

    attachmentId = incident.attachments[0]._id.toString();

    closedIncident = await Incident.create({
      title: "Closed Incident with Attachment",
      description: "Description long enough for validation rules.",
      severity: "LOW",
      category: "FIRE",
      status: "CLOSED",
      location: { type: "Point", coordinates: [-122.4194, 37.7749] },
      reportedBy: admin._id,
      contactPhone: "+15551234567",
      attachments: [
        {
          type: "IMAGE",
          originalName: "closed-evidence.jpg",
          mimeType: "image/jpeg",
          size: dummyBuffer.length,
          storageKey: storedKey,
          createdAt: new Date(),
        },
      ],
    });
  });

  describe("GET /api/v1/incidents/:id/attachments/:attachmentId", () => {
    it("allows an authorized viewer to download an attachment on an active incident", async () => {
      const response = await request(app)
        .get(`/api/v1/incidents/${incident._id}/attachments/${attachmentId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("image/jpeg");
      expect(response.body.toString()).toBe("fake-image-bytes-jpeg");
    });

    it("allows an admin or coordinator to download an attachment on any incident including closed ones", async () => {
      const closedAttachmentId = closedIncident.attachments[0]._id.toString();
      const response = await request(app)
        .get(`/api/v1/incidents/${closedIncident._id}/attachments/${closedAttachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("image/jpeg");
    });

    it("refuses an unauthorized viewer from downloading an attachment on a closed incident", async () => {
      const closedAttachmentId = closedIncident.attachments[0]._id.toString();
      const response = await request(app)
        .get(`/api/v1/incidents/${closedIncident._id}/attachments/${closedAttachmentId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the incident does not exist", async () => {
      const fakeId = "60c72b2f9b1d8b2f9b1d8b2f";
      const response = await request(app)
        .get(`/api/v1/incidents/${fakeId}/attachments/${attachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 when the attachment ID does not exist on the incident", async () => {
      const fakeAttachmentId = "60c72b2f9b1d8b2f9b1d8b2f";
      const response = await request(app)
        .get(`/api/v1/incidents/${incident._id}/attachments/${fakeAttachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("prevents path traversal via malicious storage keys", async () => {
      // Tamper storageKey in DB to attempt path traversal
      await Incident.updateOne(
        { _id: incident._id, "attachments._id": incident.attachments[0]._id },
        { $set: { "attachments.$.storageKey": "../../../etc/passwd" } }
      );

      const response = await request(app)
        .get(`/api/v1/incidents/${incident._id}/attachments/${attachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(500); // Or handled error due to path traversal security check
    });
  });
});
