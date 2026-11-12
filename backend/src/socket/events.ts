/**
 * Socket.IO Event Names and Payload Types for RescueGrid AI
 */

// Event names
export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",

  // Incident events
  INCIDENT_CREATED: "incident:created",
  INCIDENT_UPDATED: "incident:updated",
  INCIDENT_STATUS_CHANGED: "incident:status-changed",
  INCIDENT_ASSIGNED: "incident:assigned",
  INCIDENT_UNASSIGNED: "incident:unassigned",

  // Resource events
  RESOURCE_CREATED: "resource:created",
  RESOURCE_UPDATED: "resource:updated",
  RESOURCE_STATUS_CHANGED: "resource:status-changed",

  // Assignment events
  ASSIGNMENT_CREATED: "assignment:created",
  ASSIGNMENT_UPDATED: "assignment:updated",
  ASSIGNMENT_STATUS_CHANGED: "assignment:status-changed",
  ASSIGNMENT_CANCELLED: "assignment:cancelled",

  // Notification events
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",

  // Room subscription events (client -> server)
  JOIN_INCIDENT: "join:incident",
  LEAVE_INCIDENT: "leave:incident",

  // State recovery. The reply is delivered through the request's
  // acknowledgement callback rather than as a separate broadcast event, so
  // there is no response event name.
  REQUEST_MISSED_UPDATES: "sync:request",
} as const;

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

// Room naming conventions
export const SOCKET_ROOMS = {
  // Per-incident room: incident:{incidentId}
  INCIDENT: (incidentId: string) => `incident:${incidentId}`,

  // User-specific notification room: user:{userId}
  USER: (userId: string) => `user:${userId}`,

  // Room for the operational lists every authenticated user can read.
  //
  // The incident list, the live map, and the resource inventory are served
  // to any signed-in user, so the events that change those lists have to
  // reach every signed-in user too. Without this, a responder or a viewer
  // watching the list saw it change on someone else's screen but not on
  // their own. The payload is the same summary the list already exposes,
  // so the room does not widen what a client may read.
  OPERATIONS: "operations:global",
} as const;

// Base event payload structure
export interface SocketEventPayload<T = unknown> {
  eventId: string;          // UUID to prevent duplicate processing
  eventType: SocketEventType;
  timestamp: string;        // ISO 8601
  sequenceNumber?: number;  // For ordering / missed update recovery
  data: T;
}

// Typed payload interfaces
export interface IncidentEventData {
  incidentId: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  assignedTo?: string;
  updatedBy?: string;
  previousStatus?: string;
}

export interface ResourceEventData {
  resourceId: string;
  name: string;
  type: string;
  status: string;
  previousStatus?: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  lastUpdated: string;
}

export interface AssignmentEventData {
  assignmentId: string;
  incidentId: string;
  responderId: string;
  resourceId?: string;
  status: string;
  previousStatus?: string;
  updatedBy: string;
}

export interface NotificationEventData {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  createdAt: string;
}

/**
 * A notification that has been marked as read.
 *
 * Carries only the identifiers: the client re-reads the list through the API
 * rather than patching the row, so the unread count and the ordering stay
 * the server's answer rather than this payload's.
 */
export interface NotificationReadEventData {
  notificationId?: string;
  userId: string;
  /** True when every unread notification for the user was marked as read. */
  all: boolean;
}
