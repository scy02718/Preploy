# Stripe product description refresh — 2026-04

## Context

Pricing model changed in April 2026: the Planner (`/planner`) and Resume
tools (`/resume`) moved behind the Pro tier. See
[`pricing-model.md`](./pricing-model.md) for the full policy and
[issue #167](https://github.com/scy02718/Preploy/issues/167) for the
rollout.

The in-app marketing copy (landing, pricing, upgrade dialog, paywall
page) was updated in the same PR. Stripe product descriptions are the
external-facing billing copy a user sees on the checkout page and in
their payment receipts, so they need the same refresh.

## Why this isn't automated

The Stripe MCP key available in the codegen environment is read-only on
Products — it can list but not update. The updates below need to be
pasted manually into the Stripe Dashboard (or run via a local Stripe CLI
with the live secret key).

## Updates

### Product `prod_ULpkQSrVSpi2YV` — "Preploy Pro — Monthly"

**Old description:**
> 40 mock interviews per month. Voice-to-voice behavioral + technical coding practice with AI-scored feedback.

**New description (paste into Stripe Dashboard → Products → "Preploy Pro — Monthly" → Description):**
> Unlocks the Interview-day Planner (AI-generated prep schedule) and resume-tailored question generation, and lifts your mock-interview cap from 3 to 40 per month. Voice-to-voice behavioral + technical practice with AI-scored feedback. Cancel any time.

### Product `prod_ULpkEE71chYZjH` — "Preploy Pro — Annual"

**Old description:**
> 40 mock interviews per month, billed yearly. Save 33% vs monthly ($10/mo effective).

**New description:**
> Unlocks the Interview-day Planner (AI-generated prep schedule) and resume-tailored question generation, and lifts your mock-interview cap from 3 to 40 per month — billed yearly. $10/month effective (33% off monthly). Voice-to-voice behavioral + technical practice with AI-scored feedback.

### Product `prod_ULpkICV7ugyTku` — "Pro" (unnamed legacy product)

This product has no description and no current traffic. **Recommended action: archive it** in the Stripe Dashboard so future checkout flows can't accidentally select it. If it's still referenced by an env var or price ID anywhere, confirm first; the plan definitions in `apps/web/lib/plans.ts` only reference `STRIPE_PRO_PRICE_ID` + `STRIPE_PRO_PRICE_ID_ANNUAL`, neither of which should point at this legacy product.

## Verification checklist

After pasting the new descriptions:

- [ ] Visit Stripe Dashboard → Products → "Preploy Pro — Monthly" — description matches the text above
- [ ] Visit Stripe Dashboard → Products → "Preploy Pro — Annual" — description matches
- [ ] Legacy `prod_ULpkICV7ugyTku` is archived or confirmed unused
- [ ] Start a checkout session from the live site (`/pricing` → Upgrade) and confirm the Stripe-hosted page now shows the refreshed copy
- [ ] Send a test invoice and verify the line-item description reflects the update (descriptions surface on receipts)

## One-shot CLI alternative

If you'd rather script this than paste, the equivalent Stripe CLI commands are:

```sh
# Run locally with a live secret key in STRIPE_SECRET_KEY env var
stripe products update prod_ULpkQSrVSpi2YV \
  --description "Unlocks the Interview-day Planner (AI-generated prep schedule) and resume-tailored question generation, and lifts your mock-interview cap from 3 to 40 per month. Voice-to-voice behavioral + technical practice with AI-scored feedback. Cancel any time."

stripe products update prod_ULpkEE71chYZjH \
  --description "Unlocks the Interview-day Planner (AI-generated prep schedule) and resume-tailored question generation, and lifts your mock-interview cap from 3 to 40 per month — billed yearly. \$10/month effective (33% off monthly). Voice-to-voice behavioral + technical practice with AI-scored feedback."
```

Does not require a code deploy — product metadata changes propagate to
the next Stripe checkout session and every invoice generated after the
update.
