import { Router } from "express";
import * as voiceController from "../controllers/voiceController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post(
  "/transcribe",
  voiceController.transcribeAudioUploadMiddleware,
  voiceController.transcribeAudio
);

export default router;
