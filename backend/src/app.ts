import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/environment.js";
import { requestLogger, notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { responseFormatter } from "./middleware/responseFormatter.js";
import { isDatabaseReady, getDatabaseStatus } from "./services/databaseService.js";
import authRoutes from "./routes/authRoutes.js";
import incidentRoutes from "./routes/incidentRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import broadcastRoutes from "./routes/broadcastRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import evacuationRoutes from "./routes/evacuationRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import resourceAllocationRoutes from "./routes/resourceAllocationRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";

// Initialize Express app
const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(responseFormatter);
app.use(requestLogger);

// Health check endpoint
app.get("/api/v1/health", (_req, res) => {
  res.success({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Readiness endpoint - checks database connection status
app.get("/api/v1/ready", (_req, res) => {
  const status = getDatabaseStatus();
  if (status.connected) {
    res.success({
      status: "ready",
      message: "Database is connected and ready",
      database: status,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.success({
      status: "not_ready",
      message: "Database connection not established",
      database: status,
      timestamp: new Date().toISOString(),
    });
  }
});

// Auth routes
app.use("/api/v1/auth", authRoutes);

// Incident routes
app.use("/api/v1/incidents", incidentRoutes);

// Resource routes
app.use("/api/v1/resources", resourceRoutes);

// Assignment routes
app.use("/api/v1/assignments", assignmentRoutes);

// Notification routes
app.use("/api/v1/notifications", notificationRoutes);

// Broadcast routes
app.use("/api/v1/broadcasts", broadcastRoutes);

// AI service routes
app.use("/api/v1/ai", aiRoutes);

// Voice reporting routes
app.use("/api/v1/voice", voiceRoutes);

// Admin routes
app.use("/api/v1/admin", adminRoutes);

// Dashboard statistics routes
app.use("/api/v1/stats", statsRoutes);

// Evacuation routing routes
app.use("/api/v1/evacuation", evacuationRoutes);

// Analytics dashboard routes
app.use("/api/v1/analytics", analyticsRoutes);

// Intelligent resource allocation routes
app.use("/api/v1/allocation", resourceAllocationRoutes);

// AI Assistant routes
app.use("/api/v1/assistant", assistantRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Set port
app.set("port", config.port);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

export default app;
