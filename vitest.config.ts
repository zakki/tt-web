import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["obsolete_tests/**", "node_modules/**", "dist/**"],
    passWithNoTests: true,
  },
});
