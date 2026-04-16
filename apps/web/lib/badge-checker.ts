/**
 * Determine which new badges a user has earned based on their stats.
 * Pure function — no DB calls. Takes stats in, returns badge IDs to award.
 */

export interface UserStats {
  totalSessions: number;
  behavioralSessions: number;
  technicalSessions: number;
  currentStreak: number;
  longestStreak: number;
  highestScore: number | null;
  averageScore: number | null;
  /** Number of scored sessions (for avg_score_7 minimum requirement). */
  scoredSessionCount: number;
  hasCompletedBehavioral: boolean;
  hasCompletedTechnical: boolean;
  earnedBadgeIds: Set<string>;
  /** Number of STAR stories created. */
  starStoryCount: number;
  /** Number of STAR stories that have at least one AI analysis. */
  analyzedStarStoryCount: number;
  /** Number of resumes uploaded. */
  resumeCount: number;
  /** Number of interview plans created. */
  planCount: number;
  /** True if the user has had a score improvement of 2+ between consecutive sessions. */
  hasComeback: boolean;
  /** Hour (0-23) of the latest completed session in the user's local time (UTC if unknown). */
  latestSessionHour: number | null;
  /** Number of sessions completed today (UTC). */
  sessionsToday: number;
  /** User's current plan. */
  plan: string;
  /** Whether the user has completed at least one session while on the Pro plan. */
  hasProSession: boolean;
}

/**
 * Returns badge IDs the user has newly earned (not already in earnedBadgeIds).
 */
export function checkNewBadges(stats: UserStats): string[] {
  const newBadges: string[] = [];

  function award(badgeId: string) {
    if (!stats.earnedBadgeIds.has(badgeId)) {
      newBadges.push(badgeId);
    }
  }

  const streak = Math.max(stats.longestStreak, stats.currentStreak);

  // ---- Starter ----
  if (stats.totalSessions >= 1) award("first_interview");
  if (stats.hasCompletedBehavioral) award("first_behavioral");
  if (stats.hasCompletedTechnical) award("first_technical");
  if (stats.hasCompletedBehavioral && stats.hasCompletedTechnical) award("both_types");
  if (stats.resumeCount >= 1) award("first_resume");
  if (stats.starStoryCount >= 1) award("first_star");
  if (stats.planCount >= 1) award("first_plan");
  if (stats.highestScore !== null && stats.highestScore >= 5.0) award("score_5");

  // ---- Growth ----
  if (stats.totalSessions >= 5) award("sessions_5");
  if (stats.totalSessions >= 10) award("sessions_10");
  if (stats.totalSessions >= 25) award("sessions_25");
  if (streak >= 3) award("streak_3");
  if (streak >= 7) award("streak_7");
  if (streak >= 14) award("streak_14");
  if (stats.highestScore !== null && stats.highestScore >= 7.0) award("score_7");
  if (stats.highestScore !== null && stats.highestScore >= 8.0) award("score_8");
  if (stats.highestScore !== null && stats.highestScore >= 9.0) award("score_9");
  if (stats.hasComeback) award("comeback_kid");
  if (stats.behavioralSessions >= 5 && stats.technicalSessions >= 5) award("well_rounded_10");

  // ---- Mastery ----
  if (stats.totalSessions >= 50) award("sessions_50");
  if (stats.totalSessions >= 100) award("sessions_100");
  if (streak >= 30) award("streak_30");
  if (
    stats.averageScore !== null &&
    stats.averageScore > 7.0 &&
    stats.scoredSessionCount >= 5
  ) {
    award("avg_score_7");
  }
  if (stats.starStoryCount >= 10) award("star_collector");
  if (stats.analyzedStarStoryCount >= 10) award("star_perfectionist");

  // ---- Fun / Easter egg ----
  if (stats.latestSessionHour !== null) {
    if (stats.latestSessionHour >= 0 && stats.latestSessionHour < 5) award("night_owl");
    if (stats.latestSessionHour >= 5 && stats.latestSessionHour < 7) award("early_bird");
  }
  if (stats.sessionsToday >= 5) award("marathon_runner");
  if (stats.hasProSession && stats.plan === "pro") award("going_pro");

  return newBadges;
}

/**
 * Returns the progress value for a given badge based on current stats.
 * Used by the /achievements page for progress bars.
 */
export function getBadgeProgress(
  badgeId: string,
  stats: Partial<UserStats>
): number {
  switch (badgeId) {
    // Session counts
    case "first_interview":
    case "sessions_5":
    case "sessions_10":
    case "sessions_25":
    case "sessions_50":
    case "sessions_100":
      return stats.totalSessions ?? 0;
    // Behavioral/technical specific
    case "first_behavioral":
      return stats.behavioralSessions ?? 0;
    case "first_technical":
      return stats.technicalSessions ?? 0;
    // Streaks
    case "streak_3":
    case "streak_7":
    case "streak_14":
    case "streak_30":
      return Math.max(stats.longestStreak ?? 0, stats.currentStreak ?? 0);
    // STAR stories
    case "first_star":
    case "star_collector":
      return stats.starStoryCount ?? 0;
    case "star_perfectionist":
      return stats.analyzedStarStoryCount ?? 0;
    // Resumes
    case "first_resume":
      return stats.resumeCount ?? 0;
    // Plans
    case "first_plan":
      return stats.planCount ?? 0;
    // Marathon
    case "marathon_runner":
      return stats.sessionsToday ?? 0;
    default:
      return 0;
  }
}
