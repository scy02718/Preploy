/**
 * Calculate practice streaks from a list of session dates.
 * Pure function — no DB calls, fully testable.
 */

/**
 * Given an array of session timestamps (most recent first),
 * calculate the current streak and longest streak in days.
 *
 * A streak counts consecutive calendar days (UTC) with at least one session.
 * Today counts toward the streak. If no session today, the streak is based on
 * whether yesterday had a session.
 */
export function calculateStreaks(
  sessionDates: Date[],
  now: Date = new Date()
): { currentStreak: number; longestStreak: number } {
  if (sessionDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique practice days as "YYYY-MM-DD" strings (UTC)
  const daySet = new Set<string>();
  for (const date of sessionDates) {
    daySet.add(toDateString(date));
  }

  // Sort days descending (most recent first)
  const days = Array.from(daySet).sort().reverse();

  // Calculate current streak
  const today = toDateString(now);
  const yesterday = toDateString(new Date(now.getTime() - 86400000));

  let currentStreak = 0;
  if (days[0] === today || days[0] === yesterday) {
    // Start counting from the most recent day
    let expected = days[0] === today ? today : yesterday;
    for (const day of days) {
      if (day === expected) {
        currentStreak++;
        // Move to the previous day
        expected = toDateString(
          new Date(new Date(expected + "T00:00:00Z").getTime() - 86400000)
        );
      } else if (day < expected) {
        break;
      }
    }
  }

  // Calculate longest streak (scan all days ascending)
  const ascending = [...days].reverse();
  let longestStreak = 1;
  let streak = 1;
  for (let i = 1; i < ascending.length; i++) {
    const prevDate = new Date(ascending[i - 1] + "T00:00:00Z");
    const currDate = new Date(ascending[i] + "T00:00:00Z");
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 1;
    }
  }

  // Edge case: single day is also a longest streak of 1 if there are sessions
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Build a practice heatmap for the last N days.
 * Returns an array of { date: "YYYY-MM-DD", count: number } entries.
 */
export function buildHeatmap(
  sessionDates: Date[],
  days: number = 30,
  now: Date = new Date()
): { date: string; count: number }[] {
  const countMap = new Map<string, number>();
  for (const date of sessionDates) {
    const key = toDateString(date);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const result: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = toDateString(d);
    result.push({ date: key, count: countMap.get(key) ?? 0 });
  }

  return result;
}
