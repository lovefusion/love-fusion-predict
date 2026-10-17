import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Pure unit tests only — no DOM, no DB
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    // Fail fast on first error in CI
    bail: process.env.CI ? 1 : 0,
    // Coverage (opt-in with `npm test -- --coverage`)
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/types.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
