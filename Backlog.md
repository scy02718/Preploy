# Backlog

Technical debt, deferred fixes, and low-priority improvements captured during code review. Each item includes enough context to be picked up without prior knowledge of the discussion that created it.

---

## [CORRECTNESS] Feedback route returns stale data when previous generation failed mid-way

**Identified in:** Story 19 review
**File:** `apps/web/app/api/sessions/[id]/feedback/route.ts`

### Problem

The `POST /api/sessions/[id]/feedback` handler has an early-return at line 44 when a `sessionFeedback` row already exists:

```ts
if (existing) {
  return NextResponse.json(existing);
}
```

For behavioral sessions this is safe. For technical sessions, if a previous feedback generation request failed after the row was inserted but before `code_quality_score`, `explanation_quality_score`, or `timeline_analysis` were written (e.g., a mid-insert DB error or a crash), subsequent calls will return the incomplete row silently. The feedback page will render with missing scores and an empty timeline.

### What to do

For technical sessions, add a completeness check before returning the existing row:

```ts
if (existing) {
  const isTechnical = found.type === "technical";
  const isComplete = !isTechnical || (
    existing.codeQualityScore !== null &&
    existing.explanationQualityScore !== null &&
    existing.timelineAnalysis !== null
  );
  if (isComplete) return NextResponse.json(existing);
  // Otherwise fall through and regenerate
}
```

If the row is incomplete, delete it and regenerate. Alternatively, use an `ON CONFLICT DO UPDATE` upsert instead of a bare `insert().returning()` so partial writes are always overwritten on retry.

### Acceptance criteria

- Calling `POST /feedback` on a session with an incomplete feedback row regenerates and overwrites it
- Calling `POST /feedback` on a session with a complete row still returns immediately (no redundant GPT call)
- Add an integration test covering the incomplete-row scenario

---

## [UX] Feedback page flickers on technical sessions due to race condition

**Identified in:** Story 20 review
**File:** `apps/web/app/dashboard/sessions/[id]/feedback/page.tsx`

### Problem

The feedback page fires two independent `useEffect` hooks on mount: one fetches the session type (`GET /api/sessions/:id`), the other polls for feedback (`GET /api/sessions/:id/feedback`). If feedback arrives before the session type fetch, `FeedbackDashboard` first renders with `sessionType="behavioral"` (the default), then re-renders with `"technical"` when the session fetch completes. The user sees the CodeQualityCard and TimelineView pop in after a frame.

### What to do

Fetch both session metadata and feedback in a single flow. Either:

1. **Combine into one call**: Have `GET /api/sessions/:id/feedback` also return the session `type` field (add it to the response or join it in the query). Then the page only needs one polling endpoint.
2. **Sequential fetch**: Fetch the session type first, then start the feedback poll. Use a single `useEffect` that does `await fetchSession(); startPolling();`. This adds one round-trip of latency but eliminates the flicker.

Option 1 is cleaner if you're willing to change the API response shape.

### Acceptance criteria

- On a technical session feedback page, CodeQualityCard and TimelineView render on the first paint (no pop-in)
- Behavioral sessions are unaffected

---

## [UX] Feedback page heading doesn't distinguish interview type

**Identified in:** Story 20 review
**File:** `apps/web/components/feedback/FeedbackDashboard.tsx`

### Problem

The heading says "Interview Feedback" for both behavioral and technical sessions. When a user has done multiple session types, the feedback page doesn't immediately orient them to which kind they're looking at.

### What to do

Use the `sessionType` prop (already available) to set the heading:

```tsx
<h1 className="text-2xl font-bold">
  {isTechnical ? "Technical Interview Feedback" : "Behavioral Interview Feedback"}
</h1>
```

### Acceptance criteria

- Technical feedback page heading says "Technical Interview Feedback"
- Behavioral feedback page heading says "Behavioral Interview Feedback"

---

## [CI] Web test process exits 1 despite 276/276 assertions passing

**Identified in:** PR #1 (autonomous dev loop) — QA gauntlet on the `apps/api` retry story surfaced this on the `apps/web` side and the agent verified it exists on baseline.

**Files:** `apps/web/components/feedback/FeedbackDashboard.test.tsx`, `apps/web/components/setup/BehavioralSetupForm.test.tsx`, `apps/web/components/setup/TechnicalSetupForm.test.tsx`, and several other component test files.

### Problem

`npx turbo test --filter=@interview-assistant/web` (and `cd apps/web && npm run test`) reports all 276 test assertions passing but the Vitest process exits with code 1. The cause is uncaught `ReferenceError: window is not defined` exceptions thrown during React 19 async cleanup in jsdom — they surface AFTER every test has already passed, in the teardown phase, so they don't fail any individual test but they break the process exit code.

Baseline on `main` shows roughly 29 such teardown errors; the PR #1 branch shows 14 (fewer only because fewer files were touched in that test run, not because of any fix). This has been happening for a while and is unrelated to any single story — it's a React 19 + Vitest + jsdom interaction in the component test harness.

This is currently the single biggest blocker for the autonomous loop's QA gate on web stories: a clean implementation will still trip QA because the process exit code says "failure." Right now we have to squint at the output and tell QA "ignore that, 276 passed." That's not sustainable.

### What to do

Investigate in this order — stop as soon as one works:

1. **Upgrade vitest / jsdom / @testing-library/react** to the latest versions that explicitly support React 19. The ecosystem was still catching up when this repo was set up; a straight dependency bump may have already fixed this upstream.
2. **Switch the offending files to `happy-dom`** instead of `jsdom`. happy-dom has historically been less strict about teardown ordering. Can be scoped per-test-file via `// @vitest-environment happy-dom`.
3. **Add a global `afterEach` that awaits all pending microtasks** before jsdom tears down. Something like `await new Promise(r => setTimeout(r, 0))` in `vitest.setup.ts` — crude but sometimes effective against React 19 scheduler races.
4. **Catch uncaught exceptions** at the Node level in `vitest.setup.ts`: `process.on('uncaughtException', e => { if (/window is not defined/.test(e.message)) return; throw e; })`. This is a band-aid but unblocks CI/QA while a proper fix is investigated.
5. **File an upstream issue** against vitest or @testing-library/react if root cause is clearly in their React 19 shim.

### Acceptance criteria

- `npx turbo test --filter=@interview-assistant/web` exits 0 on a clean `main` checkout.
- `.claude/hooks/precommit-gate.sh` passes on any valid web-only change without manual override.
- No reduction in test count (still 276 assertions, no suppressed tests).
- Fix is documented in `apps/web/CLAUDE.md` under a short "Known gotchas" section so future contributors don't re-trip this.

### Priority

High. This blocks the autonomous loop's QA gate for every web story, not just one-offs.
