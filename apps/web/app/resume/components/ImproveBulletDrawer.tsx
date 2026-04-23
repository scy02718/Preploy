"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

interface ImproveBulletDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bullet: string;
  roleTitle: string;
  roleCompany: string;
  resumeId: string;
  /** Called when user accepts a variant — parent handles the PATCH and undo stack */
  onAccept: (oldBullet: string, newBullet: string) => Promise<void>;
}

export function ImproveBulletDrawer({
  open,
  onOpenChange,
  bullet,
  roleTitle,
  roleCompany,
  resumeId,
  onAccept,
}: ImproveBulletDrawerProps) {
  const [variants, setVariants] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch variants whenever the drawer opens with a new bullet
  useEffect(() => {
    if (!open || !bullet) return;

    let cancelled = false;
    setVariants([]);
    setRateLimitError(false);
    setFetchError(null);
    setIsFetching(true);

    fetch("/api/resume/rewrite-bullet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId, bullet, roleTitle, roleCompany }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 429) {
          setRateLimitError(true);
          return;
        }
        if (!res.ok) {
          setFetchError("Failed to generate rewrites. Please try again.");
          return;
        }
        const data = await res.json() as { variants: string[] };
        if (!cancelled) setVariants(data.variants ?? []);
      })
      .catch(() => {
        if (!cancelled) setFetchError("Network error. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, bullet, resumeId, roleTitle, roleCompany]);

  async function handleAccept(variant: string) {
    setIsAccepting(true);
    try {
      await onAccept(bullet, variant);
      onOpenChange(false);
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--primary)]" aria-hidden="true" />
            Improve This Bullet
          </SheetTitle>
          <SheetDescription>
            Review AI-generated rewrites and accept one to update your resume.
          </SheetDescription>
        </SheetHeader>

        {/* Original bullet */}
        <div className="mb-4 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
          <p className="text-sm">{bullet}</p>
        </div>

        {/* 429 rate-limit banner */}
        {rateLimitError && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            You&apos;ve hit the AI usage limit. Please wait a minute and try again.
          </div>
        )}

        {/* Generic error */}
        {fetchError && !rateLimitError && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {fetchError}
          </div>
        )}

        {/* Loading skeleton — 3 blocks mirroring the 3 variant cards */}
        {isFetching && !rateLimitError && (
          <div className="space-y-3" aria-label="Loading rewrites">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-md bg-muted h-20"
              />
            ))}
          </div>
        )}

        {/* Variants list */}
        {!isFetching && variants.length > 0 && (
          <div className="space-y-3">
            {variants.map((variant, idx) => (
              <div
                key={idx}
                className="rounded-md border p-3 space-y-2 motion-safe:transition-colors hover:border-primary/50"
              >
                <p className="text-sm">{variant}</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAccepting}
                  onClick={() => handleAccept(variant)}
                  className="gap-1.5 min-h-[44px]"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Accept
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
