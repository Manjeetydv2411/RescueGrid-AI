import http from "http";
import { config } from "./config/environment.js";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { initSocketIO } from "./socket/index.js";
import { checkExpiredAssignments } from "./services/escalationService.js";

const PORT = config.port;

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocketIO(server);

// Connect to database before starting server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    server.listen(PORT, () => {
      logger.info(`RescueGrid AI API running at http://localhost:${PORT}`);
      logger.info(`Socket.IO real-time server ready`);
    });

    // Start background escalation check interval (every minute)
    setInterval(checkExpiredAssignments, 60 * 1000);
  } catch (error) {
    logger.error("Failed to start server:", error as Error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  io.close();
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
});

export { server, io };
