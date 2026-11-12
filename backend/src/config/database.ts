import mongoose, { Connection } from "mongoose";
import { config } from "./environment.js";
import { logger } from "../utils/logger.js";

let isConnected = false;
let connection: Connection | null = null;

export const connectDatabase = async (): Promise<void> => {
  if (isConnected && connection) {
    logger.info("Using existing database connection");
    return;
  }

  try {
    // Read the URI at connect time rather than from the frozen `config`
    // object: the test suite sets MONGODB_URI before connecting, and a
    // module-load-time snapshot would ignore it and point the tests at the
    // development database.
    //
    // The database name comes from the URI. Forcing a fixed dbName here
    // would silently redirect every connection away from the database the
    // operator asked for, which would have clearDatabase() wiping the
    // wrong one.
    const uri = process.env.MONGODB_URI || config.mongodbUri;
    await mongoose.connect(uri);
    connection = mongoose.connection;
    isConnected = true;

    logger.info(
      `Connected to MongoDB: ${connection.host}/${connection.name}`
    );
  } catch (error) {
    logger.error("MongoDB connection error:", error as Error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (isConnected && connection) {
    await mongoose.disconnect();
    isConnected = false;
    connection = null;
    logger.info("Disconnected from MongoDB");
  }
};

export const getDatabaseConnection = (): Connection | null => {
  return connection;
};

export const isDatabaseConnected = (): boolean => {
  return isConnected && connection !== null;
};

export const clearDatabase = async (): Promise<void> => {
  if (isConnected && connection) {
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

export default {
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  clear: clearDatabase,
  isConnected: isDatabaseConnected,
  getConnection: getDatabaseConnection,
};
