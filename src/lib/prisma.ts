import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev mode hot-reloads modules on every edit, which would otherwise
 * open a new connection pool each time until MySQL refuses them. Cache the
 * client on globalThis so reloads reuse one pool.
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
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
