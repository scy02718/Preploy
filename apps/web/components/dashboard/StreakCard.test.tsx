import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakCard } from "./StreakCard";

const SAMPLE_HEATMAP = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-03-${String(i + 1).padStart(2, "0")}`,
  count: i % 3 === 0 ? 1 : 0,
}));

describe("StreakCard", () => {
  it("renders current and longest streak", () => {
    render(
      <StreakCard currentStreak={5} longestStreak={12} heatmap={SAMPLE_HEATMAP} />
    );
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
  });

  it("renders streak labels", () => {
    render(
      <StreakCard currentStreak={3} longestStreak={7} heatmap={SAMPLE_HEATMAP} />
    );
    expect(screen.getAllByText("Current streak").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Longest streak").length).toBeGreaterThanOrEqual(1);
  });

  it("renders heatmap with correct number of cells", () => {
    const { container } = render(
      <StreakCard currentStreak={0} longestStreak={0} heatmap={SAMPLE_HEATMAP} />
    );
    // 30 heatmap cells
    const cells = container.querySelectorAll("[title]");
    expect(cells.length).toBe(30);
  });

  it("renders 'Last 30 days' label", () => {
    render(
      <StreakCard currentStreak={0} longestStreak={0} heatmap={SAMPLE_HEATMAP} />
    );
    expect(screen.getAllByText("Last 30 days").length).toBeGreaterThanOrEqual(1);
  });
});
