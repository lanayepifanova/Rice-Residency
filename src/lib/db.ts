import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 removed the `datasources` / `datasourceUrl` constructor options.
// Connections now go through a driver adapter, so the URL is supplied here
// rather than in prisma/schema.prisma.
//
// DATABASE_URL must point at the transaction-mode pooler (port 6543). The
// direct host (db.<ref>.supabase.co) is IPv6-only and unreachable from
// serverless platforms.
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. See .env.local.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next.js dev-mode hot reloading re-evaluates modules on every change, which
// would otherwise open a new connection pool each time and exhaust the
// pooler's client limit.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
