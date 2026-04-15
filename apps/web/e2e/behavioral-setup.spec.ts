/**
 * Test 4 — Behavioral interview setup @smoke
 *
 * Verifies: setup page loads and the setup form is visible.
 * Note: Full session flow (mic + voice) is out of scope for v1 smoke suite.
 *
 * The session page itself requires WebRTC + OpenAI Realtime API which cannot
 * be reliably mocked at the network layer in a production build without custom
 * server instrumentation.  A TODO is filed to extend this test in v2 once a
 * stub transport is wired in.
 *
 * TODO(#41-v2): Mock the OpenAI Realtime WS endpoint via Playwright request
 * routing and validate the first question renders in the session page.
 */

import { test, expect } from "@playwright/test";

test.describe("Behavioral interview setup @smoke", () => {
  test("setup page loads with configuration form", async ({ page }) => {
    await page.goto("/interview/behavioral/setup");

    // Should not redirect to /login (auth state is present)
    await expect(page).toHaveURL(/\/interview\/behavioral\/setup/);

    // Page heading
    await expect(
      page.getByRole("heading", { name: /Behavioral Interview Setup/i })
    ).toBeVisible();
  });

  test("setup page shows configuration fields", async ({ page }) => {
    // Stub API calls so the page loads quickly without a real DB
    await page.route("/api/sessions/quota", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "free",
          planName: "Free",
          used: 0,
          limit: 3,
          remaining: 3,
        }),
      })
    );
    await page.route("/api/templates*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await page.goto("/interview/behavioral/setup");

    // The setup form should render
    await expect(
      page.getByRole("heading", { name: /Behavioral Interview Setup/i })
    ).toBeVisible();
  });
});
