import { Request, Response, NextFunction } from "express";
import User, { hashUserPassword } from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { escapeRegExp } from "../services/incidentService.js";
import { userSchemas } from "../utils/validation.js";
import { ValidationError } from "../utils/errors.js";

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;
    const search = req.query.search as string;

    const query: any = {};
    if (role) query.role = role;
    if (search) {
      // Escape the term so regex metacharacters cannot alter the query.
      const searchRegex = new RegExp(escapeRegExp(search), "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.success({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role, phone } = userSchemas.adminCreate.parse(
      req.body
    );
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ValidationError("Email already registered");
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: await hashUserPassword(password),
      role,
      phone,
    });
    const actor = (req as any).user;

    await AuditLog.create({
      action: "USER_CREATED",
      entity: "USER",
      entityId: String(user._id),
      actorId: actor.id,
      actorRole: actor.role,
      details: { role: user.role, createdUserEmail: user.email },
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    res.created(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isAvailable: user.isAvailable,
        createdAt: user.createdAt,
      },
      "User account created successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = userSchemas.adminRoleUpdate.parse(req.body);

    // An admin who demotes themselves immediately loses access to the admin
    // screens, and if they are the only admin, the deployment loses its last
    // administrator. Refuse rather than let that happen silently.
    const actor = (req as any).user;
    if (actor?.id && actor.id === id && role !== "ADMIN") {
      res.error(400, "You cannot change your own role");
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      res.error(404, "User not found");
      return;
    }

    // Log admin role change
    await AuditLog.create({
      action: "USER_ROLE_UPDATED",
      entity: "USER",
      entityId: String(user._id),
      actorId: actor?.id || user._id,
      actorRole: actor?.role || "ADMIN",
      details: { newRole: role, updatedUserEmail: user.email },
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    res.success(user, "User role updated successfully");
  } catch (error) {
    next(error);
  }
};

export const listAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const entity = req.query.entity as string;
    const action = req.query.action as string;

    const query: any = {};
    if (entity) query.entity = entity;
    if (action) {
      // The action filter is free text, so it matches on a substring rather
      // than the exact action name. Typing "INCIDENT" should surface
      // INCIDENT_CREATED and INCIDENT_UPDATED, not silently return nothing.
      const actionRegex = new RegExp(escapeRegExp(action), "i");
      query.action = actionRegex;
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

    res.success({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listUsers,
  createUser,
  updateUserRole,
  listAuditLogs,
};
