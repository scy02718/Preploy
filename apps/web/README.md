# @interview-assistant/web

Next.js 16 (App Router) application for Preploy — AI-powered mock interview
practice. See the root `CLAUDE.md` and `apps/web/CLAUDE.md` for coding
conventions.

## E2E tests

Playwright smoke tests live in `apps/web/e2e/`. They run against a **production
build** (`next build && next start`), not `next dev`, to catch build-time regressions.

### Prerequisites

```bash
# Install Playwright Chromium (one-time, per machine)
cd apps/web
npx playwright install chromium
```

### Running locally

Start the test Postgres (same Docker service used by integration tests):

```bash
# From the repo root
docker compose --profile test up -d test-db
```

Then, from `apps/web/`:

```bash
npm run test:e2e          # Run all E2E tests (builds + starts the server)
npm run test:e2e:smoke    # Run only @smoke-tagged tests (fastest)
npm run test:e2e:ui       # Open Playwright UI (interactive)
```

The first run will execute `npm run build` automatically (≈2 min).  Subsequent
runs with `reuseExistingServer: true` (local default) skip the build if the
server is already up.

### Auth

`globalSetup` (`e2e/global.setup.ts`) mints a NextAuth v5–compatible JWE cookie
for a seeded test user (`e2e-test@preploy.dev`) and writes it to
`e2e/.auth/user.json` (gitignored).  Tests that need to be authenticated use
this storage state automatically (via `projects[].use.storageState` in
`playwright.config.ts`).  Public-page tests override `storageState` to `{
cookies: [], origins: [] }`.

### Extension guidelines

- **Golden paths only** in `e2e/`.  New happy-path flows go here.
- **Bug repros and edge cases** → integration tests (`app/api/**/*.integration.test.ts`).
- Keep the suite under ~10 tests for v1; discuss with the team before adding more.
- Tag every new test with `@smoke` so CI can select it with `--grep @smoke`.

### Flake budget

The suite must pass 10 consecutive CI runs before branch-protection is flipped
to require E2E (tracked as a follow-up task after #41 merges).

## Health check

The app exposes a public health endpoint at `GET /api/health`:

- `200 {"status":"ok"}` — the process is up and the database responds to
  `SELECT 1`.
- `503 {"status":"error"}` — the database ping failed.

Intended for load balancer / container orchestrator health probes. It does not
require authentication and is not listed in `middleware.ts`'s protected-paths
matcher.

Smoke test locally:

```bash
curl -i http://localhost:3000/api/health
```

## Billing

Preploy uses [Stripe](https://stripe.com) for Pro-plan subscriptions. The billing
surface consists of two API routes:

| Route | Description |
|---|---|
| `POST /api/billing/checkout` | Creates a Stripe Checkout Session and returns `{ url }` for client redirect. |
| `POST /api/billing/portal` | Creates a Stripe Billing Portal session for the current user (requires existing `stripe_customer_id`). Returns `{ url }`. |
| `POST /api/billing/webhook` | Receives Stripe lifecycle events and updates the user's plan in the DB. |

### Customer Portal configuration (one-time, in the Stripe Dashboard)

After the first deploy, go to **Stripe Dashboard → Settings → Billing → Customer portal** and enable:

- **Update payment method**
- **View invoices**
- **Cancel subscription**

Without these toggles, the "Manage billing" button on `/profile` will hit the portal but the user will see a barebones page with no actions available.

### Local setup

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and log in:

   ```bash
   stripe login
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your Stripe keys:

   ```bash
   cp apps/web/.env.local.example apps/web/.env.local
   ```

   | Variable | How to get it |
   |---|---|
   | `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (`sk_test_...`). |
   | `STRIPE_WEBHOOK_SECRET` | Copied from `stripe listen` output (see below). |
   | `STRIPE_PRO_PRICE_ID` | Stripe Dashboard → Products → Pro plan → Price ID (`price_...`). |

3. Forward Stripe events to your local dev server:

   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```

   The CLI will print `webhook signing secret: whsec_...` — copy that value into
   `STRIPE_WEBHOOK_SECRET` in your `.env.local`.

4. Trigger a test checkout flow via the app UI (`/profile → Upgrade`), or
   manually with the CLI:

   ```bash
   stripe trigger checkout.session.completed
   ```

### Handled events

| Stripe event | Effect |
|---|---|
| `checkout.session.completed` | Upgrades user to `pro`, records `stripe_subscription_id`, period dates. |
| `customer.subscription.updated` | Refreshes plan and `plan_period_end`; maps `past_due`/`unpaid` → pro-flagged. |
| `customer.subscription.deleted` | Reverts to `free`, clears subscription ID, resets `interview_usage`. |
| `invoice.payment_failed` | Sets `past_due_at` timestamp on the user row. |

Webhook handlers are idempotent — re-delivering the same event is safe.

The webhook distinguishes `UserNotFoundError` (returns 200, Stripe does not retry — handles stale noise) from any other error (returns 500, Stripe retries with exponential backoff for up to 3 days).

## Environment variables

### Runtime vs build-time

Next.js inlines any `NEXT_PUBLIC_*` env var into the **client bundle at build
time** — changing its value after `next build` has no effect on already-built
JS shipped to the browser. Everything else (`DATABASE_URL`, `OPENAI_API_KEY`,
OAuth secrets, etc.) is read by the server at request time and must be
**injected at container start** — not baked into the image. This split matters
for Docker/ECS wiring: only the `BUILD_TIME_BAKED` vars belong in
`--build-arg`, and only the `RUNTIME_ONLY` vars should live in the runtime
task definition / secrets manager.

| Variable                   | Classification     | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BASE_URL`     | BUILD_TIME_BAKED   | Public origin of the site (e.g. `https://preploy.app`). Used for sitemap, robots, canonical, and OG tags. Defaults to `https://preploy.app` when unset. |
| `NEXT_PUBLIC_SENTRY_DSN`   | BUILD_TIME_BAKED   | Sentry DSN shipped to browsers for client-side error reporting.             |
| `NODE_ENV`                 | BUILD_TIME_BAKED   | Standard Node env flag; set by Next during `next build` / `next start`.     |
| `NEXT_RUNTIME`             | BUILD_TIME_BAKED   | Next-managed flag (`nodejs` \| `edge`) used by `instrumentation.ts`.        |
| `SUPABASE_DB_URL`          | RUNTIME_ONLY       | Postgres connection string for Drizzle (server secret, never client).      |
| `TEST_DATABASE_URL`        | RUNTIME_ONLY       | Override connection string for the integration-test Docker Postgres.       |
| `OPENAI_API_KEY`           | RUNTIME_ONLY       | OpenAI API key for question / problem / plan generation and analysis.      |
| `GOOGLE_CLIENT_ID`         | RUNTIME_ONLY       | Google OAuth client ID for NextAuth.                                        |
| `GOOGLE_CLIENT_SECRET`     | RUNTIME_ONLY       | Google OAuth client secret for NextAuth (server secret, never client).     |
| `SENTRY_DSN`               | RUNTIME_ONLY       | Server-side Sentry DSN used in `sentry.server.config.ts` / edge runtime.   |
| `LOG_LEVEL`                | RUNTIME_ONLY       | Pino log level override (`debug`, `info`, `warn`, `error`).                |
| `AUTH_SECRET`              | RUNTIME_ONLY       | NextAuth v5 session signing secret (also read as `NEXTAUTH_SECRET`). Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_SECRET`          | RUNTIME_ONLY       | Legacy alias for `AUTH_SECRET`. Either works; prefer `AUTH_SECRET` for new setups. |
| `AUTH_URL`                 | RUNTIME_ONLY       | Public URL of the app (also read as `NEXTAUTH_URL`). Forwarded to Playwright's webServer during E2E runs. |
| `CI`                       | RUNTIME_ONLY       | Set by CI runners (GitHub Actions, etc.). Used to toggle Playwright retry counts and parallel workers. |
| `PLAYWRIGHT_BASE_URL`      | RUNTIME_ONLY       | Base URL used by the Playwright E2E suite (default: `http://localhost:3000`). |
| `PLAYWRIGHT_SKIP_WEBSERVER`| RUNTIME_ONLY       | Set to `1` in CI to skip Playwright's built-in webServer block (server is pre-started). |
| `NEXTAUTH_URL`             | RUNTIME_ONLY       | Public URL of the app — used to build Stripe redirect URLs. Alias of `AUTH_URL`. |
| `STRIPE_SECRET_KEY`        | RUNTIME_ONLY       | Stripe secret API key (`sk_test_...` for dev, `sk_live_...` for prod). Never expose to client. |
| `STRIPE_WEBHOOK_SECRET`    | RUNTIME_ONLY       | Webhook signing secret from `stripe listen` or Stripe Dashboard. Used to verify inbound events. |
| `STRIPE_PRO_PRICE_ID`      | RUNTIME_ONLY       | Stripe Price ID for the Pro subscription plan (`price_...`). |

Server-only secrets (`SUPABASE_DB_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`,
`SENTRY_DSN`) must never be referenced from a file marked `"use client"` and
must never appear in the compiled client bundles under `.next/static/**`. The
automated checks in `tests/readme-env-audit.test.ts` and
`tests/client-bundle-secrets.test.ts` enforce both invariants.

## Local Docker

One-command local run of the production container image, wired to the existing
Supabase instance (or any Postgres you point it at) through `.env.local`. This
is the same image that deploys to production, so a green run here is strong
evidence the container is shippable.

Build context is the **repo root**, not `apps/web/`, so the monorepo workspace
files (`package-lock.json`, `packages/shared`) are visible to `npm ci`:

```bash
# From the repo root
docker compose up --build            # builds apps/web/Dockerfile, serves :3000
```

The `web` service reads environment from `.env.local` at the repo root (not
committed). Required keys — populate before `docker compose up`:

| Key                      | Notes                                                           |
| ------------------------ | --------------------------------------------------------------- |
| `DATABASE_URL`           | Postgres connection string (Supabase pooler URL in prod).      |
| `SUPABASE_DB_URL`        | Drizzle connection string; usually the same as `DATABASE_URL`. |
| `AUTH_SECRET`            | NextAuth v5 session signing secret. Generate with `openssl rand -base64 32`. Missing or empty → `[auth][error] MissingSecret` in the container logs. |
| `NEXTAUTH_SECRET`        | Legacy alias for `AUTH_SECRET`; either one works. Prefer `AUTH_SECRET` for new setups. |
| `AUTH_URL` / `NEXTAUTH_URL` | Public URL of the app — `http://localhost:3000` locally.   |
| `GOOGLE_CLIENT_ID`       | Google OAuth client ID.                                         |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth client secret.                                     |
| `OPENAI_API_KEY`         | OpenAI API key.                                                 |
| `AUTH_TRUST_HOST`        | Set to `true` for any non-Vercel deploy (local Docker included). NextAuth v5 rejects untrusted `Host` headers otherwise — the symptom is `[auth][error] UntrustedHost` in the container logs. |

Runtime envs baked into the container image itself (set in the Dockerfile, not
`.env.local`):

- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0` — required so the Next standalone server binds outside
  the container, not just to `127.0.0.1`.
- `PORT=3000`
- `NEXT_TELEMETRY_DISABLED=1`

Smoke check once the container is up:

```bash
curl -i http://localhost:3000/api/health/live    # liveness — no DB touch
curl -i http://localhost:3000/api/health         # readiness — pings Postgres
```

The integration-test Postgres (`test-db` service) lives in the same
`docker-compose.yml` behind the `test` compose profile, so it is **not**
started by `docker compose up` and does not conflict with the `web` service.
Start it on demand with:

```bash
docker compose --profile test up -d test-db
```
