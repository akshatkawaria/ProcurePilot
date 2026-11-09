import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/app-error";

// Extend Express Request interface to include businessId
declare global {
  namespace Express {
    interface Request {
      businessId?: string;
    }
  }
}

/**
 * Temporary Tenant Resolution Middleware (Development / Demo Mechanism).
 *
 * Resolves the businessId context for business-scoped routes:
 * 1. Checks `req.headers["x-business-id"]` if supplied (useful for automated tests).
 * 2. Falls back to selecting the oldest-created business record in the database
 *    (e.g., the seeded demo business Apex Wholesale Foods).
 *
 * IMPORTANT SECURITY NOTE:
 * Both `x-business-id` header inspection and the oldest-created fallback are temporary
 * development mechanisms for Milestone 6. They must NOT be trusted for production
 * authorization. In Milestone 7, verified JWT authentication will derive `req.businessId`
 * securely from the authenticated token claims.
 */
export async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const headerBusinessId = req.headers["x-business-id"];

    if (typeof headerBusinessId === "string" && headerBusinessId.trim()) {
      const exists = await prisma.business.findUnique({
        where: { id: headerBusinessId.trim() },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundError(`Business with ID '${headerBusinessId}' not found`);
      }

      req.businessId = exists.id;
      return next();
    }

    // Default fallback: select the oldest-created business in the database
    const defaultBusiness = await prisma.business.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (!defaultBusiness) {
      throw new NotFoundError(
        "No business record found in the database. Please run the database seed script."
      );
    }

    req.businessId = defaultBusiness.id;
    next();
  } catch (error) {
    next(error);
  }
}
