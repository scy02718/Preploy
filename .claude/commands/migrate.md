---
description: Generate a Drizzle migration from schema changes, review the SQL, and apply it locally.
---

You are running a Drizzle schema migration for `apps/web`. Follow these steps
in order — never skip the review step.

## Step 1 — Confirm there are schema changes

```bash
git diff apps/web/lib/schema.ts
```

If there is no diff, stop and tell the user there are no schema changes to
migrate. Do not generate an empty migration.

## Step 2 — Generate the migration

```bash
cd apps/web && npm run db:generate
```

This writes a new SQL file under `apps/web/drizzle/`.

## Step 3 — Review the generated SQL

Read the newly created SQL file. Summarize for the user, in this format:

```
Generated migration: drizzle/<filename>.sql
  Tables added:        <list>
  Tables modified:     <list>
  Columns added:       <list>
  Columns dropped:     <list>  ← FLAG IF NON-EMPTY
  Indexes added:       <list>
  Destructive ops:     <yes/no — details>
```

If there are any **destructive operations** (DROP COLUMN, DROP TABLE,
NOT NULL on a column with existing rows, type narrowing), STOP and ask the
user to confirm before applying.

## Step 4 — Apply locally

Only after the user has reviewed (and approved if there were destructive ops):

```bash
cd apps/web && npm run db:migrate
```

## Step 5 — Run integration tests

```bash
docker compose up -d test-db
cd apps/web && npm run test:integration
```

The integration test global setup re-applies migrations against the test DB,
so a passing integration suite confirms the migration is correct.

## Step 6 — Stage the migration

```bash
git add apps/web/lib/schema.ts apps/web/drizzle/
```

Suggest a Conventional Commits message:

```
chore(db): add migration <NNNN> — <one-line summary>
```

**Never** use `npm run db:push` for committed work.
