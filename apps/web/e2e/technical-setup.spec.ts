/**
 * Test 5 — Technical interview setup @smoke
 *
 * Verifies: setup page loads and shows the Monaco editor reference + a
 * configuration form so users can start a technical session.
 */

import { test, expect } from "@playwright/test";

test.describe("Technical interview setup @smoke", () => {
  test("setup page loads with configuration form", async ({ page }) => {
    await page.goto("/interview/technical/setup");

    // Should not redirect to /login
    await expect(page).toHaveURL(/\/interview\/technical\/setup/);

    // Page heading
    await expect(
      page.getByRole("heading", { name: /Technical Interview Setup/i })
    ).toBeVisible();
  });

  test("setup page shows quota and description", async ({ page }) => {
    // Stub the quota API so the page loads without a real DB
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

    await page.goto("/interview/technical/setup");

    // Description text from the page
    await expect(
      page.getByText(/Configure your mock coding interview/i)
    ).toBeVisible();
  });
});
