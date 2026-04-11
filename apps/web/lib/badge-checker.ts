/**
 * Determine which new badges a user has earned based on their stats.
 * Pure function — no DB calls. Takes stats in, returns badge IDs to award.
 */

export interface UserStats {
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  highestScore: number | null;
  hasCompletedBehavioral: boolean;
  hasCompletedTechnical: boolean;
  earnedBadgeIds: Set<string>;
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

  if (stats.totalSessions >= 1) {
    award("first_interview");
  }

  if (stats.longestStreak >= 3 || stats.currentStreak >= 3) {
    award("streak_3");
  }

  if (stats.longestStreak >= 7 || stats.currentStreak >= 7) {
    award("streak_7");
  }

  if (stats.highestScore !== null && stats.highestScore >= 8.0) {
    award("score_8");
  }

  if (stats.totalSessions >= 10) {
    award("sessions_10");
  }

  if (stats.totalSessions >= 25) {
    award("sessions_25");
  }

  if (stats.hasCompletedBehavioral && stats.hasCompletedTechnical) {
    award("both_types");
  }

  return newBadges;
}
