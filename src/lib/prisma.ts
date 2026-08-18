import { PrismaClient } from "@prisma/client";

/**
 * The database client, constructed lazily.
 *
 * Two reasons it is a proxy rather than a plain `new PrismaClient()`:
 *
 *  1. Next.js dev mode hot-reloads modules on every edit, which would open a
 *     new connection pool each time until MySQL refuses them. The client is
 *     cached on globalThis so reloads reuse one pool.
 *
 *  2. This build deploys to hosts with no database. `new PrismaClient()`
 *     validates the datasource at construction, so building it at module
 *     scope would throw during `next build` on any page that merely imports
 *     this file — before any query, and before any try/catch could help.
 *     Deferring construction to first property access means importing is
 *     always safe, and only an actual query can fail (see `optional()`).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function client(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const created = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

  // In production a module is evaluated once, so the local binding is enough;
  // caching globally there would outlive a serverless invocation for nothing.
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

let cached: PrismaClient | null = null;
const get = (): PrismaClient => (cached ??= client());

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(get() as object, prop, receiver);
  },
  has(_target, prop) {
    return prop in (get() as object);
  },
});

export default prisma;
