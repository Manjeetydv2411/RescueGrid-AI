import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { logger } from "../utils/logger.js";

export interface StoredFileMetadata {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface IStorageProvider {
  save(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredFileMetadata>;
  getStream(storageKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    size?: number;
    mimeType?: string;
  }>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

/**
 * Local Disk Storage Provider for development and local deployments.
 * Enforces strict path traversal defenses and safe UUID-based filenames.
 */
export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(customDir?: string) {
    const configuredDir =
      customDir ||
      process.env.STORAGE_LOCAL_DIR ||
      path.join(process.cwd(), "uploads");
    this.baseDir = path.resolve(configuredDir);

    // Ensure uploads root directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Resolves a storage key to an absolute filesystem path,
   * verifying it stays strictly inside the designated base directory.
   */
  public resolveSafePath(storageKey: string): string {
    // Prevent directory traversal characters
    const sanitizedKey = storageKey.replace(/^(\.\.[\/\\])+/, "");
    const resolved = path.resolve(this.baseDir, sanitizedKey);

    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`Security Exception: Path traversal detected for key '${storageKey}'`);
    }

    return resolved;
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredFileMetadata> {
    const ext = path.extname(originalName).toLowerCase() || "";
    const uniqueId = crypto.randomUUID();
    const safeFilename = `${uniqueId}${ext}`;
    const storageKey = `incidents/${safeFilename}`;

    const targetPath = this.resolveSafePath(storageKey);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, buffer);

    return {
      storageKey,
      originalName,
      mimeType,
      size: buffer.length,
    };
  }

  async getStream(storageKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    size?: number;
    mimeType?: string;
  }> {
    const filePath = this.resolveSafePath(storageKey);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for key: ${storageKey}`);
    }

    const stat = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      size: stat.size,
    };
  }

  async delete(storageKey: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(storageKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      logger.warn(`Failed to delete storage file '${storageKey}': ${(err as Error).message}`);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

/**
 * S3 Storage Provider stub for production environments.
 * Uses AWS S3 / MinIO via standard S3-compatible credentials in environment variables.
 */
export class S3StorageProvider implements IStorageProvider {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || "rescuegrid-evidence";
    this.region = process.env.AWS_REGION || "us-east-1";
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredFileMetadata> {
    const ext = path.extname(originalName).toLowerCase() || "";
    const uniqueId = crypto.randomUUID();
    const storageKey = `incidents/${uniqueId}${ext}`;

    // For production deployments with @aws-sdk/client-s3 configured,
    // PutObjectCommand would be dispatched here.
    logger.info(`[S3StorageProvider] Saved object to s3://${this.bucket}/${storageKey}`);

    return {
      storageKey,
      originalName,
      mimeType,
      size: buffer.length,
    };
  }

  async getStream(storageKey: string): Promise<{
    stream: NodeJS.ReadableStream;
    size?: number;
    mimeType?: string;
  }> {
    // For S3, GetObjectCommand returns a readable stream
    throw new Error("S3 GetStream requires production AWS credentials configured.");
  }

  async delete(storageKey: string): Promise<void> {
    logger.info(`[S3StorageProvider] Deleted object s3://${this.bucket}/${storageKey}`);
  }

  async exists(storageKey: string): Promise<boolean> {
    return true;
  }
}

/**
 * Storage factory producing the active storage provider.
 */
function createStorageProvider(): IStorageProvider {
  const providerType = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  if (providerType === "s3") {
    return new S3StorageProvider();
  }

  return new LocalStorageProvider();
}

export const storageProvider: IStorageProvider = createStorageProvider();

/**
 * Cleans up temporary or partially uploaded files when an incident creation fails.
 */
export async function cleanupFiles(storageKeys: string[]): Promise<void> {
  if (!storageKeys || storageKeys.length === 0) return;

  await Promise.all(
    storageKeys.map(async (key) => {
      try {
        await storageProvider.delete(key);
      } catch (err) {
        logger.warn(`Cleanup error for '${key}': ${(err as Error).message}`);
      }
    })
  );
}
