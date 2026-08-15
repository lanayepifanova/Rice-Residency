import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a real Postgres database, because the things
 * they check — transactional capacity, unique-index dedupe, cascade deletes —
 * only exist in the database. A mock would assert that the mock behaves.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // Each file seeds and tears down its own rows; running files in parallel
    // against one database invites interference that has nothing to do with
    // the code under test.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
