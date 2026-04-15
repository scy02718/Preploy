/**
 * Test 2 — Auth smoke tests @smoke
 *
 * Verifies:
 * - /login shows Google sign-in button
 * - Unauthenticated access to /dashboard redirects to /login
 */

import { test, expect } from "@playwright/test";

// Run unauthenticated for both tests
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth flows @smoke", () => {
  test("/login shows Google sign-in button", async ({ page }) => {
    await page.goto("/login");

    // The login page renders a form with a "Sign in with Google" button
    await expect(
      page.getByRole("button", { name: /Sign in with Google/i })
    ).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // Middleware redirects; wait for navigation to settle
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /profile redirects to /login", async ({ page }) => {
    await page.goto("/profile");

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
