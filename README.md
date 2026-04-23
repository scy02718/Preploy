# Preploy

Practice mock interviews with AI. Get scored, track progress, get hired.

## Features

### Free tier
- **Behavioral interviews** — Voice-to-voice mock sessions with real-time AI conversation, STAR-method coaching, and scored feedback on structure and delivery (3 sessions/month)
- **Technical interviews** — Split-panel coding sessions with Monaco editor, problem statements, mic recording for verbal explanations, AI feedback on correctness and approach, and 1 LLM hint per session
- **Progress tracking** — Per-session feedback, trend charts, and a coaching hub that breaks down weak areas across behavioral, technical, and communication dimensions
- **STAR practice builder** — Standalone STAR-method story builder for structuring behavioral answers
- **Interview prep planner** — AI-generated day-by-day schedule from today to your interview date, balanced across behavioral, technical, and STAR practice
- **Resume tools** — PDF/plain-text resume upload, structured parse, and AI bullet rewrite (available to all signed-in users; generating interview questions from your resume during session setup is a Pro feature)
- **Achievements** — Progress milestones to keep motivation high
- **Gaze tracking (opt-in)** — MediaPipe Face Landmarker measures eye contact and presence during behavioral sessions; all processing runs locally in-browser, nothing is sent to a server
- **1 AI hint per technical session**

### Pro tier ($15/month or $120/year)
- **Higher session cap** — 40 sessions per month (up from 3)
- **Resume-tailored question generation** — During session setup, Pro users can generate interview questions drawn directly from their uploaded resume experience
- **3 AI hints per technical session** — Up from 1 on Free
- **Follow-up probing** — Interviewer probes up to 3 layers deep per question (impact, reasoning, counterfactual), with configurable intensity
- **Interviewer personas** — Five behavioral interviewer styles: Amazon LP, Google STAR, hostile panel, warm peer, or the default friendly Alex
- **Custom topic focus** — Free-text directive that steers every question toward a specific competency or topic
- **Pro analysis** — 10 deep-analysis runs per billing period with extended feedback and session summaries

## Tech stack

Next.js 16 (App Router) • React 19 • TypeScript • Drizzle ORM + Supabase Postgres • NextAuth v5 (Google OAuth) • OpenAI • Upstash Redis (rate limiting) • Stripe (billing) • Tailwind v4 + shadcn/ui • Vitest + Playwright • Vercel (Sydney region)

Monorepo managed by [Turborepo](https://turbo.build/):

```
apps/
  web/              Next.js 16 app (frontend + API routes)
packages/
  shared/           Shared TypeScript types + constants
```

## Quickstart

```bash
git clone https://github.com/scy02718/preploy.git
cd preploy
npm install                  # also runs scripts/setup-mediapipe.sh via postinstall
cp apps/web/.env.local.example apps/web/.env.local
# fill in required env vars (see below)
npm run dev
```

Open http://localhost:3000.

The `postinstall` script fetches MediaPipe WASM files and the face landmarker model into `apps/web/public/mediapipe/`. If you do not need gaze tracking locally, that step is harmless to skip — the feature is opt-in and the rest of the app works without it.

## Environment variables

**Minimum to boot locally:**

| Variable | Purpose |
|---|---|
| `SUPABASE_DB_URL` | Postgres connection string for Drizzle. Use the Supabase Session pooler (port 5432). |
| `AUTH_SECRET` | NextAuth v5 session signing secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | Public URL of the app — `http://localhost:3000` for local dev. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Google Cloud Console → Credentials). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
| `OPENAI_API_KEY` | OpenAI API key for question generation, code analysis, and feedback. |

**Optional (needed for billing, rate limiting, email, and error tracking):**

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for rate limiting. Falls back to in-memory limiter when unset (fine for dev, not for prod). |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token. |
| `STRIPE_SECRET_KEY` | Stripe secret key for Pro-plan billing. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (from `stripe listen`). |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the monthly Pro plan. |
| `STRIPE_PRO_PRICE_ID_ANNUAL` | Stripe Price ID for the annual Pro plan. |
| `SENTRY_DSN` | Server-side Sentry DSN (leave blank to disable). |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN. |
| `NEXT_PUBLIC_BASE_URL` | Canonical origin used for sitemap, robots, and OG tags. Defaults to `https://preploy.tech`. |
| `RESEND_API_KEY` | Resend API key for transactional email. Emails are silently skipped when unset. |

Full env reference (classifications, Docker wiring, Stripe setup): [`apps/web/README.md`](apps/web/README.md#environment-variables).

## Development

Run the full check suite before pushing:

```bash
npx turbo lint typecheck test           # ESLint + tsc + unit/component tests
cd apps/web && npm run test:integration # Integration tests (requires Docker)
cd apps/web && npm run test:e2e:smoke   # Playwright E2E smoke suite
```

Integration tests and E2E smoke tests require a local Postgres container:

```bash
docker compose --profile test up -d test-db
```

Detailed test docs: [`apps/web/README.md`](apps/web/README.md).

## Lighthouse (Performance / Accessibility / SEO)

Lighthouse CI runs on every PR using the **desktop preset** and gates merges on these thresholds:

| Category       | Threshold | Gate  | Routes                              |
|----------------|-----------|-------|-------------------------------------|
| Performance    | ≥ 90      | error | all 5                               |
| Accessibility  | ≥ 95      | error | all 5                               |
| SEO            | ≥ 95      | error | `/`, `/pricing`, `/login` only      |
| Best Practices | —         | warn  | all 5                               |

`/privacy` and `/terms` are excluded from the SEO gate — both pages intentionally set `robots: { index: false }` (draft legal docs, per issue #32), which caps the SEO category at ~0.69.

**Run locally** (requires a production build and a running DB):

```bash
# 1. Build the app
cd apps/web && npm run build

# 2. Start the production server in the background
npx next start -p 3000 &

# 3. Run lhci against the 5 public routes (from the repo root)
cd ../..
npx lhci autorun --config lighthouserc.json
```

HTML reports are written to `.lighthouseci/`. When the workflow fails in CI,
the report is uploaded as a GitHub Actions artifact (`lighthouse-report`)
so you can inspect the regression without re-running locally.

## Project structure

```
apps/
  web/              Next.js 16 app (frontend + API routes)
packages/
  shared/           Shared TypeScript types + constants
.github/workflows/  CI pipeline (lint, typecheck, unit, integration, E2E, build)
dev_logs/           Archived design docs (e.g. parked AWS migration)
```

## Contributing

This is a solo-maintained project, but bug reports and PRs are welcome. [Open an issue](https://github.com/scy02718/preploy/issues) or fork and submit a PR against `main`.

## License

All rights reserved. This source is publicly viewable for reference only — it is not open source and may not be copied, redistributed, or used to build a competing product. See [LICENSE](./LICENSE) for full terms.
