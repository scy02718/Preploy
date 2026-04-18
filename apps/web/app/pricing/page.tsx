import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_DEFINITIONS } from "@/lib/plans";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://preploy.tech";

export const metadata: Metadata = {
  title: "Pricing — Preploy",
  description:
    "Practice mock interviews with AI feedback. Free tier with 3 sessions per month, or upgrade to Pro for more.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  robots: { index: true, follow: true },
};

// Shared free + Pro capabilities. The Pro-gated helpers (Planner, Resume)
// are intentionally absent from the Free column below — pricing is the
// canonical place users learn what upgrading unlocks.
const FREE_FEATURES = [
  "3 mock interviews per month",
  "Behavioral & technical modes",
  "Voice-to-voice AI interviewer",
  "Scored feedback on every session",
  "STAR story prep with AI analysis",
  "Coaching guides & progress dashboard",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  // Lead with the Pro-exclusive features so the value prop reads as
  // "tools you can't get free", not just "a bigger quota."
  "Interview-day Planner — AI-generated prep schedule",
  "Resume upload + resume-tailored questions",
  "Company-specific question generation",
  `${PLAN_DEFINITIONS.pro.limits.monthlyInterviews} mock interviews per month (up from 3)`,
  "Priority during high-traffic periods",
];

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col",
        highlight && "border-primary shadow-lg ring-1 ring-primary/20"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          {highlight && <Badge>Most popular</Badge>}
        </div>
        <div className="mt-2">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground ml-1">{period}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        <ul className="space-y-2.5 flex-1 mb-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={cn(
            buttonVariants({
              variant: highlight ? "default" : "outline",
              size: "lg",
            }),
            "w-full"
          )}
        >
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}

export default function PricingPage() {
  const pro = PLAN_DEFINITIONS.pro;

  return (
    <main className="max-w-5xl mx-auto px-4 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Simple, honest pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Start practicing for free. Upgrade when you need more sessions —
          cancel anytime from your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PricingCard
          name="Free"
          price="$0"
          period="/month"
          description="Get a feel for AI-powered interview practice."
          features={FREE_FEATURES}
          cta="Get started free"
          ctaHref="/login"
        />

        <PricingCard
          name="Pro — Monthly"
          price={`$${pro.priceUsd}`}
          period="/month"
          description={`${pro.limits.monthlyInterviews} sessions per month. Cancel anytime.`}
          features={PRO_FEATURES}
          cta="Upgrade to Pro"
          ctaHref="/profile"
          highlight
        />

        <PricingCard
          name="Pro — Annual"
          price={`$${pro.annualMonthlyEquivalentUsd}`}
          period={`/month, billed $${pro.annualTotalUsd}/year`}
          description="Same as Pro Monthly — save 33% by paying yearly."
          features={[...PRO_FEATURES, "33% savings vs monthly billing"]}
          cta="Upgrade — Annual"
          ctaHref="/profile"
        />
      </div>

      <div className="mt-16 text-center space-y-4">
        <h2 className="text-2xl font-semibold">Questions?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Check the{" "}
          <Link href="/#faq" className="underline hover:text-foreground">
            FAQ on the landing page
          </Link>{" "}
          or email{" "}
          <a
            href="mailto:preploy.dev@gmail.com"
            className="underline hover:text-foreground"
          >
            preploy.dev@gmail.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
