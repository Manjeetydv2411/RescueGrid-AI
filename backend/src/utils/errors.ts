export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string = "Resource", id?: string) {
    super(id ? `${entity} not found with id: ${id}` : `${entity} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

/**
 * A dependent service (the AI service) could not be reached or failed.
 *
 * This is a 503 rather than a 500: the request itself was fine, and the
 * caller can retry once the dependency recovers.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable") {
    super(message, 503);
  }
}

export default {
  ValidationError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ServiceUnavailableError,
};
