# apps/web — Next.js + Drizzle conventions

This file scopes Claude's instructions to the Next.js app. The root `CLAUDE.md`
covers monorepo-wide rules (Tasks.md workflow, pre-commit checklist).

## Stack

Next.js 16 (App Router) + React 19 · Drizzle ORM + Postgres (`postgres` driver) · NextAuth v5 (`@/lib/auth`) · Tailwind v4 + shadcn/ui · Vitest (+ jsdom for unit/component, real Docker Postgres for integration) · Pino structured logging (`@/lib/logger`).

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

## Feature gating (Free vs Pro)

When adding a route that should be Pro-only, the canonical pattern is:

1. Add the feature key to `FEATURE_MATRIX` in `lib/features.ts`.
2. In write API routes, call
   `const gated = await requireProFeature(session.user.id, "<key>");
   if (gated) return gated;` right after the auth + rate-limit checks.
   It returns a 402 with
   `{ error: "pro_plan_required", feature, currentPlan }`.
3. For a new gated page, follow the `/planner` pattern
   (`app/planner/page.tsx` is a server component that gates; the
   interactive UI lives in `PlannerClient.tsx`). The server shell
   renders `<FeaturePaywall feature="<key>" />` for free users with no
   existing data, or the client in `isReadOnly` mode for grandfathered
   users with data.
4. Sidebar navigation: set `proOnly: true` on the nav item so the "Pro"
   badge renders for free users.
5. Full policy + grandfather rules: `dev_logs/pricing-model.md`.
   Stripe descriptions: `dev_logs/stripe-pro-update-2026-04.md`.

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

## Tests

### Unit tests (`lib/*.test.ts`)

Co-locate next to source. Cover happy path + edge/error cases.

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

For the standard template, copy any existing `app/api/**/*.integration.test.ts` — they all follow the same shape (mock auth + db, seed users in `beforeAll`, clean tables in `beforeEach`, teardown in `afterAll`).

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

Server-side: use `createRequestLogger({ route, userId })` from `@/lib/logger` — never `console.log`. Client-side `console.error` is fine (Pino doesn't run in the browser).

## Design

Preploy's visual system is the "editorial coaching studio" direction landed in
PRs #164 / #165 / the polish follow-up. The full rationale lives in
`dev_logs/design-audit-2026-04.md`; what you need to know day-to-day:

### Tokens

All colour, font, shadow, and motion primitives are defined as CSS custom
properties in `app/globals.css`. Read that file before reaching for Tailwind
colour utilities — the tokens are:

- **Colour**: `--background`, `--foreground`, `--card`, `--primary` (cedar
  green), `--accent` (warm amber wash), `--destructive` (terracotta, not
  fire-truck red), `--muted`, `--border`, `--ring`, plus `--chart-1`..`5`
  (cedar / amber / burnt orange / terracotta / slate blue — semantic hues
  for score visualisations). Every token carries real chroma on a warm axis
  in light mode and ink-navy axis in dark.
- **Typography**: `--font-display` (Fraunces, serif, opsz + SOFT axes) is
  used **only on `h1`** via a `@layer base` rule; `--font-sans` (Instrument
  Sans) is the UI workhorse; `--font-mono` (Geist Mono) stays on code /
  transcript / timer / tabular numerals. `--font-heading` is deliberately
  mapped to `--font-sans` — do not move shadcn Card/Sheet/AlertDialog titles
  onto the serif, it reads heavy in dense UI.
- **Shadow**: `--shadow-xs`/`sm`/`md`/`lg`/`xl`. Warm-tinted drops in light
  mode; inset top-highlight + deep outer in dark. Never fall back to the
  default Tailwind shadow (pure black on warm bg reads cheap).
- **Motion**: `--ease-out` / `--ease-in` / `--ease-in-out` + `--duration-fast`
  (120ms) / `--duration-base` (200ms) / `--duration-slow` (320ms). Wrap
  aesthetic transitions in `motion-safe:` — `globals.css` has a global
  `prefers-reduced-motion` safety net that caps all animation + transition
  durations to 0.01ms, but that is a safety net, not licence to skip the
  prefix.

### Anti-patterns (do not ship)

- **Hardcoded Tailwind colours** like `text-green-600 dark:text-green-400`,
  `bg-red-50/50`, `text-blue-600` — use semantic tokens (`text-primary`,
  `bg-destructive/10`, `text-[color:var(--chart-5)]`) so dark mode stays
  cohesive.
- **Raw HTML entities as icons** — `&times;`, `↻`, `*` all look lazy. Reach
  for Lucide (`<X>`, `<RefreshCw>`, `<Lightbulb>`).
- **Native `<select>` / `confirm()` / `alert()`** — use shadcn
  `<Select>` / `<AlertDialog>` / an inline `role="status" aria-live="polite"`
  banner respectively. Native dialogs have no focus management and are blocked
  in some embedded contexts.
- **Decorative icons inside `<label>` text** without `aria-hidden="true"`.
  Screen readers announce the SVG title ("Building 2 Company") otherwise.
- **Toggle buttons without `aria-expanded` + `aria-controls`** for any
  expand/collapse widget (FAQ, AnalysisCard, Show Transcript).
- **Touch targets below 44×44px on interactive elements** — especially icon-
  only buttons and chip-sized filter toggles.

### Skill workflow

The `ui-ux-pro-max` and `frontend-design` skills are both installed. Default
routing for UI work:

- **`frontend-design`** when building or overhauling a user-facing surface.
  It's explicitly scoped to "avoid generic AI aesthetics" — use it whenever
  a page needs real craft, not just a token swap.
- **`ui-ux-pro-max`** for the accessibility / interaction / navigation rule
  audits (`--design-system`, `--domain ux`). Cross-check against its
  priority table before shipping a new component — it catches
  touch-target, reduced-motion, and `aria-*` gaps that are easy to miss.

When editing an existing UI file, the self-check before opening a PR is:
"does this look like every other shadcn+tailwind starter?" and "would a
real user hit a dead end or confusion here?" If either answer is yes,
push further.
