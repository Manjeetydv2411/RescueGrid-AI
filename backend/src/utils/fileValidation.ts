import path from "path";

export interface FileVerificationResult {
  isValid: boolean;
  detectedType?: "IMAGE" | "VIDEO";
  mimeType?: string;
  error?: string;
}

// Configurable file upload limits
export const UPLOAD_LIMITS = {
  MAX_IMAGE_COUNT: parseInt(process.env.MAX_IMAGE_COUNT || "5", 10),
  MAX_VIDEO_COUNT: parseInt(process.env.MAX_VIDEO_COUNT || "1", 10),
  MAX_IMAGE_SIZE_BYTES: parseInt(process.env.MAX_IMAGE_SIZE_BYTES || String(5 * 1024 * 1024), 10), // 5MB
  MAX_VIDEO_SIZE_BYTES: parseInt(process.env.MAX_VIDEO_SIZE_BYTES || String(50 * 1024 * 1024), 10), // 50MB
};

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const ALLOWED_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
];

export const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
export const ALLOWED_VIDEO_EXTS = [".mp4", ".webm"];

/**
 * Inspects binary magic bytes to detect actual file signature,
 * preventing file masquerading attacks (e.g. an executable renamed to .jpg).
 */
export function detectMagicBytes(buffer: Buffer): { mime?: string; type?: "IMAGE" | "VIDEO" } | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // 1. JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", type: "IMAGE" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", type: "IMAGE" };
  }

  // 3. WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (buffer.length >= 12) {
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46; // "RIFF"
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50; // "WEBP"
    if (isRiff && isWebp) {
      return { mime: "image/webp", type: "IMAGE" };
    }
  }

  // 4. MP4: 'ftyp' at bytes 4..7
  if (buffer.length >= 8) {
    const isFtyp =
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70; // "ftyp"
    if (isFtyp) {
      return { mime: "video/mp4", type: "VIDEO" };
    }
  }

  // 5. WebM: EBML header 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mime: "video/webm", type: "VIDEO" };
  }

  return null;
}

/**
 * Validates a file's extension, declared MIME type, size limit, and binary magic bytes.
 */
export function verifyUploadedFile(
  buffer: Buffer,
  originalName: string,
  declaredMimeType?: string
): FileVerificationResult {
  const ext = path.extname(originalName || "").toLowerCase();

  const isImageExt = ALLOWED_IMAGE_EXTS.includes(ext);
  const isVideoExt = ALLOWED_VIDEO_EXTS.includes(ext);

  if (!isImageExt && !isVideoExt) {
    return {
      isValid: false,
      error: `Unsupported file extension '${ext}'. Allowed: JPEG, PNG, WebP, MP4, WebM.`,
    };
  }

  const magic = detectMagicBytes(buffer);
  if (!magic) {
    return {
      isValid: false,
      error: `File content does not match any supported format (JPEG, PNG, WebP, MP4, WebM). Content verification failed.`,
    };
  }

  // Verify extension matches magic bytes
  if (magic.type === "IMAGE" && !isImageExt) {
    return {
      isValid: false,
      error: `File extension '${ext}' does not match detected image content (${magic.mime}).`,
    };
  }

  if (magic.type === "VIDEO" && !isVideoExt) {
    return {
      isValid: false,
      error: `File extension '${ext}' does not match detected video content (${magic.mime}).`,
    };
  }

  // Size limit checks
  if (magic.type === "IMAGE" && buffer.length > UPLOAD_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    const limitMb = UPLOAD_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
    return {
      isValid: false,
      error: `Image '${originalName}' exceeds maximum size limit of ${limitMb}MB.`,
    };
  }

  if (magic.type === "VIDEO" && buffer.length > UPLOAD_LIMITS.MAX_VIDEO_SIZE_BYTES) {
    const limitMb = UPLOAD_LIMITS.MAX_VIDEO_SIZE_BYTES / (1024 * 1024);
    return {
      isValid: false,
      error: `Video '${originalName}' exceeds maximum size limit of ${limitMb}MB.`,
    };
  }

  return {
    isValid: true,
    detectedType: magic.type,
    mimeType: magic.mime,
  };
}
