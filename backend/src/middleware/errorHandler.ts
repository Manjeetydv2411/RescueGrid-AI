import { ZodError } from "zod";

import { AppError } from "../utils/errors.js";

export const notFoundHandler = (
  req: import("express").Request,
  res: import("express").Response,
  _next: import("express").NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

export const errorHandler = (
  err: Error,
  _req: import("express").Request,
  res: import("express").Response,
  _next: import("express").NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
      },
    });
    return;
  }

  // A malformed request body or query string is the caller's mistake, not a
  // server fault. Without this branch Zod's error fell through to a 500,
  // which told the client "we broke" when it was their input that was wrong.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    // `path` is PropertyKey[], so a segment may be a symbol — String() each
    // one rather than calling join(), which would throw on a symbol.
    const field = first?.path.map(String).join(".");
    res.status(400).json({
      success: false,
      error: {
        message: field
          ? `${field}: ${first.message}`
          : "Request validation failed",
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
    },
  });
};

export const requestLogger = (
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
): void => {
  const userAgent = req.get("user-agent") || "";
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${req.method}] ${req.path} ${res.statusCode} ${userAgent} - ${duration}ms`
    );
  });

  next();
};
