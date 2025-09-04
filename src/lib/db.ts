import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 removed the `datasources` / `datasourceUrl` constructor options.
// Connections now go through a driver adapter, so the URL is supplied here
// rather than in prisma/schema.prisma.
//
// DATABASE_URL points at Postgres. Locally that is this machine, and the data
// lives on disk in the Postgres data directory, so it outlives the dev server,
// the browser, and a reboot.
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

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  client ??= globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

/**
 * Built on first query, not on import.
 *
 * `next build` imports every route to read its configuration, and it does that
 * in an environment that has no reason to hold a database URL — Vercel's build
 * container runs before the project's database is necessarily attached. A
 * client constructed at module scope turned that import into a build failure
 * ("Failed to collect configuration for /s/[token]"), even though no page asks
 * for a row at build time: every one of them is `force-dynamic`.
 *
 * Deferring construction to the first property access keeps the missing-URL
 * error where it is useful — the first request that actually wants data — and
 * lets the build read the module without a database in reach.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = instance[property as keyof PrismaClient];

    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in getClient();
  },
});
