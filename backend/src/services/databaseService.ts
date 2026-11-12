import { connectDatabase, disconnectDatabase, clearDatabase, isDatabaseConnected } from "../config/database.js";
import { logger } from "../utils/logger.js";

export const initializeDatabase = async (): Promise<void> => {
  logger.info("Initializing database connection...");
  await connectDatabase();
};

export const closeDatabase = async (): Promise<void> => {
  logger.info("Closing database connection...");
  await disconnectDatabase();
};

export const isDatabaseReady = (): boolean => {
  return isDatabaseConnected();
};

export const getDatabaseStatus = (): {
  connected: boolean;
  timestamp: string;
} => {
  return {
    connected: isDatabaseConnected(),
    timestamp: new Date().toISOString(),
  };
};

export default {
  initialize: initializeDatabase,
  close: closeDatabase,
  isReady: isDatabaseReady,
  getStatus: getDatabaseStatus,
};
