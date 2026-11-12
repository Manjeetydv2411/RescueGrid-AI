import { Router } from "express";
import * as evacuationController from "../controllers/evacuationController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/plan", authenticate, evacuationController.getEvacuationPlan);

export default router;
