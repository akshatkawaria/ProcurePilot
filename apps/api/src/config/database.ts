import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, tsx watch restarts the module on every change.
 * Without this pattern, each restart would create a new PrismaClient
 * and leak database connections.
 *
 * We attach the client to `globalThis` so it survives module reloads.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

