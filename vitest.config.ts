import { defineConfig } from "vitest/config";

/**
 * Unit tests: pure domain logic, no database, no network. Fast enough to run on
 * every save. Integration tests live behind their own config so this suite
 * never needs credentials.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "node_modules/**"],
  },
});
