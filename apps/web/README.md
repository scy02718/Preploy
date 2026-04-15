# @interview-assistant/web

Next.js 16 (App Router) application for Preploy — AI-powered mock interview
practice. See the root `CLAUDE.md` and `apps/web/CLAUDE.md` for coding
conventions.

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

Server-only secrets (`SUPABASE_DB_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`,
`SENTRY_DSN`) must never be referenced from a file marked `"use client"` and
must never appear in the compiled client bundles under `.next/static/**`. The
automated checks in `tests/readme-env-audit.test.ts` and
`tests/client-bundle-secrets.test.ts` enforce both invariants.
