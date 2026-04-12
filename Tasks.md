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
- [ ] Profile page with name editing, plan management, and account disable
- [ ] 3D avatar replaced with pulsing circle visualizer (no Three.js)
- [ ] All new features have unit tests, integration tests, and component tests
- [ ] CI pipeline passes all checks
