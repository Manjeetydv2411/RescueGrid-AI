import { Server as SocketIOServer } from "socket.io";
import crypto from "crypto";
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  SocketEventType,
  SocketEventPayload,
  IncidentEventData,
  ResourceEventData,
  AssignmentEventData,
  NotificationEventData,
  NotificationReadEventData,
} from "./events.js";
import { logger } from "../utils/logger.js";

let ioInstance: SocketIOServer | null = null;
let sequenceCounter = 0;

/**
 * Initialize or set the Socket.IO server instance
 */
export const setSocketServer = (io: SocketIOServer): void => {
  ioInstance = io;
  logger.info("Socket.IO server instance registered with socketService");
};

/**
 * Get the active Socket.IO server instance
 */
export const getSocketServer = (): SocketIOServer | null => {
  return ioInstance;
};

/**
 * Helper to build a standard event payload with deduplication ID and sequence number
 */
const buildPayload = <T>(eventType: SocketEventType, data: T): SocketEventPayload<T> => {
  sequenceCounter += 1;
  return {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    sequenceNumber: sequenceCounter,
    data,
  };
};

/**
 * Emit an event to a specific room
 * Events are only emitted if Socket.IO is initialized
 */
export const emitToRoom = <T>(
  room: string,
  eventType: SocketEventType,
  data: T
): void => {
  if (!ioInstance) {
    logger.debug(`Socket not initialized; skipped emitting ${eventType} to room ${room}`);
    return;
  }

  const payload = buildPayload(eventType, data);
  ioInstance.to(room).emit(eventType, payload);
  logger.debug(`Socket event emitted: ${eventType} -> room [${room}] (seq: ${payload.sequenceNumber})`);
};

/**
 * Emit an event to all connected clients
 */
export const emitToAll = <T>(eventType: SocketEventType, data: T): void => {
  if (!ioInstance) {
    logger.debug(`Socket not initialized; skipped broadcast of ${eventType}`);
    return;
  }

  const payload = buildPayload(eventType, data);
  ioInstance.emit(eventType, payload);
  logger.debug(`Socket event broadcast: ${eventType} (seq: ${payload.sequenceNumber})`);
};

// --- Specialized Event Emitters ---

/**
 * Emit incident events to both the incident-specific room and the operations
 * room.
 *
 * The incident list, the live map, and the resource inventory are served to
 * every signed-in user, so the events that change them go to the operations
 * room, which every signed-in socket joins. The coordination room and the
 * role rooms are deliberately not also targeted: they are subsets of the
 * operations room, and emitting to both would deliver the same event twice
 * to every administrator and coordinator.
 */
export const emitIncidentCreated = (data: IncidentEventData): void => {
  const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
  emitToRoom(room, SOCKET_EVENTS.INCIDENT_CREATED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.INCIDENT_CREATED, data);
};

export const emitIncidentUpdated = (data: IncidentEventData): void => {
  const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
  emitToRoom(room, SOCKET_EVENTS.INCIDENT_UPDATED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.INCIDENT_UPDATED, data);
};

export const emitIncidentStatusChanged = (data: IncidentEventData): void => {
  const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
  emitToRoom(room, SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, data);
};

/**
 * Emit an incident assignment.
 *
 * Assignment is a distinct change from a general update: clients that show
 * the responsible responder (the map's incident list, the incident record)
 * need to react to it, and a general update does not tell them that the
 * responder changed.
 */
export const emitIncidentAssigned = (data: IncidentEventData): void => {
  const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
  emitToRoom(room, SOCKET_EVENTS.INCIDENT_ASSIGNED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.INCIDENT_ASSIGNED, data);
};

/**
 * Emit the removal of an incident's assigned responder.
 */
export const emitIncidentUnassigned = (data: IncidentEventData): void => {
  const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
  emitToRoom(room, SOCKET_EVENTS.INCIDENT_UNASSIGNED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.INCIDENT_UNASSIGNED, data);
};

/**
 * Emit a newly registered resource to the operations room.
 */
export const emitResourceCreated = (data: ResourceEventData): void => {
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.RESOURCE_CREATED, data);
};

/**
 * Emit resource availability updates to the operations room.
 */
export const emitResourceUpdated = (data: ResourceEventData): void => {
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.RESOURCE_UPDATED, data);
};

export const emitResourceStatusChanged = (data: ResourceEventData): void => {
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, data);
};

/**
 * Emit assignment updates to the responder, the incident room, and the
 * operations room.
 *
 * The operations room carries the change to the dispatch list and to the
 * dashboard's dispatch totals. The assignment list exposes the responder's
 * phone number, so the API scopes that list to the caller's role — the
 * event does not widen what a client may read, because the client re-reads
 * the list through the API rather than reading the payload.
 */
export const emitAssignmentCreated = (data: AssignmentEventData): void => {
  // Notify the assigned responder directly
  emitToRoom(SOCKET_ROOMS.USER(data.responderId), SOCKET_EVENTS.ASSIGNMENT_CREATED, data);
  // Notify the incident room
  emitToRoom(SOCKET_ROOMS.INCIDENT(data.incidentId), SOCKET_EVENTS.ASSIGNMENT_CREATED, data);
  // Notify everyone watching the operational lists
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ASSIGNMENT_CREATED, data);
};

export const emitAssignmentUpdated = (data: AssignmentEventData): void => {
  emitToRoom(SOCKET_ROOMS.USER(data.responderId), SOCKET_EVENTS.ASSIGNMENT_UPDATED, data);
  emitToRoom(SOCKET_ROOMS.INCIDENT(data.incidentId), SOCKET_EVENTS.ASSIGNMENT_UPDATED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ASSIGNMENT_UPDATED, data);
};

export const emitAssignmentStatusChanged = (data: AssignmentEventData): void => {
  emitToRoom(SOCKET_ROOMS.USER(data.responderId), SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, data);
  emitToRoom(SOCKET_ROOMS.INCIDENT(data.incidentId), SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, data);
};

/**
 * Emit the cancellation of a dispatch.
 *
 * A cancellation is a distinct event from a general status change: the
 * client treats a cancelled dispatch as one that will never be picked up,
 * which is different from one that is merely in a new state.
 */
export const emitAssignmentCancelled = (data: AssignmentEventData): void => {
  emitToRoom(SOCKET_ROOMS.USER(data.responderId), SOCKET_EVENTS.ASSIGNMENT_CANCELLED, data);
  emitToRoom(SOCKET_ROOMS.INCIDENT(data.incidentId), SOCKET_EVENTS.ASSIGNMENT_CANCELLED, data);
  emitToRoom(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ASSIGNMENT_CANCELLED, data);
};

/**
 * Emit user-targeted notification
 */
export const emitNotification = (data: NotificationEventData): void => {
  emitToRoom(SOCKET_ROOMS.USER(data.userId), SOCKET_EVENTS.NOTIFICATION_NEW, data);
};

/**
 * Emit that a notification has been marked as read.
 *
 * The client subscribes to this so the unread badge and the list update when
 * a notification is read in another tab or on another device. Without it the
 * badge would sit at its old count until the next poll.
 */
export const emitNotificationRead = (data: NotificationReadEventData): void => {
  emitToRoom(SOCKET_ROOMS.USER(data.userId), SOCKET_EVENTS.NOTIFICATION_READ, data);
};

export default {
  setSocketServer,
  getSocketServer,
  emitToRoom,
  emitToAll,
  emitIncidentCreated,
  emitIncidentUpdated,
  emitIncidentStatusChanged,
  emitIncidentAssigned,
  emitIncidentUnassigned,
  emitResourceUpdated,
  emitResourceCreated,
  emitResourceStatusChanged,
  emitAssignmentCreated,
  emitAssignmentUpdated,
  emitAssignmentStatusChanged,
  emitAssignmentCancelled,
  emitNotification,
  emitNotificationRead,
};
