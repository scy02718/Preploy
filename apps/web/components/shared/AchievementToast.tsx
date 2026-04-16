"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Trophy } from "lucide-react";
import { getBadge } from "@/lib/badges";

interface AchievementToastProps {
  badgeIds: string[];
  onDismiss: () => void;
}

/**
 * Bottom-right toast that congratulates the user on new badges.
 * Shows the first badge with a link to /achievements. Auto-hides after 8s.
 */
export function AchievementToast({ badgeIds, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible || badgeIds.length === 0) return null;

  const first = getBadge(badgeIds[0]);
  const extra = badgeIds.length - 1;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {first ? `${first.icon} ${first.name}` : "New Badge!"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {first?.description}
            {extra > 0 && ` and ${extra} more badge${extra > 1 ? "s" : ""}!`}
          </p>
          <Link
            href="/achievements"
            className="text-xs text-primary hover:underline mt-1 inline-block"
            onClick={onDismiss}
          >
            View achievements
          </Link>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
