# Preploy — Interview Assistant

Practice mock interviews with AI. Get scored, track progress, get hired.

## Features

- **Behavioral interviews** — Voice-to-voice mock sessions with real-time AI conversation, STAR-method coaching, and scored feedback on structure and delivery
- **Technical interviews** — Split-panel coding sessions with Monaco editor, problem statements, mic recording for verbal explanations, and AI feedback on correctness and approach
- **Progress tracking** — Per-session feedback, trend charts, and a coaching hub that breaks down weak areas across behavioral, technical, and communication dimensions
- **STAR practice** — Standalone STAR-method story builder for structuring behavioral answers
- **Interview planner** — Session planning and preparation tooling
- **Resume builder** — Resume editing integrated into the prep workflow
- **Achievements** — Progress milestones to keep motivation high
- **Optional gaze tracking** — MediaPipe Face Landmarker measures eye contact and presence during behavioral sessions (opt-in; all processing runs locally in-browser, nothing is sent to a server)

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
git clone https://github.com/scy02718/interview-assistant.git
cd interview-assistant
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

This is a solo-maintained project, but bug reports and PRs are welcome. [Open an issue](https://github.com/scy02718/interview-assistant/issues) or fork and submit a PR against `main`.

## License

All rights reserved. This source is publicly viewable for reference only — it is not open source and may not be copied, redistributed, or used to build a competing product. See [LICENSE](./LICENSE) for full terms.
