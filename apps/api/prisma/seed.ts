import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding for ProcurePilot...");

  // 1. Clean existing records in reverse dependency order
  console.log("🧹 Cleaning old records...");
  await prisma.payment.deleteMany();
  await prisma.approvalLog.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.supplierQuote.deleteMany();
  await prisma.supplierProduct.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  // 2. Create wholesale business tenant
  console.log("🏢 Creating wholesale business...");
  const business = await prisma.business.create({
    data: {
      name: "Apex Wholesale Foods",
      email: "admin@apexwholesale.com",
      phone: "+1-555-0199",
      address: "100 Industrial Parkway, Suite 4, Chicago, IL",
    },
  });

  // 3. Create initial users (Owner and Manager)
  console.log("👤 Creating users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      email: "owner@apexwholesale.com",
      passwordHash,
      firstName: "Alex",
      lastName: "Carter",
      role: UserRole.OWNER,
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: "manager@apexwholesale.com",
      passwordHash,
      firstName: "Jordan",
      lastName: "Taylor",
      role: UserRole.MANAGER,
    },
  });

  // 4. Create products
  console.log("📦 Creating products...");
  const productsData = [
    {
      sku: "COF-ARA-005",
      name: "Premium Arabica Coffee Beans (5 lb bag)",
      category: "Beverages",
      unit: "bag",
      description: "Fair-trade dark roast Arabica whole bean coffee.",
    },
    {
      sku: "OIL-EVO-005",
      name: "Extra Virgin Olive Oil (5L Tin)",
      category: "Pantry",
      unit: "tin",
      description: "Cold-pressed Mediterranean extra virgin olive oil.",
    },
    {
      sku: "OAT-ROL-025",
      name: "Organic Rolled Oats (25 lb bag)",
      category: "Grains",
      unit: "bag",
      description: "Certified organic gluten-free rolled oats.",
    },
    {
      sku: "MLK-ALM-012",
      name: "Almond Milk Unsweetened (12x1L Case)",
      category: "Dairy Alternatives",
      unit: "case",
      description: "Barista-grade unsweetened almond milk case.",
    },
    {
      sku: "HNY-CLV-001",
      name: "Raw Clover Honey (1 Gallon Jug)",
      category: "Sweeteners",
      unit: "jug",
      description: "100% pure raw unfiltered clover honey.",
    },
    {
      sku: "SED-CHI-010",
      name: "Organic Chia Seeds (10 lb bag)",
      category: "Superfoods",
      unit: "bag",
      description: "Black organic nutrient-dense chia seeds.",
    },
  ];

  const products = await Promise.all(
    productsData.map((p) =>
      prisma.product.create({
        data: {
          businessId: business.id,
          ...p,
        },
      })
    )
  );

  const productMap = new Map(products.map((p) => [p.sku, p]));

  // 5. Create Inventory levels (deliberately create LOW STOCK items to trigger restock logic)
  console.log("📊 Setting inventory levels...");
  const inventoryConfig = [
    { sku: "COF-ARA-005", currentStock: 4, reorderLevel: 15, reorderQuantity: 20 },  // LOW STOCK
    { sku: "OIL-EVO-005", currentStock: 3, reorderLevel: 10, reorderQuantity: 15 },  // LOW STOCK
    { sku: "OAT-ROL-025", currentStock: 25, reorderLevel: 10, reorderQuantity: 15 }, // HEALTHY
    { sku: "MLK-ALM-012", currentStock: 5, reorderLevel: 12, reorderQuantity: 20 },  // LOW STOCK
    { sku: "HNY-CLV-001", currentStock: 18, reorderLevel: 8, reorderQuantity: 10 },  // HEALTHY
    { sku: "SED-CHI-010", currentStock: 2, reorderLevel: 8, reorderQuantity: 10 },   // LOW STOCK
  ];

  for (const inv of inventoryConfig) {
    const prod = productMap.get(inv.sku)!;
    await prisma.inventory.create({
      data: {
        businessId: business.id,
        productId: prod.id,
        currentStock: inv.currentStock,
        reorderLevel: inv.reorderLevel,
        reorderQuantity: inv.reorderQuantity,
        lastRestocked: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      },
    });
  }

  // 6. Generate 30 days of historical sales records for forecasting
  console.log("📈 Generating 30 days of historical sales records...");
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Average daily sales rate and price per product
  const salesProfiles: Record<string, { avgQty: number; unitPrice: number }> = {
    "COF-ARA-005": { avgQty: 3, unitPrice: 32.0 },  // ~3 bags/day (~$96/day)
    "OIL-EVO-005": { avgQty: 2, unitPrice: 48.0 },  // ~2 tins/day (~$96/day)
    "OAT-ROL-025": { avgQty: 1, unitPrice: 22.0 },  // ~1 bag/day
    "MLK-ALM-012": { avgQty: 3, unitPrice: 29.5 },  // ~3 cases/day
    "HNY-CLV-001": { avgQty: 1, unitPrice: 38.0 },  // ~1 jug/day
    "SED-CHI-010": { avgQty: 1, unitPrice: 26.0 },  // ~1 bag/day
  };

  const salesToInsert: Array<{
    businessId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    soldAt: Date;
  }> = [];

  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const saleDate = new Date(now - dayOffset * DAY_MS);

    for (const [sku, profile] of Object.entries(salesProfiles)) {
      const prod = productMap.get(sku)!;
      // Slight daily variation: +/- 1 around average
      const variation = (dayOffset % 3 === 0 ? 1 : dayOffset % 2 === 0 ? -1 : 0);
      const quantity = Math.max(1, profile.avgQty + variation);
      const total = Number((quantity * profile.unitPrice).toFixed(2));

      salesToInsert.push({
        businessId: business.id,
        productId: prod.id,
        quantity,
        unitPrice: profile.unitPrice,
        total,
        soldAt: saleDate,
      });
    }
  }

  await prisma.sale.createMany({
    data: salesToInsert,
  });

  // 7. Create 3 competing wholesale suppliers
  console.log("🤝 Creating suppliers and product catalogs...");
  const supplierA = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Global Harvest Foods",
      contactEmail: "orders@globalharvest.com",
      contactPhone: "+1-800-555-0111",
      address: "500 Logistics Blvd, Atlanta, GA",
      reliabilityScore: 0.95, // Highly reliable
      qualityScore: 0.92,     // Premium quality
    },
  });

  const supplierB = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Direct Farm Supply Co.",
      contactEmail: "sales@directfarmsupply.com",
      contactPhone: "+1-800-555-0222",
      address: "12 Rural Route 9, Des Moines, IA",
      reliabilityScore: 0.82, // Moderate reliability
      qualityScore: 0.80,     // Standard quality, lowest prices
    },
  });

  const supplierC = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Metro Wholesale Distributors",
      contactEmail: "info@metrowholesale.com",
      contactPhone: "+1-800-555-0333",
      address: "88 Commercial Ave, Chicago, IL",
      reliabilityScore: 0.89, // Good reliability
      qualityScore: 0.87,     // Fast local 1-2 day delivery
    },
  });

  // 8. Link suppliers to products with varying prices, MOQ, and delivery days
  // Format: [supplierId, sku, unitPrice, minOrderQty, deliveryDays]
  const catalogEntries: Array<[string, string, number, number, number]> = [
    // Coffee: Supplier B cheapest ($16.00), Supplier C fast ($17.20), Supplier A reliable ($18.50)
    [supplierA.id, "COF-ARA-005", 18.5, 5, 2],
    [supplierB.id, "COF-ARA-005", 16.0, 10, 5],
    [supplierC.id, "COF-ARA-005", 17.2, 5, 2],

    // Olive Oil: Supplier B cheapest ($24.00), Supplier C ($26.50), Supplier A ($28.00)
    [supplierA.id, "OIL-EVO-005", 28.0, 3, 2],
    [supplierB.id, "OIL-EVO-005", 24.0, 5, 5],
    [supplierC.id, "OIL-EVO-005", 26.5, 3, 3],

    // Rolled Oats
    [supplierB.id, "OAT-ROL-025", 12.0, 5, 4],
    [supplierC.id, "OAT-ROL-025", 13.5, 4, 2],

    // Almond Milk: Supplier C ($15.50), Supplier A ($16.80)
    [supplierA.id, "MLK-ALM-012", 16.8, 5, 2],
    [supplierC.id, "MLK-ALM-012", 15.5, 6, 2],

    // Raw Honey
    [supplierA.id, "HNY-CLV-001", 22.0, 2, 3],
    [supplierB.id, "HNY-CLV-001", 19.5, 5, 6],

    // Chia Seeds
    [supplierB.id, "SED-CHI-010", 13.5, 5, 5],
    [supplierC.id, "SED-CHI-010", 14.8, 4, 2],
  ];

  for (const [supplierId, sku, unitPrice, minOrderQty, deliveryDays] of catalogEntries) {
    const prod = productMap.get(sku)!;
    await prisma.supplierProduct.create({
      data: {
        supplierId,
        productId: prod.id,
        unitPrice,
        minOrderQty,
        deliveryDays,
        isAvailable: true,
      },
    });
  }

  // 9. Add initial supplier quotations
  console.log("📝 Adding initial supplier quotations...");
  const validUntil = new Date(Date.now() + 30 * DAY_MS); // Valid for next 30 days

  await prisma.supplierQuote.create({
    data: {
      supplierId: supplierA.id,
      productId: productMap.get("COF-ARA-005")!.id,
      unitPrice: 17.8, // Special quoted discount from $18.50
      quantity: 15,
      totalPrice: Number((17.8 * 15).toFixed(2)),
      validUntil,
      notes: "Bulk discount quote for 15+ bags.",
    },
  });

  await prisma.supplierQuote.create({
    data: {
      supplierId: supplierC.id,
      productId: productMap.get("OIL-EVO-005")!.id,
      unitPrice: 25.0, // Special quote from $26.50
      quantity: 10,
      totalPrice: Number((25.0 * 10).toFixed(2)),
      validUntil,
      notes: "Seasonal promo quote on extra virgin olive oil.",
    },
  });

  console.log("\n✅ Database seed completed successfully!");
  console.log(`- Business ID: ${business.id}`);
  console.log(`- Owner Login: ${owner.email} / password123`);
  console.log(`- Products created: ${products.length}`);
  console.log(`- Low-stock items ready for procurement: 4`);
  console.log(`- Historical sales records: ${salesToInsert.length} (30 days)`);
  console.log(`- Suppliers created: 3 with catalogs and quotes`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

