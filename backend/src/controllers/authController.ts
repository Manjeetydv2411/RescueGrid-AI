import { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService.js";
import { userSchemas } from "../utils/validation.js";
import User from "../models/User.js";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role, phone } = userSchemas.register.parse(
      req.body
    );

    const user = await authService.register(
      name,
      email,
      password,
      role,
      phone
    );

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
      "User registered successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = userSchemas.login.parse(req.body);

    const { user, tokens } = await authService.login(email, password);

    res.success({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isAvailable: user.isAvailable,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.error(401, "Unauthorized");
      return;
    }

    // Load the current profile from the database so the client always sees the
    // authoritative role and contact details (the role claim can be stale
    // after an admin changes it).
    const account = await User.findById(user.id).select("name email role phone isAvailable");

    if (!account) {
      res.error(404, "Account not found");
      return;
    }

    res.success({
      id: account._id,
      name: account.name,
      email: account.email,
      role: account.role,
      phone: account.phone,
      isAvailable: account.isAvailable,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // For now, just return success (token invalidation would be handled client-side)
    res.success({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken || typeof refreshToken !== "string") {
      res.error(401, "A refresh token is required");
      return;
    }

    const { user, tokens } = await authService.refreshTokens(refreshToken);

    res.success({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isAvailable: user.isAvailable,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  logout,
  refresh,
};
