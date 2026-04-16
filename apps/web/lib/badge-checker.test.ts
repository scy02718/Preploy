import { describe, it, expect } from "vitest";
import { checkNewBadges, getBadgeProgress, type UserStats } from "./badge-checker";
import { BADGES } from "./badges";

/** Helper: builds a default "empty" UserStats, overriding specific fields. */
function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    totalSessions: 0,
    behavioralSessions: 0,
    technicalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    highestScore: null,
    averageScore: null,
    scoredSessionCount: 0,
    hasCompletedBehavioral: false,
    hasCompletedTechnical: false,
    earnedBadgeIds: new Set(),
    starStoryCount: 0,
    analyzedStarStoryCount: 0,
    resumeCount: 0,
    planCount: 0,
    hasComeback: false,
    latestSessionHour: null,
    sessionsToday: 0,
    plan: "free",
    hasProSession: false,
    ...overrides,
  };
}

describe("checkNewBadges", () => {
  it("returns empty array for brand-new user", () => {
    expect(checkNewBadges(stats())).toEqual([]);
  });

  // ---- Starter tier ----
  it("awards first_interview on 1 session", () => {
    expect(checkNewBadges(stats({ totalSessions: 1 }))).toContain("first_interview");
  });

  it("awards first_behavioral on completing behavioral", () => {
    expect(
      checkNewBadges(stats({ hasCompletedBehavioral: true, totalSessions: 1 }))
    ).toContain("first_behavioral");
  });

  it("awards first_technical on completing technical", () => {
    expect(
      checkNewBadges(stats({ hasCompletedTechnical: true, totalSessions: 1 }))
    ).toContain("first_technical");
  });

  it("awards both_types when both interview types completed", () => {
    expect(
      checkNewBadges(
        stats({
          hasCompletedBehavioral: true,
          hasCompletedTechnical: true,
          totalSessions: 2,
        })
      )
    ).toContain("both_types");
  });

  it("awards first_resume on 1 resume", () => {
    expect(checkNewBadges(stats({ resumeCount: 1 }))).toContain("first_resume");
  });

  it("awards first_star on 1 STAR story", () => {
    expect(checkNewBadges(stats({ starStoryCount: 1 }))).toContain("first_star");
  });

  it("awards first_plan on 1 plan", () => {
    expect(checkNewBadges(stats({ planCount: 1 }))).toContain("first_plan");
  });

  it("awards score_5 on score >= 5.0", () => {
    expect(checkNewBadges(stats({ highestScore: 5.0 }))).toContain("score_5");
  });

  it("does not award score_5 on score 4.9", () => {
    expect(checkNewBadges(stats({ highestScore: 4.9 }))).not.toContain("score_5");
  });

  // ---- Growth tier ----
  it("awards sessions_5 on 5 sessions", () => {
    expect(checkNewBadges(stats({ totalSessions: 5 }))).toContain("sessions_5");
  });

  it("awards sessions_10 on 10 sessions", () => {
    expect(checkNewBadges(stats({ totalSessions: 10 }))).toContain("sessions_10");
  });

  it("awards sessions_25 on 25 sessions", () => {
    expect(checkNewBadges(stats({ totalSessions: 25 }))).toContain("sessions_25");
  });

  it("awards streak_3 via currentStreak", () => {
    expect(checkNewBadges(stats({ currentStreak: 3 }))).toContain("streak_3");
  });

  it("awards streak_7 via longestStreak", () => {
    expect(checkNewBadges(stats({ longestStreak: 7 }))).toContain("streak_7");
  });

  it("awards streak_14", () => {
    expect(checkNewBadges(stats({ longestStreak: 14 }))).toContain("streak_14");
  });

  it("awards score_7 on score >= 7.0", () => {
    expect(checkNewBadges(stats({ highestScore: 7.0 }))).toContain("score_7");
  });

  it("awards score_8 on score >= 8.0", () => {
    expect(checkNewBadges(stats({ highestScore: 8.5 }))).toContain("score_8");
  });

  it("does not award score_8 on 7.9", () => {
    expect(checkNewBadges(stats({ highestScore: 7.9 }))).not.toContain("score_8");
  });

  it("awards score_9 on score >= 9.0", () => {
    expect(checkNewBadges(stats({ highestScore: 9.0 }))).toContain("score_9");
  });

  it("awards comeback_kid when hasComeback is true", () => {
    expect(checkNewBadges(stats({ hasComeback: true }))).toContain("comeback_kid");
  });

  it("awards well_rounded_10 on 5 behavioral + 5 technical", () => {
    expect(
      checkNewBadges(
        stats({
          behavioralSessions: 5,
          technicalSessions: 5,
          totalSessions: 10,
          hasCompletedBehavioral: true,
          hasCompletedTechnical: true,
        })
      )
    ).toContain("well_rounded_10");
  });

  // ---- Mastery tier ----
  it("awards sessions_50 on 50 sessions", () => {
    expect(checkNewBadges(stats({ totalSessions: 50 }))).toContain("sessions_50");
  });

  it("awards sessions_100 on 100 sessions", () => {
    expect(checkNewBadges(stats({ totalSessions: 100 }))).toContain("sessions_100");
  });

  it("awards streak_30", () => {
    expect(checkNewBadges(stats({ longestStreak: 30 }))).toContain("streak_30");
  });

  it("awards avg_score_7 when avg > 7.0 and 5+ scored sessions", () => {
    expect(
      checkNewBadges(stats({ averageScore: 7.5, scoredSessionCount: 5, totalSessions: 5 }))
    ).toContain("avg_score_7");
  });

  it("does not award avg_score_7 with fewer than 5 scored sessions", () => {
    expect(
      checkNewBadges(stats({ averageScore: 8.0, scoredSessionCount: 4 }))
    ).not.toContain("avg_score_7");
  });

  it("awards star_collector on 10 STAR stories", () => {
    expect(checkNewBadges(stats({ starStoryCount: 10 }))).toContain("star_collector");
  });

  it("awards star_perfectionist on 10 analyzed stories", () => {
    expect(
      checkNewBadges(stats({ analyzedStarStoryCount: 10 }))
    ).toContain("star_perfectionist");
  });

  // ---- Fun / Easter egg ----
  it("awards night_owl for sessions between midnight and 5am", () => {
    expect(
      checkNewBadges(stats({ latestSessionHour: 2, totalSessions: 1 }))
    ).toContain("night_owl");
  });

  it("awards early_bird for sessions between 5am and 7am", () => {
    expect(
      checkNewBadges(stats({ latestSessionHour: 6, totalSessions: 1 }))
    ).toContain("early_bird");
  });

  it("awards marathon_runner for 5 sessions in a day", () => {
    expect(
      checkNewBadges(stats({ sessionsToday: 5, totalSessions: 5 }))
    ).toContain("marathon_runner");
  });

  it("awards going_pro for pro user with a session", () => {
    expect(
      checkNewBadges(stats({ plan: "pro", hasProSession: true, totalSessions: 1 }))
    ).toContain("going_pro");
  });

  it("does not award going_pro for free user", () => {
    expect(
      checkNewBadges(stats({ plan: "free", hasProSession: false, totalSessions: 5 }))
    ).not.toContain("going_pro");
  });

  // ---- Already earned ----
  it("does not re-award badges already earned", () => {
    const result = checkNewBadges(
      stats({
        totalSessions: 10,
        earnedBadgeIds: new Set(["first_interview", "sessions_5", "sessions_10"]),
      })
    );
    expect(result).not.toContain("first_interview");
    expect(result).not.toContain("sessions_5");
    expect(result).not.toContain("sessions_10");
  });

  it("awards multiple badges simultaneously", () => {
    const result = checkNewBadges(
      stats({
        totalSessions: 10,
        hasCompletedBehavioral: true,
        hasCompletedTechnical: true,
        currentStreak: 7,
        highestScore: 8.5,
        resumeCount: 1,
        starStoryCount: 1,
      })
    );
    expect(result).toContain("first_interview");
    expect(result).toContain("both_types");
    expect(result).toContain("streak_7");
    expect(result).toContain("score_8");
    expect(result).toContain("sessions_10");
    expect(result).toContain("first_resume");
    expect(result).toContain("first_star");
  });
});

describe("getBadgeProgress", () => {
  it("returns session count for session badges", () => {
    expect(getBadgeProgress("sessions_10", { totalSessions: 7 })).toBe(7);
  });

  it("returns streak for streak badges", () => {
    expect(getBadgeProgress("streak_7", { currentStreak: 4, longestStreak: 5 })).toBe(5);
  });

  it("returns star count for star_collector", () => {
    expect(getBadgeProgress("star_collector", { starStoryCount: 6 })).toBe(6);
  });

  it("returns 0 for unknown badge", () => {
    expect(getBadgeProgress("unknown_badge", {})).toBe(0);
  });
});

describe("badge definitions integrity", () => {
  it("every badge ID referenced in checkNewBadges exists in BADGES", () => {
    const exhaustive = stats({
      totalSessions: 100,
      behavioralSessions: 50,
      technicalSessions: 50,
      currentStreak: 30,
      longestStreak: 30,
      highestScore: 10.0,
      averageScore: 8.0,
      scoredSessionCount: 100,
      hasCompletedBehavioral: true,
      hasCompletedTechnical: true,
      starStoryCount: 10,
      analyzedStarStoryCount: 10,
      resumeCount: 1,
      planCount: 1,
      hasComeback: true,
      latestSessionHour: 3,
      sessionsToday: 5,
      plan: "pro",
      hasProSession: true,
    });
    const allAwarded = checkNewBadges(exhaustive);
    const badgeIds = new Set(BADGES.map((b) => b.id));
    for (const id of allAwarded) {
      expect(badgeIds.has(id)).toBe(true);
    }
    // night_owl awarded (hour=3), not early_bird (hour 5-7)
    expect(allAwarded.length).toBeGreaterThanOrEqual(25);
  });
});
