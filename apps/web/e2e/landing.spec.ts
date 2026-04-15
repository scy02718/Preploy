/**
 * Test 1 — Landing page smoke tests @smoke
 *
 * Verifies: hero renders with the new #33 copy, primary CTA is visible and
 * routes to /login, the "How it works" section renders. These run WITHOUT
 * auth (no storageState override) to test the public page.
 */

import { test, expect } from "@playwright/test";

// Override the default storageState so these tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Landing page @smoke", () => {
  test("renders hero headline", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Practice interviews until the real one feels easy",
      })
    ).toBeVisible();
  });

  test("shows hero sub-headline", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText(/voice-to-voice mock interviews/i)
    ).toBeVisible();
  });

  test("primary CTA is visible and links to /login", async ({ page }) => {
    await page.goto("/");

    const primaryCta = page.getByTestId("primary-cta");
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/login");
    await expect(primaryCta).toHaveText(/Start a free mock interview/i);
  });

  test("How it works section renders", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /how it works/i })
    ).toBeVisible();
  });
});
