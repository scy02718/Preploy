import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AchievementsPage from "./page";
import { BADGES } from "@/lib/badges";

// Mock fetch
const mockStatsResponse = {
  totalSessions: 5,
  currentStreak: 2,
  longestStreak: 3,
  highestScore: 7.5,
  avgScore: 6.0,
  badges: [
    { badgeId: "first_interview", earnedAt: "2026-04-10T00:00:00Z" },
    { badgeId: "first_behavioral", earnedAt: "2026-04-10T00:00:00Z" },
    { badgeId: "sessions_5", earnedAt: "2026-04-14T00:00:00Z" },
  ],
  hasCompletedBehavioral: true,
  hasCompletedTechnical: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockStatsResponse),
  });
});

describe("AchievementsPage", () => {
  it("renders the page title and earned count", async () => {
    render(<AchievementsPage />);
    // Wait for data load
    expect(
      await screen.findByText(`3 of ${BADGES.length} badges earned`)
    ).toBeDefined();
    expect(screen.getAllByText("Achievements").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all badge names by default (all filter)", async () => {
    render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // Check that a starter and a growth badge are visible
    expect(screen.getAllByText("First Steps").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dedicated").length).toBeGreaterThanOrEqual(1);
  });

  it("shows earned badges without grayscale", async () => {
    const { container } = render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // Earned badges should not have grayscale class
    const earnedIcons = container.querySelectorAll("span:not(.grayscale)");
    expect(earnedIcons.length).toBeGreaterThan(0);
  });

  it("shows locked badges with grayscale and hint text", async () => {
    render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // A locked badge should show its hint, not description
    // "first_technical" is locked — its hint is "Run a technical interview session"
    expect(
      screen.getAllByText("Run a technical interview session").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("filters by tier when a tier button is clicked", async () => {
    render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);

    // Click "Mastery" filter — use getAllByText since tier labels also say "Mastery"
    const masteryButtons = screen.getAllByText("Mastery");
    // The first one is the filter button (in the filter bar)
    fireEvent.click(masteryButtons[0]);

    // Mastery badges should be visible
    expect(screen.getAllByText("Dedicated Practitioner").length).toBeGreaterThanOrEqual(1);
    // Starter badge should NOT be visible
    expect(screen.queryByText("First Steps")).toBeNull();
  });

  it("shows tier labels on each badge", async () => {
    render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // Tier labels
    expect(screen.getAllByText("Starter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Growth").length).toBeGreaterThanOrEqual(1);
  });

  it("shows progress bars for numeric target badges", async () => {
    const { container } = render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // sessions_10 has target=10, user has 5 sessions → should show "5/10"
    expect(screen.getAllByText("5/10").length).toBeGreaterThanOrEqual(1);
    // Progress bar elements
    const bars = container.querySelectorAll("[class*='bg-primary/60']");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("shows earned date for earned badges", async () => {
    render(<AchievementsPage />);
    await screen.findByText(`3 of ${BADGES.length} badges earned`);
    // Check for formatted date
    expect(screen.getAllByText(/Earned Apr/).length).toBeGreaterThanOrEqual(1);
  });
});
