import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieSecure: boolean;
  cookieSameSite: "lax" | "strict" | "none";
  aiServiceUrl: string;
}

/**
 * The fallback secret used when JWT_SECRET is unset.
 *
 * It is a constant, not a secret, so it is only acceptable in development —
 * see `validateConfig`.
 */
export const DEVELOPMENT_JWT_SECRET = "development-secret-key-change-in-production";

const validateConfig = (config: EnvConfig): void => {
  const requiredKeys: (keyof EnvConfig)[] = [
    "nodeEnv",
    "port",
    "mongodbUri",
    "jwtSecret",
    "jwtExpiresIn",
  ];
  const missingKeys = requiredKeys.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    console.error(`Missing required environment variables: ${missingKeys.join(", ")}`);
    process.exit(1);
  }

  // The development fallback is compiled into the source, so it is not a
  // secret. Running production on it would let anyone who has read the
  // repository forge a token for any account, including an admin one.
  if (
    config.nodeEnv === "production" &&
    config.jwtSecret === DEVELOPMENT_JWT_SECRET
  ) {
    console.error(
      "JWT_SECRET is still set to the built-in development value. " +
        "Set a unique secret before running in production."
    );
    process.exit(1);
  }
};

export const config: EnvConfig = {
  nodeEnv: (process.env.NODE_ENV || "development") as string,
  port: Number(process.env.PORT) || 4000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/rescuegrid",
  jwtSecret: process.env.JWT_SECRET || DEVELOPMENT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  cookieSecure: process.env.NODE_ENV === "production",
  cookieSameSite: (process.env.COOKIE_SAME_SITE as "lax" | "strict" | "none") || "lax",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://127.0.0.1:8000",}

validateConfig(config);

export default {
  nodeEnv: config.nodeEnv,
  port: config.port,
  mongodbUri: config.mongodbUri,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  cookieSecure: config.cookieSecure,
  cookieSameSite: config.cookieSameSite,
  aiServiceUrl: config.aiServiceUrl,
};
