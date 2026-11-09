import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";
import { ApiResponse } from "../utils/response";
import { BadRequestError } from "../utils/app-error";

export class DashboardController {
  /**
   * GET /api/v1/dashboard/summary
   * Fetches summary statistics for the active business dashboard.
   */
  static async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const businessId = req.businessId;

      // Defensive runtime check for business context
      if (!businessId) {
        throw new BadRequestError(
          "Business context is missing. Ensure tenant resolution middleware is configured."
        );
      }

      const summary = await DashboardService.getSummary(businessId);

      ApiResponse.success(
        res,
        summary,
        "Dashboard summary fetched successfully",
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
