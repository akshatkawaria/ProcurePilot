/**
 * Base custom application error with HTTP status code and optional details.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: string[];

  constructor(message: string, statusCode = 500, errors: string[] = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request — Invalid syntax, parameters, or business validation failure.
 */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors: string[] = []) {
    super(message, 400, errors);
  }
}

/**
 * 401 Unauthorized — Authentication required or invalid/expired credentials.
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401);
  }
}

/**
 * 403 Forbidden — Authenticated but lacking required permissions/role.
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden - insufficient permissions") {
    super(message, 403);
  }
}

/**
 * 404 Not Found — Requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

/**
 * 409 Conflict — Resource already exists or state conflict (e.g. duplicate SKU).
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict", errors: string[] = []) {
    super(message, 409, errors);
  }
}

