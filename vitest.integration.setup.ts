/**
 * Integration tests are run by the Vitest CLI, not by Next.js, so nothing has
 * loaded .env.local for them. Prisma 7 does not read env files either.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to whatever the environment already provides, which is how this
  // runs in CI.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for integration tests. Copy .env.example to .env.local and fill it in.",
  );
}
