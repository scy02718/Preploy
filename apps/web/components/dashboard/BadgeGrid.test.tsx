import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BadgeGrid } from "./BadgeGrid";
import { BADGES } from "@/lib/badges";

describe("BadgeGrid", () => {
  it("renders all badge definitions", () => {
    render(<BadgeGrid earnedBadges={[]} />);
    for (const badge of BADGES) {
      expect(screen.getAllByText(badge.name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows achievement count", () => {
    render(<BadgeGrid earnedBadges={[{ badgeId: "first_interview", earnedAt: "2026-04-12" }]} />);
    expect(screen.getAllByText(`Achievements (1/${BADGES.length})`).length).toBeGreaterThanOrEqual(1);
  });

  it("highlights earned badges", () => {
    const { container } = render(
      <BadgeGrid earnedBadges={[{ badgeId: "first_interview", earnedAt: "2026-04-12" }]} />
    );
    // Earned badges have bg-primary/5, unearned have opacity-40
    const earned = container.querySelectorAll("[class*='bg-primary']");
    expect(earned.length).toBeGreaterThanOrEqual(1);
    const locked = container.querySelectorAll("[class*='opacity-40']");
    expect(locked.length).toBe(BADGES.length - 1);
  });

  it("shows 0 earned when no badges", () => {
    render(<BadgeGrid earnedBadges={[]} />);
    expect(screen.getAllByText(`Achievements (0/${BADGES.length})`).length).toBeGreaterThanOrEqual(1);
  });
});
