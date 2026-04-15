/**
 * Utility helpers for admin-only routes.
 * Admin user IDs come from ADMIN_USER_IDS env var (comma-separated UUIDs).
 */

let cachedAdminIds: Set<string> | null = null;

function getAdminIds(): Set<string> {
  if (cachedAdminIds) return cachedAdminIds;
  const raw = process.env.ADMIN_USER_IDS ?? "";
  cachedAdminIds = new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  return cachedAdminIds;
}

/**
 * Returns true if the given user ID is in the ADMIN_USER_IDS list.
 * Returns 404 (not 403) from routes when this is false — never leak existence.
 */
export function isAdmin(userId: string): boolean {
  return getAdminIds().has(userId);
}

// Exported for testing purposes only
export function _resetAdminIdsCache(): void {
  cachedAdminIds = null;
}
