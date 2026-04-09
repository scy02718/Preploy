# Instructions for Claude

After making code change, recommend a commit message for that specific changes, if you made code changes significant enough. 

When referred to a **task**, go to **Tasks.md** and read through the stories and task descriptions. When you finish a task, always refer back to the **Tasks.md** and mark it as complete.

## Testing Requirements

When implementing a new feature or modifying existing logic, always write tests alongside the code. Aim for these coverage targets:

- **Pure logic** (`lib/`, `services/`, `stores/`, utils): **80%+ line coverage**. These are the highest-value tests.
- **API routes**: Write integration tests for any new or modified route handler.
- **Hooks and components**: Skip test coverage — these are browser-runtime code better covered by E2E tests later.

### Where to put tests

- **Web unit tests**: Place `*.test.ts` / `*.test.tsx` next to the source file being tested (e.g., `lib/prompts.test.ts`).
- **Web integration tests**: Place `*.integration.test.ts` next to the route handler (e.g., `app/api/sessions/route.integration.test.ts`). These run against a real Docker Postgres test DB.
  - Mock only `@/lib/auth` (for auth simulation).
  - Mock `@/lib/db` to point at `getTestDb()` from `tests/setup-db.ts` — this redirects all DB calls to the Docker test DB.
  - Use `beforeAll` to seed test data (e.g., test users), `beforeEach` to clean tables between tests, `afterAll` to cleanup/teardown.
- **Python tests**: Place `test_*.py` in `apps/api/tests/`. Mock external API calls (OpenAI) with `unittest.mock.patch`; test everything else for real.

### How to run

```bash
turbo test                                          # All unit tests
cd apps/web && npm run test:integration             # Integration tests (requires: docker compose up -d test-db)
cd apps/web && npm run test:coverage                # Unit tests with coverage
cd apps/api && npm run test:coverage                # Python tests with coverage
```

### Key principle

After finishing a feature, run `turbo test` to ensure nothing is broken. If adding a new API route or modifying an existing one, add or update the corresponding integration test. If adding pure logic, add a unit test.