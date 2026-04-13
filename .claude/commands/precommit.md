---
description: Run lint, typecheck, unit tests, and integration tests; fix anything that fails until everything is green.
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

## Step 4 — Report

Print a final summary in this format:

```
Pre-commit checklist
  Lint:                ✓ / ✗
  Typecheck:           ✓ / ✗
  Unit tests:          ✓ / ✗  (N passed)
  Component tests:     ✓ / ✗  (N passed)
  Integration tests:   ✓ / ✗  (N passed)
```

Only report SUCCESS if **every** step is green. If anything is still red, list
the failing files and the next thing you would try.
