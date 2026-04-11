import { describe, it, expect } from "vitest";
import { calculateStreaks, buildHeatmap } from "./streaks";

function d(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

describe("calculateStreaks", () => {
  it("returns 0 for no sessions", () => {
    const result = calculateStreaks([]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
  });

  it("returns 1 for a single session today", () => {
    const now = d("2026-04-12");
    const result = calculateStreaks([d("2026-04-12")], now);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("counts consecutive days as a streak", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-12"), d("2026-04-11"), d("2026-04-10")];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("streak continues if yesterday was the last session (not today yet)", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-11"), d("2026-04-10"), d("2026-04-09")];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(3);
  });

  it("streak breaks on a gap day", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-12"), d("2026-04-11"), d("2026-04-09")];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(2);
  });

  it("streak is 0 if last session was 2+ days ago", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-09"), d("2026-04-08")];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(0);
  });

  it("deduplicates multiple sessions on the same day", () => {
    const now = d("2026-04-12");
    const dates = [
      d("2026-04-12"),
      d("2026-04-12"),
      d("2026-04-12"),
      d("2026-04-11"),
    ];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(2);
  });

  it("longest streak tracks historical best", () => {
    const now = d("2026-04-12");
    // 5-day streak last week, 2-day streak now
    const dates = [
      d("2026-04-12"),
      d("2026-04-11"),
      // gap
      d("2026-04-05"),
      d("2026-04-04"),
      d("2026-04-03"),
      d("2026-04-02"),
      d("2026-04-01"),
    ];
    const result = calculateStreaks(dates, now);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it("longest streak equals current when current is the best", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-12"), d("2026-04-11"), d("2026-04-10")];
    const result = calculateStreaks(dates, now);
    expect(result.longestStreak).toBe(3);
  });
});

describe("buildHeatmap", () => {
  it("returns correct number of days", () => {
    const result = buildHeatmap([], 7, d("2026-04-12"));
    expect(result).toHaveLength(7);
  });

  it("counts sessions per day correctly", () => {
    const now = d("2026-04-12");
    const dates = [d("2026-04-12"), d("2026-04-12"), d("2026-04-10")];
    const result = buildHeatmap(dates, 5, now);

    const today = result.find((r) => r.date === "2026-04-12");
    expect(today?.count).toBe(2);

    const twoDaysAgo = result.find((r) => r.date === "2026-04-10");
    expect(twoDaysAgo?.count).toBe(1);

    const yesterday = result.find((r) => r.date === "2026-04-11");
    expect(yesterday?.count).toBe(0);
  });

  it("days are ordered oldest to newest", () => {
    const result = buildHeatmap([], 3, d("2026-04-12"));
    expect(result[0].date).toBe("2026-04-10");
    expect(result[2].date).toBe("2026-04-12");
  });
});
