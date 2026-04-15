# apps/web — Next.js + Drizzle conventions

This file scopes Claude's instructions to the Next.js app. The root `CLAUDE.md`
covers monorepo-wide rules (Tasks.md workflow, pre-commit checklist).

## Stack

- Next.js 16 (App Router) + React 19
- Drizzle ORM + Postgres (`postgres` driver)
- NextAuth v5 (`@/lib/auth`)
- Vitest + Testing Library + jsdom for unit/component tests
- Vitest + real Docker Postgres for integration tests
- Tailwind v4 + shadcn/ui components
- Pino structured logging (`@/lib/logger`)

## API routes

- Place in `app/api/{resource}/route.ts`.
- **Always** check `auth()` first; return 401 if unauthenticated.
- Validate input with Zod schemas from `@/lib/validations`.
- Use `checkRateLimit(session.user.id)` from `@/lib/api-utils` for expensive endpoints.
- Use `createRequestLogger({ route, userId })` from `@/lib/logger` — never `console.log` server-side.
- On 404 for another user's resource, never leak existence (return 404, not 403).

## SDK clients (OpenAI, Stripe, etc.) — lazy-init only

**Never instantiate an SDK client at module load.** Next.js evaluates every
route module during `next build`'s "Collecting page data" phase, and any SDK
that throws synchronously when its API key is missing (OpenAI, Stripe, …)
will crash the build before runtime env vars are read. This has burned us
twice (PRs #52, #53).

- For SDK clients used in **one** route, construct inside the handler:
  ```ts
  export async function POST(req: NextRequest) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // ...
  }
  ```
- For SDK clients shared across **multiple** routes (e.g. `lib/stripe.ts`),
  expose a Proxy that defers construction until first property access:
  ```ts
  let cached: Stripe | null = null;
  function getClient(): Stripe {
    if (cached) return cached;
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "..." });
    return cached;
  }
  export const stripe = new Proxy({} as Stripe, {
    get(_t, prop, recv) { return Reflect.get(getClient(), prop, recv); },
  });
  ```
  The Proxy keeps the existing named export shape so `vi.mock("@/lib/stripe", () => ({ stripe: {...} }))` test patterns work unchanged.
- **Never** put `if (!process.env.X) throw` at module top level — the build
  will hit it before your runtime env is in place.

## Database

- Schema lives in `lib/schema.ts`. Relations are defined in the same file.
- After modifying the schema, run:
  ```bash
  npm run db:generate    # Generate SQL migration
  # review the SQL in drizzle/
  npm run db:migrate     # Apply locally
  ```
- **Never** use `npm run db:push` for committed work — it bypasses the audit trail.
  It is acceptable for throwaway local iteration only.
- Commit the generated SQL files in `drizzle/`. They are the source of truth.
- Integration tests apply migrations automatically via `tests/global-setup.ts`.

## Pages

- Place in `app/{route}/page.tsx`. Use `"use client"` for interactive pages.
- Add new protected routes to `middleware.ts` matcher.
- Add navigation links in `components/shared/Sidebar.tsx` (and `Header.tsx` if top-level).
- Page containers: `max-w-6xl`. Two-column layouts: `md:grid-cols-2`.

### Loading skeletons (mandatory for any data-fetching widget)

**Every widget that fetches data MUST render a `animate-pulse` skeleton during the fetch.** Widgets that "pop in" suddenly when data arrives are a regression — file paths and the user has noticed them in PRs #37, #38, and others. Before requesting review:

- [ ] Does any `useEffect` in this component call `fetch(...)`? → Add an `isLoading` state initialized to `true`.
- [ ] Render a skeleton branch (`if (isLoading) return <skeleton/>`) before the real content.
- [ ] **The skeleton's shape must mirror the post-load layout exactly.** Same number of cards, same column structure, same approximate heights. A skeleton that shows 1 card per column is wrong if the loaded layout has 4 cards on the right.
- [ ] When you ADD a new card to a page that already has a skeleton, you MUST add a matching placeholder to the skeleton in the same commit. This is the most common cause of pop-in regressions.
- [ ] For nested widgets that fetch their own data (e.g., `MonthlyUsageMeter`), the widget owns its own internal skeleton — the parent doesn't need to know about it.
- [ ] Use `animate-pulse rounded bg-muted` divs sized to match the eventual content. Don't use empty `<Card />` shells without inner placeholders — they look broken.

## Styling

- Tailwind v4 + shadcn/ui (`Card`, `CardHeader`, `CardTitle`, `CardContent`).
- Dark mode: use `dark:` variants for custom colors.
- Score colors: `getScoreColor()` from `@/lib/utils`.

## Tests

### Unit tests (`lib/*.test.ts`)

- Co-locate next to the source file (e.g., `lib/prompts.test.ts`).
- Target 80%+ line coverage on `lib/`, `services/`, `stores/`.
- Cover happy path, edge cases, error cases, boundary values, empty/null inputs.

### E2E tests (`e2e/*.spec.ts`)

Playwright smoke tests cover golden paths through the production build.

- Tag every test with `@smoke`.
- Run against `next build && next start` (never `next dev`).
- **Golden paths only**: new user flows belong here.
- **Bug repros and edge cases** → integration tests, not E2E.
- Auth state is injected via `e2e/.auth/user.json` (minted by `global.setup.ts`).
- Stub external APIs (OpenAI, etc.) with `page.route()`, not real network calls.
- Extend only for top-level feature flows; keep the suite under ~10 tests for v1.

Local run (from `apps/web/`):

```bash
docker compose --profile test up -d test-db   # start test DB
npm run test:e2e:smoke                          # run smoke tests
```

### Component tests (`components/**/*.test.tsx`)

- Only for **interactive** components (state changes, conditional rendering, expand/collapse).
- Skip purely presentational components (shadcn wrappers, badges, icons).
- Skip Three.js/avatar components — better covered by E2E later.
- Use `getAllByText`, not `getByText` (shadcn renders multiple times in jsdom).
- Mock Zustand stores and `next/navigation` with `vi.hoisted()` + `vi.mock()`.
- For async data: mock `global.fetch` in `beforeEach`, restore in `afterEach`.

### Integration tests (`app/api/**/*.integration.test.ts`)

These run against a **real** Docker Postgres test DB. Start it with:

```bash
docker compose --profile test up -d test-db
npm run test:integration
```

(`test-db` lives behind the `test` compose profile so it does not start when
you run `docker compose up` for the `web` service — see `apps/web/README.md`
→ Local Docker.)

**Never mock the database.** That's the whole point of integration tests.

The only things you may mock:
- `@/lib/auth` — to simulate authenticated requests
- External APIs (OpenAI, Anthropic, etc.)
- `@/lib/db` — pointed at `getTestDb()` from `tests/setup-db.ts` (this is *redirection*, not mocking)

**Standard template:**

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { cleanupTestDb, teardownTestDb, getTestDb } from "../../../../tests/setup-db";
import { users } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { GET, POST } from "./route";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User",
};

describe("API /api/your-route (integration)", () => {
  beforeAll(async () => { /* seed users */ });
  beforeEach(async () => { vi.clearAllMocks(); /* clean tables */ });
  afterAll(async () => { await cleanupTestDb(); await teardownTestDb(); });

  it("returns 401 when unauthenticated", async () => { /* ... */ });
  it("returns 404 for another user's resource", async () => { /* ... */ });
  it("returns 400 for invalid input", async () => { /* ... */ });
  it("happy path returns correct data", async () => { /* ... */ });
});
```

### Integration test checklist (mandatory for every route change)

1. **Auth**: 401 when unauthenticated
2. **Authorization**: 404 when accessing another user's resource (never leak existence)
3. **Validation**: 400 for invalid/missing required fields
4. **Happy path**: correct status code + response shape for each HTTP method
5. **Query params/filters**: each individually AND in combination — pagination boundaries, totalCount with filters, empty result sets
6. **Response shape changes**: update **every consumer** (other routes, frontend fetch calls, sidebar, dashboard) AND their tests
7. **Branching logic**: test both branches (e.g., behavioral vs technical)
8. **Persistence**: after POST/PATCH, verify with a real SELECT query

When modifying an existing route, **always re-read** its integration test file first and add cases for any new param/field/branch.

## Logging

```ts
import { createRequestLogger } from "@/lib/logger";
const log = createRequestLogger({ route: "POST /api/example", userId });
log.info("processing request");
log.error({ err }, "something failed");
```

Client-side `console.error` is fine — Pino doesn't run in the browser.

## Skills available in this project

- **`webapp-testing`** — Playwright for browser tests. Use this when asked to "click through", "exercise the UI", or "verify the avatar renders". Prefer this over writing component tests for Three.js or animation-heavy code.
- **`claude-api`** — reference this only if the story touches Anthropic SDK code. The web app currently uses OpenAI; do not "convert" OpenAI calls to Anthropic without explicit instruction.
