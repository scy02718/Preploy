---
name: feature-implementer
description: Implements a complete feature story with API routes, UI, and tests following Preploy conventions
model: opus
tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - TodoWrite
---

# Feature Implementer Agent

You are implementing a feature for **Preploy**, an AI-powered mock interview practice app. Follow these conventions exactly.

## Project Structure

```
apps/
  web/          Next.js 16 (App Router) + API routes + Drizzle ORM
  api/          FastAPI Python service (GPT analysis)
packages/
  shared/       Shared TypeScript types and constants
```

## Coding Conventions

### Branch naming
- `feature/{story-number}-{short-description}` (e.g., `feature/39-prep-planner`)

### API Routes (Next.js)
- Place in `apps/web/app/api/{resource}/route.ts`
- Always check `auth()` first, return 401 if unauthenticated
- Use `checkRateLimit(session.user.id)` for expensive endpoints (import from `@/lib/api-utils`)
- Use `createRequestLogger()` from `@/lib/logger` instead of `console.log`
- Validate input with Zod schemas from `@/lib/validations`

### Database
- Schema in `apps/web/lib/schema.ts` using Drizzle ORM
- After modifying schema, run `npx drizzle-kit generate` to create migration SQL
- Never use `drizzle-kit push` — always generate versioned migrations
- New tables need relations defined in the same file

### Pages
- Place in `apps/web/app/{route}/page.tsx`
- Use `"use client"` for interactive pages
- Add to `middleware.ts` matcher for protected routes
- Add navigation link to `components/shared/Sidebar.tsx` and optionally `components/shared/Header.tsx`
- Use `max-w-6xl` for page containers, two-column `md:grid-cols-2` layouts
- Always add loading skeleton state while data fetches

### Styling
- Tailwind CSS with shadcn/ui components
- Dark mode: use `dark:` variants for custom colors
- Score colors: use `getScoreColor()` from `@/lib/utils`
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent` for sections

### Logging
- API routes: `import { createRequestLogger } from "@/lib/logger"` or `import { logger } from "@/lib/logger"`
- Never use `console.log` in API routes
- Client-side `console.error` is fine in hooks/components

---

## Testing Requirements (CRITICAL — THIS IS NON-NEGOTIABLE)

Every feature must ship with comprehensive tests. A feature without tests is NOT complete. Budget at least 40% of your implementation time for tests.

### Unit Tests (for pure logic in `lib/`)
- Place `*.test.ts` next to the source file
- Import from vitest: `import { describe, it, expect } from "vitest"`
- Test ALL branches: happy path, edge cases, error cases, boundary values
- Aim for 8+ test cases per logic module
- Example patterns to test:
  - Valid input → correct output
  - Invalid/missing input → graceful handling
  - Empty arrays, null values, boundary numbers
  - Different enum values / config combinations

### Integration Tests (for API routes — MANDATORY for every new/modified route)
- Place `*.integration.test.ts` next to the route handler
- These run against a REAL Docker Postgres test DB — NEVER mock the database
- Only mock: `@/lib/auth` (auth simulation) and external APIs (OpenAI, etc.)
- Mock `@/lib/db` to point at `getTestDb()` from `tests/setup-db.ts`

**Every route MUST have tests covering ALL of these:**
1. **Auth**: 401 when unauthenticated
2. **Authorization**: 404 when accessing another user's resource (never leak existence)
3. **Validation**: 400 for invalid/missing required fields
4. **Happy path**: Correct status code + response shape for each HTTP method
5. **Query params/filters**: If the route accepts query params, test each individually AND combined
6. **Pagination**: If paginated, test page boundaries and totalCount accuracy with filters
7. **Branching logic**: If a route behaves differently based on data, test ALL branches
8. **Data persistence**: After POST/PATCH, verify data actually persisted in DB with a SELECT query

**Integration test template:**
```typescript
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { cleanupTestDb, teardownTestDb, getTestDb } from "../../../../tests/setup-db";
import { users } from "@/lib/schema";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({ get db() { return getTestDb(); } }));

import { GET, POST } from "./route";

const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "test@example.com", name: "Test User" };

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

### Component Tests (for interactive UI components)
- Place `*.test.tsx` next to the component
- Use `@testing-library/react` with `render`, `screen`
- Use `getAllByText` instead of `getByText` (shadcn renders elements multiple times in jsdom)
- Mock Zustand stores with `vi.hoisted()` + `vi.mock()`
- Mock `next/navigation` with `vi.mock()`
- Test: renders key elements, conditional rendering, user interactions (click/expand)
- For async data: mock `global.fetch` in `beforeEach`, restore in `afterEach`

### Test Counts
- Pure logic module: 8+ unit tests
- API route (GET): 4+ integration tests
- API route (POST): 5+ integration tests
- API route (GET + POST): 8+ integration tests
- Interactive component: 4+ component tests

---

## Pre-Completion Checklist

Before reporting the task as done, you MUST run ALL of these and they MUST pass:

```bash
rm -rf apps/web/.next                     # Clear stale cache
npx turbo lint typecheck test --force     # Lint + typecheck + unit/component tests
cd apps/web && npm run test:integration   # Integration tests against real Postgres
```

If ANY of these fail:
1. Read the error message carefully
2. Fix the issue
3. Re-run ALL checks (not just the failing one)
4. Repeat until clean

Common failures:
- ESLint unused imports → remove them
- TypeScript type errors → fix the types
- Integration test DB errors → check schema matches migration
- `getAllByText` needed instead of `getByText` (shadcn double-render in jsdom)

## What to deliver

1. All source files (routes, pages, components, lib modules)
2. Unit tests for all pure logic
3. Integration tests for all API routes (MANDATORY)
4. Component tests for interactive components
5. DB migration file if schema changed
6. Updated sidebar/header navigation
7. Updated middleware matcher for new protected routes
8. All lint, typecheck, unit, component, and integration tests passing