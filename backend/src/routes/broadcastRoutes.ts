import { Router } from "express";
import * as broadcastController from "../controllers/broadcastController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// All broadcast routes require authentication
router.use(authenticate);

// Preview broadcast recipient counts without sending notifications (ADMIN & COORDINATOR only)
router.post("/preview", authorize("ADMIN", "COORDINATOR"), broadcastController.previewBroadcast);

// Only ADMIN and COORDINATOR (dispatchers) can create emergency broadcasts
router.post("/", authorize("ADMIN", "COORDINATOR"), broadcastController.createBroadcast);

// Any authenticated user can list and view broadcasts
router.get("/", broadcastController.listBroadcasts);
router.get("/:id", broadcastController.getBroadcast);

export default router;
