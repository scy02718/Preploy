# Interview Assistant — Phase 3.5: Features, UX Polish & Lightweight Ops

> **Timeline:** Week 9-12
> **Goal:** Maximize feature velocity before production hardening. Add user-facing features (emotion/gaze detection, coaching, gamification, PDF export), polish UX (wider layouts, dark mode, loading states), and add non-disruptive ops (Sentry, structured logging, versioned migrations, security hardening). No architectural migrations — the monolith stays intact.
> **Previous phases:** See `dev_logs/Phase1_Tasks.md`, `dev_logs/Phase2_Tasks.md`, `dev_logs/Phase3_Tasks.md`

---

## Story 24: Layout Width Fix

> **Motivation:** The setup pages (behavioral + technical) and feedback pages use a narrow centered layout (`max-w-3xl` / `max-w-md`) that wastes screen space and forces excessive scrolling. The dashboard already uses the full available width. All pages should feel spacious and reduce scrolling, especially for content-heavy pages like feedback.

### Tasks

- [x] **24.1** Audit all page layouts and identify narrow containers:
  - `app/interview/behavioral/setup/page.tsx`
  - `app/interview/technical/setup/page.tsx`
  - `components/feedback/FeedbackDashboard.tsx`
  - `app/dashboard/sessions/[id]/feedback/page.tsx`
  - Any other pages with `max-w-md`, `max-w-lg`, or `max-w-3xl` that should be wider

- [x] **24.2** Widen setup pages to use a two-column layout on desktop:
  - Behavioral: Company Details + Expected Questions on the left, Interview Settings on the right
  - Technical: Interview Type + Focus Areas on the left, Language + Difficulty on the right
  - Collapse to single column on mobile (`md:` breakpoint)
  - Remove excessive centering; use `max-w-5xl` or `max-w-6xl`

- [x] **24.3** Widen FeedbackDashboard to use available space:
  - Score card and code quality card side-by-side on desktop
  - Strengths/weaknesses side-by-side (already are, but check width)
  - Timeline and answer breakdown can be full-width
  - Use `max-w-5xl` or `max-w-6xl` instead of `max-w-3xl`

- [x] **24.4** Update component tests for any layout changes that affect conditional rendering

- [x] **24.5** Verify: all pages look good at 1280px, 1440px, and 1920px widths. No horizontal overflow. Mobile still works.

### Acceptance Criteria

- [x] Setup pages use two-column layout on desktop, single column on mobile
- [x] Feedback page uses wider container, key sections side-by-side
- [x] No page requires more than one screen-height of scrolling for typical content
- [x] No regressions on mobile/small screens (md: breakpoint collapses to single column)

---

## Story 25: Dark Mode Toggle

> **Motivation:** The app already supports dark mode via `next-themes` and Tailwind's `dark:` variants, but there's no user-facing way to switch between light and dark mode. Users expect this control, especially developers who prefer dark mode for coding sessions.

### Tasks

- [x] **25.1** Add a theme toggle button to the Header component:
  - Sun/Moon icon (lucide-react) that switches between light/dark/system
  - Use `useTheme()` from `next-themes`
  - Dropdown or simple click-to-cycle toggle
  - Persist choice (next-themes handles this via localStorage)

- [x] **25.2** Audit all custom colors for dark mode compatibility:
  - Check hardcoded colors in TimelineView, MicIndicator, CodeQualityCard
  - Ensure all text is readable in both modes
  - Fix any components using `text-blue-700` without `dark:text-blue-300` etc.

- [x] **25.3** Write component test for the toggle (renders, clicking changes theme)

### Acceptance Criteria

- [x] Theme toggle visible in header on all pages
- [x] Switching to dark mode applies immediately, persists across page loads
- [x] All components readable in both light and dark mode (dark: variants on score colors)
- [x] No flash of unstyled content on page load (suppressHydrationWarning + defaultTheme)

---

## Story 26: Loading States & Transitions

> **Motivation:** Several pages show raw loading spinners or blank screens while data loads. Skeleton screens and smooth transitions make the app feel faster and more polished, even when API calls take 1-2 seconds.

### Tasks

- [x] **26.1** Add skeleton screens for the dashboard page:
  - Stats cards show pulsing placeholders while loading
  - Session list shows 3-5 skeleton rows

- [x] **26.2** Add skeleton screens for the feedback page:
  - Score card skeleton (circular placeholder + text lines)
  - Strengths/weaknesses skeleton (two column placeholder blocks)
  - Answer breakdown skeleton (3 collapsed card placeholders)

- [x] **26.3** Add smooth transitions for session state changes:
  - Setup → "Creating session..." → Session page (fade transition)
  - Session → "Processing..." → Feedback (progress steps indicator)

- [x] **26.4** Add loading state for problem generation in technical session:
  - Show "Generating problem..." with animated dots in the problem panel
  - Editor is ready and usable while problem loads

### Acceptance Criteria

- [x] No blank white screens during data loading
- [x] Skeleton screens match the shape of actual content
- [x] Transitions between pages feel smooth, not jarring
- [x] Loading states have clear messaging ("Generating feedback...", "Transcribing audio...", etc.)

---

## Story 27: Structured Logging (Pino)

> **Motivation:** The codebase uses `console.log` and `console.error` throughout. In production, these are unstructured and hard to search. Pino provides structured JSON logging with levels, timestamps, and request context — essential for debugging production issues.

### Tasks

- [ ] **27.1** Install Pino for Next.js:
  - `npm install pino pino-pretty` in `apps/web`
  - Create `lib/logger.ts` that exports a configured Pino instance
  - Pretty-print in development, JSON in production

- [ ] **27.2** Install structlog or Python logging for FastAPI:
  - Configure Python's `logging` module with JSON formatter for production
  - Keep human-readable format for development

- [ ] **27.3** Replace all `console.log`/`console.error` in API routes with `logger.info`/`logger.error`:
  - Add request context (session ID, user ID) where available
  - Grep for all `console.` calls and replace

- [ ] **27.4** Add request ID middleware:
  - Generate a UUID per request in Next.js middleware
  - Pass it through to log calls for cross-service tracing

- [ ] **27.5** Write unit test for logger configuration (correct level, format)

- [ ] **27.6** Update CLAUDE.md: "Use `logger` from `@/lib/logger` instead of `console.log` in all API routes and server-side code"

### Acceptance Criteria

- [ ] No `console.log` or `console.error` in API route handlers
- [ ] All logs are structured JSON in production, pretty-printed in development
- [ ] Request IDs appear in logs for traceability
- [ ] CLAUDE.md updated with logging guidelines

---

## Story 28: Sentry Error Monitoring

> **Motivation:** Errors in production are invisible without monitoring. Sentry's free tier (5K errors/month) captures errors with stack traces, source maps, and user context — enough for an MVP. Zero cost.

### Tasks

- [ ] **28.1** Install and configure `@sentry/nextjs`:
  - `npx @sentry/wizard@latest -i nextjs`
  - Configure DSN via environment variable `SENTRY_DSN`
  - Enable source maps upload in production builds
  - Add `SENTRY_DSN` to `.env.example` and `.env.ci` (dummy value)

- [ ] **28.2** Configure Sentry for the Python FastAPI service:
  - `pip install sentry-sdk[fastapi]`
  - Initialize in `app/main.py`

- [ ] **28.3** Add user context to Sentry events:
  - Set Sentry user (`id`, `email`) after auth in API routes
  - Tag events with session type (behavioral/technical)

- [ ] **28.4** Test error capture:
  - Trigger a test error and verify it appears in the Sentry dashboard
  - Verify source maps resolve correctly

- [ ] **28.5** Update README with Sentry setup instructions

### Acceptance Criteria

- [ ] Unhandled errors in Next.js and FastAPI are captured in Sentry
- [ ] Source maps resolve to original TypeScript/Python source
- [ ] User context (ID, email) attached to error events
- [ ] No performance impact on normal requests

---

## Story 29: Versioned Database Migrations

> **Motivation:** Currently using `drizzle-kit push` which directly modifies the production schema — dangerous for a real deployment. Versioned migrations (`drizzle-kit generate` → commit SQL → apply in CI) provide an audit trail, rollback capability, and safe schema evolution.

### Tasks

- [ ] **29.1** Generate initial migration from current schema:
  - Run `npx drizzle-kit generate` to create SQL migration files
  - Commit the `drizzle/` migrations folder

- [ ] **29.2** Add a `migrate` script to `apps/web/package.json`:
  - `"migrate": "drizzle-kit migrate"`
  - Document the new workflow in README

- [ ] **29.3** Update CI to run migrations against the test DB before integration tests:
  - The `tests/global-setup.ts` already handles this, but verify it uses the migration files

- [ ] **29.4** Update CLAUDE.md: "When modifying `lib/schema.ts`, always run `npx drizzle-kit generate` to create a migration file. Never use `drizzle-kit push` in production."

- [ ] **29.5** Update README: replace `drizzle-kit push` instructions with the migration workflow

### Acceptance Criteria

- [ ] Migration SQL files committed to `drizzle/` directory
- [ ] Schema changes produce new migration files via `drizzle-kit generate`
- [ ] CI integration tests use migration files (not push)
- [ ] README and CLAUDE.md updated with new workflow

---

## Story 30: Security Hardening

> **Motivation:** The app accepts user input (form fields, audio files, code) and makes external API calls. Basic security measures prevent common attacks and abuse without adding complexity.

### Tasks

- [ ] **30.1** Add Content Security Policy (CSP) headers:
  - Configure in `next.config.ts` or middleware
  - Allow OpenAI API, Supabase, and self for scripts/styles
  - Block inline scripts where possible

- [ ] **30.2** Add rate limiting on public API routes:
  - Simple in-memory rate limiter (token bucket) for `/api/sessions`, `/api/transcribe`, `/api/problems/generate`
  - 30 requests/minute per authenticated user
  - Return 429 Too Many Requests with Retry-After header
  - Write integration test for rate limit behavior

- [ ] **30.3** Input sanitization audit:
  - Review all API routes for unsanitized user input passed to DB queries or external APIs
  - Drizzle ORM parameterizes queries (safe), but check any `sql` tagged template usage
  - Verify file upload size limits are enforced (already have 25MB on transcribe)

- [ ] **30.4** Add CSRF protection review:
  - NextAuth handles CSRF for auth routes
  - Verify all mutation routes (POST/PATCH/DELETE) require authentication

### Acceptance Criteria

- [ ] CSP headers present on all responses
- [ ] Rate limiting returns 429 after threshold
- [ ] No SQL injection vectors identified
- [ ] All mutation endpoints require authentication

---

## Story 31: Per-User Session Limits

> **Motivation:** OpenAI API calls cost money. Without limits, a single user could run hundreds of sessions and rack up costs. Simple per-user daily limits prevent abuse while keeping the app free for normal use.

### Tasks

- [ ] **31.1** Add a daily session limit check to `POST /api/sessions`:
  - Count today's sessions for the authenticated user
  - Default limit: 10 sessions/day (configurable via env var `MAX_DAILY_SESSIONS`)
  - Return 429 with clear error message when limit reached
  - Write integration test for the limit

- [ ] **31.2** Show remaining sessions in the UI:
  - Display "X/10 sessions remaining today" on the dashboard or setup pages
  - Add a `GET /api/sessions/quota` endpoint that returns `{ used, limit, remaining }`
  - Write integration test for the quota endpoint

- [ ] **31.3** Add `.env.example` entry for `MAX_DAILY_SESSIONS`

### Acceptance Criteria

- [ ] Users cannot create more than 10 sessions per day (configurable)
- [ ] Clear error message when limit reached
- [ ] Remaining quota visible in the UI
- [ ] Integration tests cover both under-limit and at-limit scenarios

---

## Story 32: Interview Tips & Coaching Page

> **Motivation:** Users need to learn interview techniques before practicing. A dedicated coaching page teaches STAR method, problem-solving frameworks, system design templates, and communication tips. This differentiates the app from a simple mock interview tool — it's also a learning platform.

### Tasks

- [ ] **32.1** Create `app/coaching/page.tsx` — main coaching page:
  - Tabbed layout: Behavioral | LeetCode | System Design | Communication
  - Each tab renders a content section with techniques, examples, and tips
  - Add "Coaching" link to the sidebar navigation

- [ ] **32.2** Behavioral coaching content:
  - STAR method explanation with examples
  - Common behavioral question categories (leadership, conflict, failure, teamwork)
  - Tips: be specific, use metrics, practice storytelling
  - "Practice this" button linking to behavioral setup with relevant config

- [ ] **32.3** LeetCode coaching content:
  - Problem-solving framework: understand → plan → implement → verify
  - Common patterns: two pointers, sliding window, BFS/DFS, dynamic programming
  - Tips: think aloud, discuss complexity, handle edge cases
  - "Practice this" button linking to technical setup with relevant focus areas

- [ ] **32.4** System Design coaching content:
  - Framework: requirements → high-level design → deep dive → trade-offs
  - Key concepts: scalability, databases, caching, load balancing
  - Tips: ask clarifying questions, estimate scale, discuss alternatives

- [ ] **32.5** Communication tips content:
  - General tips applicable to all interview types
  - Body language, pacing, confidence, asking good questions
  - Especially relevant for the facial emotion and gaze tracking features (Story 36-37)

- [ ] **32.6** Component tests for coaching page (renders tabs, switching works)

### Acceptance Criteria

- [ ] Coaching page accessible from sidebar
- [ ] Four content tabs with substantive interview guidance
- [ ] "Practice this" buttons link to the correct setup page
- [ ] Mobile-friendly layout

---

## Story 33: Export Feedback as PDF

> **Motivation:** Users want to save and share their interview feedback — for personal records, to show mentors, or for job application portfolios. A PDF export captures the complete feedback in a printable format.

### Tasks

- [ ] **33.1** Install a PDF generation library:
  - Option A: `@react-pdf/renderer` (React components → PDF)
  - Option B: `html2canvas` + `jspdf` (screenshot approach, simpler but less clean)
  - Choose based on complexity and output quality

- [ ] **33.2** Create a `FeedbackPDF` component or generation function:
  - Include: overall score, code quality/explanation scores (if technical), summary, strengths, weaknesses, per-answer breakdown, timeline (if technical)
  - Styled for print (no dark mode, clean typography)
  - Header with "Interview Assistant — Feedback Report" and date

- [ ] **33.3** Add "Export as PDF" button to the FeedbackDashboard:
  - Downloads the PDF with filename: `feedback-{session-type}-{date}.pdf`
  - Show loading state while PDF generates

- [ ] **33.4** Component test for the export button (renders, click triggers download)

### Acceptance Criteria

- [ ] PDF contains all feedback sections with correct data
- [ ] PDF is clean and printable (no dark mode artifacts, proper typography)
- [ ] Download triggers with a meaningful filename
- [ ] Works for both behavioral and technical sessions

---

## Story 34: Practice Streaks & Gamification

> **Motivation:** Consistent practice is key to interview success. Streaks and achievements encourage daily practice and give users a sense of progress beyond just scores.

### Tasks

- [ ] **34.1** Add streak tracking to the database:
  - Add `user_streaks` table: `user_id`, `current_streak`, `longest_streak`, `last_practice_date`
  - Or track via session dates (no new table — query `interview_sessions` for consecutive days)
  - Create a `GET /api/users/stats` endpoint returning streak + total sessions + avg score
  - Write integration test for the stats endpoint

- [ ] **34.2** Add streak display to the dashboard:
  - Streak counter with fire icon (current streak in days)
  - "Longest streak: X days" subtitle
  - Visual calendar heatmap showing practice days (last 30 days)

- [ ] **34.3** Add achievement badges:
  - Define 5-8 achievements: "First Interview", "3-Day Streak", "7-Day Streak", "Score 8+", "10 Sessions", "Both Types" (did both behavioral + technical)
  - Store earned badges in DB (new `user_achievements` table or JSONB on user)
  - Display badges on dashboard
  - Check and award badges after each session completion

- [ ] **34.4** Add a `POST /api/sessions/:id/complete` hook or extend `PATCH` to trigger streak/badge updates on session completion
  - Write integration tests for streak calculation and badge awarding

- [ ] **34.5** Component tests for streak display and badges

### Acceptance Criteria

- [ ] Dashboard shows current streak and longest streak
- [ ] Streak increments when user practices on consecutive days
- [ ] Achievements are earned and displayed
- [ ] All new API endpoints have integration tests

---

## Story 35: Live Transcript Overlay

> **Motivation:** During both behavioral and technical interviews, users want optional visual feedback of what they're saying. The behavioral session already has a transcript toggle — extend this to technical sessions and polish the UX for both.

### Tasks

- [ ] **35.1** Add live transcript overlay to the technical session page:
  - Floating panel (similar to behavioral session's existing overlay)
  - Shows transcribed speech segments as they arrive
  - Toggle button to show/hide
  - Auto-scrolls to latest entry

- [ ] **35.2** Polish the existing behavioral session transcript overlay:
  - Match styling with technical session overlay
  - Add speaker labels with color coding (Interviewer vs You)
  - Smooth scroll behavior

- [ ] **35.3** Add a "Show Transcript" toggle to TechnicalSessionLayout bottom bar

### Acceptance Criteria

- [ ] Technical session has optional live transcript overlay
- [ ] Both interview types have consistent transcript overlay styling
- [ ] Overlay is non-intrusive and doesn't cover the main content area

---

## Story 36: Facial Emotion Detection

> **Motivation:** In behavioral interviews, positive facial expressions convey confidence and enthusiasm. A lightweight MediaPipe Face Landmarker model runs in-browser, detecting emotional state from facial landmarks throughout the session. The feedback page then includes an emotion timeline showing how the candidate's expression changed during the interview.

### Tasks

- [ ] **36.1** Install and configure MediaPipe Face Landmarker:
  - Install `@mediapipe/tasks-vision`
  - Create `hooks/useFaceAnalysis.ts` that initializes the Face Landmarker with blendshape output enabled
  - Run detection on each video frame (throttled to ~10fps to save CPU)
  - Expose: `{ isReady, emotions, startAnalysis, stopAnalysis }`

- [ ] **36.2** Implement emotion classification from blendshapes:
  - Create `lib/emotion-classifier.ts` — pure function
  - Map MediaPipe blendshape scores to emotions:
    - `mouthSmileLeft` + `mouthSmileRight` → "positive"
    - `browDownLeft` + `browDownRight` + `mouthFrownLeft` → "tense"
    - Low activations across all → "neutral"
    - `eyeSquintLeft` + `jawOpen` → "engaged"
  - Output: `{ emotion: string, confidence: number, timestamp_ms: number }`
  - Write unit tests for the classifier (8+ test cases for different blendshape combos)

- [ ] **36.3** Add Face Analysis settings widget to the behavioral setup page (right column):
  - Toggle: "Enable Facial Emotion Tracking" (default on)
  - Toggle: "Enable Eye Gaze Tracking" (default on)
  - Brief description: "Your webcam will analyze facial expressions and eye contact during the interview"
  - Store settings in session config (`face_analysis: { emotion: boolean, gaze: boolean }`)
  - This fills the empty space in the right column of the two-column setup layout

- [ ] **36.4** Capture emotion data during behavioral interview sessions:
  - Wire `useFaceAnalysis` into the behavioral session page
  - Accumulate emotion samples (one per second) in a ref
  - On session end, save emotion data alongside transcript

- [ ] **36.5** Add emotion data to the database and API:
  - Add `emotion_timeline` JSONB column to `session_feedback` (or separate table)
  - Update `POST /api/sessions/[id]/feedback` to accept and store emotion data
  - Write integration test for emotion data persistence
  - Generate migration file (`drizzle-kit generate`)

- [ ] **36.6** Update the Python feedback analyzer to incorporate emotion data:
  - Add `emotion_samples` to `TechnicalFeedbackRequest` schema (reuse for behavioral too)
  - Update system prompt to reference emotion patterns: "The candidate appeared tense during questions about leadership but positive when discussing technical achievements"
  - Write unit test for prompt including emotion data

- [ ] **36.7** Create `components/feedback/EmotionTimeline.tsx`:
  - Horizontal timeline showing emotion state over session duration
  - Color-coded: green (positive), yellow (neutral), orange (tense), blue (engaged)
  - Hover to see exact emotion + timestamp
  - Summary stats: "Positive 60%, Neutral 25%, Tense 15%"

- [ ] **36.8** Add EmotionTimeline to FeedbackDashboard (behavioral sessions only):
  - Render between ScoreCard and StrengthsWeaknesses
  - Only show when emotion data exists

- [ ] **36.9** Component tests for EmotionTimeline

### Acceptance Criteria

- [ ] Face Landmarker runs in browser at ~10fps without noticeable performance impact
- [ ] Emotion classification produces reasonable results from blendshape data
- [ ] Emotion timeline renders on behavioral feedback page
- [ ] Feedback AI references emotion patterns in its analysis
- [ ] Emotion classifier has 8+ unit tests
- [ ] New API fields have integration tests
- [ ] DB migration file committed

---

## Story 37: Eye Gaze Tracking

> **Motivation:** Consistent eye contact conveys confidence in interviews. Frequent gaze shifts indicate nervousness. MediaPipe's iris landmarks can track gaze direction in-browser, and the feedback page can show a gaze stability score and highlight moments of inconsistent eye contact.

### Tasks

- [ ] **37.1** Extend `useFaceAnalysis` hook to extract gaze data:
  - Use MediaPipe iris landmarks (indices 468-477) to compute gaze direction
  - Calculate gaze vector: iris center position relative to eye corner landmarks
  - Detect: "looking at camera" vs "looking away" (left/right/up/down)
  - Expose: `{ gazeDirection, gazeStability }` alongside emotion data

- [ ] **37.2** Implement gaze stability scoring:
  - Create `lib/gaze-analyzer.ts` — pure function
  - Input: array of gaze samples `{ direction: {x,y}, timestamp_ms }[]`
  - Calculate: stability score (0-10) based on variance of gaze position
  - Calculate: "looking at camera" percentage
  - Detect: periods of rapid gaze shifts (nervousness indicator)
  - Write unit tests (8+ cases: stable gaze, erratic gaze, looking away, etc.)

- [ ] **37.3** Capture gaze data during behavioral sessions:
  - Sample gaze direction alongside emotion data (same 1/second cadence)
  - Store as part of the same emotion/gaze data blob

- [ ] **37.4** Add gaze data to database and feedback API:
  - Extend the emotion_timeline JSONB to include gaze data per sample
  - Update feedback analyzer prompt to reference gaze patterns
  - Write integration test

- [ ] **37.5** Create `components/feedback/GazeReport.tsx`:
  - Gaze stability score (0-10) with color coding
  - "Looking at camera" percentage
  - Timeline highlighting periods of erratic gaze
  - Tip: "You looked away frequently around 2:30-3:00 — this was during the leadership question"

- [ ] **37.6** Add GazeReport to FeedbackDashboard (behavioral sessions only)

- [ ] **37.7** Component tests for GazeReport

### Acceptance Criteria

- [ ] Gaze direction extracted from iris landmarks at ~10fps
- [ ] Gaze stability score is reasonable (stable = high, erratic = low)
- [ ] GazeReport renders on behavioral feedback page
- [ ] Feedback AI references gaze patterns
- [ ] Gaze analyzer has 8+ unit tests
- [ ] New API fields have integration tests

---

## Story 38: Additional Instructions for Technical Interview

> **Motivation:** Users sometimes want to give the AI extra context for problem generation — e.g., "Focus on graph problems similar to Google interviews" or "I'm preparing for a specific company." An optional text field on the technical setup page captures this and passes it to the problem generation prompt. This also fills the empty space in the right column of the setup layout.

### Tasks

- [ ] **38.1** Add `additional_instructions` field to `TechnicalSessionConfig` in the shared types:
  - Optional `string` field, max 1000 characters
  - Update `technicalConfigSchema` in `lib/validations.ts` to include it
  - Write unit test for the new validation field

- [ ] **38.2** Add "Additional Instructions" textarea to the technical setup form (right column, below Settings card):
  - Optional field with placeholder: "e.g., Focus on Google-style problems, avoid recursion..."
  - Character count (X/1000)
  - Stored in session config via `setConfig({ additional_instructions: ... })`

- [ ] **38.3** Pass `additional_instructions` to the problem generation prompt:
  - Update `buildProblemGenerationPrompt()` in `lib/prompts-technical.ts` to append instructions if present
  - Write unit test for prompt with and without instructions

- [ ] **38.4** Update integration tests for `POST /api/sessions` to cover the new config field

### Acceptance Criteria

- [ ] Optional text field visible on technical setup page
- [ ] Instructions are stored in session config and passed to problem generation
- [ ] Empty instructions don't affect existing behavior
- [ ] Unit + integration tests cover the new field

---

## Definition of Done — Phase 3.5

- [ ] All setup and feedback pages use wider, two-column layouts on desktop
- [ ] Dark mode toggle in header, all components work in both modes
- [ ] Skeleton screens on all data-loading pages
- [ ] Structured logging (Pino) in all API routes, no console.log
- [ ] Sentry capturing errors in both Next.js and FastAPI
- [ ] Database migrations versioned and committed
- [ ] CSP headers and rate limiting on public routes
- [ ] Per-user daily session limits enforced
- [ ] Coaching page with 4 content tabs
- [ ] PDF export for feedback reports
- [ ] Practice streaks and achievement badges on dashboard
- [ ] Live transcript overlay in both interview types
- [ ] Facial emotion detection during behavioral interviews with feedback timeline
- [ ] Eye gaze tracking during behavioral interviews with stability score
- [ ] All new features have unit tests, integration tests, and component tests
- [ ] CI pipeline passes all checks
