import { Router } from "express";
import * as assignmentController from "../controllers/assignmentController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Reads require a session: an assignment exposes the responder's name,
// email, and phone number.
router.get("/", authenticate, assignmentController.listAssignments);

// Protected routes
router.post("/incidents/:incidentId", authenticate, assignmentController.createAssignment);
// Must be declared before "/:id" so "responders" is not parsed as an id.
router.get("/responders", authenticate, assignmentController.listResponders);
router.get("/:id", authenticate, assignmentController.getAssignmentById);
router.put("/:id", authenticate, assignmentController.updateAssignment);
router.delete("/:id", authenticate, assignmentController.deleteAssignment);

// Assignment by responder
router.get("/responder/:responderId", authenticate, assignmentController.getAssignmentsByResponder);

// Assignment by incident
router.get("/incidents/:incidentId", authenticate, assignmentController.getAssignmentsByIncident);

// Recommendations
router.get("/recommendations/:incidentId", authenticate, assignmentController.getRecommendations);

// Cancel assignment
router.post("/:id/cancel", authenticate, assignmentController.cancelAssignment);

export default router;
