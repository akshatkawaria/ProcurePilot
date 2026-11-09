import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod/v4";
import { Prisma } from "@prisma/client";
import { AppError, NotFoundError } from "../utils/app-error";
import { ApiResponse } from "../utils/response";

/**
 * 404 Not Found fallback handler for unmatched routes.
 * Emits a JSON error conforming to the standard API error contract.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Centralized Express error-handling middleware.
 * Intercepts all thrown exceptions and formats them into standard API responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // Express requires all 4 parameters to register this as an error-handling middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. Handled Application Errors (custom domain errors)
  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.errors, err.statusCode);
    return;
  }

  // 2. Zod Request Validation Errors
  if (err instanceof ZodError) {
    const errorMessages = err.issues.map((issue) => {
      const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${fieldPath}: ${issue.message}`;
    });

    ApiResponse.error(res, "Request validation failed", errorMessages, 400);
    return;
  }

  // 3. Prisma Known Database Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[]) || ["field"];
        const fieldList = Array.isArray(target) ? target.join(", ") : String(target);
        ApiResponse.error(
          res,
          `A record with this ${fieldList} already exists`,
          [`Unique constraint violation on: ${fieldList}`],
          409
        );
        return;
      }
      case "P2025": {
        ApiResponse.error(
          res,
          "The requested record was not found",
          ["Record does not exist or has already been deleted"],
          404
        );
        return;
      }
      case "P2003": {
        ApiResponse.error(
          res,
          "Invalid relationship reference",
          ["Foreign key constraint violation: referenced record does not exist"],
          400
        );
        return;
      }
      case "P2014": {
        ApiResponse.error(
          res,
          "Relation constraint violation",
          ["The requested change would violate a required relationship"],
          400
        );
        return;
      }
      default: {
        ApiResponse.error(
          res,
          "Database operation failed",
          ["A database constraint or validation error occurred"],
          400
        );
        return;
      }
    }
  }

  // 4. Prisma Connection / Initialization Errors
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error("Database connection failure:", err.message);
    ApiResponse.error(
      res,
      "Database service unavailable",
      ["Could not establish a connection to the database"],
      503
    );
    return;
  }

  // 5. Malformed JSON payload syntax error in body
  if (err instanceof SyntaxError && "body" in err) {
    ApiResponse.error(res, "Invalid JSON payload in request body", [err.message], 400);
    return;
  }

  // 6. Generic unhandled internal server errors
  console.error("Unhandled Server Error:", err);
  const isDev = process.env.NODE_ENV !== "production";
  ApiResponse.error(
    res,
    "Internal server error",
    isDev && err.message ? [err.message] : [],
    500
  );
}
