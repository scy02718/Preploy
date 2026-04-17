import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/*.integration.test.{ts,tsx}", "node_modules", ".next"],
    // Isolate each test file in its own subprocess. Without this, React 19's
    // concurrent scheduler can flush queued renders from a previous test file
    // after jsdom's `window` has been torn down, producing "window is not defined"
    // uncaught exceptions (unrelated to any individual assertion). Using forks
    // gives each file a fresh module graph and a fresh jsdom environment.
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["lib/prompts.ts", "lib/validations.ts", "lib/utils.ts", "lib/transcription.ts", "lib/code-templates.ts"],
      exclude: ["**/*.test.*", "**/*.integration.test.*"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Point the shared package to this worktree's copy so vitest picks up
      // changes committed here rather than the main repo's symlinked version.
      "@interview-assistant/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
});
