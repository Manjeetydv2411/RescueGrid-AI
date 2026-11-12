import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { UPLOAD_LIMITS } from "../utils/fileValidation.js";

// Buffer uploads in memory for magic bytes verification before saving to storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: Math.max(
      UPLOAD_LIMITS.MAX_VIDEO_SIZE_BYTES,
      UPLOAD_LIMITS.MAX_IMAGE_SIZE_BYTES
    ),
    files: UPLOAD_LIMITS.MAX_IMAGE_COUNT + UPLOAD_LIMITS.MAX_VIDEO_COUNT,
  },
});

const uploadFields = upload.fields([
  { name: "images", maxCount: UPLOAD_LIMITS.MAX_IMAGE_COUNT },
  { name: "video", maxCount: UPLOAD_LIMITS.MAX_VIDEO_COUNT },
]);

/**
 * Middleware that handles multipart file uploads for incidents.
 * If the request is not multipart/form-data, it safely continues to allow standard JSON payloads.
 */
export const incidentUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          error: {
            message: `Uploaded file exceeds maximum allowed size.`,
          },
        });
        return;
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({
          success: false,
          error: {
            message: `Too many files uploaded. Maximum ${UPLOAD_LIMITS.MAX_IMAGE_COUNT} images and ${UPLOAD_LIMITS.MAX_VIDEO_COUNT} video allowed.`,
          },
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: {
          message: `Upload error: ${err.message}`,
        },
      });
      return;
    } else if (err) {
      res.status(400).json({
        success: false,
        error: {
          message: err.message || "Failed to process uploaded files.",
        },
      });
      return;
    }
    next();
  });
};
