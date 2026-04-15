---
description: Run lint, typecheck, unit tests, integration tests, and E2E smoke tests; fix anything that fails until everything is green.
---

You are about to run the full pre-commit checklist for this monorepo. Follow
these steps **exactly**, in order. Do not skip steps.

## Step 1 — Clear stale Next.js cache

```bash
rm -rf apps/web/.next
```

## Step 2 — Lint, typecheck, unit/component tests

```bash
npx turbo lint typecheck test
```

If anything fails:

1. Read the error message carefully.
2. Fix the underlying issue — never `--no-verify`, never delete failing tests
   to "make them pass," never disable rules. Diagnose root cause first.
3. Re-run **the entire** turbo command (not just the failing project).
4. Repeat until clean.

Common failures and fixes:
- ESLint unused-import → remove the import.
- TypeScript strict-null → fix the type, do not cast to `any`.
- Vitest "Cannot find module" → check `vi.mock()` paths, especially for
  `@/lib/db` or `@/lib/auth`.
- Component test using `getByText` → switch to `getAllByText` (shadcn renders
  multiple times in jsdom).

## Step 3 — Integration tests

```bash
docker compose up -d test-db
cd apps/web && npm run test:integration
```

If the test DB container is already healthy, the `up -d` is a no-op. If
integration tests fail because of a schema mismatch, regenerate the migration:

```bash
cd apps/web && npm run db:generate
# review drizzle/*.sql
npm run db:migrate
```

Then re-run the integration suite.

## Step 4 — E2E smoke tests (Playwright)

Skip this step entirely if `apps/web/e2e/` does not exist on the current
branch (e.g., on branches cut before #41 merged). Otherwise:

```bash
docker compose --profile test up -d test-db
cd apps/web && npm run test:e2e:smoke
```

This spins up a production build (`next build && next start`) and runs the
chromium smoke suite against it. Expect ~2–3 minutes on a cold cache. The
suite shares the same `test-db` container as integration tests.

Common failures:
- `AUTH_SECRET` missing → all authenticated tests redirect to `/login`.
  `playwright.config.ts` falls back to the CI dummy secret, but verify
  your shell env does not override it with a different value.
- Port 3000 already in use → stop any local `next dev` first.
- Schema drift → run `npm run db:migrate` against `test-db`, then re-run.
- Transient mic/camera prompts → `playwright.config.ts` grants both
  permissions; if a new test still blocks, match that pattern.

If a single test flakes, re-run the full suite once before calling it a
failure. Any test that flakes twice gets a `test.skip(...)` with a
`TODO(#41-v2)` comment and a follow-up issue filed — we do not tolerate a
flaky suite in the repo.

## Step 5 — Report

Print a final summary in this format:

```
Pre-commit checklist
  Lint:                ✓ / ✗
  Typecheck:           ✓ / ✗
  Unit tests:          ✓ / ✗  (N passed)
  Component tests:     ✓ / ✗  (N passed)
  Integration tests:   ✓ / ✗  (N passed)
  E2E smoke tests:     ✓ / ✗ / skipped  (N passed)
```

Only report SUCCESS if **every** step is green. If anything is still red, list
the failing files and the next thing you would try.
