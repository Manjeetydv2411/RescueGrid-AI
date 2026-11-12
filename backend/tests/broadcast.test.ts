import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import Broadcast from "../src/models/Broadcast.js";
import BroadcastDelivery from "../src/models/BroadcastDelivery.js";
import * as broadcastService from "../src/services/broadcast/broadcastService.js";

describe("Phase 1: Multi-Channel Emergency Broadcast Models and Service Architecture", () => {
  let adminUser: any;
  let responderUser: any;

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

    responderUser = await User.create({
      name: "Responder Unit 1",
      email: "responder1@example.com",
      password: "password123",
      role: "RESPONDER",
      phone: "+15550199",
    });
  });

  it("should create broadcast and record simulated deliveries across multiple channels", async () => {
    const broadcast = await broadcastService.createBroadcast({
      title: "URGENT: Flash Flood Warning",
      message: "Evacuate sector 7 immediately.",
      severity: "CRITICAL",
      channels: ["SMS", "EMAIL", "PUSH", "IN_APP"],
      scope: {
        targetRoles: ["RESPONDER"],
      },
      senderId: adminUser._id.toString(),
    });

    expect(broadcast).toBeDefined();
    expect(broadcast.title).toBe("URGENT: Flash Flood Warning");
    expect(broadcast.status).toBe("COMPLETED");
    expect(broadcast.totalRecipients).toBe(4);
    expect(broadcast.simulatedDeliveries).toBe(3);
    expect(broadcast.successfulDeliveries).toBe(4);

    const deliveries = await BroadcastDelivery.find({ broadcastId: broadcast._id });
    expect(deliveries.length).toBe(4);

    const smsDelivery = deliveries.find((d) => d.channel === "SMS");
    expect(smsDelivery?.status).toBe("SIMULATED");
    expect(smsDelivery?.recipientAddress).toBe("+15550199");

    const inAppDelivery = deliveries.find((d) => d.channel === "IN_APP");
    expect(inAppDelivery?.status).toBe("DELIVERED");
  });

  it("should support idempotency via idempotencyKey", async () => {
    const key = "flood-alert-2026-10-31-001";

    const first = await broadcastService.createBroadcast({
      title: "Flash Flood Warning",
      message: "Evacuate now.",
      severity: "HIGH",
      channels: ["SMS"],
      scope: { targetRoles: ["RESPONDER"] },
      senderId: adminUser._id.toString(),
      idempotencyKey: key,
    });

    const second = await broadcastService.createBroadcast({
      title: "Flash Flood Warning",
      message: "Evacuate now.",
      severity: "HIGH",
      channels: ["SMS"],
      scope: { targetRoles: ["RESPONDER"] },
      senderId: adminUser._id.toString(),
      idempotencyKey: key,
    });

    expect(first._id.toString()).toBe(second._id.toString());
  });
});
