import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import app from "../src/app.js";
import { initSocketIO } from "../src/socket/index.js";
import { SOCKET_EVENTS } from "../src/socket/events.js";
import { connectDatabase, disconnectDatabase, clearDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import Incident from "../src/models/Incident.js";
import Resource from "../src/models/Resource.js";
import Assignment from "../src/models/Assignment.js";
import Notification from "../src/models/Notification.js";
import { createTokens } from "../src/services/authService.js";
import * as incidentService from "../src/services/incidentService.js";
import * as resourceService from "../src/services/resourceService.js";
import * as assignmentService from "../src/services/assignmentService.js";
import * as notificationService from "../src/services/notificationService.js";
import { Severity, IncidentCategory, IncidentStatus, ResourceStatus, ResourceType, AssignmentStatus } from "../src/types/models.js";

describe("Phase 6: Real-time Incident Coordination with Socket.IO", () => {
  let server: http.Server;
  let port: number;
  let adminToken: string;
  let coordinatorToken: string;
  let responderToken: string;
  let viewerToken: string;
  let adminUser: any;
  let coordinatorUser: any;
  let responderUser: any;
  let viewerUser: any;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid_test";
    await connectDatabase();

    // Start a dedicated HTTP server for socket tests
    server = http.createServer(app);
    initSocketIO(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create users for each role
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: "password123",
      role: "ADMIN",
    });

    coordinatorUser = await User.create({
      name: "Coordinator User",
      email: "coord@example.com",
      password: "password123",
      role: "COORDINATOR",
    });

    responderUser = await User.create({
      name: "Responder User",
      email: "responder@example.com",
      password: "password123",
      role: "RESPONDER",
    });

    viewerUser = await User.create({
      name: "Viewer User",
      email: "viewer@example.com",
      password: "password123",
      role: "VIEWER",
    });

    adminToken = createTokens(adminUser._id.toString(), "ADMIN").accessToken;
    coordinatorToken = createTokens(coordinatorUser._id.toString(), "COORDINATOR").accessToken;
    responderToken = createTokens(responderUser._id.toString(), "RESPONDER").accessToken;
    viewerToken = createTokens(viewerUser._id.toString(), "VIEWER").accessToken;
  });

  const createClient = (token?: string): ClientSocket => {
    return Client(`http://localhost:${port}`, {
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      transports: ["websocket"],
      reconnection: false,
    });
  };

  describe("Requirement 1: Authenticate socket connections", () => {
    it("should allow connection with a valid JWT in handshake authorization header", async () => {
      const client = createClient(adminToken);

      await new Promise<void>((resolve, reject) => {
        client.on("connect", () => {
          expect(client.connected).toBe(true);
          client.disconnect();
          resolve();
        });
        client.on("connect_error", (err) => reject(err));
      });
    });

    it("should reject connection when no authorization token is provided", async () => {
      const client = createClient(); // No token

      await new Promise<void>((resolve) => {
        client.on("connect_error", (err) => {
          expect(err.message).toContain("Authentication error: No token provided");
          client.disconnect();
          resolve();
        });
      });
    });

    it("should reject connection with invalid or malformed token", async () => {
      const client = createClient("invalid-token-string");

      await new Promise<void>((resolve) => {
        client.on("connect_error", (err) => {
          expect(err.message).toContain("Authentication error: Invalid or expired token");
          client.disconnect();
          resolve();
        });
      });
    });
  });

  describe("Requirement 2 & 5: Authorize subscriptions and protect sensitive info", () => {
    it("should allow an authenticated user to join an active incident room", async () => {
      const incident = await Incident.create({
        title: "Flash Flood",
        description: "River overflowed banks into downtown",
        severity: Severity.HIGH,
        category: IncidentCategory.FLOOD,
        status: IncidentStatus.ACTIVE,
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
        reportedBy: adminUser._id,
      });

      const client = createClient(coordinatorToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const response: any = await new Promise((resolve) => {
        client.emit(SOCKET_EVENTS.JOIN_INCIDENT, { incidentId: incident._id.toString() }, resolve);
      });

      expect(response.success).toBe(true);
      expect(response.message).toContain(incident._id.toString());
      client.disconnect();
    });

    it("should reject joining an incident room for non-existent incident", async () => {
      const client = createClient(coordinatorToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const nonExistentId = "507f1f77bcf86cd799439011";
      const response: any = await new Promise((resolve) => {
        client.emit(SOCKET_EVENTS.JOIN_INCIDENT, { incidentId: nonExistentId }, resolve);
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe("Incident not found");
      client.disconnect();
    });

    it("should prevent unauthorized VIEWER from accessing closed/sensitive incident room", async () => {
      const closedIncident = await Incident.create({
        title: "Resolved Hazmat Leak",
        description: "Contained chemical leak in warehouse",
        severity: Severity.CRITICAL,
        category: IncidentCategory.OTHER,
        status: IncidentStatus.CLOSED,
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
        reportedBy: adminUser._id,
      });

      const client = createClient(viewerToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const response: any = await new Promise((resolve) => {
        client.emit(SOCKET_EVENTS.JOIN_INCIDENT, { incidentId: closedIncident._id.toString() }, resolve);
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("Unauthorized to view closed incident");
      client.disconnect();
    });

    it("should refuse a missed-updates request for an incident the user may not subscribe to", async () => {
      // sync:request returns the full record and its audit history, so it
      // must not be more permissive than joining the room itself.
      const closedIncident = await Incident.create({
        title: "Resolved Hazmat Leak",
        description: "Contained chemical leak in warehouse",
        severity: Severity.CRITICAL,
        category: IncidentCategory.OTHER,
        status: IncidentStatus.CLOSED,
        location: { type: "Point", coordinates: [-122.4194, 37.7749] },
        reportedBy: adminUser._id,
      });

      const client = createClient(viewerToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const response: any = await new Promise((resolve) => {
        client.emit(
          SOCKET_EVENTS.REQUEST_MISSED_UPDATES,
          { incidentId: closedIncident._id.toString() },
          resolve
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("Unauthorized to view closed incident");
      expect(response.incident).toBeUndefined();
      client.disconnect();
    });
  });

  describe("Requirement 3, 4, 7: Event emissions with consistent schemas after DB success", () => {
    it("should emit incident:created with consistent schema and eventId when created in service", async () => {
      const coordinatorClient = createClient(coordinatorToken);
      await new Promise<void>((resolve) => coordinatorClient.on("connect", () => resolve()));

      const eventPromise = new Promise<any>((resolve) => {
        coordinatorClient.on(SOCKET_EVENTS.INCIDENT_CREATED, (payload) => {
          resolve(payload);
        });
      });

      // Perform the service operation
      await incidentService.createIncident(
        "Earthquake in District 4",
        "Magnitude 5.2 tremor felt across central valley",
        Severity.CRITICAL,
        IncidentCategory.EARTHQUAKE,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        coordinatorUser._id.toString()
      );

      const receivedPayload = await eventPromise;

      // Verify standardized envelope and deduplication ID
      expect(receivedPayload).toHaveProperty("eventId");
      expect(receivedPayload).toHaveProperty("eventType", SOCKET_EVENTS.INCIDENT_CREATED);
      expect(receivedPayload).toHaveProperty("timestamp");
      expect(receivedPayload).toHaveProperty("sequenceNumber");
      expect(receivedPayload.data).toMatchObject({
        title: "Earthquake in District 4",
        severity: "CRITICAL",
        category: "EARTHQUAKE",
        status: "REPORTED",
      });

      coordinatorClient.disconnect();
    });

    it("should emit incident:status-changed when incident status transitions", async () => {
      const incident = await incidentService.createIncident(
        "Wildfire Warning",
        "Fire heading towards western residential area",
        Severity.HIGH,
        IncidentCategory.FIRE,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      const client = createClient(adminToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      // Subscribe to incident room
      await new Promise((resolve) => {
        client.emit(SOCKET_EVENTS.JOIN_INCIDENT, { incidentId: incident._id.toString() }, resolve);
      });

      const statusChangedPromise = new Promise<any>((resolve) => {
        client.on(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, (payload) => {
          resolve(payload);
        });
      });

      // Update status to VERIFIED
      await incidentService.updateIncident(
        incident._id.toString(),
        { status: IncidentStatus.VERIFIED },
        adminUser._id.toString(),
        "ADMIN"
      );

      const payload = await statusChangedPromise;
      expect(payload.data.previousStatus).toBe(IncidentStatus.REPORTED);
      expect(payload.data.status).toBe(IncidentStatus.VERIFIED);
      expect(payload.data.incidentId).toBe(incident._id.toString());

      client.disconnect();
    });

    it("should emit resource:status-changed to coordination room when availability changes", async () => {
      const resource = await resourceService.createResource(
        "Ambulance Alpha",
        ResourceType.AMBULANCE,
        "Medical",
        ResourceStatus.AVAILABLE,
        { type: "Point", coordinates: [-122.4194, 37.7749] }
      );

      const coordClient = createClient(coordinatorToken);
      await new Promise<void>((resolve) => coordClient.on("connect", () => resolve()));

      const resourceEventPromise = new Promise<any>((resolve) => {
        coordClient.on(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, (payload) => {
          resolve(payload);
        });
      });

      // Update resource availability
      await resourceService.updateAvailability(resource._id.toString(), ResourceStatus.MAINTENANCE);

      const payload = await resourceEventPromise;
      expect(payload.data.resourceId).toBe(resource._id.toString());
      expect(payload.data.status).toBe(ResourceStatus.MAINTENANCE);
      expect(payload.data.previousStatus).toBe(ResourceStatus.AVAILABLE);

      coordClient.disconnect();
    });

    it("should emit assignment:created directly to the assigned responder's private room", async () => {
      const incident = await incidentService.createIncident(
        "Multi-Vehicle Collision",
        "Multiple cars involved on highway 101",
        Severity.HIGH,
        IncidentCategory.OTHER,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      const responderClient = createClient(responderToken);
      await new Promise<void>((resolve) => responderClient.on("connect", () => resolve()));

      const assignmentEventPromise = new Promise<any>((resolve) => {
        responderClient.on(SOCKET_EVENTS.ASSIGNMENT_CREATED, (payload) => {
          resolve(payload);
        });
      });

      // Create assignment for this responder
      await assignmentService.createAssignment(
        incident._id.toString(),
        responderUser._id.toString(),
        undefined,
        "Proceed immediately with caution"
      );

      const payload = await assignmentEventPromise;
      expect(payload.data.incidentId).toBe(incident._id.toString());
      expect(payload.data.responderId).toBe(responderUser._id.toString());
      expect(payload.data.status).toBe(AssignmentStatus.PENDING);

      responderClient.disconnect();
    });

    it("should emit incident:assigned when an incident is assigned to a responder", async () => {
      // The web client subscribes to incident:assigned to refresh the record
      // that shows the responsible responder. A general incident:updated does
      // not carry that change, so the dedicated event has to be emitted.
      const incident = await incidentService.createIncident(
        "Structure Fire",
        "Smoke reported from a warehouse on the east side",
        Severity.HIGH,
        IncidentCategory.FIRE,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      const client = createClient(coordinatorToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const assignedPromise = new Promise<any>((resolve) => {
        client.on(SOCKET_EVENTS.INCIDENT_ASSIGNED, (payload) => {
          resolve(payload);
        });
      });

      await incidentService.assignIncident(
        incident._id.toString(),
        responderUser._id.toString(),
        coordinatorUser._id.toString(),
        "COORDINATOR"
      );

      const payload = await assignedPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.INCIDENT_ASSIGNED);
      expect(payload.data.incidentId).toBe(incident._id.toString());
      expect(payload.data.assignedTo).toBe(responderUser._id.toString());

      client.disconnect();
    });

    it("should emit incident:unassigned when an incident's responder is removed", async () => {
      const incident = await incidentService.createIncident(
        "Gas Leak",
        "Strong smell of gas reported near the depot",
        Severity.MEDIUM,
        IncidentCategory.OTHER,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      await incidentService.assignIncident(
        incident._id.toString(),
        responderUser._id.toString(),
        coordinatorUser._id.toString(),
        "COORDINATOR"
      );

      const client = createClient(coordinatorToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const unassignedPromise = new Promise<any>((resolve) => {
        client.on(SOCKET_EVENTS.INCIDENT_UNASSIGNED, (payload) => {
          resolve(payload);
        });
      });

      await incidentService.unassignIncident(
        incident._id.toString(),
        coordinatorUser._id.toString(),
        "COORDINATOR"
      );

      const payload = await unassignedPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.INCIDENT_UNASSIGNED);
      expect(payload.data.incidentId).toBe(incident._id.toString());
      expect(payload.data.assignedTo).toBeUndefined();

      client.disconnect();
    });

    it("should emit resource:created when a resource is added to the inventory", async () => {
      const coordClient = createClient(coordinatorToken);
      await new Promise<void>((resolve) => coordClient.on("connect", () => resolve()));

      const createdPromise = new Promise<any>((resolve) => {
        coordClient.on(SOCKET_EVENTS.RESOURCE_CREATED, (payload) => {
          resolve(payload);
        });
      });

      const resource = await resourceService.createResource(
        "Fire Engine Bravo",
        ResourceType.FIRE_UNIT,
        "Fire",
        ResourceStatus.AVAILABLE,
        { type: "Point", coordinates: [-122.4194, 37.7749] }
      );

      const payload = await createdPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.RESOURCE_CREATED);
      expect(payload.data.resourceId).toBe(resource._id.toString());
      expect(payload.data.name).toBe("Fire Engine Bravo");

      coordClient.disconnect();
    });

    it("should deliver incident events to a responder, whose list shows the same incidents", async () => {
      // The incident list and the live map are served to every signed-in
      // user, so the events that change them have to reach every signed-in
      // user. The responder is not in the coordination room, so without the
      // operations room the responder's list would silently go stale.
      const responderClient = createClient(responderToken);
      await new Promise<void>((resolve) => responderClient.on("connect", () => resolve()));

      const createdPromise = new Promise<any>((resolve) => {
        responderClient.on(SOCKET_EVENTS.INCIDENT_CREATED, (payload) => {
          resolve(payload);
        });
      });

      const incident = await incidentService.createIncident(
        "Storm Drain Overflow",
        "Water backing up into the basement car park",
        Severity.MEDIUM,
        IncidentCategory.FLOOD,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      const payload = await createdPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.INCIDENT_CREATED);
      expect(payload.data.incidentId).toBe(incident._id.toString());

      responderClient.disconnect();
    });

    it("should deliver resource events to a viewer, whose inventory shows the same resources", async () => {
      const viewerClient = createClient(viewerToken);
      await new Promise<void>((resolve) => viewerClient.on("connect", () => resolve()));

      const statusPromise = new Promise<any>((resolve) => {
        viewerClient.on(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, (payload) => {
          resolve(payload);
        });
      });

      const resource = await resourceService.createResource(
        "Shelter Bravo",
        ResourceType.SHELTER,
        "Shelter",
        ResourceStatus.AVAILABLE,
        { type: "Point", coordinates: [-122.4194, 37.7749] }
      );

      await resourceService.updateAvailability(
        resource._id.toString(),
        ResourceStatus.MAINTENANCE
      );

      const payload = await statusPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED);
      expect(payload.data.resourceId).toBe(resource._id.toString());
      expect(payload.data.status).toBe(ResourceStatus.MAINTENANCE);

      viewerClient.disconnect();
    });

    it("should emit notification:read when a notification is marked as read", async () => {
      // The header's unread badge and the notifications list subscribe to
      // this, so a read in another tab has to reach this one.
      const notification = await Notification.create({
        userId: responderUser._id,
        type: "INCIDENT",
        title: "Fictional demo dispatch notice",
        message: "FICTIONAL DEMO NOTIFICATION. A responder was dispatched.",
        isRead: false,
      });

      const client = createClient(responderToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const readPromise = new Promise<any>((resolve) => {
        client.on(SOCKET_EVENTS.NOTIFICATION_READ, (payload) => {
          resolve(payload);
        });
      });

      await notificationService.markAsRead(
        notification._id.toString(),
        responderUser._id.toString()
      );

      const payload = await readPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.NOTIFICATION_READ);
      expect(payload.data.notificationId).toBe(notification._id.toString());
      expect(payload.data.userId).toBe(responderUser._id.toString());
      expect(payload.data.all).toBe(false);

      client.disconnect();
    });

    it("should emit notification:read when every notification is marked as read", async () => {
      await Notification.create({
        userId: responderUser._id,
        type: "INCIDENT",
        title: "Fictional demo dispatch notice",
        message: "FICTIONAL DEMO NOTIFICATION. A responder was dispatched.",
        isRead: false,
      });

      const client = createClient(responderToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      const readPromise = new Promise<any>((resolve) => {
        client.on(SOCKET_EVENTS.NOTIFICATION_READ, (payload) => {
          resolve(payload);
        });
      });

      await notificationService.markAllAsRead(responderUser._id.toString());

      const payload = await readPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.NOTIFICATION_READ);
      expect(payload.data.userId).toBe(responderUser._id.toString());
      expect(payload.data.all).toBe(true);

      client.disconnect();
    });

    it("should emit assignment:cancelled when a dispatch is cancelled", async () => {
      // The client treats a cancelled dispatch as one that will never be
      // picked up, which is different from one that has merely changed
      // state, so it needs its own event.
      const incident = await incidentService.createIncident(
        "Collapsed Wall",
        "Part of the perimeter wall has come down",
        Severity.HIGH,
        IncidentCategory.OTHER,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      const assignment = await assignmentService.createAssignment(
        incident._id.toString(),
        responderUser._id.toString(),
        undefined,
        "Bring the shoring kit"
      );

      const responderClient = createClient(responderToken);
      await new Promise<void>((resolve) => responderClient.on("connect", () => resolve()));

      const cancelledPromise = new Promise<any>((resolve) => {
        responderClient.on(SOCKET_EVENTS.ASSIGNMENT_CANCELLED, (payload) => {
          resolve(payload);
        });
      });

      await assignmentService.cancelAssignment(
        assignment._id.toString(),
        coordinatorUser._id.toString(),
        "COORDINATOR"
      );

      const payload = await cancelledPromise;
      expect(payload.eventType).toBe(SOCKET_EVENTS.ASSIGNMENT_CANCELLED);
      expect(payload.data.assignmentId).toBe(assignment._id.toString());
      expect(payload.data.status).toBe(AssignmentStatus.CANCELLED);
      expect(payload.data.previousStatus).toBe(AssignmentStatus.PENDING);

      responderClient.disconnect();
    });
  });

  describe("Requirement 6: Missed updates recovery strategy", () => {
    it("should allow a client to request state and audit history after reconnecting", async () => {
      const incident = await incidentService.createIncident(
        "Power Outage at Hospital",
        "Backup generators activated at General Hospital",
        Severity.CRITICAL,
        IncidentCategory.OTHER,
        { type: "Point", coordinates: [-122.4194, 37.7749] },
        adminUser._id.toString()
      );

      // Perform updates
      await incidentService.updateIncident(
        incident._id.toString(),
        { status: IncidentStatus.VERIFIED },
        adminUser._id.toString(),
        "ADMIN"
      );

      const client = createClient(coordinatorToken);
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));

      // Client requests missed updates
      const response: any = await new Promise((resolve) => {
        client.emit(
          SOCKET_EVENTS.REQUEST_MISSED_UPDATES,
          { incidentId: incident._id.toString(), sinceVersion: 1 },
          resolve
        );
      });

      expect(response.success).toBe(true);
      expect(response.incident.id).toBe(incident._id.toString());
      expect(response.incident.status).toBe(IncidentStatus.VERIFIED);
      expect(response.history.length).toBeGreaterThan(0);

      client.disconnect();
    });
  });
});
