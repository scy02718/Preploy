/**
 * Test 3 — Dashboard smoke test @smoke
 *
 * Verifies: signed-in user lands on /dashboard and sees the sidebar.
 * Uses the auth storage state from global setup.
 */

import { test, expect } from "@playwright/test";

test.describe("Dashboard @smoke", () => {
  test("authenticated user sees dashboard and sidebar nav", async ({ page }) => {
    await page.goto("/dashboard");

    // Should not be redirected to /login
    await expect(page).toHaveURL(/\/dashboard/);

    // Dashboard heading
    await expect(
      page.getByRole("heading", { name: /Dashboard/i })
    ).toBeVisible();

    // Sidebar nav links — check a few key entries
    await expect(
      page.getByRole("link", { name: /Dashboard/i }).first()
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Behavioral Interview/i })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Technical Interview/i })
    ).toBeVisible();
  });
});
