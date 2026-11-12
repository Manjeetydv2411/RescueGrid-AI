# Real-Time Incident Coordination API Documentation (Socket.IO)

This document details the architecture, authentication, event schemas, room model, client lifecycle, and testing instructions for RescueGrid AI's Phase 6 Real-Time Coordination subsystem.

---

## 1. Architecture Overview

RescueGrid AI uses **Socket.IO** attached to the Express HTTP server to distribute live status updates to authorized users during emergencies.

### Key Tenets & Reliability Distinction
> ⚠️ **CRITICAL SAFETY DISTINCTION: Emitted vs. Delivered vs. Acknowledged**
> In emergency response systems, a successful socket emission **must never be treated as proof that a responder or client received or acted on a notification**.
> - **Emitted (`EMITTED`)**: The server pushed an event packet to the network transport/room. The network may drop packets, or the recipient may be in an offline tunnel or disconnected.
> - **Delivered (`DELIVERED`)**: Transport-level confirmation that the packet reached the client socket.
> - **Acknowledged (`ACKNOWLEDGED`)**: The responder/client explicitly triggered a callback or confirmation action (e.g., clicking "Accept Assignment", or sending an acknowledgment event) back to the server.
>
> All mission-critical workflows (such as responder dispatch and assignment acceptance) require explicit acknowledgment via the REST API or socket ack callbacks, rather than relying on broadcast events.

---

## 2. Authentication

Socket connections must be authenticated using JSON Web Tokens (JWT). The handshake supports two methods:

### Handshake Authorization Header (Recommended)
Pass the standard `Authorization: Bearer <token>` header in the socket handshake options:

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`,
  },
  transports: ["websocket"],
});
```

### Handshake Auth Object (Alternative)
```typescript
const socket = io("http://localhost:3000", {
  auth: {
    token: accessToken,
  },
});
```

If the token is missing, expired, or invalid, the connection is rejected immediately with a `connect_error`:
- `"Authentication error: No token provided"`
- `"Authentication error: Invalid or expired token"`

---

## 3. Channels & Room Subscription Model

Upon successful authentication, users are automatically placed into relevant channels based on their identity and role:

| Room Pattern | Description | Auto-Joined? | Authorized Roles |
|---|---|---|---|
| `user:{userId}` | Private channel for direct notifications and assignments | Yes | Only the specific user |
| `role:{role}` | Role-wide broadcasts (`role:ADMIN`, `role:COORDINATOR`, etc.) | Yes | Users with matching role |
| `coordination:global` | Global stream for incident creation, assignments, and resource changes | Yes (for ADMIN/COORDINATOR) | `ADMIN`, `COORDINATOR` |
| `incident:{incidentId}` | Incident-specific channel for real-time updates and logs | No (Explicit request) | Verified based on incident state and user role |

### Subscribing to an Incident Channel (`join:incident`)

Clients join an incident room by sending `join:incident` with an acknowledgment callback:

```typescript
socket.emit("join:incident", { incidentId: "6ad7561ad..." }, (response) => {
  if (response.success) {
    console.log("Subscribed to incident updates:", response.incident);
  } else {
    console.error("Subscription failed:", response.error);
  }
});
```

**Authorization Rules:**
- `ADMIN` and `COORDINATOR`: Allowed to join any incident channel.
- `RESPONDER`: Allowed to join active or assigned incidents.
- `VIEWER`: Denied access to sensitive or `CLOSED` incidents.

---

## 4. Standard Event Envelopes and Schemas

All server emissions adhere to a standardized event envelope designed for idempotency and ordering:

```typescript
interface SocketEventPayload<T> {
  eventId: string;          // UUID v4 - prevents duplicate processing on client retries
  eventType: string;        // Name of the event
  timestamp: string;        // ISO 8601 UTC timestamp
  sequenceNumber: number;   // Monotonically increasing sequence number
  data: T;                  // Typed event payload
}
```

### Incident Events
- **`incident:created`**: Emitted when a new incident is submitted and saved to MongoDB.
- **`incident:updated`**: Emitted when details or assignments change.
- **`incident:status-changed`**: Emitted on status transitions (`REPORTED -> VERIFIED -> ACTIVE -> RESOLVED -> CLOSED`).

**Payload Structure:**
```json
{
  "eventId": "a798544e-3760-4bce-9257-ec189914757c",
  "eventType": "incident:status-changed",
  "timestamp": "2026-10-20T17:20:00.000Z",
  "sequenceNumber": 42,
  "data": {
    "incidentId": "6ad7561ad...",
    "title": "Flash Flood Downtown",
    "severity": "CRITICAL",
    "category": "FLOOD",
    "status": "ACTIVE",
    "previousStatus": "VERIFIED",
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "updatedBy": "user_id_here"
  }
}
```

### Resource Events
- **`resource:updated`**: Emitted when resource properties are modified.
- **`resource:status-changed`**: Emitted when availability status changes (`AVAILABLE`, `ON_MISSION`, `MAINTENANCE`, `UNAVAILABLE`).

### Assignment Events
- **`assignment:created`**: Emitted to the assigned responder's private room (`user:{responderId}`), the incident channel (`incident:{incidentId}`), and the coordination room (`coordination:global`).
- **`assignment:updated`**: Emitted on assignment note or status changes.
- **`assignment:status-changed`**: Emitted on assignment workflow transitions (`PENDING -> ACCEPTED -> DISPATCHED -> ARRIVED -> COMPLETED`).

---

## 5. Reconnection & Missed Updates Recovery

When mobile or field responder clients experience temporary network dropouts, they can recover missed updates upon reconnection using the `sync:request` event:

```typescript
socket.on("connect", () => {
  // Re-request latest state and audit history since last received version
  socket.emit("sync:request", {
    incidentId: "6ad7561ad...",
    sinceVersion: lastKnownVersionNumber,
  }, (response) => {
    if (response.success) {
      console.log("Current incident state:", response.incident);
      console.log("Audit log history:", response.history);
    }
  });
});
```

---

## 6. Notification Tracking (Read/Unread)

In addition to ephemeral socket events, persistent notifications are tracked in MongoDB.

### REST Endpoints for Notifications:
- `GET /api/v1/notifications` — Fetch user's paginated notifications (query params: `page`, `limit`, `unread=true`).
- `GET /api/v1/notifications/unread-count` — Quick count of unread notifications.
- `PATCH /api/v1/notifications/:id/read` — Mark a single notification as read.
- `PATCH /api/v1/notifications/read-all` — Mark all user notifications as read.

---

## 7. How to Run and Test Locally

### Prerequisites
- MongoDB running on `localhost:27017` (or configured via `MONGODB_URI`)
- Node.js 20+

### Start the Server
```bash
cd backend
npm run dev
```
The server will start at `http://localhost:3000` with both Express REST endpoints and the Socket.IO listener.

### Run Automated Tests
```bash
npm test
```
All 54 tests across authentication, database, models, health, notifications, and Socket.IO real-time coordination will run.

### Interactive Client Example (Node.js)
```typescript
import { io } from "socket.io-client";

// 1. Obtain token via REST login
const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "coord@example.com", password: "password123" }),
});
const { data: { tokens } } = await loginRes.json();

// 2. Connect to Socket.IO
const socket = io("http://localhost:3000", {
  extraHeaders: {
    Authorization: `Bearer ${tokens.accessToken}`,
  },
});

socket.on("connect", () => {
  console.log("Connected with socket ID:", socket.id);

  // Subscribe to an incident
  socket.emit("join:incident", { incidentId: "INCIDENT_ID" }, console.log);
});

// 3. Listen for real-time events
socket.on("incident:status-changed", (event) => {
  console.log("Status update received:", event.data);
});

socket.on("assignment:created", (event) => {
  console.log("New assignment dispatched:", event.data);
});
```
