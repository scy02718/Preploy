# Interview Assistant - Phase 2: Behavioral Interview MVP

> **Timeline:** Week 3-5
> **Goal:** Build the full behavioral interview flow from setup → live interview with avatar → AI-generated feedback. Also introduce Zustand state management, input validation, and testing infrastructure.

---

## Story 8: Behavioral Interview Setup Page

> **Motivation:** Users need a way to configure their mock interview before starting — company context, job description, expected questions, and interview style/difficulty. This config drives the AI interviewer's system prompt, so getting it right directly impacts interview quality.

### Tasks

- [x] **8.1** Install Zustand in `apps/web` (`npm install zustand`). Create `stores/interviewStore.ts` — a Zustand store managing the full behavioral interview lifecycle:
  - State: `sessionId`, `config` (BehavioralSessionConfig from `packages/shared`), `status` (SessionStatus), `transcript[]`, `error`
  - Actions: `setConfig(partial)`, `createSession()`, `startSession()`, `endSession()`, `addTranscriptEntry()`, `reset()`
  - `createSession()` should POST to `/api/sessions` with type `"behavioral"` and the config, store the returned session ID
  - `startSession()` should PATCH `/api/sessions/[id]` with `status: "in_progress"` and `startedAt: new Date()`
  - `endSession()` should PATCH `/api/sessions/[id]` with `status: "completed"`, `endedAt: new Date()`, and `durationSeconds`

- [x] **8.2** Create `components/interview/BehavioralSetupForm.tsx` — a multi-field form with:
  - **Company name** — text input (optional)
  - **Job description** — textarea (optional, placeholder: "Paste the job description here...")
  - **Expected questions** — dynamic list: text input + "Add" button, each question shows with a remove (X) button, max 10 questions
  - **Interview style** — Slider from 0 to 1 (label: "Strict" on left, "Casual" on right), default 0.5
  - **Difficulty** — Slider from 0 to 1 (label: "Easy" on left, "Hard" on right), default 0.5
  - Use shadcn/ui components (Input, Label, Slider, Button, Card)
  - On submit: call `interviewStore.createSession()` then navigate to `/interview/behavioral/session`

- [x] **8.3** Replace the placeholder `app/interview/behavioral/setup/page.tsx` with the real setup page:
  - Render `BehavioralSetupForm` inside a centered layout (max-w-2xl)
  - Page title: "Behavioral Interview Setup"
  - Subtitle: "Configure your mock interview. The AI interviewer will adapt based on these settings."
  - "Start Interview" button at the bottom of the form (disabled until form submits)

- [x] **8.4** Add Zod validation to `POST /api/sessions` in `app/api/sessions/route.ts`:
  - Create `lib/validations.ts` with a `behavioralConfigSchema` using Zod:
    - `company_name`: optional string, max 200 chars
    - `job_description`: optional string, max 5000 chars
    - `expected_questions`: optional array of strings, max 10 items, each max 500 chars
    - `interview_style`: number between 0 and 1
    - `difficulty`: number between 0 and 1
  - Validate the `config` field in the POST handler, return 400 with specific error messages on failure

- [x] **8.5** Verify: can fill out the setup form, submit it, see a session created in Supabase with correct config JSONB, and get redirected to the session page

### Acceptance Criteria

- [x] Setup form renders with all fields (company, JD, questions list, style slider, difficulty slider)
- [x] Adding/removing expected questions works (max 10 enforced)
- [x] Sliders show current value and labels
- [x] Form submission creates a session in the DB with correct config
- [x] Invalid input (e.g., JD over 5000 chars) returns a clear error
- [x] After submission, user is redirected to `/interview/behavioral/session`

---

## Story 9: AI Interviewer Prompt Builder

> **Motivation:** The quality of the mock interview hinges entirely on the system prompt sent to OpenAI's Realtime API. This prompt must incorporate the user's config (company, JD, difficulty, style) to make the AI behave like a realistic interviewer for that specific role. Building this as a pure function makes it easy to test and iterate on.

### Tasks

- [x] **9.1** Create `lib/prompts.ts` — export a `buildBehavioralSystemPrompt(config: BehavioralSessionConfig): string` function that generates a system prompt incorporating:
  - Base persona: "You are an experienced hiring manager conducting a behavioral interview"
  - If `company_name` provided: "You are interviewing for a role at {company_name}"
  - If `job_description` provided: "Here is the job description:\n{job_description}\nTailor your questions to assess fitness for this role."
  - If `expected_questions` provided: "The candidate expects questions like: {list}. You may use some of these but also add your own."
  - `interview_style` mapping: 0.0 = very formal/structured, 0.5 = balanced, 1.0 = casual/conversational. Include specific instructions like "Keep a formal tone, don't use first names" vs "Be warm and conversational"
  - `difficulty` mapping: 0.0 = entry-level questions, 0.5 = mid-level, 1.0 = senior/staff-level with deep follow-ups
  - Interview flow instructions: start with introduction, ask 4-6 questions, use STAR method follow-ups, wrap up with "do you have any questions for me?"
  - Important constraint: "Keep responses concise (2-3 sentences max) since this is a voice conversation. Do not give long monologues."

- [x] **9.2** Create `lib/prompts.test.ts` (will be runnable after Story 13 sets up Vitest, but write it now):
  - Test that default config (no company, no JD) produces a valid prompt with base persona
  - Test that company name is included when provided
  - Test that job description is included when provided
  - Test that expected questions are listed when provided
  - Test style=0.0 produces "formal" instructions, style=1.0 produces "casual" instructions
  - Test difficulty=0.0 mentions "entry-level", difficulty=1.0 mentions "senior"
  - Test that prompt always includes the "concise responses" constraint

- [x] **9.3** Verify: the prompt builder produces reasonable, well-structured prompts for various config combinations

### Acceptance Criteria

- [x] `buildBehavioralSystemPrompt()` is a pure function with no side effects
- [x] All config fields are reflected in the output prompt when provided
- [x] Default config (empty) still produces a valid, usable prompt
- [x] Prompt explicitly instructs concise voice responses
- [x] Tests cover all config permutations

---

## Story 10: Live Interview Session Page (Voice + Avatar)

> **Motivation:** This is the core experience — a video-call-like interface where the user talks to an AI interviewer avatar. We need to combine the voice spike (Story 5) with the avatar spike (Story 6) into a single integrated page, add session controls (timer, end session), and capture the transcript for later analysis. The previous story explanation will be present under `dev_logs/Phase1_Tasks.md`

### Tasks

- [x] **10.1** Create `components/interview/VideoCallLayout.tsx` — split-screen layout mimicking a video call:
  - **Left side (60%):** Avatar viewport — reuse `AvatarCanvas`, `AvatarModel`, `LipSyncController`, `IdleAnimations`, `IdlePose` from the spike
  - **Right side (40%):** User's webcam feed via `getUserMedia({ video: true })` rendered in a `<video>` element, mirrored (CSS `transform: scaleX(-1)`)
  - Both sides should have name labels: "AI Interviewer" on left, user's name (from session) on right
  - Overlay status indicators: "Listening..." when AI detects speech, "Speaking..." when AI is talking

- [x] **10.2** Create `components/interview/SessionControls.tsx` — bottom control bar:
  - **Timer** — elapsed time display (MM:SS), starts when session begins
  - **Mute/Unmute** button with mic icon (toggles `useRealtimeVoice.mute()/unmute()`)
  - **End Session** button (red, confirmation dialog: "Are you sure you want to end the interview?")
  - **Connection status** indicator (green dot = connected, yellow = connecting, red = disconnected)

- [x] **10.3** Integrate voice + avatar lip-sync — the key integration point:
  - In `useRealtimeVoice.ts`, expose the `playbackContextRef` (AudioContext used for AI audio playback) so external consumers can tap into it
  - Create an AnalyserNode on the playback AudioContext, connect it inline with audio output
  - Feed this AnalyserNode into `useLipSync.connectAnalyser()` so the avatar's mouth moves when the AI speaks
  - This means: AI speaks → audio plays → analyser detects energy → lip-sync drives avatar mouth

- [x] **10.4** Modify `useRealtimeVoice.ts` to accept the system prompt from the Zustand store config:
  - The `connect()` function should use `buildBehavioralSystemPrompt(config)` from `lib/prompts.ts` as the system prompt
  - The session page reads config from `interviewStore` and passes it to the hook

- [x] **10.5** Replace the placeholder `app/interview/behavioral/session/page.tsx` with the real session page:
  - Read `sessionId` and `config` from `interviewStore` — if missing, redirect to `/interview/behavioral/setup`
  - On mount: call `interviewStore.startSession()` to mark the session as in_progress
  - Render `VideoCallLayout` with the integrated voice + avatar
  - Render `SessionControls` at the bottom
  - Show live transcript as a scrollable overlay (semi-transparent, bottom-right) — toggle-able with a button
  - On "End Session": call `interviewStore.endSession()`, save transcript to DB, navigate to feedback page

- [x] **10.6** Create `app/api/sessions/[id]/transcript/route.ts` — API route to save transcript:
  - `POST`: receives `{ entries: TranscriptEntry[] }`, creates a transcript record linked to the session
  - `GET`: returns the transcript for a session (needed by feedback page)
  - Both routes require auth and verify session ownership

- [x] **10.7** Verify: full flow works — setup → session page loads with avatar + webcam → voice conversation works → avatar lip-syncs to AI speech → timer runs → can end session → transcript saved to DB

### Acceptance Criteria

- [x] Video-call layout shows avatar on left, webcam on right
- [x] AI interviewer uses the system prompt built from the user's setup config
- [x] Avatar lip-syncs to AI speech audio in real-time
- [x] Mute/unmute works during the session
- [x] Timer displays elapsed time
- [x] "End Session" shows confirmation, then saves transcript and navigates to feedback
- [x] Transcript is persisted to the `transcripts` table
- [ ] If user navigates to session page without a config, they're redirected to setup

---

## Story 11: Post-Session Feedback Generation (Python Service)

> **Motivation:** After the interview ends, the user needs actionable feedback. We send the full transcript to gpt-5.4-mini via the Python FastAPI service, which returns structured feedback: overall score, per-answer breakdown, strengths, weaknesses, and suggestions. The Python service is the natural home for this since it will later become an independent AI analysis service (Phase 4).

### Tasks

- [x] **11.1** Create `apps/api/app/schemas.py` — Pydantic models for request/response:
  - `TranscriptEntry`: speaker (str), text (str), timestamp_ms (int)
  - `FeedbackRequest`: session_id (str), transcript (list[TranscriptEntry]), config (dict with company_name, job_description, etc.)
  - `AnswerAnalysis`: question (str), answer_summary (str), score (float 0-10), feedback (str), suggestions (list[str])
  - `FeedbackResponse`: overall_score (float 0-10), summary (str), strengths (list[str]), weaknesses (list[str]), answer_analyses (list[AnswerAnalysis])

- [x] **11.2** Create `apps/api/app/services/feedback_generator.py`:
  - `async def generate_behavioral_feedback(transcript, config) -> FeedbackResponse`
  - Build an analysis prompt that includes the full transcript and session config
  - Call OpenAI gpt-5.4-mini (via `openai` Python SDK) with a system prompt instructing structured JSON output
  - The analysis prompt should ask gpt-5.4-mini to:
    - Identify each Q&A pair in the transcript
    - Score each answer (0-10) based on STAR method, relevance, depth, specificity
    - Identify overall strengths and weaknesses
    - Provide an overall score (weighted average)
    - Write a 2-3 sentence summary
  - Parse the JSON response, validate with Pydantic, return `FeedbackResponse`
  - Handle errors gracefully: API timeout, malformed response, etc.

- [x] **11.3** Create `apps/api/app/routers/analysis.py` — FastAPI router:
  - `POST /api/analysis/behavioral` — accepts `FeedbackRequest`, calls `generate_behavioral_feedback()`, returns `FeedbackResponse`
  - Add basic error handling (500 if gpt-5.4-mini fails, 400 if transcript is empty)
  - Register the router in `main.py`

- [x] **11.4** Add OpenAI dependency to `apps/api/pyproject.toml` (`openai>=1.0`), update `config.py` to read `OPENAI_API_KEY` from env

- [x] **11.5** Create `app/api/sessions/[id]/feedback/route.ts` in the Next.js app — a proxy route that:
  - `POST`: reads transcript from DB for the given session, sends it to the Python service at `http://localhost:8000/api/analysis/behavioral`, saves the returned feedback to `session_feedback` table, returns the feedback
  - `GET`: returns existing feedback from `session_feedback` table if already generated
  - Both routes require auth and verify session ownership

- [x] **11.6** Verify: after ending a session, can trigger feedback generation, Python service returns structured JSON, feedback is saved to DB

### Acceptance Criteria

- [x] Python service accepts a transcript + config and returns structured feedback JSON
- [x] Feedback includes: overall_score, summary, strengths[], weaknesses[], answer_analyses[]
- [x] Each answer_analysis has: question, answer_summary, score, feedback, suggestions
- [x] Feedback is persisted to `session_feedback` table
- [ ] Empty transcript returns 400 error
- [ ] gpt-5.4-mini API failure returns 500 with descriptive error

---

## Story 12: Feedback Dashboard Page

> **Motivation:** The feedback page is the payoff for the user — where they see how they did. A clear, well-organized feedback dashboard with scores, per-answer breakdowns, and actionable suggestions makes the whole product valuable. Without this, the interview is just practice with no learning.

### Tasks

- [x] **12.1** Create `components/feedback/ScoreCard.tsx` — displays overall score as a large number with a color-coded ring/badge:
  - 0-3: red ("Needs Work")
  - 4-6: yellow ("Average")
  - 7-8: green ("Good")
  - 9-10: blue ("Excellent")
  - Shows the score label and the summary text below

- [x] **12.2** Create `components/feedback/StrengthsWeaknesses.tsx` — two-column layout:
  - Left: "Strengths" with green check icons, each strength as a bullet point
  - Right: "Areas for Improvement" with orange alert icons, each weakness as a bullet point
  - Use shadcn Card component for each column

- [x] **12.3** Create `components/feedback/AnswerBreakdown.tsx` — expandable list of each Q&A analysis:
  - Each item shows: question text, score badge, one-line feedback summary
  - Expandable to show: full answer summary, detailed feedback, suggestions list
  - Use shadcn Accordion or a collapsible Card pattern

- [x] **12.4** Create `components/feedback/FeedbackDashboard.tsx` — composes the above components:
  - Top: ScoreCard (overall score + summary)
  - Middle: StrengthsWeaknesses (two columns)
  - Bottom: AnswerBreakdown (expandable per-answer analysis)
  - Include a "View Transcript" button that links to or shows the full transcript
  - Include a "Start New Interview" button linking back to setup

- [x] **12.5** Replace the placeholder `app/dashboard/sessions/[id]/feedback/page.tsx` with the real page:
  - Server component that fetches feedback from `GET /api/sessions/[id]/feedback`
  - If feedback doesn't exist yet, show a loading state with "Generating feedback..." spinner and poll every 3 seconds
  - If session not found or not owned by user, redirect to dashboard
  - Render `FeedbackDashboard` with the fetched data

- [x] **12.6** Wire up the end-to-end flow: when the session ends in Story 10, the session page should:
  - Save the transcript (POST to transcript API)
  - Trigger feedback generation (POST to feedback API)
  - Navigate to `/dashboard/sessions/[id]/feedback`

- [x] **12.7** Verify: full end-to-end flow — setup → interview → end → feedback page shows scores, strengths, weaknesses, per-answer analysis

### Acceptance Criteria

- [x] Feedback page shows overall score with color coding
- [x] Strengths and weaknesses displayed in two-column layout
- [x] Per-answer breakdown is expandable with question, score, feedback, suggestions
- [x] "Generating feedback..." loading state appears while waiting
- [x] "Start New Interview" button works
- [x] Full flow from setup → interview → feedback page works end-to-end

---

## Story 13: Testing Infrastructure (Vitest)

> **Motivation:** We now have enough logic worth testing — prompt builders, API routes, validation schemas, and feedback parsing. Setting up Vitest now means every new feature from this point forward can be tested, and we catch regressions before they reach production. This is the foundation for CI in Phase 3.

### Tasks

- [x] **13.1** Install testing dependencies in `apps/web`:
  - `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
  - Create `apps/web/vitest.config.ts` with `jsdom` environment, path aliases matching `tsconfig.json` (`@/` → `./`)
  - Add `"test": "vitest run"` script to `apps/web/package.json`

- [x] **13.2** Add `test` pipeline to `turbo.json` so `turbo test` runs tests across all workspaces

- [x] **13.3** Write unit tests for `lib/prompts.ts` (the tests drafted in Story 9.2):
  - Run them and verify they pass
  - At least 6 test cases covering all config permutations

- [x] **13.4** Write unit tests for `lib/validations.ts`:
  - Valid behavioral config passes
  - Missing `interview_style` fails
  - `job_description` over 5000 chars fails
  - `expected_questions` over 10 items fails
  - `interview_style` outside 0-1 range fails

- [x] **13.5** Write integration tests for `POST /api/sessions` and `PATCH /api/sessions/[id]`:
  - Mock `auth()` for authenticated/unauthenticated requests
  - Use real Docker Postgres test DB (not mocked) for actual DB calls
  - Test: unauthenticated request returns 401
  - Test: valid payload creates session and returns 201
  - Test: invalid type returns 400
  - Test: PATCH with valid fields updates and returns 200
  - Test: session isolation between users
  - Test: ISO string timestamp conversion

- [x] **13.6** Install testing dependencies in `apps/api`:
  - `pytest`, `pytest-asyncio`, `httpx` (for TestClient)
  - Create `apps/api/tests/` directory with `conftest.py`
  - Add test script to `pyproject.toml`

- [x] **13.7** Write unit tests for the feedback generator's prompt building and response parsing (mock the OpenAI API call):
  - Test that a valid transcript produces a valid FeedbackResponse
  - Test that empty transcript raises an error
  - Test that malformed gpt-5.4-mini response is handled gracefully

- [x] **13.8** Verify: `turbo test` runs all tests across both workspaces and all pass

### Acceptance Criteria

- [x] `turbo test` runs tests in both `apps/web` and `apps/api`
- [x] Prompt builder has 6+ passing test cases (14 tests)
- [x] Validation schemas have 5+ passing test cases (13 tests)
- [x] API route tests cover auth, success, and error cases (18 integration tests with real Docker Postgres)
- [x] Python feedback generator tests cover happy path and error cases (13 tests)
- [x] All tests pass with zero failures (58 total: 40 unit + 18 integration)

---

## Definition of Done — Phase 2

- [x] Behavioral setup form creates a session with validated config in Supabase
- [x] Live interview session: voice conversation with AI + avatar lip-sync in video-call layout
- [x] AI interviewer adapts to user's config (company, JD, style, difficulty)
- [x] Transcript captured and saved to DB during interview
- [x] Post-session feedback generated by Python service via gpt-5.4-mini
- [x] Feedback dashboard shows scores, strengths/weaknesses, per-answer breakdown
- [x] Full end-to-end flow: setup → interview → feedback works without errors
- [x] Vitest + pytest set up with 15+ tests across both workspaces (58 tests)
- [x] `turbo test` passes all tests
