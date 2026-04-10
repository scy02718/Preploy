import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/*.integration.test.{ts,tsx}", "node_modules"],
    coverage: {
      provider: "v8",
      include: ["lib/prompts.ts", "lib/validations.ts", "lib/utils.ts", "lib/transcription.ts"],
      exclude: ["**/*.test.*", "**/*.integration.test.*"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
