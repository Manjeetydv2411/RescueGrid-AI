import { Router } from "express";
import * as incidentController from "../controllers/incidentController.js";
import { authenticate } from "../middleware/auth.js";
import { incidentUploadMiddleware } from "../middleware/upload.js";

const router = Router();

// Reads require a session: an incident record carries the reporter's name
// and email, so it must not be readable anonymously.
router.get("/", authenticate, incidentController.listIncidents);
router.get("/nearby", authenticate, incidentController.getNearbyIncidents);

// Protected routes - multipart upload middleware for POST
router.post("/", authenticate, incidentUploadMiddleware, incidentController.createIncident);
router.get("/:id", authenticate, incidentController.getIncidentById);
router.put("/:id", authenticate, incidentController.updateIncident);
router.delete("/:id", authenticate, incidentController.deleteIncident);

// Attachment routes
router.get(
  "/:id/attachments",
  authenticate,
  incidentController.listIncidentAttachments
);
router.get(
  "/:id/attachments/:attachmentId",
  authenticate,
  incidentController.getAttachment
);

// Assignment routes
router.post("/:id/assign", authenticate, incidentController.assignIncident);
router.post("/:id/unassign", authenticate, incidentController.unassignIncident);

export default router;
