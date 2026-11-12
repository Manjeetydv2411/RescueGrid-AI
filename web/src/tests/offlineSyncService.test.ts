import { describe, it, expect, beforeEach } from "vitest";
import { offlineSyncService } from "../services/offlineSyncService";

describe("OfflineSyncService", () => {
  beforeEach(async () => {
    await offlineSyncService.clearUserData();
  });

  it("should initialize and track online state", () => {
    const isOnline = offlineSyncService.getIsOnline();
    expect(typeof isOnline).toBe("boolean");
    expect(isOnline).toBe(true);
  });

  it("should queue offline actions and report pending count", async () => {
    await offlineSyncService.queueAction({
      type: "UPDATE_STATUS",
      endpoint: "/api/v1/incidents/123/status",
      method: "PATCH",
      payload: { status: "ACTIVE" },
      idempotencyKey: "test-key-1",
    });

    const count = await offlineSyncService.getPendingCount();
    expect(count).toBe(1);
  });

  it("should cache and retrieve incidents offline", async () => {
    const mockIncidents = [
      { _id: "inc-1", title: "Test Fire Incident", status: "REPORTED", severity: "HIGH" },
    ];

    await offlineSyncService.cacheIncidents(mockIncidents);
    const cached = await offlineSyncService.getCachedIncidents();

    expect(cached).toHaveLength(1);
    expect(cached[0].title).toBe("Test Fire Incident");
  });
});
