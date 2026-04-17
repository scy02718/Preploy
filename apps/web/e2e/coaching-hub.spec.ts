/**
 * Coaching Hub smoke tests @smoke
 *
 * Verifies: /coaching redirects to /coaching/hiring-overview, hub nav renders
 * all 4 tabs, each tab click changes URL and reveals migrated content.
 * Uses auth storage state from global setup.
 *
 * Story trace: 116-A, 116-B, 116-F, 116-G, 116-H, 116-I
 */

import { test, expect, type Page } from "@playwright/test";

// The hub nav has aria-label="Coaching hub navigation" to distinguish it from
// the global Header nav, which also contains "Behavioral" and "Technical" links
// pointing at /interview/*/setup. Always scope hub-nav locators via this label
// so Playwright's strict mode doesn't match both navs.
const hubNav = (page: Page) => page.getByLabel("Coaching hub navigation");

test.describe("Coaching Hub @smoke", () => {
  // 116-A: /coaching redirects to /coaching/hiring-overview
  test("redirects /coaching to /coaching/hiring-overview", async ({ page }) => {
    await page.goto("/coaching");
    await expect(page).toHaveURL(/\/coaching\/hiring-overview/);
  });

  // 116-B: Hub heading and 4 tab labels are visible
  test("shows Interview Coaching heading and all 4 tab labels on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/coaching/hiring-overview");

    await expect(
      page.getByRole("heading", { name: /Interview Coaching/i })
    ).toBeVisible();

    // All 4 tabs should be visible in the desktop hub rail
    const nav = hubNav(page);
    await expect(nav.getByRole("link", { name: "Hiring Overview" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Behavioral" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Technical" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Communication" })).toBeVisible();
  });

  // 116-F + 116-G: Clicking Behavioral tab changes URL and shows STAR Method content
  test("clicking Behavioral tab navigates and shows STAR Method content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/coaching/hiring-overview");

    await hubNav(page).getByRole("link", { name: "Behavioral" }).click();
    await expect(page).toHaveURL(/\/coaching\/behavioral/);

    // 116-G: Old Behavioral content visible
    await expect(
      page.getByText("The STAR Method").first()
    ).toBeVisible();
  });

  // 116-F + 116-H: Clicking Technical tab changes URL and shows LeetCode content
  test("clicking Technical tab navigates and shows LeetCode and System Design content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/coaching/hiring-overview");

    await hubNav(page).getByRole("link", { name: "Technical" }).click();
    await expect(page).toHaveURL(/\/coaching\/technical/);

    // 116-H: Old LeetCode content visible
    await expect(
      page.getByText("Problem-Solving Framework").first()
    ).toBeVisible();

    // 116-H: Old System Design content also visible on same page
    await expect(
      page.getByText("System Design Framework").first()
    ).toBeVisible();
  });

  // 116-F + 116-I: Clicking Communication tab changes URL and shows communication content
  test("clicking Communication tab navigates and shows communication content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/coaching/hiring-overview");

    await hubNav(page).getByRole("link", { name: "Communication" }).click();
    await expect(page).toHaveURL(/\/coaching\/communication/);

    // 116-I: Old Communication content visible
    await expect(
      page.getByText("Communication Fundamentals").first()
    ).toBeVisible();
  });

  // 116-F + 113: Clicking Hiring Overview from another tab goes back and shows funnel content
  test("clicking Hiring Overview tab navigates back and shows funnel heading", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/coaching/behavioral");

    await hubNav(page).getByRole("link", { name: "Hiring Overview" }).click();
    await expect(page).toHaveURL(/\/coaching\/hiring-overview/);

    // Hiring Overview funnel content should be visible (replaced ComingSoon stub in #113)
    await expect(page.getByText(/How Hiring Works/i).first()).toBeVisible();
  });
});
