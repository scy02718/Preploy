import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BadgeGrid } from "./BadgeGrid";
import { BADGES } from "@/lib/badges";

// BadgeGrid now shows a subset (first 12) on the dashboard
const DISPLAY_COUNT = 12;

describe("BadgeGrid", () => {
  it("renders the first 12 badge definitions", () => {
    render(<BadgeGrid earnedBadges={[]} />);
    const displayed = BADGES.slice(0, DISPLAY_COUNT);
    for (const badge of displayed) {
      expect(screen.getAllByText(badge.name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows total achievement count (earned / total)", () => {
    render(<BadgeGrid earnedBadges={[{ badgeId: "first_interview", earnedAt: "2026-04-12" }]} />);
    expect(screen.getAllByText(`Achievements (1/${BADGES.length})`).length).toBeGreaterThanOrEqual(1);
  });

  it("highlights earned badges", () => {
    const { container } = render(
      <BadgeGrid earnedBadges={[{ badgeId: "first_interview", earnedAt: "2026-04-12" }]} />
    );
    const earned = container.querySelectorAll("[class*='bg-primary']");
    expect(earned.length).toBeGreaterThanOrEqual(1);
    const locked = container.querySelectorAll("[class*='opacity-40']");
    expect(locked.length).toBe(DISPLAY_COUNT - 1);
  });

  it("shows 0 earned when no badges", () => {
    render(<BadgeGrid earnedBadges={[]} />);
    expect(screen.getAllByText(`Achievements (0/${BADGES.length})`).length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'View all' link to /achievements", () => {
    render(<BadgeGrid earnedBadges={[]} />);
    expect(screen.getAllByText("View all").length).toBeGreaterThanOrEqual(1);
  });
});
