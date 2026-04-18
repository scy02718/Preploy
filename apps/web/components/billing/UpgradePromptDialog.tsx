"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_DEFINITIONS } from "@/lib/plans";

interface UpgradePromptDialogProps {
  open: boolean;
  onClose: () => void;
  used: number;
  limit: number;
}

// Lead with the Pro-exclusive tools so users understand that upgrading
// unlocks *features*, not just more of the same quota. Kept in sync with
// `FREE_FEATURES` / `PRO_FEATURES` in `/pricing` and `FEATURE_META` in
// `lib/features.ts`.
const PRO_BENEFITS = [
  "Interview-day Planner — AI-generated prep schedule",
  "Resume upload + resume-tailored questions",
  "Company-specific question generation",
  `${PLAN_DEFINITIONS.pro.limits.monthlyInterviews} mock interviews per month (up from 3)`,
];

/**
 * Modal that surfaces when the API returns a 402 free_tier_limit_reached
 * response. Shows current usage, the Pro benefits list pulled from
 * `PLAN_DEFINITIONS.pro`, and an "Upgrade to Pro" button that POSTs to
 * `/api/billing/checkout` and redirects to the returned Stripe URL.
 */
export function UpgradePromptDialog({
  open,
  onClose,
  used,
  limit,
}: UpgradePromptDialogProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to start checkout");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError("Checkout returned no URL");
    } catch {
      setError("Failed to start checkout");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      data-testid="upgrade-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        data-testid="upgrade-dialog-backdrop"
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2
          id="upgrade-dialog-title"
          className="text-xl font-semibold mb-2"
        >
          You&apos;ve hit your monthly limit
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          You&apos;ve used <strong data-testid="upgrade-dialog-used">{used}</strong>{" "}
          of <strong data-testid="upgrade-dialog-limit">{limit}</strong>{" "}
          interviews this month. Upgrade to Pro for unlimited practice.
        </p>

        <div className="rounded-md border p-4 mb-4 bg-muted/30">
          <p className="text-sm font-medium mb-2">
            Pro — ${PLAN_DEFINITIONS.pro.priceUsd}/month
          </p>
          <ul className="text-sm space-y-1.5">
            {PRO_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5">✓</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive mb-3"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isUpgrading}>
            Maybe later
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            data-testid="upgrade-dialog-cta"
          >
            {isUpgrading ? "Loading..." : "Upgrade to Pro"}
          </Button>
        </div>
      </div>
    </div>
  );
}
