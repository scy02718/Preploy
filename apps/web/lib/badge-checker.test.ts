import { describe, it, expect } from "vitest";
import { checkNewBadges, type UserStats } from "./badge-checker";

function makeStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    highestScore: null,
    hasCompletedBehavioral: false,
    hasCompletedTechnical: false,
    earnedBadgeIds: new Set(),
    ...overrides,
  };
}

describe("checkNewBadges", () => {
  it("returns empty for brand new user", () => {
    expect(checkNewBadges(makeStats())).toEqual([]);
  });

  it("awards first_interview after 1 session", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 1 }));
    expect(badges).toContain("first_interview");
  });

  it("awards streak_3 for 3-day streak", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 3, currentStreak: 3 }));
    expect(badges).toContain("streak_3");
  });

  it("awards streak_7 for 7-day streak", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 7, longestStreak: 7 }));
    expect(badges).toContain("streak_7");
  });

  it("awards score_8 for high score", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 1, highestScore: 8.5 }));
    expect(badges).toContain("score_8");
  });

  it("does not award score_8 for score below 8", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 1, highestScore: 7.9 }));
    expect(badges).not.toContain("score_8");
  });

  it("awards sessions_10 at 10 sessions", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 10 }));
    expect(badges).toContain("sessions_10");
  });

  it("awards sessions_25 at 25 sessions", () => {
    const badges = checkNewBadges(makeStats({ totalSessions: 25 }));
    expect(badges).toContain("sessions_25");
  });

  it("awards both_types when both interview types completed", () => {
    const badges = checkNewBadges(
      makeStats({ totalSessions: 2, hasCompletedBehavioral: true, hasCompletedTechnical: true })
    );
    expect(badges).toContain("both_types");
  });

  it("does not re-award already earned badges", () => {
    const badges = checkNewBadges(
      makeStats({
        totalSessions: 5,
        earnedBadgeIds: new Set(["first_interview"]),
      })
    );
    expect(badges).not.toContain("first_interview");
  });

  it("awards multiple badges at once", () => {
    const badges = checkNewBadges(
      makeStats({
        totalSessions: 10,
        currentStreak: 3,
        highestScore: 9.0,
        hasCompletedBehavioral: true,
        hasCompletedTechnical: true,
      })
    );
    expect(badges).toContain("first_interview");
    expect(badges).toContain("streak_3");
    expect(badges).toContain("score_8");
    expect(badges).toContain("sessions_10");
    expect(badges).toContain("both_types");
  });
});
