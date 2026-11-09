import { prisma } from "../config/database";

export interface DashboardSummaryData {
  totalProducts: number;
  lowStockCount: number;
  totalSuppliers: number;
  recentSalesTotal: number;
}

export class DashboardService {
  /**
   * Retrieves the core dashboard summary metrics scoped to a specific business.
   *
   * @param businessId The UUID/text ID of the business tenant.
   * @returns Aggregated metrics: total products, low stock count, suppliers, and 7-day sales.
   */
  static async getSummary(businessId: string): Promise<DashboardSummaryData> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Run independent aggregation queries in parallel for high performance
    const [totalProducts, totalSuppliers, salesAggregate, lowStockResult] = await Promise.all([
      // 1. Total products belonging to this business
      prisma.product.count({
        where: { businessId },
      }),

      // 2. Total suppliers belonging to this business
      prisma.supplier.count({
        where: { businessId },
      }),

      // 3. Sum of sales amounts over the most recent 7 days (rolling window)
      prisma.sale.aggregate({
        where: {
          businessId,
          soldAt: { gte: sevenDaysAgo },
        },
        _sum: {
          total: true,
        },
      }),

      // 4. Inventory records where current stock is less than or equal to product reorder threshold
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM inventory
        WHERE business_id = ${businessId}
          AND current_stock <= reorder_level
      `,
    ]);

    // Handle nullable sales sum: keep numeric with two decimal places, default to 0 when null
    const rawSalesTotal = salesAggregate._sum.total;
    const recentSalesTotal =
      rawSalesTotal !== null && rawSalesTotal !== undefined
        ? Math.round(Number(rawSalesTotal) * 100) / 100
        : 0;

    const lowStockCount = lowStockResult[0]?.count ?? 0;

    return {
      totalProducts,
      lowStockCount,
      totalSuppliers,
      recentSalesTotal,
    };
  }
}
