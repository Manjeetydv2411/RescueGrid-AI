import { Router } from "express";
import * as aiController from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// AI service routes - all require authentication
router.use(authenticate);

// Category suggestion (POST /api/v1/ai/category-suggestion)
router.post("/category-suggestion", aiController.getCategorySuggestion);

// Summary generation (POST /api/v1/ai/summary/:incidentId)
router.post("/summary/:incidentId", aiController.generateSummary);

// Priority scoring (POST /api/v1/ai/priority/:incidentId)
router.post("/priority/:incidentId", aiController.getPriorityScore);

// Missing information detection (POST /api/v1/ai/missing-info/:incidentId)
router.post("/missing-info/:incidentId", aiController.getMissingInfo);

export default router;
