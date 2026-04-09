# Interview Assistant - Phase 1: Foundation & Technical Spikes

> **Timeline:** Week 1-2
> **Goal:** Scaffold the project, get auth working, build basic page structure, and prove out the three hardest technical risks — voice conversation, 3D avatar lip-sync, and code execution.

---

## Story 1: Project Scaffolding & Monorepo Setup

> Set up the Turborepo monorepo with Next.js frontend, Python FastAPI backend, shared packages, and all dev tooling so every subsequent story has a working foundation to build on.

### Tasks

- [x] **1.1** Initialize Turborepo monorepo at project root with `apps/` and `packages/` workspace structure
- [x] **1.2** Create Next.js 14+ app in `apps/web` with App Router, TypeScript, and `src/` disabled (use `app/` directly)
- [x] **1.3** Set up Python FastAPI project in `apps/api` with `pyproject.toml`, virtual environment, and basic `app/main.py` with health check endpoint
- [x] **1.4** Create `packages/shared` with TypeScript types (`types.ts`) and constants (`constants.ts`) — define the core enums and interfaces (InterviewType, SessionStatus, SessionConfig, etc.)
- [x] **1.5** Configure `turbo.json` with `dev`, `build`, `lint` pipelines so `turbo dev` starts both Next.js and FastAPI concurrently
- [x] **1.6** Create `.env.example` with all expected env vars (Supabase URL, OpenAI key, Deepgram key, Google OAuth credentials, Judge0 API URL)
- [x] **1.7** Set up `.gitignore`, initialize git repo, create initial commit
- [x] **1.8** Verify: `turbo dev` starts Next.js on `:3000` and FastAPI on `:8000`, both hot-reload on file changes

---

## Story 2: UI Foundation (Tailwind + shadcn/ui + Layout)

> Set up the design system and create the app shell (header, sidebar, page layout) so all future pages have consistent styling and navigation.

### Tasks

- [x] **2.1** Install and configure Tailwind CSS v4 in `apps/web`
- [x] **2.2** Initialize shadcn/ui with default theme, install base components: Button, Card, Input, Label, Slider, Select, Tabs, Badge, Separator
- [x] **2.3** Create root `app/layout.tsx` with HTML structure, font loading (Inter or Geist), dark mode support via `class` strategy, and global providers wrapper
- [x] **2.4** Create `components/shared/Header.tsx` — app logo/name, navigation links (Dashboard, Behavioral Interview, Technical Interview), user avatar dropdown (placeholder for now)
- [x] **2.5** Create `components/shared/Sidebar.tsx` — collapsible sidebar with nav items and session history quick-access (placeholder data)
- [x] **2.6** Create `app/page.tsx` — minimal landing page with two CTAs: "Start Behavioral Interview" and "Start Technical Interview", linking to their respective setup pages
- [x] **2.7** Create placeholder pages with basic headings for all routes: `interview/behavioral/setup`, `interview/behavioral/session`, `interview/technical/setup`, `interview/technical/session`, `(dashboard)/page`, `(dashboard)/sessions/[id]/feedback`
- [x] **2.8** Verify: all routes render with consistent layout, navigation works between pages, responsive on desktop

---

## Story 3: Database Schema & Drizzle ORM

> Connect to Supabase PostgreSQL, define all data models with Drizzle ORM, and run initial migrations so the app has persistent storage ready.

### Tasks

- [x] **3.1** Create Supabase project (manual step — document the setup instructions in README)
- [x] **3.2** Install `drizzle-orm`, `drizzle-kit`, and `postgres` (node-postgres driver) in `apps/web`
- [x] **3.3** Create `lib/db.ts` — Drizzle client initialized with Supabase connection string from env
- [x] **3.4** Define schema in `lib/schema.ts`:
  - `users` table: id (UUID, PK, default gen), email (unique), name, avatar_url, created_at, updated_at
  - `interview_sessions` table: id (UUID), user_id (FK), type (enum: behavioral/technical), status (enum: configuring/in_progress/completed/cancelled), config (JSONB), started_at, ended_at, duration_seconds, created_at
  - `transcripts` table: id (UUID), session_id (FK), entries (JSONB array)
  - `code_snapshots` table: id (UUID), session_id (FK), code (text), language, timestamp_ms (integer), event_type (enum: edit/run/submit), execution_result (JSONB)
  - `session_feedback` table: id (UUID), session_id (FK), overall_score (real), summary (text), strengths (JSONB), weaknesses (JSONB), answer_analyses (JSONB), code_quality_score (real, nullable), explanation_quality_score (real, nullable), timeline_analysis (JSONB, nullable), created_at
- [x] **3.5** Configure `drizzle.config.ts` pointing to Supabase, generate and run initial migration
- [x] **3.6** Create basic CRUD route handlers: `app/api/sessions/route.ts` (GET list, POST create) and `app/api/sessions/[id]/route.ts` (GET single, PATCH update)
- [x] **3.7** Verify: migrations apply cleanly to Supabase, can create and retrieve a session via API routes (test with curl or Postman)

---

## Story 4: Authentication (NextAuth + Google OAuth)

> Implement Google OAuth login so users have accounts, sessions are tied to users, and protected routes redirect to login.

### Tasks

- [x] **4.1** Install `next-auth@5` (Auth.js v5) and `@auth/drizzle-adapter`
- [x] **4.2** Create `lib/auth.ts` — NextAuth config with Google provider, Drizzle adapter connected to the users table, session strategy: JWT
- [x] **4.3** Create `app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all route handler
- [x] **4.4** Create `app/(auth)/login/page.tsx` — clean login page with Google sign-in button, app branding
- [x] **4.5** Add `SessionProvider` to root layout, create `useSession` usage in Header to show user name/avatar or "Sign In" link
- [x] **4.6** Add middleware (`middleware.ts`) to protect `/interview/*` and `/dashboard/*` routes — redirect to `/login` if unauthenticated
- [x] **4.7** Verify: Google OAuth flow works end-to-end — sign in → redirected to dashboard → user record created in Supabase → sign out works → protected routes redirect when logged out

---

## Story 5: Spike — OpenAI Realtime Voice Conversation

> Prove that we can have a real-time voice conversation with AI through the browser. This is the core technology for behavioral interviews.

### Tasks

- [x] **5.1** Create `app/api/realtime/token/route.ts` — backend endpoint that calls OpenAI's ephemeral token API and returns a short-lived session token (keeps API key server-side)
- [x] **5.2** Create `hooks/useRealtimeVoice.ts` — custom hook that:
  - Requests microphone access via `getUserMedia`
  - Fetches ephemeral token from `/api/realtime/token`
  - Opens WebSocket to `wss://api.openai.com/v1/realtime`
  - Sends `session.update` with a basic system prompt, voice selection, and turn detection config
  - Captures mic audio via Web Audio API (AudioWorklet), converts to PCM16 24kHz
  - Streams audio as `input_audio_buffer.append` events
  - Receives `response.audio.delta` events, decodes base64, queues for playback
  - Receives `response.audio_transcript.delta` for text transcripts of both speakers
  - Exposes state: `isConnected`, `isListening`, `isSpeaking`, `transcript[]`
  - Provides controls: `connect()`, `disconnect()`, `mute()`, `unmute()`
- [x] **5.3** Create `app/interview/behavioral/spike/page.tsx` — test page with:
  - Connect/Disconnect button
  - Mute/Unmute toggle
  - Visual indicator showing when AI is speaking vs listening
  - Live transcript display (scrolling text of both user and AI utterances)
  - Simple system prompt: "You are a friendly interviewer. Ask the user to tell you about themselves."
- [x] **5.4** Handle edge cases: mic permission denied (show message), WebSocket disconnect (auto-reconnect with backoff), browser tab unfocus (keep connection alive)
- [x] **5.5** Verify: can have a 2+ minute back-and-forth voice conversation with AI, transcript is captured accurately, latency feels natural (<1s response time)

---

## Story 6: Spike — 3D Avatar with Lip-Sync

> Prove that we can render a 3D avatar that moves its mouth in sync with audio output. This makes the behavioral interview feel like a real video call.

### Tasks

- [x] **6.1** Install `@react-three/fiber`, `@react-three/drei`, and `three` in `apps/web`
- [x] **6.2** Download/generate a Ready Player Me GLB avatar with viseme blend shapes (morph targets for `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`, `viseme_FF`, `viseme_TH`, `viseme_PP`, `viseme_SS`, `viseme_CH`, `viseme_nn`, `viseme_RR`, `viseme_DD`, `viseme_kk`, `viseme_sil`) — place in `public/avatars/`
- [x] **6.3** Create `components/avatar/AvatarCanvas.tsx` — React Three Fiber `<Canvas>` with camera, lighting (ambient + directional), and environment setup sized like a webcam feed (4:3 or 16:9 aspect)
- [x] **6.4** Create `components/avatar/AvatarModel.tsx` — loads GLB via `useGLTF`, renders the skinned mesh, exposes ref to morph target influences
- [x] **6.5** Create `hooks/useLipSync.ts` — takes an audio source (AudioBuffer or MediaStream), uses Web Audio `AnalyserNode` to extract frequency data, maps frequency bands to viseme weights, returns current viseme weights at 60fps
- [x] **6.6** Create `components/avatar/LipSyncController.tsx` — in `useFrame` loop, reads viseme weights from `useLipSync`, applies them to AvatarModel morph targets with lerp smoothing (interpolation factor ~0.5 for natural movement)
- [x] **6.7** Add idle animations: subtle breathing (chest scale oscillation), random blinking (eyelid morph targets on a timer), slight head sway
- [x] **6.8** Create `app/interview/behavioral/avatar-spike/page.tsx` — test page with:
  - 3D avatar rendered in a video-call-sized frame
  - "Play test audio" button that plays a sample speech clip and drives lip-sync
  - Visual confirmation that mouth shapes change with audio
- [x] **6.9** Verify: avatar renders at 60fps, lip-sync visually matches speech audio, idle animations look natural, no performance issues on a standard laptop

---

## Story 7: Spike — Monaco Code Editor

> Prove that we can provide a coding environment for technical interviews. Users write code and explain their thought process verbally — no code execution needed (Google-style interview). AI analyzes the code + transcript together post-session.

### Tasks

- [x] **7.1** Install `@monaco-editor/react` in `apps/web`
- [x] **7.2** Create `components/editor/CodeEditor.tsx` — Monaco editor wrapper with:
  - Language support (Python, JavaScript, Java, C++, Go)
  - Dark theme default
  - Sensible defaults: font size 14, minimap off, line numbers on, word wrap off
  - `onChange` callback exposing current code content
- [x] **7.3** Create `components/editor/EditorToolbar.tsx` — toolbar above editor with: language dropdown, "Reset" button
- [x] **7.4** Create `components/editor/ProblemDescription.tsx` — left panel with problem title, difficulty badge, examples, and constraints
- [x] **7.5** Create `app/interview/technical/spike/page.tsx` — test page with LeetCode-like layout:
  - Left panel: hardcoded "Two Sum" problem description
  - Right panel: Monaco code editor with language switching
  - Info bar reminding user to explain their approach verbally
- [x] **7.6** Verify: can write code in all supported languages, language switching works, editor renders properly

---

## Definition of Done — Phase 1

- [ ] Monorepo builds and runs with `turbo dev`
- [ ] All placeholder pages are routable and styled with consistent layout
- [ ] Database schema is deployed to Supabase with all tables
- [ ] Google OAuth login works end-to-end
- [ ] Voice spike: 2+ minute voice conversation with AI works in browser
- [ ] Avatar spike: 3D avatar renders with lip-sync driven by audio
- [ ] Editor spike: code can be written in Monaco with language switching
- [ ] All three spikes work independently on a standard laptop without performance issues
