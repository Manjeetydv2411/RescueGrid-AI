import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config/environment.js";
import User, { IUserDocument } from "../models/User.js";
import { ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export const register = async (
  name: string,
  email: string,
  password: string,
  role: string = "VIEWER",
  phone?: string
): Promise<IUserDocument> => {
  // Public registration can only create a least-privileged viewer account.
  if (role !== "VIEWER") {
    throw new ValidationError("Cannot assign privileged role during registration");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ValidationError("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role,
    phone,
  });

  logger.info(`New user registered: ${user.email} with role: ${user.role}`);

  return user;
};

export const login = async (
  email: string,
  password: string
): Promise<{ user: IUserDocument; tokens: TokenPair }> => {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
  if (!user) {
    // Generic error to prevent email enumeration
    throw new ValidationError("Invalid credentials");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    // Generic error to prevent password guessing
    throw new ValidationError("Invalid credentials");
  }

  const tokens = createTokens(user._id.toString(), user.role, {
    name: user.name,
    email: user.email,
  });

  logger.info(`User logged in: ${user.email}`);

  return { user, tokens };
};

export const verifyToken = (token: string): { id: string; role: string } => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      role: string;
      iat: number;
      exp: number;
    };
    return { id: decoded.id, role: decoded.role };
  } catch (error) {
    throw new ValidationError("Invalid or expired token");
  }
};

/**
 * Exchange a refresh token for a new token pair.
 *
 * The refresh token is only ever accepted here — never as an access token on
 * an API route. The user's current role is read from the database rather than
 * from the token, so a role change takes effect on the next refresh rather
 * than lingering until the token expires.
 */
export const refreshTokens = async (
  refreshToken: string
): Promise<{ user: IUserDocument; tokens: TokenPair }> => {
  let decoded: { id: string; type?: string };

  try {
    decoded = jwt.verify(refreshToken, config.jwtSecret) as {
      id: string;
      type?: string;
    };
  } catch (error) {
    throw new ValidationError("Invalid or expired refresh token");
  }

  if (decoded.type !== "refresh") {
    throw new ValidationError("Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ValidationError("Invalid or expired refresh token");
  }

  const tokens = createTokens(user._id.toString(), user.role, {
    name: user.name,
    email: user.email,
  });

  logger.info(`Session refreshed for user: ${user.email}`);

  return { user, tokens };
};

export const createTokens = (
  userId: string,
  role: string,
  profile?: { name?: string; email?: string }
): TokenPair => {
  // The access token carries the user's display identity so the client can
  // render the signed-in profile without a second round-trip. The role claim
  // remains the authoritative source for authorization.
  const accessToken = jwt.sign(
    {
      id: userId,
      role,
      ...(profile?.name ? { name: profile.name } : {}),
      ...(profile?.email ? { email: profile.email } : {}),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as SignOptions
  );

  // Refresh token with longer expiration (optional, can be enabled in future)
  const refreshToken = jwt.sign(
    { id: userId, type: "refresh" },
    config.jwtSecret,
    { expiresIn: "7d" } as SignOptions
  );

  return { accessToken, refreshToken };
};

export default {
  register,
  login,
  verifyToken,
  refreshTokens,
  createTokens,
};
