/**
 * Timezone helpers for time-of-day and day-boundary achievement checks.
 *
 * The achievement check path (`/api/users/badges`) runs on the server, where
 * the ambient timezone is UTC on Vercel. Previously we extracted hours via
 * `.getUTCHours()` and day strings from `.getUTCDate()`, which fired
 * `early_bird` / `night_owl` against UTC time regardless of where the user
 * actually lives. A user in NZ (UTC+12/+13) running at 2pm local would
 * register as 2am UTC — wrong.
 *
 * These helpers take an IANA timezone name (e.g. `"Pacific/Auckland"`) and
 * return the hour (0-23) or the local calendar date ("YYYY-MM-DD") that the
 * caller should use. When the timezone is null/undefined/invalid we fall
 * back to UTC — same behavior as before, so the fix is strictly additive
 * for users who haven't reported a timezone yet.
 */

/**
 * Returns the hour (0-23) of `date` as observed in the given IANA timezone.
 * Falls back to UTC when `timeZone` is null/undefined/empty or invalid.
 */
export function getHourInTimezone(
  date: Date,
  timeZone: string | null | undefined
): number {
  if (!timeZone) return date.getUTCHours();
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    });
    // `formatToParts` gives us the hour as a 0-23 string even with `2-digit`
    // because `hour12: false` is set. `format()` would emit "24" at midnight
    // in some locales, which is why we use `formatToParts`.
    const parts = fmt.formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    if (!hourPart) return date.getUTCHours();
    const n = Number.parseInt(hourPart.value, 10);
    if (Number.isNaN(n)) return date.getUTCHours();
    // Normalize the midnight edge case some locales express as "24".
    return n === 24 ? 0 : n;
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Returns the calendar date ("YYYY-MM-DD") of `date` as observed in the
 * given IANA timezone. Falls back to the UTC date when `timeZone` is
 * null/undefined/empty or invalid.
 */
export function getDateStringInTimezone(
  date: Date,
  timeZone: string | null | undefined
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!timeZone) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // en-CA formats as YYYY-MM-DD natively.
    return fmt.format(date);
  } catch {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
}
