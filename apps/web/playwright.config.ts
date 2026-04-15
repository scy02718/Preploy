import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isCI = !!process.env.CI;

// In CI the build is done in a prior step; only `npm run start` is needed.
// Locally we need the full build + start.
const webServerCommand = isCI ? "npm run start" : "npm run build && npm run start";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Grant camera and microphone to avoid browser permission prompts on
    // interview pages.
    permissions: ["camera", "microphone"],
  },

  projects: [
    // Setup project: seeds DB + mints auth cookie before any test runs.
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // Smoke tests — chromium only for v1.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the auth cookie produced by the setup project.
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Playwright manages the web server.  In CI, the build was already done in a
  // prior job step so we only run `npm run start`.  Locally, we build first.
  webServer: {
    command: webServerCommand,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      // Forward the test DB URL so the server can connect to it during E2E.
      ...(process.env.TEST_DATABASE_URL
        ? { SUPABASE_DB_URL: process.env.TEST_DATABASE_URL }
        : {}),
      // Forward AUTH_SECRET explicitly so the NextAuth JWE cookie minted by
      // global.setup.ts is verifiable by the spawned `npm run start` process.
      // Falls back to the CI dummy secret for local runs where AUTH_SECRET
      // is not set in the shell environment — otherwise every authenticated
      // test silently redirects to /login.
      AUTH_SECRET: process.env.AUTH_SECRET ?? "dummy-auth-secret-for-ci-only",
      AUTH_URL: process.env.AUTH_URL ?? BASE_URL,
    },
  },
});
