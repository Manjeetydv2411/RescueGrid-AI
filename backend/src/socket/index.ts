import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { socketAuthMiddleware, AuthenticatedSocket } from "./authMiddleware.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "./events.js";
import { setSocketServer } from "./socketService.js";
import { logger } from "../utils/logger.js";
import Incident from "../models/Incident.js";
import {
  canJoinIncidentRoom,
  incidentRoomRefusal,
} from "../services/incidentAccess.js";

/**
 * Configure and initialize Socket.IO server attached to HTTP server
 */
export const initSocketIO = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // Attach authentication middleware
  io.use(socketAuthMiddleware);

  // Register server instance with our emitter service
  setSocketServer(io);

 io.on("connection", (rawSocket) => {``
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.user;

    logger.info(`User connected to socket: ${user.id} (${user.role}) [socketId: ${socket.id}]`);

    // Automatically join personal notification room
    socket.join(SOCKET_ROOMS.USER(user.id));

    // Every signed-in user can read the incident list, the live map, and the
    // resource inventory, so every signed-in user joins the room that carries
    // the events which change them.
    socket.join(SOCKET_ROOMS.OPERATIONS);

    // --- Room Subscription: Incident Channel ---
    socket.on(SOCKET_EVENTS.JOIN_INCIDENT, async (data: { incidentId: string }, callback?: (res: any) => void) => {
      try {
        if (!data?.incidentId) {
          callback?.({ success: false, error: "incidentId is required" });
          return;
        }

        const incident = await Incident.findById(data.incidentId);
        if (!incident) {
          callback?.({ success: false, error: "Incident not found" });
          return;
        }

        // Authorization check. Shared with REQUEST_MISSED_UPDATES so the two
        // ways of reading an incident's live state cannot drift apart.
        if (!canJoinIncidentRoom(incident, user)) {
          callback?.({ success: false, error: incidentRoomRefusal(user) });
          return;
        }

        const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
        socket.join(room);
        logger.info(`Socket ${socket.id} (user: ${user.id}) joined room ${room}`);

        callback?.({
          success: true,
          message: `Joined incident room: ${data.incidentId}`,
          incident: {
            id: incident._id,
            title: incident.title,
            status: incident.status,
            severity: incident.severity,
          },
        });
      } catch (err) {
        logger.error(`Error joining incident room: ${(err as Error).message}`);
        callback?.({ success: false, error: "Internal server error" });
      }
    });

    // --- Leave Incident Channel ---
    socket.on(SOCKET_EVENTS.LEAVE_INCIDENT, (data: { incidentId: string }, callback?: (res: any) => void) => {
      if (!data?.incidentId) {
        callback?.({ success: false, error: "incidentId is required" });
        return;
      }

      const room = SOCKET_ROOMS.INCIDENT(data.incidentId);
      socket.leave(room);
      logger.info(`Socket ${socket.id} left room ${room}`);

      callback?.({ success: true, message: `Left incident room: ${data.incidentId}` });
    });

    // --- Missed Updates Recovery ---
    socket.on(
      SOCKET_EVENTS.REQUEST_MISSED_UPDATES,
      async (data: { incidentId: string; sinceVersion?: number }, callback?: (res: any) => void) => {
        try {
          if (!data?.incidentId) {
            callback?.({ success: false, error: "incidentId is required" });
            return;
          }

          const incident = await Incident.findById(data.incidentId);
          if (!incident) {
            callback?.({ success: false, error: "Incident not found" });
            return;
          }

          // Same rule as joining the room: this handler returns the full
          // record and its audit history, so it must not be more permissive
          // than the subscription it is meant to recover from.
          if (!canJoinIncidentRoom(incident, user)) {
            callback?.({ success: false, error: incidentRoomRefusal(user) });
            return;
          }

          // Return the current full state plus relevant audit log history
          const auditHistory = incident.auditLog || [];
          const recentUpdates = data.sinceVersion
            ? auditHistory.filter((entry: any) => true) // Return audit entries
            : auditHistory.slice(-10);

          callback?.({
            success: true,
            incident: {
              id: incident._id,
              title: incident.title,
              status: incident.status,
              severity: incident.severity,
              version: incident.version,
              updatedAt: incident.updatedAt,
            },
            history: recentUpdates,
          });
        } catch (err) {
          logger.error(`Error fetching missed updates: ${(err as Error).message}`);
          callback?.({ success: false, error: "Internal server error" });
        }
      }
    );

    // --- Handle Disconnection ---
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      logger.info(`User disconnected: ${user.id} [socketId: ${socket.id}, reason: ${reason}]`);
    });
  });

  return io;
};

export default {
  initSocketIO,
};
