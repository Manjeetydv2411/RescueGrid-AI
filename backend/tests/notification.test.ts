import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import Notification from "../src/models/Notification.js";
import { createTokens } from "../src/services/authService.js";
import * as notificationService from "../src/services/notificationService.js";

describe("Requirement 8: Notifications and Read/Unread State", () => {
  let user: any;
  let userToken: string;

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

    user = await User.create({
      name: "Responder One",
      email: "resp1@example.com",
      password: "password123",
      role: "RESPONDER",
    });

    userToken = createTokens(user._id.toString(), "RESPONDER").accessToken;
  });

  it("should create notifications with unread state by default", async () => {
    const notification = await notificationService.createNotification({
      userId: user._id.toString(),
      type: "ASSIGNMENT",
      title: "New Mission Assignment",
      message: "You have been dispatched to Incident #102",
    });

    expect(notification.isRead).toBe(false);
    expect(notification.title).toBe("New Mission Assignment");
    expect(notification.readAt).toBeUndefined();
  });

  it("should retrieve unread notification count via REST API", async () => {
    // Create 3 notifications, mark 1 as read
    await notificationService.createNotification({
      userId: user._id.toString(),
      type: "ASSIGNMENT",
      title: "Mission 1",
      message: "Details 1",
    });

    const notif2 = await notificationService.createNotification({
      userId: user._id.toString(),
      type: "INCIDENT",
      title: "Incident Update",
      message: "Details 2",
    });

    await notificationService.markAsRead(notif2._id.toString(), user._id.toString());

    await notificationService.createNotification({
      userId: user._id.toString(),
      type: "BROADCAST",
      title: "Weather Alert",
      message: "Details 3",
    });

    const res = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBe(2);
  });

  it("should mark a single notification as read", async () => {
    const notif = await notificationService.createNotification({
      userId: user._id.toString(),
      type: "ASSIGNMENT",
      title: "Mission Alert",
      message: "High priority evacuation needed",
    });

    const res = await request(app)
      .patch(`/api/v1/notifications/${notif._id}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRead).toBe(true);
    expect(res.body.data.readAt).toBeDefined();
  });

  it("should mark all notifications as read for the user", async () => {
    await notificationService.createNotification({
      userId: user._id.toString(),
      type: "INCIDENT",
      title: "Alert A",
      message: "Message A",
    });

    await notificationService.createNotification({
      userId: user._id.toString(),
      type: "RESOURCE",
      title: "Alert B",
      message: "Message B",
    });

    const res = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modifiedCount).toBe(2);

    const countRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${userToken}`);
    expect(countRes.body.data.unreadCount).toBe(0);
  });
});
