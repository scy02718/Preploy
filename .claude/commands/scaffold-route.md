---
description: Scaffold a new Next.js API route + integration test skeleton with auth, logging, Zod validation, and the 8-point integration test coverage pre-wired.
argument-hint: <resource-name>
---

You are scaffolding a new API route at `apps/web/app/api/$ARGUMENTS/route.ts` and its integration test.

## Step 1 — Validate the resource name

- Refuse if `$ARGUMENTS` is empty — tell the user to provide a resource name, e.g. `/scaffold-route interview-sessions`.
- Refuse if `$ARGUMENTS` does not match `^[a-z][a-z0-9-]*$` (kebab-case, lowercase only, no slashes, no underscores). Tell the user what is wrong.
- Run:

```bash
ls apps/web/app/api/$ARGUMENTS 2>/dev/null
```

If the directory already exists, refuse and tell the user to pick a different name or edit the existing route directly.

## Step 2 — Show the user what you'll create

Print exactly:

```
Will create:
  apps/web/app/api/$ARGUMENTS/route.ts                    (~40 lines, GET + POST stubs)
  apps/web/app/api/$ARGUMENTS/route.integration.test.ts   (~120 lines, 8 it() blocks)

Resource:        $ARGUMENTS
Auth:            required (session.user.id)
Logger:          createRequestLogger({ route: "/api/$ARGUMENTS" })
Validator:       Zod schema in lib/validations/$ARGUMENTS.ts (you will fill in)
Rate limit:      checkRateLimit(session.user.id) on POST (remove if endpoint is cheap)
```

Wait for the user to say "yes" or "go" before writing any files.

## Step 3 — Write `route.ts`

Write the following into `apps/web/app/api/$ARGUMENTS/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRequestLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/api-utils";
// import { TODO_RESOURCE_SCHEMA } from "@/lib/validations/TODO_RESOURCE";

export async function GET(req: NextRequest) {
  const log = createRequestLogger({ route: "/api/$ARGUMENTS", method: "GET" });
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // TODO: query params, fetch, return shape
  log.info("listing $ARGUMENTS");
  return NextResponse.json({ items: [] });
}

export async function POST(req: NextRequest) {
  const log = createRequestLogger({ route: "/api/$ARGUMENTS", method: "POST" });
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rateLimit = await checkRateLimit(session.user.id);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  // const parsed = TODO_RESOURCE_SCHEMA.safeParse(body);
  // if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  // TODO: persist, return shape
  log.info("created $ARGUMENTS");
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

## Step 4 — Write `route.integration.test.ts`

Write the following into `apps/web/app/api/$ARGUMENTS/route.integration.test.ts`:

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

// 8-point integration coverage. Do not ship until each TODO is replaced with a real assertion.
describe("API /api/$ARGUMENTS (integration)", () => {
  beforeAll(async () => {
    // TODO: seed users and any prerequisite fixture rows
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: TEST_USER });
    // TODO: truncate $ARGUMENTS table between tests
  });

  afterAll(async () => {
    await cleanupTestDb();
    await teardownTestDb();
  });

  it("returns 401 when unauthenticated", async () => {
    // TODO: set mockAuth to return null, call GET/POST, assert status 401
    expect(true).toBe(false);
  });

  it("returns 404 when accessing another user's $ARGUMENTS (does not leak existence)", async () => {
    // TODO: seed a row owned by a different user, request it as TEST_USER, assert 404
    expect(true).toBe(false);
  });

  it("returns 400 for invalid input", async () => {
    // TODO: POST a body that violates the Zod schema, assert status 400 + issues shape
    expect(true).toBe(false);
  });

  it("GET happy path returns expected shape", async () => {
    // TODO: seed valid data, call GET, assert status 200 + response shape
    expect(true).toBe(false);
  });

  it("POST happy path returns expected shape", async () => {
    // TODO: POST valid body, assert status 201 + response shape
    expect(true).toBe(false);
  });

  it("filters by query params individually and combined", async () => {
    // TODO: seed multiple rows, call GET with each filter and combined, assert correct subset
    expect(true).toBe(false);
  });

  it("paginates correctly with totalCount and page boundaries", async () => {
    // TODO: seed N rows, request page 1 and page 2, assert items length and totalCount
    expect(true).toBe(false);
  });

  it("POST persists data — verified with a SELECT", async () => {
    // TODO: POST valid body, then SELECT from DB directly via getTestDb(), assert row exists
    expect(true).toBe(false);
  });
});
```

## Step 5 — Reminders printed to the user

Print exactly:

```
Next steps:
  1. Add a Zod validator at apps/web/lib/validations/$ARGUMENTS.ts and import it in route.ts.
  2. Replace each TODO in route.ts with real query/persist logic.
  3. Replace each `expect(true).toBe(false)` in the test with a real assertion.
  4. If the route needs to be reachable in the UI, add a sidebar entry in components/shared/Sidebar.tsx.
  5. If protected, ensure the matcher in middleware.ts covers /api/$ARGUMENTS.
  6. Run `cd apps/web && npm run test:integration` — all 8 tests should be RED until you fill them in.
```

## Rules

- Never write feature logic into the route — only the auth/log/rate-limit/Zod scaffolding.
- Never write real assertions in the test file — keep them as `expect(true).toBe(false)` so the suite fails until the developer does the work. A scaffolder that writes fake-passing tests is worse than no scaffolder.
- Never modify `middleware.ts`, `Sidebar.tsx`, or any sibling routes — that is the developer's job in step 5.
