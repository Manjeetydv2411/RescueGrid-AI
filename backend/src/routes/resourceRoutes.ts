import { Router } from "express";
import * as resourceController from "../controllers/resourceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Reads require a session: a resource record carries the contact details of
// the unit that owns it, so it must not be readable anonymously.
router.get("/", authenticate, resourceController.listResources);
router.get("/nearby", authenticate, resourceController.getNearbyResources);

// Protected routes
router.post("/", authenticate, authorize("ADMIN", "COORDINATOR"), resourceController.createResource);
router.get("/:id", authenticate, resourceController.getResourceById);
router.put("/:id", authenticate, authorize("ADMIN", "COORDINATOR"), resourceController.updateResource);
router.delete("/:id", authenticate, authorize("ADMIN", "COORDINATOR"), resourceController.deleteResource);

// Availability routes
router.patch("/:id/availability", authenticate, authorize("ADMIN", "COORDINATOR"), resourceController.updateAvailability);

export default router;
