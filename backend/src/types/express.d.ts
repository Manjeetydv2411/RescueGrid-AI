import "express";

declare global {
  namespace Express {
    interface Response {
      success: (data: unknown, message?: string) => Response;
      created: (data: unknown, message?: string) => Response;
      error: (statusCode: number, message: string, details?: unknown) => Response;
    }
  }
}
