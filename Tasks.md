# Interview Assistant — Phase 3: Technical Interview MVP

> **Timeline:** Week 6-8
> **Goal:** Build the full technical interview flow: setup → live coding session with speech capture → AI-generated feedback correlating code with verbal explanations. No code execution — users code in Monaco and explain verbally (Google-style), then AI analyzes code + speech together. Expand test coverage and introduce CI.

---

## What Already Exists (from Phase 1 Spikes)

- `components/editor/CodeEditor.tsx` — Monaco editor wrapper with language switching
- `components/editor/EditorToolbar.tsx` — Language selector dropdown + reset button
- `components/editor/ProblemDescription.tsx` — Renders problem title, difficulty badge, description, examples, constraints
- `app/interview/technical/setup/page.tsx` — Placeholder setup page (just a link)
- `app/interview/technical/session/page.tsx` — Placeholder session page (just a badge + end button)
- `packages/shared/src/types.ts` — `TechnicalSessionConfig`, `TechnicalInterviewType`, `Difficulty`, `CodeEventType`, `ExecutionResult` types
- `packages/shared/src/constants.ts` — `SUPPORTED_LANGUAGES`, `FOCUS_AREAS` arrays
- `lib/validations.ts` — `technicalConfigSchema` already defined (validates interview_type, focus_areas, language, difficulty)
- `stores/interviewStore.ts` — Currently behavioral-only. Needs to be generalized for both modes.

---

## Story 14: Technical Interview Setup Page

> **Motivation:** Users need a way to configure their technical interview: choose a problem type (leetcode, system design, frontend, backend), select focus areas (arrays, trees, DP, etc.), pick a programming language, and set difficulty. This config drives both the AI problem generation and the post-session analysis, so the form needs to capture enough context for those to work well.

### Tasks

- [x] **14.1** Generalize `stores/interviewStore.ts` to support both behavioral and technical interviews:
  - Change `config` type from `BehavioralSessionConfig` to `SessionConfig` (the union type from shared)
  - Add a `type` field: `"behavioral" | "technical"`
  - In `createSession()`, use `get().type` instead of hardcoding `"behavioral"`
  - Add a `setType(type)` action that also resets the config to the appropriate defaults
  - Default config for technical: `{ interview_type: "leetcode", focus_areas: [], language: "python", difficulty: "medium" }`
  - Ensure `reset()` clears the type back to no selection
  - **Do not break existing behavioral flow** — verify the behavioral setup + session pages still work after this change

- [x] **14.2** Create `components/interview/TechnicalSetupForm.tsx` — a form with:
  - **Interview type** — radio group or select with options: "LeetCode-style", "System Design", "Frontend", "Backend". Maps to `TechnicalInterviewType` enum values.
  - **Focus areas** — multi-select checkboxes from `FOCUS_AREAS` constant. At least 1 must be selected. Display in a 2-column or 3-column grid. Each chip/checkbox shows the area name formatted nicely (e.g., "dynamic_programming" → "Dynamic Programming").
  - **Programming language** — dropdown from `SUPPORTED_LANGUAGES` constant. Default: "python".
  - **Difficulty** — radio group: "Easy", "Medium", "Hard". Default: "Medium".
  - On submit: call `interviewStore.setType("technical")`, then `interviewStore.setConfig(formValues)`, then `interviewStore.createSession()`, then navigate to `/interview/technical/session`
  - Disable submit if no focus areas selected
  - Use shadcn/ui components (RadioGroup, Checkbox, Select, Button, Card, Label)

- [x] **14.3** Replace the placeholder `app/interview/technical/setup/page.tsx` with the real setup page:
  - Render `TechnicalSetupForm` inside a centered layout (max-w-2xl)
  - Page title: "Technical Interview Setup"
  - Subtitle: "Configure your mock coding interview. The AI will generate a problem and analyze your approach."

- [x] **14.4** Add Zod validation for technical config in `POST /api/sessions` route:
  - The `technicalConfigSchema` already exists in `lib/validations.ts`. Verify it's correctly applied in the route handler for `type: "technical"` sessions.
  - Test that: `focus_areas` must have at least 1 item, `interview_type` must be one of the 4 valid values, `language` must be a non-empty string, `difficulty` must be "easy"/"medium"/"hard".

- [x] **14.5** Write unit tests for the technical config validation in `lib/validations.test.ts`:
  - Valid technical config passes
  - Empty `focus_areas` array fails
  - Invalid `interview_type` fails
  - Invalid `difficulty` fails
  - At least 5 test cases

- [x] **14.6** Verify: can fill out the technical setup form, submit it, see a session created in Supabase with correct config JSONB (type="technical", config has interview_type, focus_areas, language, difficulty), and get redirected to the session page

### Acceptance Criteria

- [x] Setup form renders with all fields: interview type, focus areas, language, difficulty
- [x] Focus areas displayed as checkboxes, at least 1 required to submit
- [x] Form submission creates a `type: "technical"` session in the DB with correct config
- [x] Invalid config (e.g., no focus areas) shows a clear error
- [x] After submission, user is redirected to `/interview/technical/session`
- [x] Existing behavioral setup + session flow still works (no regression)
- [x] 5+ new validation test cases pass

---

## Story 15: Audio Recording & Batch Transcription

> **Motivation:** During the technical interview, the user explains their thinking verbally while coding. We need to capture their speech and transcribe it with word-level timestamps so the analysis service can correlate what was said with code changes. We use **batch transcription via `gpt-4o-mini-transcribe`** ($0.003/min — cheapest option, 20x cheaper than streaming via the Realtime API) instead of streaming. This keeps us on a single vendor (OpenAI) with one API key and one billing dashboard. The tradeoff is no live transcript text, but a pulsing mic indicator with audio-level feedback gives the user sufficient confidence their speech is being captured. In a coding interview, the user's eyes are on the editor — live transcription text would be a distraction anyway.

### Tasks

- [ ] **15.1** Create `hooks/useAudioRecorder.ts` — a React hook for recording mic audio during the session:
  - Exposes: `{ startRecording, stopRecording, isRecording, audioLevel }`
  - `startRecording()`:
    1. Call `navigator.mediaDevices.getUserMedia({ audio: true })`
    2. Create a `MediaRecorder` with `mimeType: "audio/webm;codecs=opus"` (fallback to `"audio/webm"` if opus not supported)
    3. On `dataavailable` event: push chunks to an internal array (ref-based)
    4. Set up an `AnalyserNode` on the mic stream to expose `audioLevel` (0-1 float, updated via `requestAnimationFrame`) for the pulsing mic indicator
    5. Start recording with `mediaRecorder.start(1000)` (1-second chunks for memory efficiency)
  - `stopRecording()`:
    1. Stop the MediaRecorder
    2. Release all mic tracks (`stream.getTracks().forEach(t => t.stop())`)
    3. Combine chunks into a single `Blob` and return it
    4. Clean up the AnalyserNode and AudioContext
  - Use refs for MediaRecorder, stream, chunks, and AudioContext to avoid stale closures
  - `isRecording`: boolean state indicating whether recording is active
  - `audioLevel`: number (0-1) representing current mic input volume, updated at ~30fps

- [ ] **15.2** Create `app/api/transcribe/route.ts` — a server-side route that transcribes an audio file:
  - `POST`: accepts `multipart/form-data` with an `audio` file field and a `session_id` field
  - Auth check: return 401 if not authenticated
  - Verify session ownership (session belongs to the authenticated user)
  - Call OpenAI's transcription API: `openai.audio.transcriptions.create({ model: "gpt-4o-mini-transcribe", file: audioFile, response_format: "verbose_json", timestamp_granularities: ["word"] })`
  - The `verbose_json` format returns word-level timestamps (`words: [{ word, start, end }]`)
  - Convert word-level timestamps into `TranscriptEntry[]`: group words into sentence-like segments (split on pauses > 1 second between words), each entry gets `speaker: "user"`, `text` (the grouped words), and `timestamp_ms` (start time of first word in segment, in milliseconds)
  - Return `{ entries: TranscriptEntry[] }` as JSON
  - Handle errors: file too large (limit to 25MB, OpenAI's max), unsupported format, API failure

- [ ] **15.3** Add `OPENAI_API_KEY` usage note in `.env.example` if not already present (it should already be there from Phase 2 for the Realtime API). No new API keys needed — same OpenAI key.

- [ ] **15.4** Write unit tests for the word-to-segment grouping logic:
  - Extract the grouping function into a testable pure function in `lib/transcription.ts`: `groupWordsIntoSegments(words: { word: string, start: number, end: number }[]): TranscriptEntry[]`
  - Test: single word returns one segment
  - Test: continuous speech (all words < 1s apart) returns one segment
  - Test: pause > 1 second creates a new segment
  - Test: empty words array returns empty array
  - Test: timestamps are converted to milliseconds correctly
  - 5+ test cases

- [ ] **15.5** Write integration tests for `POST /api/transcribe` route:
  - Unauthenticated returns 401
  - Missing audio file returns 400
  - Mock the OpenAI transcription API — valid audio returns TranscriptEntry array
  - 3+ test cases

- [ ] **15.6** Verify: can record audio during a session, stop recording to get a Blob, POST it to `/api/transcribe`, and receive back timestamped TranscriptEntry objects. The mic indicator shows audio levels during recording.

### Acceptance Criteria

- [ ] `useAudioRecorder` captures mic audio as a Blob and exposes real-time audio levels
- [ ] `stopRecording()` cleanly releases the mic and returns the audio Blob
- [ ] `POST /api/transcribe` accepts audio, calls `gpt-4o-mini-transcribe`, returns `TranscriptEntry[]` with millisecond timestamps
- [ ] Words are grouped into sentence-like segments (split on >1s pauses)
- [ ] 401 returned for unauthenticated requests
- [ ] Audio level (0-1) updates at ~30fps for the mic indicator
- [ ] 5+ unit tests for word grouping pass
- [ ] 3+ integration tests for transcribe route pass

---

## Story 16: Code Snapshot Capture

> **Motivation:** To give meaningful feedback, the AI needs to see how the user's code evolved over time — not just the final state. By capturing timestamped snapshots of the code on each meaningful change (debounced edits, language switches, resets), we create a timeline that the analysis service can correlate with the speech transcript. This is what lets the AI say "When you were discussing the edge case at 2:30, your code didn't handle it yet."

### Tasks

- [ ] **16.1** Create `hooks/useCodeSnapshots.ts` — a React hook that:
  - Exposes: `{ captureSnapshot, getSnapshots, code, setCode, language, setLanguage, resetCode }`
  - Maintains the current `code` (string) and `language` (string) state
  - `captureSnapshot(eventType: CodeEventType)`: pushes a new snapshot to an internal array with `{ code, language, timestamp_ms (relative to session start), event_type }`
  - Auto-captures on debounced edits: when `code` changes, debounce for 2 seconds, then capture a snapshot with `event_type: "edit"`. Reset the debounce timer on each keystroke.
  - `resetCode()`: sets code to the language-specific boilerplate (e.g., `"def solution():\n    pass"` for Python) and captures a snapshot with `event_type: "edit"`
  - `getSnapshots()`: returns the full array of snapshots captured so far
  - Accept `sessionStartTime: number` (epoch ms) as a parameter so timestamps are relative to session start

- [ ] **16.2** Create `app/api/sessions/[id]/snapshots/route.ts` — API route to persist code snapshots:
  - `POST`: receives `{ snapshots: CodeSnapshot[] }`, validates auth and session ownership, inserts all snapshots into the `code_snapshots` table
  - `GET`: returns all code snapshots for a session, ordered by `timestamp_ms`
  - Use the existing `codeSnapshots` schema table

- [ ] **16.3** Define language-specific boilerplate templates in `lib/code-templates.ts`:
  - Export a `getBoilerplate(language: string): string` function
  - Python: `"def solution():\n    pass\n"`
  - JavaScript: `"function solution() {\n  \n}\n"`
  - Java: `"class Solution {\n    public void solution() {\n        \n    }\n}\n"`
  - C++: `"#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solution() {\n        \n    }\n};\n"`
  - Go: `"package main\n\nfunc solution() {\n    \n}\n"`
  - Return empty string for unknown languages

- [ ] **16.4** Write unit tests for `lib/code-templates.ts`:
  - Each supported language returns non-empty boilerplate
  - Unknown language returns empty string
  - Python boilerplate contains "def solution"
  - 5+ test cases

- [ ] **16.5** Write integration tests for the snapshots API route (`app/api/sessions/[id]/snapshots/route.integration.test.ts`):
  - Unauthenticated POST returns 401
  - Authenticated POST with valid snapshots returns 201 and data is in DB
  - GET returns snapshots ordered by timestamp_ms
  - 3+ test cases

- [ ] **16.6** Verify: code changes in the editor create debounced snapshots, `getSnapshots()` returns the correct timeline, and snapshots can be persisted via POST then retrieved via GET

### Acceptance Criteria

- [ ] Code changes are captured as timestamped snapshots after 2s debounce
- [ ] Snapshots include: code, language, timestamp_ms, event_type
- [ ] Language switch and code reset both trigger snapshots
- [ ] POST API persists snapshots to `code_snapshots` table
- [ ] GET API returns snapshots in chronological order
- [ ] 5+ unit tests for boilerplate templates pass
- [ ] 3+ integration tests for snapshots API pass

---

## Story 17: Problem Generation

> **Motivation:** The technical interview needs a coding problem tailored to the user's config (type, focus areas, difficulty, language). We use GPT-5.4-mini to generate problems on-the-fly — this is more flexible than a static problem bank and lets us tailor to specific focus areas. The generated problem follows the `Problem` interface already defined in `ProblemDescription.tsx`.

### Tasks

- [ ] **17.1** Create `lib/prompts-technical.ts` — export a `buildProblemGenerationPrompt(config: TechnicalSessionConfig): string` function:
  - System prompt instructs GPT-5.4-mini to generate a single coding problem
  - The prompt must specify: interview type (leetcode-style, system design, frontend, backend), focus areas to test, difficulty level, and the target programming language (for examples)
  - The output format must match the `Problem` interface: `{ title, difficulty, description, examples: [{ input, output, explanation? }], constraints: string[] }`
  - Include instruction: "Respond ONLY with valid JSON matching the Problem schema."
  - For system design: generate a design question instead of a coding problem (description only, no input/output examples)

- [ ] **17.2** Create `app/api/problems/generate/route.ts` — API route to generate a problem:
  - `POST`: receives `{ config: TechnicalSessionConfig }`, validates auth
  - Calls OpenAI GPT-5.4-mini with the prompt from `buildProblemGenerationPrompt()`
  - Parses and validates the JSON response against a Zod schema matching the `Problem` interface
  - Returns the generated problem
  - If GPT returns invalid JSON, retry once. If still invalid, return 500 with error.
  - Add rate limiting consideration: one problem per session (store the problem in session config or a dedicated field)

- [ ] **17.3** Create a Zod schema for the `Problem` type in `lib/validations.ts`:
  - `problemSchema`: title (string), difficulty ("Easy"/"Medium"/"Hard"), description (string), examples (array of { input: string, output: string, explanation?: string }), constraints (array of strings)
  - Export it for reuse in the route handler and tests

- [ ] **17.4** Write unit tests for `lib/prompts-technical.ts`:
  - Leetcode config includes "coding problem" and the focus areas
  - System design config includes "system design" and skips input/output examples instruction
  - Difficulty is reflected in the prompt ("Easy", "Medium", "Hard")
  - Language is mentioned in the prompt
  - 6+ test cases

- [ ] **17.5** Write an integration test for `POST /api/problems/generate`:
  - Mock the OpenAI API call (don't spend real tokens in tests)
  - Valid config + mocked GPT response returns a valid Problem
  - Unauthenticated returns 401
  - Malformed GPT response returns 500
  - 3+ test cases

- [ ] **17.6** Verify: calling the API with a technical config returns a well-structured Problem that renders correctly in `ProblemDescription.tsx`

### Acceptance Criteria

- [ ] Prompt builder produces different prompts for leetcode vs system design vs frontend vs backend
- [ ] Prompt includes the focus areas, difficulty, and language from config
- [ ] API route returns a valid `Problem` object that matches the existing `ProblemDescription` interface
- [ ] Invalid GPT responses are retried once, then return 500
- [ ] 6+ unit tests for prompt builder pass
- [ ] 3+ integration/unit tests for the API route pass

---

## Story 18: Technical Interview Session Page

> **Motivation:** This is the core technical interview experience — the user sees a coding problem on the left, a Monaco editor on the right, and speaks their thought process into the mic while coding. The session page ties together the setup config, problem generation, code editor, speech transcription, and code snapshots into a cohesive interview experience. At the end, the transcript and code timeline are saved for analysis.

### Tasks

- [ ] **18.1** Create `components/interview/TechnicalSessionLayout.tsx` — the main session layout:
  - **Left panel (40%):** Problem description rendered with the existing `ProblemDescription` component. Scrollable. Shows a loading skeleton while the problem is being generated.
  - **Right panel (60%):** `EditorToolbar` at the top (language selector + reset button), `CodeEditor` below filling the remaining height.
  - **Bottom bar:** Session controls — timer (MM:SS), mic status indicator (pulsing red dot when active), "End Session" button with confirmation dialog.
  - The layout should be a full-viewport height (minus header), no scrolling on the outer container, each panel scrolls independently.

- [ ] **18.2** Create `components/interview/MicIndicator.tsx` — a small component showing mic recording status:
  - Red pulsing dot + "Recording..." when mic is active (`isRecording` from `useAudioRecorder`)
  - The pulsing dot's scale/opacity should react to `audioLevel` (louder speech = bigger pulse) — gives the user real-time visual feedback that their voice is being captured
  - Gray dot + "Mic off" when not recording
  - No live transcript text — the user's focus should be on the code editor

- [ ] **18.3** Replace the placeholder `app/interview/technical/session/page.tsx` with the real session page:
  - Read `sessionId`, `config`, and `type` from `interviewStore` — if missing or type !== "technical", redirect to `/interview/technical/setup`
  - On mount:
    1. Call `interviewStore.startSession()` to mark session as in_progress
    2. Fetch problem from `POST /api/problems/generate` with the session config
    3. Start mic recording via `useAudioRecorder.startRecording()`
    4. Initialize `useCodeSnapshots` with the session start time
  - Render `TechnicalSessionLayout` with:
    - The generated problem (or loading state)
    - CodeEditor + EditorToolbar wired to `useCodeSnapshots` state
    - MicIndicator wired to `useAudioRecorder` state (`isRecording`, `audioLevel`)
    - Timer + End Session controls
  - Use `hasStartedRef` to prevent double-start in React Strict Mode
  - On "End Session":
    1. Stop recording via `useAudioRecorder.stopRecording()` → get audio Blob
    2. Show a brief "Processing..." state while transcription runs
    3. POST audio Blob to `/api/transcribe` → receive `TranscriptEntry[]`
    4. Save transcript to DB via `POST /api/sessions/[id]/transcript`
    5. Save code snapshots to DB via `POST /api/sessions/[id]/snapshots`
    6. Call `interviewStore.endSession()`
    7. Fire-and-forget: trigger feedback generation via `POST /api/sessions/[id]/feedback`
    8. Navigate to `/dashboard/sessions/[id]/feedback`

- [ ] **18.4** Set up the code editor with proper defaults:
  - Initialize code with language-specific boilerplate from `lib/code-templates.ts`
  - When user changes language via `EditorToolbar`, update the editor language and capture a snapshot
  - When user clicks "Reset", reset to boilerplate and capture a snapshot
  - Wire `onChange` to `useCodeSnapshots.setCode()` (which handles debounced capture)

- [ ] **18.5** Verify: full flow works — setup → session page loads → problem appears → user can code + speak → timer runs → can end session → transcript + snapshots saved to DB → redirected to feedback page

### Acceptance Criteria

- [ ] Session page shows problem on left, code editor on right
- [ ] Problem is generated from config and renders while editor is ready
- [ ] Mic records continuously with pulsing audio-level indicator
- [ ] Code changes are captured as debounced snapshots
- [ ] Language switching updates the editor and captures a snapshot
- [ ] Timer displays elapsed time from session start
- [ ] "End Session" stops recording, transcribes audio, saves transcript + snapshots, triggers feedback, navigates to feedback page
- [ ] Brief "Processing..." state shown during post-session transcription
- [ ] If user navigates to session without config, redirected to setup
- [ ] No double-start in React Strict Mode

---

## Story 19: Technical Feedback Analysis (Python Service)

> **Motivation:** After the technical interview, the user needs feedback on both their code quality and how they communicated their thought process. The Python service receives the transcript + code snapshots, correlates them on a timeline, and uses GPT-5.4-mini to produce structured feedback. This is the unique value prop — not just "is the code correct?" but "did you explain your reasoning well?"

### Tasks

- [ ] **19.1** Create `apps/api/app/schemas.py` additions — add Pydantic models for technical analysis:
  - `CodeSnapshot`: code (str), language (str), timestamp_ms (int), event_type (str)
  - `TechnicalFeedbackRequest`: session_id (str), transcript (list[TranscriptEntry]), code_snapshots (list[CodeSnapshot]), config (dict)
  - `TimelineEvent`: timestamp_ms (int), event_type ("speech" | "code_change"), summary (str)
  - `TechnicalFeedbackResponse`: overall_score (float 0-10), summary (str), strengths (list[str]), weaknesses (list[str]), code_quality_score (float 0-10), explanation_quality_score (float 0-10), answer_analyses (list[AnswerAnalysis]), timeline_analysis (list[TimelineEvent])

- [ ] **19.2** Create `apps/api/app/services/code_analyzer.py`:
  - `def build_technical_analysis_prompt(transcript, code_snapshots, config) -> str`
  - The prompt should include: the full transcript (labeled "Candidate" for user entries), the final code snapshot, a summary of code evolution (first snapshot → final snapshot, number of changes, languages used), and the session config (type, focus areas, difficulty)
  - Instruct GPT-5.4-mini to evaluate:
    - **Code quality** (0-10): correctness, efficiency, readability, edge case handling
    - **Explanation quality** (0-10): clarity of thought process, problem decomposition, trade-off discussion
    - **Overall approach**: did they break the problem down? Did they consider alternatives? Did they discuss time/space complexity?
  - Output format: JSON matching `TechnicalFeedbackResponse`

- [ ] **19.3** Create `apps/api/app/services/timeline_correlator.py`:
  - `def build_timeline(transcript, code_snapshots) -> list[TimelineEvent]`
  - Merge transcript entries and code snapshots into a single timeline sorted by `timestamp_ms`
  - For transcript entries: create `TimelineEvent` with type="speech", summary = first 100 chars of text
  - For code snapshots: create `TimelineEvent` with type="code_change", summary = "Changed code ({language})" or "Reset code" depending on event_type
  - This is a pure function — no AI calls, just data transformation

- [ ] **19.4** Create the analysis function `apps/api/app/services/code_analyzer.py`:
  - `async def generate_technical_feedback(transcript, code_snapshots, config) -> TechnicalFeedbackResponse`
  - Build the prompt using `build_technical_analysis_prompt()`
  - Build the timeline using `build_timeline()`
  - Call GPT-5.4-mini with response_format: json_object, temperature 0.3
  - Parse response, inject the timeline_analysis from `build_timeline()`, validate with Pydantic
  - Handle errors: empty transcript, empty code snapshots, API failures

- [ ] **19.5** Add `POST /api/analysis/technical` endpoint in `apps/api/app/routers/analysis.py`:
  - Accepts `TechnicalFeedbackRequest`, calls `generate_technical_feedback()`, returns `TechnicalFeedbackResponse`
  - 400 if transcript is empty, 500 if GPT fails

- [ ] **19.6** Update `app/api/sessions/[id]/feedback/route.ts` in Next.js to support technical sessions:
  - In the POST handler, check the session type
  - If `type === "technical"`: also read code snapshots from `code_snapshots` table, call `POST /api/analysis/technical` instead of `/api/analysis/behavioral`
  - Save the richer feedback (with code_quality_score, explanation_quality_score, timeline_analysis) to `session_feedback` table

- [ ] **19.7** Write unit tests for `timeline_correlator.py`:
  - Empty inputs return empty list
  - Transcript entries and code snapshots are merged and sorted by timestamp
  - Speech events have correct type and summary truncation
  - Code change events have correct type
  - 5+ test cases

- [ ] **19.8** Write unit tests for `code_analyzer.py` prompt building and response parsing:
  - Valid inputs produce a prompt containing the code, transcript, and config
  - Mock GPT response parses into valid `TechnicalFeedbackResponse`
  - Empty transcript raises ValueError
  - Malformed GPT response raises RuntimeError
  - 5+ test cases

- [ ] **19.9** Verify: after ending a technical session, feedback is generated with code_quality_score, explanation_quality_score, timeline_analysis, and the standard fields (overall_score, strengths, weaknesses)

### Acceptance Criteria

- [ ] Technical feedback includes: overall_score, code_quality_score, explanation_quality_score, summary, strengths, weaknesses, timeline_analysis
- [ ] Timeline correctly merges and sorts transcript + code snapshot events
- [ ] Prompt includes code, transcript, and config for GPT analysis
- [ ] Empty transcript returns 400 error
- [ ] GPT failure returns 500 with descriptive error
- [ ] Next.js feedback route correctly dispatches to technical vs behavioral analysis
- [ ] 5+ timeline correlator tests pass
- [ ] 5+ code analyzer tests pass

---

## Story 20: Technical Feedback Dashboard

> **Motivation:** The technical feedback page needs additional sections beyond what the behavioral dashboard shows — specifically code quality score, explanation quality score, and a timeline view that correlates what the user said with what they coded. This is the unique insight users can't get elsewhere: "You talked about using a hash map at 1:30 but didn't implement it until 4:00."

### Tasks

- [ ] **20.1** Create `components/feedback/CodeQualityCard.tsx`:
  - Display two scores side by side: "Code Quality" and "Explanation Quality"
  - Each shows a score (0-10) with the same color-coding as `ScoreCard` (0-3 red, 4-6 yellow, 7-8 green, 9-10 blue)
  - Below each score, a one-line label: code quality = "Correctness, efficiency, readability" | explanation quality = "Clarity, problem decomposition, trade-offs"

- [ ] **20.2** Create `components/feedback/TimelineView.tsx`:
  - Render a vertical timeline of events, sorted chronologically
  - Each event shows: timestamp (formatted as MM:SS), an icon (speech bubble for "speech", code bracket icon for "code_change"), and the summary text
  - Speech events styled in one color (e.g., blue-ish), code change events in another (e.g., green-ish)
  - Scrollable if the timeline is long, max height ~400px

- [ ] **20.3** Update `components/feedback/FeedbackDashboard.tsx` to support technical feedback:
  - Accept an optional `sessionType: "behavioral" | "technical"` prop
  - If technical: render `CodeQualityCard` between ScoreCard and StrengthsWeaknesses
  - If technical and `timeline_analysis` exists: render `TimelineView` after AnswerBreakdown
  - "Start New Interview" links should go to `/interview/technical/setup` for technical sessions (not behavioral)
  - The `AnswerBreakdown` section should still work — the AI will produce answer_analyses for technical questions too (e.g., "How did you approach the problem?", "Did you discuss complexity?")

- [ ] **20.4** Update `app/dashboard/sessions/[id]/feedback/page.tsx` to pass session type:
  - Fetch the session itself (not just feedback) to determine the type
  - Pass `sessionType` to `FeedbackDashboard`
  - Map the additional technical fields from the API response: `code_quality_score`, `explanation_quality_score`, `timeline_analysis`

- [ ] **20.5** Verify: after completing a technical interview, the feedback page shows: overall score, code quality score, explanation quality score, strengths, weaknesses, timeline, and per-answer breakdown

### Acceptance Criteria

- [ ] Technical feedback page shows code quality and explanation quality scores with color coding
- [ ] Timeline view renders speech and code change events chronologically with timestamps
- [ ] "Start New Interview" links to the correct setup page based on session type
- [ ] Behavioral feedback page is unchanged (no regression)
- [ ] Full technical flow: setup → session → feedback page renders all sections

---

## Story 21: Component Tests

> **Motivation:** We now have complex interactive components (setup forms with validation, session controls with timers, feedback dashboard with conditional rendering). Component tests catch regressions in these interactions without the overhead of E2E tests. We specifically test components where user interaction drives state changes — skip simple rendering or shadcn wrappers.

### Tasks

- [ ] **21.1** Write component tests for `BehavioralSetupForm.tsx` (`components/interview/BehavioralSetupForm.test.tsx`):
  - Renders all form fields (company input, JD textarea, style slider, difficulty slider)
  - Adding a question adds it to the list
  - Removing a question removes it from the list
  - Cannot add more than 10 questions
  - Submit button calls createSession (mock the store)
  - 5+ test cases

- [ ] **21.2** Write component tests for `TechnicalSetupForm.tsx` (`components/interview/TechnicalSetupForm.test.tsx`):
  - Renders all form fields (interview type, focus areas, language, difficulty)
  - Selecting focus areas updates the form state
  - Submit is disabled when no focus areas selected
  - Submit button calls createSession with correct config
  - 4+ test cases

- [ ] **21.3** Write component tests for `FeedbackDashboard.tsx` (`components/feedback/FeedbackDashboard.test.tsx`):
  - Renders ScoreCard with correct score and color
  - Renders strengths and weaknesses lists
  - Renders answer breakdown items
  - Technical mode renders CodeQualityCard and TimelineView
  - Behavioral mode does NOT render CodeQualityCard
  - 5+ test cases

- [ ] **21.4** Write component tests for `ScoreCard.tsx` (`components/feedback/ScoreCard.test.tsx`):
  - Score 2.0 renders with red/destructive styling
  - Score 5.0 renders with yellow/warning styling
  - Score 8.0 renders with green/success styling
  - Score 9.5 renders with blue/excellent styling
  - Summary text is displayed
  - 5+ test cases

- [ ] **21.5** Verify: all component tests pass via `turbo test`. Count total tests across all workspaces — should be 80+ total.

### Acceptance Criteria

- [ ] BehavioralSetupForm has 5+ passing component tests
- [ ] TechnicalSetupForm has 4+ passing component tests
- [ ] FeedbackDashboard has 5+ passing component tests
- [ ] ScoreCard has 5+ passing component tests
- [ ] All tests pass via `turbo test`
- [ ] Total test count across all workspaces is 80+

---

## Story 22: CI Pipeline (GitHub Actions)

> **Motivation:** We now have enough tests to make CI meaningful. A CI pipeline that runs lint → typecheck → unit tests → build on every PR ensures we never merge broken code. This is the gate that protects the codebase quality as we move to Phase 4 (production readiness). Integration tests are excluded from CI (they need Docker) — those run locally.

### Tasks

- [ ] **22.1** Create `.github/workflows/ci.yml` — GitHub Actions workflow:
  - Trigger: on `push` to `main` and on `pull_request` to `main`
  - Environment: Ubuntu latest, Node.js 20, Python 3.12+
  - Steps:
    1. Checkout code
    2. Install Node.js dependencies (`npm ci`)
    3. Set up Python venv and install deps (`cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`)
    4. Run `turbo lint` — ESLint for web, ruff for Python
    5. Run `turbo test` — Vitest unit tests + pytest
    6. Run typecheck: `cd apps/web && npx tsc --noEmit`
    7. Run build: `turbo build` (skip if build requires env vars not available in CI — use `SKIP_ENV_VALIDATION=1` or similar)
  - Cache: cache `node_modules`, `.turbo`, and Python `.venv` for faster runs
  - Each step should fail-fast — if lint fails, don't bother running tests

- [ ] **22.2** Add a `typecheck` script to `apps/web/package.json`: `"typecheck": "tsc --noEmit"`
  - Add a `typecheck` task to `turbo.json`

- [ ] **22.3** Add a `lint` script to `apps/api/package.json` if not already present (already has `"lint": ".venv/bin/ruff check ."`). Verify `turbo lint` runs both workspaces.

- [ ] **22.4** Handle env vars in CI:
  - The build/typecheck may fail without `SUPABASE_DB_URL`, `OPENAI_API_KEY`, etc.
  - Add a `.env.ci` file (committed to repo) with dummy values for type-checking only: `SUPABASE_DB_URL=postgresql://dummy`, `OPENAI_API_KEY=sk-dummy`, etc.
  - Or use `process.env.SUPABASE_DB_URL!` with a fallback in `lib/db.ts` for CI
  - Whichever approach, the CI pipeline must not require real secrets for lint/typecheck/unit-tests

- [ ] **22.5** Verify: push a branch and open a PR — CI runs all checks. Intentionally break a test to confirm CI fails and blocks merge.

- [ ] **22.6** Add branch protection rule (if repo is on GitHub): require CI to pass before merging to `main`. Document this in README.

### Acceptance Criteria

- [ ] CI workflow runs on push to main and PRs to main
- [ ] Pipeline runs: lint → typecheck → test → build (in that order)
- [ ] CI passes on the current codebase with no failures
- [ ] CI does not require real API keys or database connections
- [ ] Failing tests cause CI to fail (verified by intentionally breaking a test)
- [ ] README documents the CI pipeline and how to check status

---

## Definition of Done — Phase 3

- [ ] Technical setup form creates a session with validated config in Supabase
- [ ] Live technical session: Monaco editor + problem panel + mic recording with audio-level indicator
- [ ] Problem generated by GPT-5.4-mini based on config (type, focus areas, difficulty, language)
- [ ] Code snapshots captured with timestamps during coding
- [ ] Speech recorded during session, batch-transcribed via `gpt-4o-mini-transcribe` on session end, saved to DB with word-level timestamps
- [ ] Post-session feedback includes: code quality, explanation quality, timeline analysis
- [ ] Timeline correlates speech events with code changes
- [ ] Feedback dashboard displays all technical-specific sections
- [ ] Full end-to-end flow: setup → code + speak → end → transcribe → feedback works without errors
- [ ] Component tests cover setup forms, feedback dashboard, score cards (80+ tests total)
- [ ] CI pipeline runs lint → typecheck → test → build on every PR
- [ ] `turbo test` passes all tests across both workspaces
