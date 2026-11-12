import { Router } from "express";
import * as assistantController from "../controllers/assistantController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/chat", authenticate, assistantController.chat);

export default router;
