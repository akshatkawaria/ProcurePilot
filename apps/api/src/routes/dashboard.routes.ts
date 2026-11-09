import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { tenantMiddleware } from "../middleware/tenant.middleware";

const router = Router();

// Ensure business context is resolved for all dashboard endpoints
router.use(tenantMiddleware);

// GET /api/v1/dashboard/summary
router.get("/summary", DashboardController.getSummary);

export default router;

