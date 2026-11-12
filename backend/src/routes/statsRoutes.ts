import { Router } from "express";
import * as statsController from "../controllers/statsController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Dashboard statistics require an authenticated session.
router.get("/", authenticate, statsController.getDashboardStats);

export default router;
