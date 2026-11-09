import { Response } from "express";

/**
 * TypeScript contract for standardized success responses.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

/**
 * TypeScript contract for standardized error responses.
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: string[];
}

export type ApiResponsePayload<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Standard API response helper class matching ProcurePilot specifications.
 */
export class ApiResponse {
  /**
   * Send a standardized success response.
   *
   * @param res Express Response object
   * @param data Payload to return in `data` field
   * @param message Descriptive success message (default: "Request completed successfully")
   * @param statusCode HTTP status code (default: 200)
   */
  static success<T>(
    res: Response,
    data: T,
    message = "Request completed successfully",
    statusCode = 200
  ): Response<ApiSuccessResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      data,
      message,
    });
  }

  /**
   * Send a standardized error response.
   *
   * @param res Express Response object
   * @param message Descriptive error message (default: "Something went wrong")
   * @param errors Array of specific error strings (e.g. field validation errors)
   * @param statusCode HTTP status code (default: 500)
   */
  static error(
    res: Response,
    message = "Something went wrong",
    errors: string[] = [],
    statusCode = 500
  ): Response<ApiErrorResponse> {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }
}
