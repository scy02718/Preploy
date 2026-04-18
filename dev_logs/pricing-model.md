# Preploy pricing model — 2026-04

## Summary

Preploy has two tiers: **Free** and **Pro**. Upgrading gives the user
three things, in order of importance:

1. **Two Pro-only tools** — the Interview-day Planner (`/planner`) and
   the Resume tools (`/resume`).
2. **A quota bump** — from 3 mock interviews per month to 40.
3. **Priority during high-traffic periods** — a soft commitment on
   infrastructure, not a hard SLO.

Pricing: **$15/month** or **$120/year** ($10/month effective, 33% off
monthly). Source of truth is `apps/web/lib/plans.ts` — do not hardcode
prices in copy.

## Why the tools, not just a quota bump

Before April 2026, the only reason a free user upgraded was *more of the
same thing* (40 sessions vs 3). That made Pro feel numerical — users who
weren't quota-bound had no reason to pay. The gating decision moves
Planner + Resume behind Pro so the upgrade question becomes "I want these
tools" rather than "I ran out of sessions."

The core loop (behavioral mocks, technical mocks, scored feedback, STAR
prep, coaching guides) stays free. That's intentional — Preploy still
needs to be a useful tool for users who don't pay, and the core loop is
what makes them retain long enough to hit the upgrade decision.

## Feature gating policy

The matrix lives in `apps/web/lib/features.ts`. Today it looks like:

| Feature | Free | Pro |
|---|---|---|
| `planner` — Interview-day Planner | ❌ gated | ✅ |
| `resume` — Resume tools (upload + AI questions) | ❌ gated | ✅ |

**What the matrix does NOT gate**, and why:

| Surface | Tier | Reason |
|---|---|---|
| Behavioral / technical mock interviews | Free | Core loop. Quota capped at 3/mo on free, 40/mo on Pro. |
| STAR prep (`/star`) | Free | High-retention tool that makes behavioral interviews useful; gating it hurts the funnel more than it helps conversion. |
| Coaching guides (`/coaching`) | Free | Static educational content; no per-user cost; helps SEO. |
| Dashboard / feedback / achievements | Free | Reviewing past work is part of the core loop. |

## Read-only grandfathering

Any free-tier user who had Planner or Resume data *before* the April
2026 gate retains **read-only access** to that data. The grandfather
policy has three rules:

- **Read (`GET`)**: always allowed. Free users can open `/planner` and
  `/resume`, see their existing rows, and open the detail view.
- **Delete**: allowed. Users can always remove data they own. Cleanup
  is never a Pro feature.
- **Create / update**: requires Pro. Generating a new plan, marking a
  day complete, archiving, uploading a new resume, and resume-tailored
  question generation all 402 on free.

Rationale: ripping access away from users who already had data would be
a trust breach and a support-ticket tax. Allowing read + delete lets
them orient themselves, export their work, and clean up without paying,
while still making the ongoing Pro experience materially better.

The page-level implementation reflects this: `app/planner/page.tsx` and
`app/resume/page.tsx` are server components that check the user's plan
*and* whether they have existing rows. If plan is Pro → interactive
client. If plan is Free and rows exist → read-only client. If plan is
Free and no rows → full `<FeaturePaywall />`.

## API-level gating

The `requireProFeature(userId, feature)` helper in `lib/api-utils.ts` is
the canonical gate. It returns a 402 `NextResponse` if the user's plan
doesn't unlock the feature, or `null` to continue.

Error shape:

```json
{
  "error": "pro_plan_required",
  "feature": "planner",
  "currentPlan": "free"
}
```

`402 Payment Required` is the correct status — `403` would signal an
authorization failure the user can't fix, whereas the fix here is
"upgrade your plan."

Routes currently gated:

| Route | Verb | Feature |
|---|---|---|
| `/api/plans/generate` | POST | `planner` |
| `/api/plans/[id]` | PATCH | `planner` |
| `/api/plans/[id]` | DELETE | *(not gated — cleanup grandfather)* |
| `/api/plans/[id]` | GET | *(not gated — read grandfather)* |
| `/api/resume/upload` | POST | `resume` |
| `/api/resume/questions` | POST | `resume` |
| `/api/resume/[id]` | DELETE | *(not gated — cleanup grandfather)* |
| `/api/resume` | GET | *(not gated — read grandfather)* |

## UI gating

- **Sidebar**: Planner and Resume render with a "Pro" badge for free
  users. The link still navigates — clicking lands on the
  paywall, not an error. Discovery > hiding.
- **Onboarding tour**: the Planner and Resume steps are reframed as
  "Available on Pro: …" for free users (and serve as confirmation for
  Pro users). Copy lives in `components/onboarding/tour-steps.ts`.
- **Pricing page**: Pro column leads with the gated features, quota bump
  comes after. See `app/pricing/page.tsx`.
- **Upgrade dialog** (`components/billing/UpgradePromptDialog.tsx`):
  fired on quota exhaustion. Benefits list leads with Planner + Resume
  so the upgrade decision isn't purely quota-driven.
- **Landing features**: Planner + Resume cards carry a Pro badge.
- **Paywall page** (`components/billing/FeaturePaywall.tsx`): full-page
  treatment for free users who hit a gated surface with no existing
  data. Distinct from the modal — paywalls gate a feature, the modal
  gates a limit.

## Stripe product descriptions

Out of band with this code PR — the Stripe product descriptions are
updated manually via Dashboard or `stripe` CLI. Exact copy + commands
are in [`stripe-pro-update-2026-04.md`](./stripe-pro-update-2026-04.md).

## Open questions resolved

| Question | Answer |
|---|---|
| Lock existing free users out entirely, or grandfather? | Grandfather read + delete; gate create + update. |
| Hide Pro items from free sidebar, or show with a badge? | Show with "Pro" badge — discovery-led. |
| Reframe the onboarding tour, or skip Pro steps for free users? | Reframe with "Available on Pro" copy. Keeps tour length constant and honest. |

## Open questions *not* resolved

- **A/B testing the paywall vs. hard lockout**: the current policy ships
  hard to all users. Revisit after 2 weeks of conversion data.
- **In-flight plan generation when a user downgrades**: plans are only
  persisted after successful generation, so there's no partial-state
  edge case. Documented here for clarity.
- **Team / multi-seat pricing**: out of scope for this iteration. `Plan`
  stays `"free" | "pro"` until we have a real team/enterprise ask.
