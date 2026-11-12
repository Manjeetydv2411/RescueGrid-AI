import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/environment.js";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import { UserRole } from "../types/models.js";

export interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    role: UserRole;
    email?: string;
  };
}

/**
 * Socket.IO authentication middleware using handshake headers
 * Expects Authorization: Bearer <token> in handshake.headers
 * or auth.token in handshake.auth as fallback
 */
export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  try {
    let token: string | undefined;

    // Check handshake headers (standard HTTP Authorization header)
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    // Fallback: check handshake.auth.token
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      logger.warn(`Socket connection rejected: No token provided (socket: ${socket.id})`);
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      role: UserRole;
      email?: string;
      type?: string;
    };

    // A refresh token must not open a socket session.
    if (decoded.type === "refresh") {
      logger.warn(
        `Socket connection rejected: Refresh token used as a session token (socket: ${socket.id})`
      );
      return next(new Error("Authentication error: Invalid or expired token"));
    }

    // Re-read the account so deleted accounts and role changes are enforced for
    // realtime subscriptions as well as REST requests.
    void User.findById(decoded.id)
      .select("email role")
      .then((account) => {
        if (!account) {
          next(new Error("Authentication error: Invalid or expired token"));
          return;
        }

        (socket as AuthenticatedSocket).user = {
          id: account._id.toString(),
          role: account.role,
          email: account.email,
        };

        logger.info(
          `Socket authenticated: ${socket.id} (user: ${account._id}, role: ${account.role})`
        );
        next();
      })
      .catch(() => next(new Error("Authentication error: Invalid or expired token")));
  } catch (error) {
    logger.warn(`Socket connection rejected: Invalid token (socket: ${socket.id})`);
    next(new Error("Authentication error: Invalid or expired token"));
  }
};
