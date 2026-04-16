"use client";

import { useEffect, useState, useCallback } from "react";
import { AchievementToast } from "./AchievementToast";

/**
 * Reads `new_badges` from sessionStorage (set by session pages after
 * badge awarding) and shows the AchievementToast. Clears after display.
 * Mount once in the root layout.
 */
export function AchievementToastProvider() {
  const [badgeIds, setBadgeIds] = useState<string[]>([]);

  useEffect(() => {
    // Check on mount and on focus (in case badge was awarded in another tab-like navigation)
    function check() {
      try {
        const raw = sessionStorage.getItem("new_badges");
        if (raw) {
          const ids = JSON.parse(raw);
          if (Array.isArray(ids) && ids.length > 0) {
            setBadgeIds(ids);
            sessionStorage.removeItem("new_badges");
          }
        }
      } catch {
        // ignore
      }
    }
    // Small delay so the page has time to render before the toast appears
    const timer = setTimeout(check, 1500);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  const handleDismiss = useCallback(() => setBadgeIds([]), []);

  if (badgeIds.length === 0) return null;

  return <AchievementToast badgeIds={badgeIds} onDismiss={handleDismiss} />;
}
