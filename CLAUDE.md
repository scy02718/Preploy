# Instructions for Claude

After making code change, recommend a commit message for that specific changes, if you made code changes significant enough. 

When referred to a **task**, go to **Tasks.md** and read through the stories and task descriptions. When you finish a task, always refer back to the **Tasks.md** and mark it as complete.

## Testing Requirements

When implementing a new feature or modifying existing logic, always write tests alongside the code. Aim for these coverage targets:

- **Pure logic** (`lib/`, `services/`, `stores/`, utils): **80%+ line coverage**. These are the highest-value tests.
- **API routes**: Write integration tests for any new or modified route handler.
- **Interactive components** (setup forms, feedback dashboard, expandable cards): Write component tests for components with meaningful user interaction (state changes, conditional rendering, expand/collapse). Place `*.test.tsx` next to the component. Mock Zustand stores and `next/navigation` using `vi.hoisted()` + `vi.mock()`. Use `getAllByText` instead of `getByText` since shadcn components may render elements multiple times in jsdom.
- **Skip testing**: Purely presentational components (shadcn wrappers, badges), Three.js/avatar components, and components that primarily fetch data (better covered by E2E later).

### Where to put tests

- **Web unit tests**: Place `*.test.ts` / `*.test.tsx` next to the source file being tested (e.g., `lib/prompts.test.ts`).
- **Web integration tests**: Place `*.integration.test.ts` next to the route handler (e.g., `app/api/sessions/route.integration.test.ts`). These run against a real Docker Postgres test DB.
  - **Never mock the database.** All DB interactions must run against the real Docker test DB. This is the whole point of integration tests — mocked DB queries can't catch real SQL/schema issues.
  - Mock `@/lib/auth` (for auth simulation) and external APIs (OpenAI, etc.) — these are the only things that should be mocked.
  - Mock `@/lib/db` to point at `getTestDb()` from `tests/setup-db.ts` — this redirects all DB calls to the Docker test DB (this is **not** mocking the DB; it's pointing to the test instance).
  - Use `beforeAll` to seed test data (e.g., test users), `beforeEach` to clean tables between tests, `afterAll` to cleanup/teardown.
- **Python tests**: Place `test_*.py` in `apps/api/tests/`. Mock external API calls (OpenAI) with `unittest.mock.patch`; test everything else for real.

### How to run

```bash
turbo test                                          # All unit tests
cd apps/web && npm run test:integration             # Integration tests (requires: docker compose up -d test-db)
cd apps/web && npm run test:coverage                # Unit tests with coverage
cd apps/api && npm run test:coverage                # Python tests with coverage
```

### Logging

Use structured logging instead of `console.log`/`console.error` in all server-side code:

- **API routes (Next.js)**: Use `logger` or `createRequestLogger()` from `@/lib/logger`. The `createRequestLogger` auto-generates a `requestId` for tracing.
  ```ts
  import { createRequestLogger } from "@/lib/logger";
  const log = createRequestLogger({ route: "POST /api/example", userId });
  log.info("Processing request");
  log.error({ err }, "Something failed");
  ```
- **Python (FastAPI)**: Use `logging.getLogger(__name__)` — already configured with JSON output in production.
- **Client-side code** (hooks, components, session pages): `console.error` is fine — Pino doesn't run in the browser.

### Pre-commit checklist

Before marking any story or task as complete, run **all** of the following:

```bash
npx turbo lint typecheck test          # Lint (ESLint + ruff) + typecheck + unit/component tests
cd apps/web && npm run test:integration # Integration tests (requires Docker test-db)
```

If any of these fail, fix the issue before committing. CI will reject the push otherwise.

### Database schema changes

When modifying `lib/schema.ts`, always use versioned migrations:

```bash
cd apps/web
npm run db:generate   # Generate SQL migration file from schema diff
# Review the generated SQL in drizzle/
npm run db:migrate    # Apply migration to your local database
```

- **Never use `db:push` in production.** It modifies the schema directly without an audit trail.
- `db:push` is acceptable for local development iteration, but always generate a migration before committing.
- Commit the generated SQL files in `drizzle/` — they are the source of truth for the schema.
- Integration tests automatically apply migrations via `tests/global-setup.ts`.

### Key principles

After finishing a feature, run `turbo test` to ensure nothing is broken. If adding a new API route or modifying an existing one, add or update the corresponding integration test. If adding pure logic, add a unit test.

### API route integration test checklist

Every API route change **must** have integration tests covering:

1. **Auth**: 401 when unauthenticated
2. **Authorization**: 404 when accessing another user's resource (never leak existence)
3. **Validation**: 400 for invalid/missing required fields
4. **Happy path**: Correct status code + response shape for each HTTP method
5. **Query params/filters**: If the route accepts query params (pagination, filters, etc.), test each param individually AND in combination. This includes:
   - Pagination: page boundaries, totalCount accuracy with filters applied
   - Filters: each filter alone, multiple filters combined, empty result sets
6. **Response shape changes**: If you change what an endpoint returns (e.g., wrapping an array in `{ data, pagination }`), update **every consumer** — other routes, frontend fetch calls, sidebar, dashboard — AND their tests
7. **Branching logic**: If a route behaves differently based on data (e.g., behavioral vs technical), test both branches

**When modifying an existing route**: always re-read the existing integration test file first. If your change adds a new query param, filter, response field, or behavioral branch, add corresponding test cases before considering the work done.