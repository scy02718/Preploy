import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/planner",
}));

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ plans: [] }),
});

// The top-level `page.tsx` is now a server component (auth + plan gating),
// so these tests target the interactive client body directly. The Pro-user
// happy path is what this suite has always been testing; the server-level
// gating (free users redirected to paywall, etc.) is covered by the API
// integration tests plus the `features.test.ts` unit tests.
import PlannerPage from "./PlannerClient";

describe("PlannerPage", () => {
  it("renders the page title", () => {
    render(<PlannerPage />);
    expect(
      screen.getAllByText("Interview Prep Planner").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the New Plan button", () => {
    render(<PlannerPage />);
    expect(
      screen.getAllByText("New Plan").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the Your Plans section", () => {
    render(<PlannerPage />);
    expect(
      screen.getAllByText("Your Plans").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no plans exist", async () => {
    render(<PlannerPage />);
    // The empty state text should appear after loading
    const emptyTexts = await screen.findAllByText(
      /No plans yet/i
    );
    expect(emptyTexts.length).toBeGreaterThanOrEqual(1);
  });

  // 118-N: Planner empty state mentions "no quota cost"
  it("118-N: empty state mentions 'no quota cost'", async () => {
    render(<PlannerPage />);
    const elements = await screen.findAllByText(/no quota cost/i);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the no plan selected message", async () => {
    render(<PlannerPage />);
    const noSelection = await screen.findAllByText("No Plan Selected");
    expect(noSelection.length).toBeGreaterThanOrEqual(1);
  });
});
