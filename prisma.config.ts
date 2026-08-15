import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env files automatically (@prisma/config sets
// `dotenv: false`), so CLI commands would otherwise see no DATABASE_URL.
// Next.js loads .env.local on its own; this is only for the Prisma CLI.
// On Vercel the env vars are already present, so a missing file is fine.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No local env file — fall back to whatever the environment provides.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // Run by `prisma db seed` and after `prisma migrate reset`. tsx is used
    // because the seed imports the same recurrence code the app runs, rather
    // than keeping a second copy of the date maths in sync by hand.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run over the session-mode pooler (port 5432). The
    // transaction-mode pooler used at runtime cannot execute DDL reliably.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
