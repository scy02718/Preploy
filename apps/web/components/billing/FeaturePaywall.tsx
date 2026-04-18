import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FEATURE_META, type FeatureKey } from "@/lib/features";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { UpgradeCheckoutButton } from "./UpgradeCheckoutButton";

/**
 * Full-page paywall shown to free-tier users who try to use a Pro-gated
 * feature (Planner, Resume tools). Distinct from `UpgradePromptDialog`,
 * which is the modal that fires on quota exhaustion — paywalls gate a
 * feature, the dialog gates a limit.
 *
 * Copy is driven by `FEATURE_META` in `lib/features.ts` so the paywall,
 * pricing page, and upgrade dialog all pull from one source.
 */
export function FeaturePaywall({ feature }: { feature: FeatureKey }) {
  const meta = FEATURE_META[feature];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link
        href="/dashboard"
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Dashboard
      </Link>

      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                Pro feature
              </div>
              <CardTitle className="text-2xl">
                {meta.label} is part of Preploy Pro
              </CardTitle>
            </div>
          </div>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {meta.tagline}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ul className="space-y-3">
            {meta.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 text-sm">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              Preploy Pro — ${PLAN_DEFINITIONS.pro.priceUsd}/month, or $
              {PLAN_DEFINITIONS.pro.annualMonthlyEquivalentUsd}/month billed
              annually
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes the Planner, resume-tailored questions, and a lift
              from 3 to {PLAN_DEFINITIONS.pro.limits.monthlyInterviews}{" "}
              mock interviews per month. Cancel any time.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <UpgradeCheckoutButton className="flex-1" />
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "flex-1"
              )}
            >
              See full pricing
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Free users can still run mock interviews and use STAR prep and
            coaching. You can always come back and upgrade later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * A narrower variant — shown inline above a read-only grandfathered list
 * when a free user has legacy data they can still view but can't modify.
 */
export function FeatureReadOnlyBanner({
  feature,
}: {
  feature: FeatureKey;
}) {
  const meta = FEATURE_META[feature];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Lock
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {meta.label} is now a Pro feature
          </p>
          <p className="mt-0.5 text-muted-foreground">
            You can still view what you created before, but new changes need
            a Pro plan.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href="/pricing"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          See pricing
        </Link>
        <UpgradeCheckoutButton size="sm" />
      </div>
    </div>
  );
}

// Keep the internal import surface tidy: export the button so pages can
// embed it directly if they want a custom placement (e.g. empty-state CTA).
export { UpgradeCheckoutButton } from "./UpgradeCheckoutButton";
