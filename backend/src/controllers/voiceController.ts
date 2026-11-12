import { Request, Response, NextFunction } from "express";
import multer from "multer";
import * as aiService from "../services/aiService.js";
import { storageProvider, cleanupFiles } from "../services/storageService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max for audio
    files: 1,
  },
}).single("audio");

export const transcribeAudioUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).json({
        success: false,
        error: { message: err.message || "Failed to upload audio file." },
      });
      return;
    }
    next();
  });
};

export const transcribeAudio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let storedKey: string | null = null;
  try {
    const file = req.file;
    if (!file) {
      res.error(400, "Audio file is required");
      return;
    }

    // Validate MIME type
    const allowedMimes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "video/webm"];
    if (!allowedMimes.includes(file.mimetype) && !file.originalname.match(/\.(webm|mp4|mp3|wav|ogg)$/i)) {
      res.error(400, "Unsupported audio format. Please provide WebM, MP4, MP3, WAV, or OGG.");
      return;
    }

    // Store temporarily for transcription processing
    const stored = await storageProvider.save(file.buffer, file.originalname, file.mimetype);
    storedKey = stored.storageKey;

    // Call AI transcription service or extract structured incident fields
    const transcriptResult = await aiService.aiClient.transcribeAudio(file.buffer, file.originalname);

    if (storedKey) {
      await cleanupFiles([storedKey]);
    }

    res.success(transcriptResult);
  } catch (error) {
    if (storedKey) {
      await cleanupFiles([storedKey]).catch(() => {});
    }
    next(error);
  }
};
