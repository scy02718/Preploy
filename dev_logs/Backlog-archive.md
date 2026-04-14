> **Archived 2026-04-14.** This file is frozen. All items migrated to GitHub Issues — see https://github.com/scy02718/interview-assistant/issues. File new tech debt as issues, not here.

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

---

## [REFACTOR] Consolidate apps/api FastAPI service into Next.js routes

**Identified in:** PR #1 follow-up discussion (architectural review during autonomous loop setup).

**Files:** All of `apps/api/`, plus `apps/web/app/api/sessions/[id]/feedback/route.ts` (which currently proxies to FastAPI via `fetch(${PYTHON_API_URL}/api/analysis/...)`).

### Problem

The `apps/api` FastAPI service is ~484 lines of Python across 5 functions (2 analysis endpoints + 1 health endpoint + 3 service modules). Audit of what it actually does:

| File | Lines | What it does |
| --- | --- | --- |
| `routers/analysis.py` | 59 | Two endpoints that are thin wrappers: parse request → call service → return response |
| `services/code_analyzer.py` | 166 | Call OpenAI → parse JSON → Pydantic-validate → return. Most lines are the prompt template |
| `services/feedback_generator.py` | 127 | Same pattern for behavioral analysis |
| `services/timeline_correlator.py` | 49 | **Pure function** — no AI. Merges transcript entries + code snapshots by timestamp |
| `routers/health.py` | 8 | Health check |

Nothing in the current Python code requires Python. There is no numpy, pandas, scikit-learn, transformers, spaCy, Hugging Face, LangChain, FAISS, or any Python-specific ML/scientific library. Every dependency has a first-class TypeScript equivalent already in use elsewhere in the repo:

| Python dep | TypeScript equivalent (already in repo) |
| --- | --- |
| `openai` Python SDK | `openai` npm package (first-party, same features) |
| `pydantic` v2 | `zod` (already used in `apps/web/lib/validations.ts`) |
| `FastAPI` | Next.js App Router route handlers (~30 already exist) |
| `pytest` + `ruff` | Vitest + ESLint (already configured) |
| `@sentry/python` | `@sentry/nextjs` (already configured) |
| `logging` stdlib | `pino` via `@/lib/logger` (already configured) |

The Python service does NOT touch the database — `SQLAlchemy` is in `pyproject.toml` but the services don't import it. Next.js handles auth, DB, sessions, and persistence, then makes a JSON HTTP call to FastAPI purely so FastAPI can make a second HTTP call to OpenAI and return the parsed result.

### Costs of keeping the split

1. **Duplicated patterns across languages.** The retry-on-malformed-GPT-response story (PR #2) had to be implemented twice — once per service file — because there's no way to share the helper across languages. Any future resilience / observability / rate-limiting work has the same doubling cost.
2. **Two test runners, two CI jobs, two dep upgrade flows**, two security audits, two Sentry SDKs, two logging stacks.
3. **Two CLAUDE.md files** (`apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`) that can drift. The autonomous loop's cognitive overhead doubles when it has to decide which one to read.
4. **Drift class of bugs.** The `precommit-gate.sh` hook shipped in PR #1 had a bug — it filtered on `interview-assistant-api` but the actual npm workspace name is `@interview-assistant/api`. That bug is only possible because Python and JS use different package naming conventions.
5. **Extra hop in the request path.** `browser → Next.js route → fetch → FastAPI → fetch → OpenAI → parse → JSON → fetch response → parse → Next.js response → browser`. That's two JSON round-trips and one extra process boundary for every feedback generation.
6. **Backlog drift risk.** PR #2 discovered that the retry pattern had been partially implemented in a prior session but the Backlog item was never removed and one of the two services was never mirrored. Single-language, this whole class of drift goes away.

### Benefits of keeping the split (the other side of the ledger)

1. **Independent scaling and deployment target.** Python service can run on a beefier host than serverless Next.js. Currently theoretical — not measured, not tested.
2. **Long OpenAI calls bypass serverless function timeouts.** Vercel's 60s Pro limit could bite a 20-30s analysis call if Next.js is deployed there. Mitigated by streaming responses, edge runtime exemptions, or non-serverless hosting.
3. **Future ML work is easier.** If you ever add embeddings, RAG, fine-tuning, sentence-transformers, FAISS, semantic search, or custom model inference, Python is the natural home.

### Decisive question before starting

**Is there concrete ML work on the 6–12 month roadmap?**

- **Yes** → keep the split. The cost of re-introducing Python later is much higher than keeping it now. Skip this refactor.
- **No** → consolidate. Every advantage of the split is theoretical today; every cost is real and recurring.

Only proceed with this story after the answer is explicitly "no."

### What to do

Migration plan (a `/standup` Tech Lead can refine this):

1. Move `services/timeline_correlator.py` → `apps/web/lib/timeline-correlator.ts` (pure function, easiest port)
2. Move the system prompts out of `services/code_analyzer.py` and `services/feedback_generator.py` → `apps/web/lib/prompts-analysis-technical.ts` and `.../prompts-analysis-behavioral.ts` (reuse the existing `apps/web/lib/prompts*.ts` naming)
3. Port the Pydantic schemas in `apps/api/app/schemas.py` → Zod validators in `apps/web/lib/validations.ts` (or a new `lib/schemas-analysis.ts`)
4. Implement `POST /api/analysis/behavioral` and `POST /api/analysis/technical` Next.js routes that replicate the FastAPI endpoints exactly
5. Port the retry pattern from the per-service duplication into a single helper in `apps/web/lib/openai-retry.ts`, used by both analysis routes
6. Update `apps/web/app/api/sessions/[id]/feedback/route.ts` to call the local Next.js analysis routes instead of the external `PYTHON_API_URL`
7. Port the test suite: `apps/api/tests/test_*.py` → `apps/web/app/api/analysis/*.test.ts` + `apps/web/app/api/analysis/*.integration.test.ts`. Use the same sample fixtures and assert byte-equivalent outputs for the pure functions
8. Delete `apps/api/`, `apps/api/CLAUDE.md`, the Python CI job in `.github/workflows/ci.yml`, and the api service in `docker-compose.yml`
9. Update `README.md` setup instructions (no more Python venv, no more `pip install -e ".[dev]"`)
10. Remove `@interview-assistant/api` filter from `.claude/hooks/precommit-gate.sh`
11. Shrink the per-app CLAUDE.md scheme to just `apps/web/CLAUDE.md`

### Validation strategy (byte-equivalent outputs)

Before deleting `apps/api`, run the existing pytest fixtures (the `VALID_GPT_RESPONSE`, `SAMPLE_TRANSCRIPT`, etc.) through BOTH the Python and TypeScript implementations and assert the output objects are identical (after JSON normalization). This catches subtle bugs introduced during the port (different float formatting, different enum serialization, etc.) before anything ships. Commit the comparison test; delete it after the Python side is removed.

### Acceptance criteria

- `apps/api/` directory deleted
- `apps/web/app/api/analysis/behavioral/route.ts` and `apps/web/app/api/analysis/technical/route.ts` exist and pass integration tests covering the same 8-point checklist as other routes
- `apps/web/lib/timeline-correlator.ts` has 100% line coverage (it's a pure function)
- `apps/web/lib/openai-retry.ts` is used by both analysis routes (single source of truth for the retry pattern)
- `apps/web/app/api/sessions/[id]/feedback/route.ts` calls the local routes instead of `PYTHON_API_URL`
- `PYTHON_API_URL` env var is removed from `.env.example` and `.env.ci`
- Python CI job removed from `.github/workflows/ci.yml`
- `docker-compose.yml` no longer references the api service
- `README.md` setup section no longer mentions Python, venv, or pip
- All existing Python tests have a TypeScript equivalent asserting the same behavior
- `apps/api/CLAUDE.md` deleted; `CLAUDE.md` "Monorepo layout" section updated
- `.claude/hooks/precommit-gate.sh` filter list no longer mentions `@interview-assistant/api`
- PR includes a before/after diff showing the request path simplification (one fewer process boundary)

### Out of scope

- Adding any new analysis capability — pure port, no feature work
- Optimizing prompts or retry behavior during the port — port exactly, optimize in a follow-up story
- Switching from OpenAI to a different LLM provider — also a follow-up
- Reworking `apps/web/app/api/sessions/[id]/feedback/route.ts` beyond the PYTHON_API_URL call site

### Priority

Medium. This is a significant refactor but nothing is on fire. Only start after the 6–12 month ML roadmap question is answered "no." Do not start during a feature push — the byte-equivalent validation step requires careful review and shouldn't be rushed.
