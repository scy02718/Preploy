/**
 * Test 6 — Profile page smoke test @smoke
 *
 * Verifies: /profile loads and shows the current user's information.
 * Stubs the API so we don't depend on a running DB for the smoke run.
 */

import { test, expect } from "@playwright/test";

// Test user constants — must match the values in global.setup.ts
const E2E_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "e2e-test@preploy.dev",
  name: "E2E Test User",
};

test.describe("Profile page @smoke", () => {
  test("profile page loads and shows user information", async ({ page }) => {
    // Stub the /api/users/me endpoint to return the E2E test user
    await page.route("/api/users/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: E2E_USER.id,
          email: E2E_USER.email,
          name: E2E_USER.name,
          image: null,
          plan: "free",
          disabledAt: null,
          createdAt: new Date().toISOString(),
        }),
      })
    );

    await page.goto("/profile");

    // Should not be redirected to /login
    await expect(page).toHaveURL(/\/profile/);

    // Page heading
    await expect(
      page.getByRole("heading", { name: /Profile/i })
    ).toBeVisible();
  });

  test("profile page shows current user email", async ({ page }) => {
    await page.route("/api/users/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: E2E_USER.id,
          email: E2E_USER.email,
          name: E2E_USER.name,
          image: null,
          plan: "free",
          disabledAt: null,
          createdAt: new Date().toISOString(),
        }),
      })
    );

    await page.goto("/profile");

    // The email field should show the test user's email
    // It's rendered as a disabled input, so we look for it by value
    await expect(
      page.locator(`input[value="${E2E_USER.email}"]`)
    ).toBeVisible();
  });
});
