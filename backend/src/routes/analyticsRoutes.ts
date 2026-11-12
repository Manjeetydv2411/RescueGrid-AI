import { Router } from "express";
import * as analyticsController from "../controllers/analyticsController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, analyticsController.getAnalytics);

export default router;
