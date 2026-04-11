# Backlog

Technical debt, deferred fixes, and low-priority improvements captured during code review. Each item includes enough context to be picked up without prior knowledge of the discussion that created it.

---

## [RELIABILITY] Add retry on malformed GPT response in analysis services

**Identified in:** Story 19 review
**Files:** `apps/api/app/services/code_analyzer.py`, `apps/api/app/services/feedback_generator.py`

### Problem

Both `generate_technical_feedback()` and `generate_behavioral_feedback()` raise a `RuntimeError` immediately on the first malformed or unparseable GPT response (bad JSON or Pydantic schema mismatch). There is no retry. For a technical session, GPT analysis takes 20-30 seconds and the user is waiting on the feedback page — a single flaky response from the model means a complete failure with no recovery.

### What to do

Wrap the OpenAI call + parse + validate block in a retry loop (max 2 attempts). On the first failure, log a warning and retry with the same prompt. Only raise `RuntimeError` after all attempts are exhausted.

Suggested structure (mirrors the retry pattern already in `apps/web/app/api/problems/generate/route.ts`):

```python
for attempt in range(2):
    try:
        response = await client.chat.completions.create(...)
        raw = response.choices[0].message.content
        if not raw:
            if attempt == 0: continue
            raise RuntimeError("GPT returned empty response")
        data = json.loads(raw)
        return ResponseModel.model_validate(data)
    except (json.JSONDecodeError, ValidationError):
        if attempt == 0: continue
        raise RuntimeError("GPT returned invalid response after retry")
```

Apply the same pattern to both services so behavior is consistent.

### Acceptance criteria

- A single bad GPT response does not fail the request
- Two consecutive bad responses raise `RuntimeError` and return 500
- Unit tests cover: succeeds on second attempt after first failure, fails after two bad attempts

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
