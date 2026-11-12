import jwt from "jsonwebtoken";
import { config } from "../config/environment.js";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { UserRole } from "../types/models.js";

export const authenticate = (
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Auth failed: No token provided");
    next(new UnauthorizedError("No token provided"));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      role: UserRole;
      email?: string;
      type?: string;
    };

    // A refresh token is not an access token. It carries no role claim and
    // must never be accepted as a session credential on API routes — only
    // POST /auth/refresh may exchange it.
    if (decoded.type === "refresh") {
      logger.warn("Auth failed: Refresh token used as an access token");
      next(new UnauthorizedError("Invalid or expired token"));
      return;
    }

    // Re-read the account so deleted/deactivated accounts and role changes are
    // enforced immediately rather than trusting a stale JWT claim.
    void User.findById(decoded.id)
      .select("name email role phone isAvailable")
      .then((account) => {
        if (!account) {
          next(new UnauthorizedError("Invalid or expired token"));
          return;
        }
        (req as any).user = {
          id: account._id.toString(),
          name: account.name,
          email: account.email,
          role: account.role,
          phone: account.phone,
          isAvailable: account.isAvailable,
        };
        next();
      })
      .catch(() => next(new UnauthorizedError("Invalid or expired token")));
  } catch (error) {
    logger.warn("Auth failed: Invalid token");
    next(new UnauthorizedError("Invalid or expired token"));
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ): void => {
    const user = (req as any).user;

    if (!user) {
      next(new UnauthorizedError("Unauthorized"));
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn(
        `Forbidden: User ${user.id} attempted access with role ${user.role}`
      );
      // The caller is authenticated but not permitted: that is 403, not 401.
      // A 401 would tell the client to refresh its token, which cannot help.
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
};

export default {
  authenticate,
  authorize,
};
