import { AssignmentStatus } from "../types/models.js";
import Assignment from "../models/Assignment.js";
import * as assignmentService from "../services/assignmentService.js";
import * as notificationService from "../services/notificationService.js";
import { logger } from "../utils/logger.js";

// Check for expired assignments every minute
export const checkExpiredAssignments = async () => {
  try {
    const threshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes

    const expiredAssignments = await Assignment.find({
      status: AssignmentStatus.PENDING,
      createdAt: { $lt: threshold },
    });

    for (const assignment of expiredAssignments) {
      logger.info(`Assignment expired: ${assignment._id}`);

      // Update status to EXPIRED
      await assignmentService.updateAssignment(
        assignment._id.toString(),
        { status: AssignmentStatus.EXPIRED },
        "system",
        "ADMIN"
      );

      // Notify the responder (optional, but good practice)
      await notificationService.notify({
        userId: assignment.responderId.toString(),
        type: "ASSIGNMENT",
        title: "Dispatch Expired",
        message: `Your dispatch to incident ${assignment.incidentId} has expired.`,
        relatedId: assignment.incidentId.toString(),
      });

      // Re-trigger recommendation process for this incident?
      // For now, just mark expired.
    }
  } catch (error) {
    logger.error("Error checking expired assignments:", error);
  }
};
