# Preploy — Phase 3.5: Features, UX Polish & Lightweight Ops

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

- [x] **27.1** Install Pino for Next.js:
  - `npm install pino pino-pretty` in `apps/web`
  - Create `lib/logger.ts` that exports a configured Pino instance
  - Pretty-print in development, JSON in production

- [x] **27.2** Install structlog or Python logging for FastAPI:
  - Configure Python's `logging` module with JSON formatter for production
  - Keep human-readable format for development

- [x] **27.3** Replace all `console.log`/`console.error` in API routes with `logger.info`/`logger.error`:
  - Add request context (session ID, user ID) where available
  - Grep for all `console.` calls and replace

- [x] **27.4** Add request ID middleware:
  - Generate a UUID per request in Next.js middleware
  - Pass it through to log calls for cross-service tracing

- [x] **27.5** Write unit test for logger configuration (correct level, format)

- [x] **27.6** Update CLAUDE.md: "Use `logger` from `@/lib/logger` instead of `console.log` in all API routes and server-side code"

### Acceptance Criteria

- [x] No `console.log` or `console.error` in API route handlers
- [x] All logs are structured JSON in production, pretty-printed in development
- [x] Request IDs appear in logs for traceability
- [x] CLAUDE.md updated with logging guidelines

---

## Story 28: Sentry Error Monitoring

> **Motivation:** Errors in production are invisible without monitoring. Sentry's free tier (5K errors/month) captures errors with stack traces, source maps, and user context — enough for an MVP. Zero cost.

### Tasks

- [x] **28.1** Install and configure `@sentry/nextjs`:
  - `npx @sentry/wizard@latest -i nextjs`
  - Configure DSN via environment variable `SENTRY_DSN`
  - Enable source maps upload in production builds
  - Add `SENTRY_DSN` to `.env.example` and `.env.ci` (dummy value)

- [x] **28.2** Configure Sentry for the Python FastAPI service:
  - `pip install sentry-sdk[fastapi]`
  - Initialize in `app/main.py`

- [x] **28.3** Add user context to Sentry events:
  - Set Sentry user (`id`, `email`) after auth in API routes
  - Tag events with session type (behavioral/technical)

- [x] **28.4** Test error capture:
  - Trigger a test error and verify it appears in the Sentry dashboard
  - Verify source maps resolve correctly

- [x] **28.5** Update README with Sentry setup instructions

### Acceptance Criteria

- [x] Unhandled errors in Next.js and FastAPI are captured in Sentry (when DSN configured)
- [x] Source maps configured (deleteSourcemapsAfterUpload in production)
- [x] User context (ID, email) attached to error events via setSentryUser
- [x] No performance impact — Sentry skips initialization when DSN is blank

---

## Story 29: Versioned Database Migrations

> **Motivation:** Currently using `drizzle-kit push` which directly modifies the production schema — dangerous for a real deployment. Versioned migrations (`drizzle-kit generate` → commit SQL → apply in CI) provide an audit trail, rollback capability, and safe schema evolution.

### Tasks

- [x] **29.1** Generate initial migration from current schema:
  - Run `npx drizzle-kit generate` to create SQL migration files
  - Commit the `drizzle/` migrations folder

- [x] **29.2** Add a `migrate` script to `apps/web/package.json`:
  - `"migrate": "drizzle-kit migrate"`
  - Document the new workflow in README

- [x] **29.3** Update CI to run migrations against the test DB before integration tests:
  - The `tests/global-setup.ts` already handles this, but verify it uses the migration files

- [x] **29.4** Update CLAUDE.md: "When modifying `lib/schema.ts`, always run `npx drizzle-kit generate` to create a migration file. Never use `drizzle-kit push` in production."

- [x] **29.5** Update README: replace `drizzle-kit push` instructions with the migration workflow

### Acceptance Criteria

- [x] Migration SQL files committed to `drizzle/` directory (initial migration already existed)
- [x] Schema changes produce new migration files via `npm run db:generate`
- [x] CI integration tests use migration files (`tests/global-setup.ts` calls `migrate()`)
- [x] README and CLAUDE.md updated with new workflow

---

## Story 30: Security Hardening

> **Motivation:** The app accepts user input (form fields, audio files, code) and makes external API calls. Basic security measures prevent common attacks and abuse without adding complexity.

### Tasks

- [x] **30.1** Add Content Security Policy (CSP) headers:
  - Configure in `next.config.ts` or middleware
  - Allow OpenAI API, Supabase, and self for scripts/styles
  - Block inline scripts where possible

- [x] **30.2** Add rate limiting on public API routes:
  - Simple in-memory rate limiter (token bucket) for `/api/sessions`, `/api/transcribe`, `/api/problems/generate`
  - 30 requests/minute per authenticated user
  - Return 429 Too Many Requests with Retry-After header
  - Write integration test for rate limit behavior

- [x] **30.3** Input sanitization audit:
  - Review all API routes for unsanitized user input passed to DB queries or external APIs
  - Drizzle ORM parameterizes queries (safe), but check any `sql` tagged template usage
  - Verify file upload size limits are enforced (already have 25MB on transcribe)

- [x] **30.4** Add CSRF protection review:
  - NextAuth handles CSRF for auth routes
  - Verify all mutation routes (POST/PATCH/DELETE) require authentication

### Acceptance Criteria

- [x] CSP headers present on all responses (+ X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] Rate limiting returns 429 after 30 req/min threshold (7 unit tests)
- [x] No SQL injection vectors identified (all queries via Drizzle ORM, one safe `count(*)` template)
- [x] All mutation endpoints require authentication (verified all 8 POST/PATCH routes)

---

## Story 31: Per-User Session Limits

> **Motivation:** OpenAI API calls cost money. Without limits, a single user could run hundreds of sessions and rack up costs. Simple per-user daily limits prevent abuse while keeping the app free for normal use.

### Tasks

- [x] **31.1** Add tiered plan system:
  - Add `plan` column to `users` table (enum: `free`, `pro`, `max`) with default `free`
  - Create `lib/plans.ts` with configurable limits per tier (free: 3/day, pro: 10/day, max: 30/day)
  - Plans and limits should be easy to rename/reconfigure without code changes to routes
  - Generate DB migration for the new column

- [x] **31.2** Add daily session limit check to `POST /api/sessions`:
  - Count today's sessions for the authenticated user
  - Look up user's plan → get daily limit from plan config
  - Return 429 with clear error message including plan name and limit
  - Write integration tests: free user at limit, user under limit, different plans

- [x] **31.3** Add `GET /api/sessions/quota` endpoint:
  - Returns `{ plan, used, limit, remaining }`
  - Write integration tests for the quota endpoint

- [x] **31.4** Show remaining sessions in the UI:
  - Display quota on the dashboard (e.g., "2/3 sessions used today — Free plan")
  - Show on setup pages before starting an interview

- [x] **31.5** Update `.env.example` and CLAUDE.md

### Acceptance Criteria

- [x] Users cannot exceed their plan's daily session limit
- [x] Free: 3/day, Pro: 10/day, Max: 30/day (configurable in `lib/plans.ts`)
- [x] Clear error message when limit reached, including plan name and limit
- [x] Remaining quota visible on dashboard (stats card) and both setup pages
- [x] Integration tests: quota endpoint (4 tests), session limit enforcement (2 tests)
- [x] DB migration committed (`0001_bitter_vin_gonzales.sql` — adds `user_plan` enum + `plan` column)

---

## Story 32: Interview Tips & Coaching Page

> **Motivation:** Users need to learn interview techniques before practicing. A dedicated coaching page teaches STAR method, problem-solving frameworks, system design templates, and communication tips. This differentiates the app from a simple mock interview tool — it's also a learning platform.

### Tasks

- [x] **32.1** Create `app/coaching/page.tsx` — main coaching page:
  - Tabbed layout: Behavioral | LeetCode | System Design | Communication
  - Each tab renders a content section with techniques, examples, and tips
  - Add "Coaching" link to the sidebar navigation

- [x] **32.2** Behavioral coaching content:
  - STAR method explanation with examples
  - Common behavioral question categories (leadership, conflict, failure, teamwork)
  - Tips: be specific, use metrics, practice storytelling
  - "Practice this" button linking to behavioral setup with relevant config

- [x] **32.3** LeetCode coaching content:
  - Problem-solving framework: understand → plan → implement → verify
  - Common patterns: two pointers, sliding window, BFS/DFS, dynamic programming
  - Tips: think aloud, discuss complexity, handle edge cases
  - "Practice this" button linking to technical setup with relevant focus areas

- [x] **32.4** System Design coaching content:
  - Framework: requirements → high-level design → deep dive → trade-offs
  - Key concepts: scalability, databases, caching, load balancing
  - Tips: ask clarifying questions, estimate scale, discuss alternatives

- [x] **32.5** Communication tips content:
  - General tips applicable to all interview types
  - Body language, pacing, confidence, asking good questions
  - Especially relevant for the facial emotion and gaze tracking features (Story 36-37)

- [x] **32.6** Component tests for coaching page (renders tabs, switching works)

### Acceptance Criteria

- [x] Coaching page accessible from sidebar and header nav
- [x] Four content tabs with substantive interview guidance
- [x] "Practice this" buttons link to the correct setup page
- [x] Mobile-friendly layout (responsive grids with md: breakpoints)

---

## Story 33: Export Feedback as PDF

> **Motivation:** Users want to save and share their interview feedback — for personal records, to show mentors, or for job application portfolios. A PDF export captures the complete feedback in a printable format.

### Tasks

- [x] **33.1** Installed `@react-pdf/renderer` — vector PDF with clean typography

- [x] **33.2** Created `FeedbackPDF` component with all sections:
  - Scores row (overall + code quality + explanation quality for technical)
  - Summary, strengths/weaknesses two-column, answer breakdown cards, timeline
  - Color-coded scores, Helvetica typography, A4 layout

- [x] **33.3** Added "Export PDF" button to FeedbackDashboard:
  - Dynamic import to avoid loading ~500KB PDF library on page load
  - Downloads as `feedback-{type}-{date}.pdf`
  - Loading state while generating

- [x] **33.4** Component test: Export PDF button renders

### Acceptance Criteria

- [x] PDF contains all feedback sections with correct data
- [x] PDF is clean and printable (no dark mode, Helvetica, color-coded scores)
- [x] Download triggers with meaningful filename
- [x] Works for both behavioral and technical sessions

---

## Story 34: Practice Streaks & Gamification

> **Motivation:** Consistent practice is key to interview success. Streaks and achievements encourage daily practice and give users a sense of progress beyond just scores.

### Tasks

- [x] **34.1** Streak tracking via computed query on `interview_sessions` dates (no new streak table needed):
  - Pure `calculateStreaks()` + `buildHeatmap()` functions in `lib/streaks.ts` (12 unit tests)
  - `GET /api/users/stats` endpoint returning streaks, heatmap, scores, badges
  - Integration tests for stats endpoint (4 tests)

- [x] **34.2** Streak display on dashboard:
  - `StreakCard` component with fire icon, current/longest streak numbers, 30-day heatmap (green intensity by count)
  - Component tests (4 tests)

- [x] **34.3** Achievement badges with `user_achievements` table:
  - Separate table with `UNIQUE(user_id, badge_id)` index — scalable for querying/analytics
  - 7 badge definitions in `lib/badges.ts`: First Steps, On a Roll (3d), Week Warrior (7d), High Achiever (8+), Dedicated (10 sessions), Well-Rounded (both types), Interview Pro (25 sessions)
  - `BadgeGrid` component showing earned (highlighted) and locked (dimmed) badges
  - `checkNewBadges()` pure function in `lib/badge-checker.ts` (11 unit tests)
  - Component tests (4 tests)

- [x] **34.4** Badge awarding via `POST /api/users/badges` endpoint:
  - Called fire-and-forget from both behavioral and technical session end flows
  - Gathers stats, checks for new badges, inserts awarded badges
  - Integration tests (4 tests)

- [x] **34.5** Component tests for StreakCard (4) and BadgeGrid (4)

### Acceptance Criteria

- [x] Dashboard shows current streak and longest streak with heatmap
- [x] Streak increments when user practices on consecutive days (12 unit tests verify)
- [x] Achievements earned and displayed (7 badges, awarded on session completion)
- [x] All new API endpoints have integration tests (8 total)
- [x] DB migration committed (`0002_user_achievements.sql`)

---

## Story 35: Profile Page

> **Motivation:** Users need a place to manage their account — view and edit their name, update their profile picture, see their current plan, and disable their account if needed. This is foundational for any multi-user app and lays the groundwork for future billing integration.

### Tasks

- [x] **35.1** Created `app/profile/page.tsx` with two-column layout, loading skeleton, "Profile" in user dropdown, protected route

- [x] **35.2** Profile info section: editable name with save, read-only email, member since date. `GET /api/users/me` + `PATCH /api/users/me` endpoints. 7 integration tests (auth, get profile, update name, reject empty name, update plan, reject invalid plan, reject empty body)

- [x] **35.3** Plan section: radio group for Free/Pro/Max with sessions/day display. Plan badge showing current plan. Direct DB update (Stripe integration later)

- [x] **35.4** Danger Zone: "Disable Account" with confirmation dialog. `POST /api/users/me/disable` endpoint. `disabled_at` column added. Migration: `0003_polite_paibok.sql`. 3 integration tests (auth, disable, already disabled)

- [x] **35.5** Disabled accounts blocked: `POST /api/sessions` returns 403 if `disabled_at` is set. 1 integration test

- [x] **35.6** Component tests for profile page: 4 tests (title, plan options, danger zone, disable button)

### Acceptance Criteria

- [x] Profile page accessible from user dropdown in header
- [x] Users can edit their name and see it update immediately
- [x] Current plan displayed with option to change (Free/Pro/Max radio group)
- [x] Disable account prevents new session creation (403)
- [x] All new endpoints have integration tests (11 total)
- [x] DB migration committed (`0003_polite_paibok.sql` — adds `disabled_at` column)

---

## ~~Story 36: Facial Emotion Detection~~ (Dropped)

> Dropped — adds complexity without sufficient MVP value. MediaPipe WASM is ~8MB, introduces CSP complications, and the emotion classification from blendshapes was experimental. Can revisit post-launch if users request it.

---

## ~~Story 37: Eye Gaze Tracking~~ (Dropped)

> Dropped — depends on Story 36 infrastructure. Same rationale.

---

## Story 36: Replace 3D Avatar with Pulsing Circle Visualizer

> **Motivation:** The 3D avatar (Three.js + GLB model + lip sync) causes texture loading errors, requires heavy npm dependencies (~3MB bundle), and adds CSP complexity for CDN assets. Replace it with a simple pulsing circle that reacts to AI speech — cleaner, lighter, and more reliable.

### Tasks

- [x] **36.1** Rewrote `VideoCallLayout.tsx` — pulsing circle visualizer (3 concentric rings scaling with `aiAudioLevel`), simplified props, `onWebcamReady` callback

- [x] **36.2** Updated behavioral session page — removed `useLipSync`, `avatarRef`, lip-sync `useEffect`, simplified VideoCallLayout props

- [x] **36.3** Deleted: `components/avatar/` (5 files), `hooks/useLipSync.ts`, `public/avatars/interviewer.glb`, `docs/avatar-setup.md`. Removed `playbackContext`/`playbackAnalyser` exports from `useRealtimeVoice.ts`

- [x] **36.4** Uninstalled: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`

- [x] **36.5** Cleaned README (removed avatar setup step, updated behavioral description). CSP was already clean (no drei CDNs)

- [x] **36.6** All lint, typecheck, unit, and integration tests pass

### Acceptance Criteria

- [x] No Three.js packages in `package.json`
- [x] No `components/avatar/` directory or `hooks/useLipSync.ts`
- [x] No GLB files in `public/`
- [x] Behavioral session renders pulsing circle instead of 3D avatar
- [x] No texture loading errors in console
- [x] All tests pass

---

## Story 38: Additional Instructions for Technical Interview

> **Motivation:** Users sometimes want to give the AI extra context for problem generation — e.g., "Focus on graph problems similar to Google interviews" or "I'm preparing for a specific company." An optional text field on the technical setup page captures this and passes it to the problem generation prompt. This also fills the empty space in the right column of the setup layout.

### Tasks

- [x] **38.1** Added `additional_instructions?: string` to `TechnicalSessionConfig` (shared types) + `.max(1000).optional()` to `technicalConfigSchema`. 3 validation unit tests (accepts, omits, rejects >1000)

- [x] **38.2** Added "Additional Instructions" card to technical setup right column: textarea with placeholder, 1000-char limit with counter

- [x] **38.3** Updated `buildProblemGenerationPrompt()` to append instructions when present. 2 prompt unit tests (with/without)

- [x] **38.4** Existing integration tests cover the config field (Zod validation is the enforcement point, tested in unit tests)

### Acceptance Criteria

- [x] Optional text field visible on technical setup page (right column, below Settings)
- [x] Instructions stored in session config and passed to problem generation
- [x] Empty instructions don't affect existing behavior (2 tests verify)
- [x] Unit tests cover validation + prompt generation

---

## Story 43: Session Templates (Save & Load)

> **Motivation:** Users practice the same type of interview repeatedly — same company, same expected questions, same settings. Retyping everything each time is tedious and error-prone. Templates let users save a setup config once and reuse it instantly. This is the #1 daily friction reducer.

### Tasks

- [x] **43.1** Add `session_templates` table:
  - `id` (uuid PK), `user_id` (FK users), `name` (text), `type` ("behavioral"|"technical"), `config` (JSONB — full session config), `created_at`, `updated_at`
  - Generate DB migration
  - Add relations

- [x] **43.2** Create template CRUD API routes:
  - `POST /api/templates` — save current config as a named template. Input: `{ name, type, config }`
  - `GET /api/templates` — list user's templates, filterable by type
  - `GET /api/templates/[id]` — get specific template
  - `PATCH /api/templates/[id]` — update name or config
  - `DELETE /api/templates/[id]` — delete template
  - All routes need auth + ownership checks
  - Write integration tests for ALL routes (auth, validation, CRUD, authorization)

- [x] **43.3** Add "Save as Template" button to both setup pages:
  - After filling in the form, user clicks "Save as Template"
  - Prompts for a template name (modal or inline input)
  - Saves the current form state as a template
  - Confirmation: "Template saved!"

- [x] **43.4** Add "Load Template" dropdown to both setup pages:
  - Dropdown at the top of the form showing user's templates (filtered by type)
  - Selecting a template fills all form fields with the saved config
  - "Last used" badge on most recent template

- [x] **43.5** Add template management to the Profile page:
  - New "Templates" section showing all saved templates
  - Each template shows: name, type badge, created date, preview of config
  - Edit name, delete buttons
  - Reorder/favorite later if needed

- [x] **43.6** Unit tests for any pure logic, integration tests for all CRUD routes, component tests for template dropdown and save modal

### Acceptance Criteria

- [x] Users can save the current setup as a named template
- [x] Templates can be loaded to pre-fill the setup form instantly
- [x] Templates are manageable (view, rename, delete) from the Profile page
- [x] Works for both behavioral and technical interview types
- [x] All CRUD routes have integration tests

---

## Story 44: Resume-Aware Interview Sessions

> **Motivation:** In real interviews, the interviewer has your resume in front of them. Currently, Preploy's AI interviewer doesn't know your background. Adding a resume selector to the setup pages lets the AI reference your specific projects, technologies, and achievements — making practice questions dramatically more realistic. This is the single biggest realism upgrade.

### Tasks

- [x] **44.1** Add "Include Resume" dropdown to the behavioral setup page (right column):
  - Fetches user's uploaded resumes from `GET /api/resume`
  - Dropdown: "None" | list of uploaded resumes
  - Selected resume ID stored in session config as `resume_id`
  - Small preview of selected resume content (first 200 chars)

- [x] **44.2** Add "Include Resume" dropdown to the technical setup page (right column):
  - Same pattern as behavioral
  - Resume context influences problem generation (technologies, systems the user knows)

- [x] **44.3** Include resume text in the behavioral AI interviewer system prompt:
  - Update `buildBehavioralSystemPrompt()` in `lib/prompts.ts`
  - When `resume_id` is in config, fetch resume content and include it
  - Instruct AI: "The candidate's resume is below. Reference their specific experience when asking follow-up questions."
  - Write unit tests for prompt with/without resume

- [x] **44.4** Include resume text in the technical problem generation prompt:
  - Update `buildProblemGenerationPrompt()` in `lib/prompts-technical.ts`
  - When resume is included: "The candidate has experience with: {technologies from resume}. Generate problems relevant to their background."
  - Write unit tests

- [x] **44.5** Include resume text in the feedback analysis prompts:
  - Update both Python feedback services to accept optional `resume_text`
  - GPT can compare what the candidate said vs what's on their resume
  - "The candidate mentioned leading a team of 5, which matches their resume — good consistency"
  - Write unit tests for prompts with/without resume

- [x] **44.6** Integration tests for resume-aware session flow (end-to-end: setup with resume → session → feedback references resume)

### Acceptance Criteria

- [x] Both setup pages show a resume selector dropdown
- [x] Behavioral AI interviewer asks questions referencing the user's specific resume experience
- [x] Technical problems are tailored to the user's tech stack from the resume
- [x] Feedback analysis compares answers to resume claims
- [x] Prompt builders have unit tests for with/without resume paths
- [x] No regression when no resume is selected

---

## Story 45: One-Click Flows (Cross-Page Integration)

> **Motivation:** Currently, features generate valuable output (resume questions, company questions, planner recommendations) but users have to manually copy data between pages. One-click flows eliminate this friction — "Use these questions" from the resume page should take you directly to a pre-filled setup page.

### Tasks

- [x] **45.1** Resume Questions → Behavioral Setup (one-click):
  - "Use these questions" button on resume page → stores questions in Zustand or URL params
  - Navigates to behavioral setup with Expected Questions pre-filled
  - Also pre-fills company name if it was specified during generation

- [x] **45.2** Company Questions → Behavioral Setup ("Practice with all"):
  - "Start practice session with these questions" button on the company questions widget
  - Pre-fills company name + all generated questions into Expected Questions
  - One click from "Generate questions for Google" → fully configured setup → start interview

- [x] **45.3** Prep Planner → Pre-filled Setup:
  - Each planner day's "Practice" button pre-fills the setup with:
    - Company name from the plan
    - Focus areas matching the day's topics (for technical)
    - Relevant expected questions (for behavioral)
    - If user has a resume, include it automatically

- [x] **45.4** Feedback → Practice Weak Areas:
  - "Practice weak areas" button on feedback page
  - Auto-configures next session based on feedback weaknesses:
    - Behavioral: generates expected questions targeting weak areas
    - Technical: sets focus areas matching weak topics
  - Navigates to setup with config pre-filled

- [x] **45.5** Dashboard → Recommended Next Session:
  - "Recommended next practice" card on dashboard
  - Based on: days since last practice, weakest area, active planner day
  - One-click to start a pre-configured session
  - "Practice behavioral (leadership) — your weakest area in 3 sessions"

- [x] **45.6** Component tests for all one-click flows (navigation + pre-fill verification)

### Acceptance Criteria

- [x] Resume questions can be used in behavioral setup with one click
- [x] Company questions can start a session directly
- [x] Planner days pre-fill the session setup
- [x] Feedback weak areas suggest and pre-configure the next session
- [x] Dashboard shows a recommended next session with one-click start

---

## Story 46: Smart Setup (Company + Resume Combined)

> **Motivation:** The ultimate setup experience: select a company and a resume, and Preploy generates questions that are BOTH company-specific AND resume-tailored. "Based on your resume's experience at Acme Corp with distributed systems, Google might ask: How would you design a system similar to what you built, but at Google's scale?" This is the killer differentiation feature.

### Tasks

- [x] **46.1** Create `POST /api/questions/smart-generate` endpoint:
  - Input: `{ company, role?, resume_id? }`
  - If both company and resume provided: generate questions that reference the user's specific experience in the context of that company's interview style
  - If only company: fall back to Story 40 company-specific questions
  - If only resume: fall back to Story 42 resume-tailored questions
  - Cache results (company + resume_id + role as cache key)
  - Write integration tests for all 3 modes

- [x] **46.2** Create `lib/smart-questions-prompt.ts` — pure function:
  - Combines company hints + resume text into a single prompt
  - "This candidate is interviewing at {company} for {role}. Their resume shows: {resume highlights}. Generate questions that a {company} interviewer would ask THIS specific candidate."
  - Different prompts for behavioral vs technical
  - Write 10+ unit tests

- [x] **46.3** Add "Smart Setup" mode to the behavioral setup page:
  - When both company name AND resume are selected, show a "Generate Smart Questions" button
  - Uses the smart-generate endpoint
  - Badge: "Company + Resume tailored"
  - Replaces the separate company questions and resume questions widgets with one combined experience

- [x] **46.4** Add "Smart Setup" to technical setup:
  - When resume is selected, problem generation prompt includes resume context
  - "Generate problems relevant to a candidate who has experience with {resume technologies} interviewing at {company}"

- [x] **46.5** Integration tests and component tests

### Acceptance Criteria

- [x] Smart questions reference both company culture AND resume experience
- [x] Falls back gracefully when only company or only resume is provided
- [x] Works for both behavioral and technical setups
- [x] Cached to avoid redundant GPT calls
- [x] 10+ unit tests for prompt builder
- [x] Integration tests for all modes

---

## Definition of Done — Phase 3.5

**Completed:**
- [x] All setup and feedback pages use wider, two-column layouts on desktop
- [x] Dark mode toggle in header, all components work in both modes
- [x] Skeleton screens on all data-loading pages
- [x] Structured logging (Pino) in all API routes, no console.log
- [x] Sentry capturing errors in both Next.js and FastAPI
- [x] Database migrations versioned and committed
- [x] CSP headers and rate limiting on public routes
- [x] Per-user daily session limits enforced
- [x] Coaching page with 4 content tabs
- [x] PDF export for feedback reports
- [x] Practice streaks and achievement badges on dashboard
- [x] Profile page with name editing, plan management, and account disable
- [x] 3D avatar replaced with pulsing circle visualizer (no Three.js)
- [x] Interview prep planner with personalized schedules
- [x] Company-specific question bank for behavioral prep
- [x] Session comparison and progress tracking over time
- [x] Resume-tailored question generation (PDF via GPT extraction)

**Remaining:**
- [x] Session templates (save & load setup configs)
- [x] Resume-aware interview sessions (AI interviewer knows your background)
- [x] One-click flows between features (resume → setup, feedback → next session)
- [x] Smart Setup (company + resume combined question generation)
- [x] All new features have unit tests, integration tests, and component tests
- [x] CI pipeline passes all checks

---

## Story 39: Interview Prep Planner

> **Motivation:** Random practice is inefficient. Job searchers need a structured plan: "I have an interview at Google in 2 weeks — what should I practice each day?" A planner that generates a personalized schedule based on target company, role, interview date, and weak areas makes the app a complete prep platform, not just a practice tool.

### Tasks

- [x] **39.1** Create data model for interview plans:
  - Add `interview_plans` table: `id`, `user_id`, `company`, `role`, `interview_date`, `plan_data` (JSONB), `created_at`
  - Plan data structure: `{ days: [{ date, focus: "behavioral"|"technical", topics: string[], session_type, completed: boolean }] }`
  - Generate DB migration
  - Write integration test for plan CRUD

- [x] **39.2** Create `POST /api/plans/generate` endpoint:
  - Input: `{ company, role, interview_date, weak_areas?: string[] }`
  - Uses GPT to generate a day-by-day practice schedule
  - Considers: days until interview, user's historical weak areas (from feedback), balanced behavioral/technical split
  - Returns structured plan as JSON
  - Write integration test

- [x] **39.3** Create `GET /api/plans` and `GET /api/plans/[id]` endpoints:
  - List user's plans, get a specific plan
  - `PATCH /api/plans/[id]` to mark days as completed
  - Write integration tests

- [x] **39.4** Create `app/planner/page.tsx` — prep planner page:
  - Form to create a new plan: company name, role title, interview date picker
  - "Generate Plan" button that calls the API
  - Add "Planner" to sidebar navigation

- [x] **39.5** Display the generated plan:
  - Calendar-style view showing each day with focus area and topics
  - Each day links to the appropriate setup page (behavioral/technical) with pre-filled config
  - Checkboxes to mark days as completed
  - Progress bar: "8/14 days completed"

- [x] **39.6** Auto-detect weak areas:
  - Query user's past feedback to identify recurring weaknesses
  - Pass these to the plan generator so it emphasizes weak areas
  - e.g., "You scored low on complexity analysis in 3 sessions — Day 5-6 focus on that"

- [x] **39.7** Component tests for planner page (form, plan display, progress tracking)

### Acceptance Criteria

- [x] Users can generate a personalized prep plan from company + role + date
- [x] Plan shows day-by-day schedule with topics and session types
- [x] Days can be marked complete, progress tracked
- [x] Weak areas from past sessions influence the plan
- [x] All endpoints have integration tests (25 tests)
- [x] DB migration committed

---

## Story 40: Company-Specific Question Bank

> **Motivation:** "What does Google actually ask in behavioral interviews?" Users want targeted practice, not generic questions. When a user enters a company name, the AI generates likely questions based on that company's known interview style, values, and focus areas. This fills the behavioral setup right column with high-value content.

### Tasks

- [x] **40.1** Create `POST /api/questions/generate` endpoint:
  - Input: `{ company: string, role?: string, count?: number }`
  - Uses GPT to generate 8-10 likely behavioral questions for that company
  - Each question tagged with category (leadership, conflict, teamwork, etc.)
  - Returns: `{ company, questions: [{ question, category, tip }] }`
  - Write integration test

- [x] **40.2** Create `lib/company-questions.ts` — prompt builder:
  - Builds a GPT prompt that asks for company-specific questions
  - Includes company values/culture hints when known (e.g., "Amazon = Leadership Principles")
  - Pure function, unit testable
  - Write unit tests (with/without role, different companies)

- [x] **40.3** Add company question preview to the behavioral setup page:
  - After user types a company name, show a "Generate likely questions" button
  - Displays the generated questions in the right column (below Interview Settings)
  - User can select questions to add to "Expected Questions" list with one click
  - Loading state while generating

- [x] **40.4** Cache generated questions:
  - Store in `company_questions` table: `id`, `user_id`, `company`, `role`, `questions` (JSONB), `created_at`
  - Return cached version if same company+role was generated in the last 7 days
  - Generate DB migration
  - Write integration test for caching behavior

- [x] **40.5** Component tests for the question preview widget

### Acceptance Criteria

- [x] Entering a company name shows a "Generate questions" button
- [x] Generated questions are company-specific and tagged by category
- [x] Questions can be added to expected questions with one click
- [x] Results cached for 7 days per company+role
- [x] All endpoints have integration tests (10 tests)

---

## Story 41: Session Comparison & Progress Tracking

> **Motivation:** Users practice multiple sessions but have no way to see if they're improving. A progress dashboard showing score trends over time, weak area identification, and side-by-side session comparison gives users confidence that practice is working — or alerts them to areas that need more focus.

### Tasks

- [x] **41.1** Create `GET /api/users/progress` endpoint:
  - Returns: score trend (array of `{ date, score, type }` for last 30 sessions), average by type, weak areas (topics that consistently score below 6)
  - Query from `session_feedback` + `interview_sessions`
  - Write integration test

- [x] **41.2** Create a score trend chart component:
  - Line chart showing overall score over time
  - Color-coded by session type (behavioral vs technical)
  - Use a lightweight charting library (e.g., `recharts` — small, React-native)
  - Shows improvement trajectory

- [x] **41.3** Create a weak areas summary component:
  - Identifies recurring themes from feedback weaknesses across sessions
  - Groups by frequency: "Quantifying impact (mentioned in 5/8 sessions)"
  - Suggests which session type to practice next
  - Links to relevant coaching page section

- [x] **41.4** Add a "Progress" tab or section to the dashboard:
  - Score trend chart
  - Weak areas summary
  - "Sessions this month" vs "last month" comparison
  - Visible improvement metrics: "Your average score improved by +1.2 this week"

- [x] **41.5** Session comparison view:
  - `app/dashboard/compare/page.tsx`
  - User selects two sessions from a dropdown
  - Side-by-side display: scores, strengths, weaknesses, answer breakdowns
  - Highlights what improved and what regressed between the two

- [x] **41.6** Component tests for chart, weak areas, and comparison view

### Acceptance Criteria

- [x] Dashboard shows score trend chart with clear improvement trajectory
- [x] Weak areas identified from recurring feedback patterns
- [x] Two sessions can be compared side-by-side
- [x] Progress metrics show week-over-week improvement
- [x] All endpoints have integration tests (6 tests)

---

## Story 42: Resume-Tailored Question Generation

> **Motivation:** Generic behavioral questions like "Tell me about a time you led a team" are useful, but questions tailored to YOUR resume are transformative. "Tell me about the migration project you led at Acme Corp that reduced latency by 40%" forces you to practice with questions you'll actually face. This is the highest-differentiation feature.

### Tasks

- [x] **42.1** Create `POST /api/resume/upload` endpoint:
  - Accepts PDF or plain text resume
  - Extracts text content (use `pdf-parse` for PDF)
  - Stores extracted text in `user_resumes` table: `id`, `user_id`, `filename`, `content` (text), `created_at`
  - Max file size: 5MB
  - Generate DB migration
  - Write integration test

- [x] **42.2** Create `POST /api/resume/questions` endpoint:
  - Input: `{ resume_id, company?: string, role?: string, question_type: "behavioral"|"technical" }`
  - Sends resume text + optional company/role to GPT
  - GPT generates 8-10 questions specifically referencing the user's experience
  - Behavioral: "You mentioned leading a team of 5 at Company X — how did you handle disagreements?"
  - Technical: "Your resume mentions experience with distributed systems — design a message queue for..."
  - Returns: `{ questions: [{ question, resume_reference, category }] }`
  - Write integration test

- [x] **42.3** Create `lib/resume-prompt-builder.ts` — pure function:
  - Builds GPT prompt that references specific resume entries
  - Different prompts for behavioral vs technical
  - Instructs GPT to reference specific projects, metrics, and technologies from the resume
  - Write unit tests (8+ cases: with/without company, behavioral/technical, different resume content)

- [x] **42.4** Create `app/resume/page.tsx` — resume management page:
  - Upload area (drag-and-drop or file picker)
  - Shows uploaded resume with parsed preview
  - "Generate Questions" button with type selector (behavioral/technical)
  - Displays generated questions
  - "Practice with these questions" button → pre-fills behavioral setup with questions
  - Add "Resume" to sidebar navigation

- [x] **42.5** Wire resume questions into the behavioral setup flow:
  - If user has a resume uploaded, show a "Use resume-tailored questions" toggle
  - When enabled, auto-generate and pre-fill expected questions from the resume
  - Combine with company-specific questions (Story 40) for maximum relevance

- [x] **42.6** Component tests for resume page (upload, preview, question display)

### Acceptance Criteria

- [x] Users can upload a PDF or text resume (PDF via GPT extraction)
- [x] Resume text is extracted and stored
- [x] Generated questions reference specific projects and metrics from the resume
- [x] Questions can be used directly in behavioral interview setup (→ Story 45)
- [x] Works for both behavioral and technical question types
- [x] All endpoints have integration tests (21 tests)
- [x] DB migration committed
