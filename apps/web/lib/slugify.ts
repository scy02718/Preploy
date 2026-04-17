/**
 * Converts a string to a URL/filename-safe slug.
 *
 * - Lowercases the input
 * - NFKD-normalises and strips diacritics (e.g. "é" → "e")
 * - Replaces runs of non-alphanumeric characters with a single "-"
 * - Trims leading/trailing "-"
 * - Caps at 60 characters (trimming at a "-" boundary when possible)
 * - Falls back to "story" when the result would be empty
 */
export function slugify(input: string, maxLength = 60): string {
  if (!input || typeof input !== "string") return "story";

  const normalized = input
    .normalize("NFKD")
    // Strip combining diacritical marks (U+0300–U+036F)
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) return "story";

  if (normalized.length <= maxLength) return normalized;

  // Trim at maxLength, then back up to the nearest "-" boundary
  let trimmed = normalized.slice(0, maxLength);
  const lastDash = trimmed.lastIndexOf("-");
  if (lastDash > 0) {
    trimmed = trimmed.slice(0, lastDash);
  }
  return trimmed.replace(/^-+|-+$/g, "") || "story";
}
