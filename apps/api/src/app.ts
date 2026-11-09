import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "./config/database";
import { ApiResponse } from "./utils/response";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

/**
 * GET /api/v1/health
 * Health check endpoint executing a lightweight Prisma query to verify DB connectivity.
 * - HTTP 200 when API and PostgreSQL are healthy.
 * - HTTP 503 if the database cannot be reached.
 */
app.get("/api/v1/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    ApiResponse.success(
      res,
      {
        status: "healthy",
        database: "connected",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      "ProcurePilot API is running and database is healthy",
      200
    );
  } catch (error) {
    console.error("Health check database ping failed:", error);
    ApiResponse.error(
      res,
      "Database service unavailable",
      ["Database connection failed during health ping"],
      503
    );
  }
});

// API v1 Routes
app.use("/api/v1/dashboard", dashboardRoutes);

// 404 Not Found handler for unmatched routes
app.use(notFoundHandler);

// Centralized error handler (must be registered last)
app.use(errorHandler);

export default app;
