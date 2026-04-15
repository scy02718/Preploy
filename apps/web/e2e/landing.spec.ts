/**
 * Test 1 — Landing page smoke tests @smoke
 *
 * Verifies: hero renders, CTA visible, primary link routes to /login.
 * These run WITHOUT auth (no storageState override) to test the public page.
 */

import { test, expect } from "@playwright/test";

// Override the default storageState so these tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Landing page @smoke", () => {
  test("renders hero section with Preploy heading", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Preploy" })
    ).toBeVisible();
  });

  test("shows hero description text", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText(/Practice mock interviews with AI/i)
    ).toBeVisible();
  });

  test("behavioral interview CTA links to /interview/behavioral/setup", async ({
    page,
  }) => {
    await page.goto("/");

    const behavioralLink = page.getByRole("link", {
      name: /Start Behavioral Interview/i,
    });
    await expect(behavioralLink).toBeVisible();
    await expect(behavioralLink).toHaveAttribute(
      "href",
      "/interview/behavioral/setup"
    );
  });

  test("technical interview CTA links to /interview/technical/setup", async ({
    page,
  }) => {
    await page.goto("/");

    const technicalLink = page.getByRole("link", {
      name: /Start Technical Interview/i,
    });
    await expect(technicalLink).toBeVisible();
    await expect(technicalLink).toHaveAttribute(
      "href",
      "/interview/technical/setup"
    );
  });
});
