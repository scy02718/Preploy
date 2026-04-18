# Preploy design audit — 2026-04

## Executive summary

### Top 5 highest-impact issues

1. **[blocker] No font loading — Geist is declared but never loaded via `next/font/google`-compatible path; `globals.css` maps `--font-sans` to `var(--font-sans)`, which is a self-reference unless the CSS variable is populated by the layout.** The layout does inject `geistSans.variable` onto `<html>`, but the CSS variable chain is `--font-sans → var(--font-sans)` — a tautology unless shadcn resolves it through its own cascade. In practice the app renders in the system-ui / sans-serif fallback on cold loads before hydration, causing a flash of unstyled text. More critically, **Plus Jakarta Sans** (the target typeface for Part 2) is not loaded anywhere. (`apps/web/app/layout.tsx:10-13`, `apps/web/app/globals.css:10`)

2. **[blocker] Entire color palette is achromatic — zero hue on any token.** Both light and dark mode use only `oklch(L 0 0)` values (chroma = 0). `--primary` in light mode is near-black (`oklch(0.205 0 0)`). Chart tokens (`--chart-1` through `--chart-5`) are five shades of grey. There is no brand accent color anywhere in the token set. This is the single biggest "looks like a bare shadcn default" signal. (`apps/web/app/globals.css:51-118`)

3. **[should-fix] Sidebar `Recent Sessions` section has no loading skeleton.** The Sidebar fetches `/api/sessions` in a `useEffect` with no `isLoading` state and no skeleton branch. Sessions simply pop in after the fetch resolves, violating the mandatory skeleton rule documented in `apps/web/CLAUDE.md`. (`apps/web/components/shared/Sidebar.tsx:75-89`, `:140-163`)

4. **[should-fix] `SessionControls` mute button has no `aria-label` and is purely text-driven ("Mute" / "Unmute").** During an active interview the mic state is critical. If the button were ever changed to icon-only, it would become inaccessible. More immediately, there is no Lucide mic icon — mute state is communicated only by button label and destructive variant colour, with no icon reinforcement for colour-blind users. (`apps/web/components/interview/SessionControls.tsx:79-85`)

5. **[should-fix] Landing page `LandingSocialProof` section renders an empty `<section>` — no testimonials, no placeholder, just a bare element.** A labelled section with zero content creates an invisible landmark in the accessibility tree and a visual gap between Features and FAQ. (`apps/web/components/landing/LandingSocialProof.tsx:1-8`)

### Count by severity

- **Blockers**: 5
- **Should-fix**: 23
- **Nice-to-have**: 10

### Overall verdict

The app is functionally well-built — skeletons exist on most data-fetching widgets, Lucide icons are used consistently, form labels are properly associated, and the heading hierarchy is largely correct. The primary design debt falls into two categories: (1) the shadcn default theme was never customised — the palette is entirely grey, the font is Geist rather than a display-quality pairing, and there is no brand accent; (2) a handful of interactive widgets (Sidebar recent sessions, behavioral session transcript close button, Coaching Tip `*` bullet) use raw HTML elements instead of the established component system, which erodes consistency. Fixing the token layer (colour + typography) will have the highest visual return of any Part 2 work.

---

## Global (cross-page) findings

### Typography

Every page uses the Geist Sans / Geist Mono pair loaded in `apps/web/app/layout.tsx:10-13`. The CSS custom property is mapped as `--font-sans: var(--font-sans)` — a self-reference — which works only because Next.js injects the font variable directly onto the `<html>` element; but it means the CSS layer has no independent font declaration and any style reset that clears the `html` attribute will revert to system-ui. Body text size defaults to browser default (16px), which is acceptable, but there is no explicit `font-size` or `line-height` declaration in `globals.css:120-130` — only `@apply bg-background text-foreground`. The target typeface, Plus Jakarta Sans, is not present anywhere in the codebase.

### Color / theming

All semantic tokens in both light and dark mode use `oklch(L 0 H)` where chroma (`C`) is always `0`, making every token a shade of grey. The one exception is `--sidebar-primary` in dark mode (`oklch(0.488 0.243 264.376)` — a blue), which is used only for the sidebar active state and creates an inconsistency: the sidebar active indicator in dark mode is blue while every other interactive element is grey. Chart tokens are five monotone steps with no differentiation by hue, making multi-series charts indistinguishable for colour-blind users. (`apps/web/app/globals.css:51-118`)

### Icon family

Lucide is used consistently across all pages. Icon stroke weight is the Lucide default throughout. No emoji are used as icons — this is a global strength. One anomaly: the `Tip` component in `apps/web/app/coaching/behavioral/page.tsx:29-35` uses a raw `*` asterisk character as a bullet rather than a Lucide icon, which is inconsistent.

### Skeleton consistency

Skeletons are implemented well on: Dashboard stat tiles, Dashboard progress charts, Dashboard session list, Feedback page, Profile page, Planner plan list, Technical session problem panel, STAR story list. Missing entirely on: Sidebar `Recent Sessions` (`apps/web/components/shared/Sidebar.tsx:75-89`). The Planner archived section shows a skeleton only when `loading` is true — but if plans are already loaded and the user just expands the archived section, there is no per-expansion loading state (minor, not a regression).

### Dark-mode gaps

The achromatic palette means dark mode is technically present but visually flat. The coaching behavioral page's "Strong answer / Weak answer" worked example uses hardcoded colour classes: `border-green-600/30 bg-green-50/50` and `border-red-600/30 bg-red-50/50` — the light-mode `/50` suffix does not apply in dark mode, leaving these cards with near-invisible borders against the dark background. (`apps/web/app/coaching/behavioral/page.tsx:231-254`)

### Container width consistency

Most pages correctly use `max-w-6xl mx-auto` with `px-4`. The Dashboard uses `p-6` on the DashboardLayout content div without a `max-w-*` on `DashboardPage` itself — the `<div>` at line 198 has no width constraint, meaning on ultra-wide monitors the content expands edge-to-edge within the padded layout column. (`apps/web/app/dashboard/page.tsx:198`, `apps/web/app/dashboard/layout.tsx:11`)

### `prefers-reduced-motion`

The Coaching layout uses `motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150` — this is correct and motion-safe-gated. The FAQ accordion uses `transition-all duration-200` on the height without a `motion-safe:` prefix, meaning reduced-motion users still get the height animation. The session timer countdown transition and the VideoCallLayout pulse animation have no `motion-safe` guard. (`apps/web/components/landing/LandingFAQ.tsx:71`, `apps/web/app/interview/behavioral/session/page.tsx:199-209`)

---

## Per-page audits

### 1. Landing page (`apps/web/app/page.tsx`)

**Current state**: A static marketing page composed of seven section components: Hero, HowItWorks, Personas, Features, SocialProof, FAQ, Footer.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Performance | `LandingSocialProof` renders an empty `<section aria-label="Testimonials">` with zero content. Creates an invisible landmark region and a large whitespace gap. | `components/landing/LandingSocialProof.tsx:4` |
| 2 | should-fix | Typography | Hero `<h1>` is `text-4xl` (36px) on mobile — acceptable — but the `sm:text-5xl` breakpoint jumps with no intermediate `md:` step. On 768–1023px screens the hero feels undersized relative to the padding. | `components/landing/LandingHero.tsx:28` |
| 3 | should-fix | Animation | `handleScrollToHowItWorks` calls `scrollIntoView({ behavior: "smooth" })` with no `prefers-reduced-motion` check. Smooth scroll is a vestibular trigger. | `components/landing/LandingHero.tsx:10-15` |
| 4 | should-fix | Layout & responsive | Hero section uses `py-24` top/bottom padding but no `max-w-*` on the outer section — content is constrained only by the inner `max-w-2xl` div. On very wide viewports the section background extends edge-to-edge but the horizontal rule between it and HowItWorks is invisible (no border or background differentiation). | `components/landing/LandingHero.tsx:18` |
| 5 | should-fix | Style selection | `LandingHowItWorks` renders a step number circle (`h-7 w-7`) stacked below the icon circle (`h-14 w-14`) for each card. Two circles per step creates visual clutter and the number badge is redundant when steps are already ordered 1–3 horizontally. | `components/landing/LandingHowItWorks.tsx:37-39` |
| 6 | should-fix | Accessibility | FAQ `<button>` has no `aria-controls` pointing to the answer `<div>`, and the answer div has no `id` or `role="region"`. The accordion is not a proper ARIA disclosure pattern. | `components/landing/LandingFAQ.tsx:55-79` |
| 7 | nice-to-have | Typography & color | `LandingPersonas` section has `bg-muted/30` background and `LandingFAQ` also uses `bg-muted/30` — these two non-contiguous sections have the same treatment, making the page rhythm feel repetitive. | `components/landing/LandingPersonas.tsx:27`, `components/landing/LandingFAQ.tsx:90` |
| 8 | nice-to-have | Style selection | Hero CTA uses `min-w-48` on both buttons but no visual hierarchy differentiation beyond variant. The primary CTA (`Start a free mock interview`) and secondary CTA (`See pricing`) have equal visual weight at mobile widths when they stack vertically. | `components/landing/LandingHero.tsx:37-53` |

**Strengths**: Structured data / JSON-LD present. Open Graph tags complete. Static generation (`force-static`) correctly applied. Lucide icons throughout. `Image` component with `priority` on hero logo. Footer navigation semantically labelled.

---

### 2. Auth / sign-in (`apps/web/app/(auth)/login/page.tsx`)

**Current state**: Single-card page with a Google sign-in button. Minimal and intentional.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Accessibility | The sign-in `<Button>` is inside a `<form>` with a server action. There is no visible error state rendered if the OAuth flow fails or the server action throws — users get a full-page redirect error with no in-page feedback. | `app/(auth)/login/page.tsx:31-40` |
| 2 | should-fix | Style selection | The card is `max-w-sm` (384px) centred in a `min-h-[calc(100vh-3.5rem)]` container. On mobile (375px) the card takes the full width with only `px-4` from the outer div, meaning the card edge is flush with the screen — no horizontal breathing room. | `app/(auth)/login/page.tsx:22` |
| 3 | should-fix | Typography & color | `CardTitle` reads "Welcome Back" but first-time users are not returning. Copy should branch on context or use a neutral phrasing like "Sign in to Preploy". | `app/(auth)/login/page.tsx:25` |
| 4 | nice-to-have | Navigation | No "Back to home" link or logo visible. Users who land here directly and want to return to the marketing page must use browser back. | `app/(auth)/login/page.tsx:20-44` |

**Strengths**: Page is intentionally minimal — no unnecessary form fields, no password complexity. Server action pattern avoids client-side credential handling. Metadata correctly set with `index: true`.

---

### 3. Dashboard (`apps/web/app/dashboard/page.tsx` + `Sidebar.tsx` + `Header.tsx`)

**Current state**: A complex data-fetching page with stat tiles, streak card, badge grid, score trend chart, weak-areas list, session history list, and pagination. Left sidebar with nav and recent sessions.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Performance | Sidebar `Recent Sessions` section fetches `/api/sessions` with no loading state and no skeleton branch. Sessions pop in silently after fetch. Violates mandatory skeleton rule. | `components/shared/Sidebar.tsx:75-89`, `:140-163` |
| 2 | should-fix | Layout & responsive | `DashboardPage` root `<div>` at line 198 has no `max-w-*` constraint. Content inside the layout's `p-6` content area expands to full column width on wide screens (the layout column is `flex-1`, i.e. viewport minus the 256px sidebar). | `app/dashboard/page.tsx:198` |
| 3 | should-fix | Forms & feedback | The `<select>` filter elements (type and score filters) use raw `<select>` with manual `className` rather than the shadcn `<Select>` component, breaking visual consistency — they render with the OS-native dropdown appearance on some browsers. | `app/dashboard/page.tsx:418-437` |
| 4 | should-fix | Accessibility | The Sidebar mobile trigger (`SheetTrigger`) has no `aria-label`. The `Menu` icon inside has no accessible name — screen readers will announce it as an unlabelled button. | `components/shared/Header.tsx:46-52` |
| 5 | should-fix | Accessibility | The theme toggle button in `Header.tsx` has `aria-label="Toggle theme"` — good — but the `<Moon>` icon renders with `absolute` positioning, meaning both Sun and Moon icons are present in the DOM simultaneously. Screen readers may announce the hidden icon as well, depending on whether `scale-0` is treated as `display:none`. An explicit `aria-hidden` on the inactive icon would be safer. | `components/shared/Header.tsx:82-89` |
| 6 | should-fix | Navigation | `DropdownMenuItem` for Profile uses `window.location.assign("/profile")` rather than `<Link>` or `router.push`, which causes a full page reload and breaks Next.js prefetching. | `components/shared/Header.tsx:112` |
| 7 | should-fix | Empty/loading/error states | When `isStatsLoading` is false and `totalSessions === 0` but `onboardingDismissed` is true, the component falls through to `<DashboardStatTiles isLoading={false}>` showing zeroes — there is no intermediate "get started" nudge for a user who dismissed onboarding. | `app/dashboard/page.tsx:258-266` |
| 8 | nice-to-have | Typography | The month comparison banner (`|` pipe separator) is a raw character used as a visual divider. Using a `<Separator orientation="vertical">` or a styled divider element would be more accessible. | `app/dashboard/page.tsx:346` |

**Strengths**: Stat tiles, Streak/Badge row, Progress section, and session list all have well-shaped skeletons. Pagination has correct disabled states. Session rows have accessible `Link` wrappers. Score circles use semantic colour classes from `getScoreColor`. Empty state for filtered sessions provides filter-aware copy.

---

### 4. Planner (`apps/web/app/planner/page.tsx`)

**Current state**: A two-column layout — plan list on the left, day-by-day checklist on the right. Supports create, archive, delete, and per-day completion toggling.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Forms & feedback | `handleGenerate` has no error state rendered to the user. If the `/api/plans/generate` POST fails, the button just stops spinning silently — no error message is displayed. | `app/planner/page.tsx:185-211` |
| 2 | should-fix | Animation | The `max-h-[500px] overflow-y-auto` day list container clips content to 500px with no visual indicator (no fade gradient at the bottom) that more items exist below the fold. | `app/planner/page.tsx:512` |
| 3 | should-fix | Accessibility | The archived plans toggle `<button>` is a direct child of `<Card>` without going through `<CardHeader>` or `<CardContent>`, meaning it sits outside the card's padding context and renders flush against the card border. | `app/planner/page.tsx:422-435` |
| 4 | should-fix | Touch & interaction | The plan list item `<button>` (select plan) and the `<PlanCardMenu>` kebab button are side-by-side with no minimum height set. The select-plan button's `p-3` gives `~12px` top/bottom — below the 44px touch target minimum on mobile. | `app/planner/page.tsx:396-416` |
| 5 | should-fix | Forms & feedback | The Create Plan form has no client-side validation feedback — `required` attributes are present but browser-native validation UI is inconsistent across browsers and doesn't match the app's design system. No helper text explains the date format expected. | `app/planner/page.tsx:312-369` |
| 6 | nice-to-have | Style selection | `Label` in the Create Plan form uses `<Building2>` and `<Briefcase>` icons rendered inline with `className="h-4 w-4 inline mr-1"` — icons inside `<label>` text are read aloud by screen readers as their SVG title, causing "Building 2 Company" to be announced. | `app/planner/page.tsx:314-316` |

**Strengths**: `PlanSkeleton` correctly shaped. Optimistic update on day toggle with revert on failure. Archived plans hidden by default behind a disclosure. `aria-expanded` on the archive toggle button. Lucide icons for all day-type badges.

---

### 5. Behavioral setup (`apps/web/app/interview/behavioral/setup/page.tsx` + `BehavioralSetupForm.tsx`)

**Current state**: Two-column form with company details, expected questions, interview style/difficulty sliders, resume selector, and company-specific question generation.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Forms & feedback | The "Generate likely questions" button has no loading indicator beyond the text changing to "Generating..." — no `Loader2` spinner. Compare to the Planner which uses `<Loader2 className="animate-spin">`. Inconsistent loading treatment across the app. | `components/interview/BehavioralSetupForm.tsx:314-323` |
| 2 | should-fix | Forms & feedback | The question remove button (`×`) uses an HTML entity `&times;` as the button label rather than a Lucide `X` icon. This is inconsistent with the rest of the app which uses Lucide throughout. | `components/interview/BehavioralSetupForm.tsx:214-221` |
| 3 | should-fix | Accessibility | The `×` remove button for expected questions has `aria-label="Remove question ${i+1}"` — good — but the generated question `+` add button at line 349 has `aria-label="Add question ${i+1}"` with no reference to the question text, making it ambiguous for screen reader users when multiple questions are shown. | `components/interview/BehavioralSetupForm.tsx:346-351` |
| 4 | should-fix | Forms & feedback | Interview Style and Difficulty sliders show only left/right text extremes. There is no current value display — the user has no numeric feedback on where they set the slider. | `components/interview/BehavioralSetupForm.tsx:272-299` |
| 5 | nice-to-have | Layout & responsive | On mobile (< `md`), the two-column grid collapses to one column, meaning the "Company-Specific Questions" card appears last — after the Submit button. The card's primary CTA (Generate) is below the main form Submit, causing confusion about action order. | `components/interview/BehavioralSetupForm.tsx:160-374` |

**Strengths**: All form inputs have associated `<Label>` elements via `htmlFor`. Submit button shows loading state ("Creating Session..."). Error state rendered below form with correct destructive styling. Quota error triggers `UpgradePromptDialog`. Gaze opt-in correctly gated behind global preference.

---

### 6. Technical setup (`apps/web/app/interview/technical/setup/page.tsx` + `TechnicalSetupForm.tsx`)

**Current state**: Two-column form with interview type (radio cards), focus areas (checkbox grid), language selector, difficulty radio, resume selector, and additional instructions.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Accessibility | Radio card `<label>` elements use the CSS selector `has-[data-checked]:border-primary` to show selected state. This relies on a non-standard `data-checked` attribute that shadcn's `RadioGroupItem` may or may not emit consistently. If the attribute is absent, there is no visual indicator that a radio card is selected beyond the hidden RadioGroupItem indicator. A visible checked ring via `:has(input:checked)` would be more reliable. | `components/interview/TechnicalSetupForm.tsx:199-207` |
| 2 | should-fix | Forms & feedback | Focus area checkboxes use the same `has-[data-checked]:border-primary` pattern as the radio cards. No checkmark icon is visible on selected items beyond the shadcn `Checkbox` component rendered inside the label — the checkbox itself is small (16px) and the border colour change on the card is the primary selection affordance. | `components/interview/TechnicalSetupForm.tsx:220-234` |
| 3 | should-fix | Forms & feedback | The "Please select at least one focus area" validation error appears only after submit attempt, at the bottom of the form below the Submit button. This is far from the Focus Areas card where the error originates. No inline error appears adjacent to the card. | `components/interview/TechnicalSetupForm.tsx:148-151`, `:346-349` |
| 4 | nice-to-have | Typography | The `Additional Instructions` card's Textarea placeholder text is cut off on 375px mobile — the placeholder "Focus on Google-style problems, avoid recursion, emphasize graph algorithms..." is too long. | `components/interview/TechnicalSetupForm.tsx:329` |

**Strengths**: Submit button disabled when no focus areas selected or when Other is checked with no text — prevents invalid submits. `TemplateControls` integrated. Language selector uses shadcn `Select`. Clear left/right column organisation.

---

### 7. Active behavioral session (`apps/web/app/interview/behavioral/session/page.tsx`)

**Current state**: Full-screen video call layout with a 3D AI interviewer visualizer, live transcript overlay, and session controls in a bottom bar.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Accessibility | The transcript close button (`×`) is a raw `<button>` with label text `&times;` and no `aria-label`. | `app/interview/behavioral/session/page.tsx:233-238` |
| 2 | blocker | Animation | The session timer div and the gaze loading indicator both use `absolute` positioning without `motion-safe:` guards on their own transitions. The countdown timer's colour change at `isLastMinute` uses a CSS class swap — this is fine — but the `transition-transform` on the Sun/Moon icons in Header (included on this page) lacks a `motion-safe:` guard. | `app/interview/behavioral/session/page.tsx:199-215` |
| 3 | should-fix | Accessibility | The "Show Transcript" button has no `aria-expanded` or `aria-controls` state — it toggles a panel but doesn't communicate its expanded/collapsed state to assistive technologies. | `app/interview/behavioral/session/page.tsx:261-268` |
| 4 | should-fix | Touch & interaction | The "Show Transcript" button (`px-3 py-1.5`) produces a ~12px tall touch target — well below 44px. It is positioned at `bottom-16 right-4` on a touch screen where thumbs land in exactly that area. | `app/interview/behavioral/session/page.tsx:262-268` |
| 5 | should-fix | Style selection | Transcript speaker labels use hardcoded Tailwind colour classes `text-blue-600 dark:text-blue-400` (Interviewer) and `text-green-600 dark:text-green-400` (You) rather than semantic tokens. These colours have no relationship to the app's token system. | `app/interview/behavioral/session/page.tsx:244-250` |
| 6 | nice-to-have | Empty/loading/error states | There is no loading/connecting state displayed to the user while `voice.isConnected` is false at session start — the page renders with the VideoCallLayout immediately but the user has no feedback that the AI is initialising. `SessionControls` shows "Connecting..." as text, but this is in the bottom bar and may not be noticed. | `app/interview/behavioral/session/page.tsx:195-287` |

**Strengths**: Session auto-ends at max duration with countdown timer that turns destructive red in the last minute. Voice error is surfaced with a destructive banner. Gaze loading indicator shown during MediaPipe init. Page redirects to setup if no `sessionId`.

---

### 8. Active technical session (`apps/web/app/interview/technical/session/page.tsx`)

**Current state**: Split-panel layout with problem description on left, Monaco code editor on right. Audio recording for transcription. Problem regeneration up to 5 times.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Empty/loading/error states | When `isProcessing` is true (end session flow), the page shows a processing step string (`processingStep`) but the `TechnicalSessionLayout` implementation was not read in full — it likely renders this string somewhere, but the processing overlay/modal does not appear to have a cancel path if it stalls. | `app/interview/technical/session/page.tsx:149-234` |
| 2 | should-fix | Touch & interaction | The regenerate button is a raw `<button>` with `text-xs` (12px) and `py-0` — a very small touch target in the bottom of the problem panel. It is the primary escape hatch if a user gets a bad question. | `app/interview/technical/session/page.tsx:292-303` |
| 3 | should-fix | Accessibility | The regenerate button uses a `↻` Unicode character as a prefix instead of a Lucide `RefreshCw` icon. | `app/interview/technical/session/page.tsx:298` |
| 4 | should-fix | Empty/loading/error states | The `problemError` state renders a short message with a suggestion to "end the session and start a new one" but provides no retry button that would re-call `/api/problems/generate` without ending the session. A user with a network blip cannot recover without starting over. | `app/interview/technical/session/page.tsx:277-284` |
| 5 | nice-to-have | Performance | Problem panel skeleton uses inline `style={{ width: '${95 - i * 10}%' }}` — this is a minor CLS-safe pattern but uses an inline style rather than Tailwind class, inconsistent with the rest of the skeleton system. | `app/interview/technical/session/page.tsx:258-263` |

**Strengths**: Problem panel skeleton is well-shaped and matches post-load layout. Error state present (even if recovery UX is limited). Regeneration counter gives clear feedback (`3/5 left`). `useCodeSnapshots` handles snapshot logic separately from UI concerns.

---

### 9. Feedback / results (`apps/web/app/dashboard/sessions/[id]/feedback/page.tsx` + `FeedbackDashboard.tsx`)

**Current state**: Polling page that waits for AI feedback generation (up to 2 minutes), then renders a dashboard with score card, strengths/weaknesses, per-answer breakdown, and optional code quality / gaze cards.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Empty/loading/error states | The loading state uses `animate-pulse` on the final `<p>Generating feedback...</p>` — this makes the text pulse, which is unconventional. The pulse should be on skeleton shapes, not readable text. | `app/dashboard/sessions/[id]/feedback/page.tsx:195-197` |
| 2 | should-fix | Empty/loading/error states | The error retry uses `window.location.reload()` — this re-triggers the full page load rather than simply re-running the polling effect. Any state (e.g. scroll position) is lost. A state reset + `poll()` re-invocation would be sufficient. | `app/dashboard/sessions/[id]/feedback/page.tsx:206-214` |
| 3 | should-fix | Accessibility | The error state "Retry" link is a `<button>` styled with `text-sm text-primary underline` — looks like a link but is semantically a button. This passes accessibility but creates an inconsistency: the app uses `<Link>` for navigation and `<Button>` for actions. Here, `<Button variant="link">` would be correct. | `app/dashboard/sessions/[id]/feedback/page.tsx:204-214` |
| 4 | should-fix | Navigation | The feedback page has no breadcrumb or back-link to the Dashboard from within `FeedbackDashboard`. The "Back to Dashboard" button is at the very bottom of the page (`FeedbackDashboard.tsx:177-179`), below the full per-answer breakdown. On long technical sessions with many questions, the back button is effectively invisible. | `components/feedback/FeedbackDashboard.tsx:173-179` |
| 5 | nice-to-have | Animation | The loading skeleton for the gaze card (`feedback/page.tsx:168-179`) is always rendered during loading, even for sessions where gaze tracking was not active. After load, the gaze card only renders when `gazeCoverage != null`. The skeleton shape therefore doesn't always match post-load content. | `app/dashboard/sessions/[id]/feedback/page.tsx:168-179` |

**Strengths**: Skeleton is detailed and well-shaped. Polling implements a max-attempt cap with a user-facing error. React 19 batched state update for `sessionType` + `feedback` avoids flicker. Dynamic import of `@react-pdf/renderer` defers 500KB bundle. Loading state includes a visible progress text.

---

### 10. Coaching hub (`apps/web/app/coaching/`)

**Current state**: Layout with tab navigation (Hiring Overview, Behavioral, Technical, Communication). Content pages are static article-style pages with section cards, no data fetching.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Style selection | `Tip` component in `coaching/behavioral/page.tsx` uses a raw `*` asterisk as a bullet icon instead of a Lucide icon (e.g. `Lightbulb`, `Info`, or `AlertCircle`). Inconsistent with the rest of the app. | `app/coaching/behavioral/page.tsx:29-35` |
| 2 | should-fix | Typography & color | The "Strong answer / Weak answer" worked example uses hardcoded light-mode colours (`bg-green-50/50`, `bg-red-50/50`) that are near-invisible in dark mode. | `app/coaching/behavioral/page.tsx:231-254` |
| 3 | should-fix | Animation | The coaching layout applies `motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150` on the content div. This is correct. However the `animate-in` class from `tw-animate-css` produces a fade-in from `opacity-0` — any keyboard user tabbing directly to page content will experience a brief invisibility period on each tab change. | `app/coaching/layout.tsx:15-17` |
| 4 | should-fix | Navigation | The coaching `CoachingHubNav` desktop tab bar uses `-mb-px border-b-2` to create an underline tab effect. The active tab has `bg-accent` background fill AND a `border-primary` bottom border — two active indicators. The background fill creates a visual inconsistency with the surrounding `border-b` container line. | `components/coaching/CoachingHubNav.tsx:38-46` |
| 5 | nice-to-have | Layout & responsive | Coaching sub-pages lack a `max-w-*` within the coaching content div — the layout sets `max-w-6xl` but long blocks of article text (e.g. `HiringOverviewPage`) would benefit from a narrower reading column (`max-w-3xl`) for readability. | `app/coaching/layout.tsx:9`, `app/coaching/hiring-overview/page.tsx:67-136` |

**Strengths**: `motion-safe:` properly applied on page transitions. Tab navigation has accessible `aria-label="Coaching hub navigation"`. Mobile dropdown fallback correctly implemented. Static pages have no skeleton requirement. CTAs at the bottom of each coaching page link to relevant practice flows.

---

### 11. STAR practice (`apps/web/app/star/page.tsx`)

**Current state**: Two-column layout — story list on the left, form/detail view on the right. Supports CRUD, AI analysis, PDF export, and one-click practice session launch.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | blocker | Forms & feedback | `handleDelete` uses `confirm()` — a browser native dialog that is blocked in some embedded contexts (iframes, certain browsers) and has no accessible focus management. Should be replaced with a shadcn `AlertDialog`. | `app/star/page.tsx:321-330` |
| 2 | blocker | Forms & feedback | `handleAnalyze` and `handleExportAll` use `alert()` for error feedback — browser-native alerts that cannot be styled and are inaccessible in some contexts. | `app/star/page.tsx:344-352`, `:375-428` |
| 3 | should-fix | Empty/loading/error states | `fetchDetail` has no error state — if the fetch for a story's detail fails, `selectedDetail` remains null and the right column shows the empty-state card rather than an error message. | `app/star/page.tsx:221-234` |
| 4 | should-fix | Touch & interaction | Story list items in the left panel are `<button>` elements with `p-3` padding — this gives approximately `12px` touch target height, below the 44px minimum on mobile. | `app/star/page.tsx:517-541` |
| 5 | should-fix | Style selection | The page `<h1>` includes `<Star className="h-6 w-6" />` as an inline sibling of the title text. The Star icon here is decorative — it should have `aria-hidden="true"`. | `app/star/page.tsx:462-465` |
| 6 | should-fix | Forms & feedback | `AnalysisCard` expand/collapse toggle button has no `aria-expanded` state and no `aria-controls` pointing to the expandable content. | `app/star/page.tsx:113-118` |
| 7 | should-fix | Accessibility | The `X` button to close the form (`setShowForm(false)`) at line 554 has no `aria-label`. Screen readers will announce it as an unlabelled button. | `app/star/page.tsx:554-556` |
| 8 | nice-to-have | Layout & responsive | The `StorySkeleton` shows 3 generic full-width divs of `h-20`. The real story list items have a company name, role, and date — three lines of text at different sizes. The skeleton height of `h-20` matches but the internal structure doesn't mirror the content shape. | `app/star/page.tsx:80-88` |

**Strengths**: `StorySkeleton` used correctly. Planner hint banner correctly uses dark-mode variants (`dark:border-blue-800 dark:bg-blue-950/30`). PDF export button uses `aria-label`. `Loader2` spinner on export. Story detail correctly shows analysis history. Practice button pre-fills behavioral setup via `prefillStore`.

---

### 12. Profile / settings (`apps/web/app/profile/page.tsx`)

**Current state**: Two-column layout with profile info, gaze preferences, plan/billing cards, template manager, preferences, and account deletion.

**Issues**:

| # | Severity | Dimension | Finding | File:line |
|---|---|---|---|---|
| 1 | should-fix | Empty/loading/error states | The toast message (`message` state) auto-dismisses after 3 seconds with no animation — it simply vanishes. A fade-out or slide-out transition would prevent the jarring disappearance. | `app/profile/page.tsx:93-96` |
| 2 | should-fix | Forms & feedback | The billing upgrade buttons show the full price string inline: `$${PLAN_DEFINITIONS.pro.annualMonthlyEquivalentUsd}/month billed annually ($${PLAN_DEFINITIONS.pro.annualTotalUsd}/year)` — this is a very long button label that wraps awkwardly on small screens. | `app/profile/page.tsx:457-461` |
| 3 | should-fix | Accessibility | The delete confirmation `<Input>` at line 503 requires typing the exact string "DELETE my account and all my data". The required exact match is explained in the `<Label>` but the `placeholder` text is the full string — this is helpful — but the input has no `autoComplete="off"` which means autofill could accidentally fill it with a saved value. | `app/profile/page.tsx:503-510` |
| 4 | should-fix | Accessibility | `CardTitle` for the delete card is `text-destructive` (`className="text-destructive"`). The destructive red colour may fail contrast against the white card background in light mode (approximately 3:1 WCAG AA for normal text — below the 4.5:1 requirement for text under 18pt). Needs verification. | `app/profile/page.tsx:487` |
| 5 | should-fix | Navigation | The Preferences card has `className="hidden md:block"` — it is entirely hidden on mobile. The "Take the tour again" button is therefore inaccessible on small screens. | `app/profile/page.tsx:468` |
| 6 | nice-to-have | Forms & feedback | The billing section for free users shows two upgrade buttons (monthly + annual) with `className="w-full"` stacked. The visual hierarchy between the two options is unclear — both are equal width and similar styling. Making the annual option visually distinct (e.g. a "Best value" badge) would help conversion. | `app/profile/page.tsx:440-462` |

**Strengths**: Skeleton exactly mirrors the post-load two-column layout (noted in code comment at line 194-196). `Switch` component used for gaze toggle with correct `htmlFor` association. Delete confirmation requires typed string — strong guard against accidental deletion. `signOut` called after successful delete. Billing buttons have `data-testid` attributes.

---

## Recommended design-system spec (drives Part 2)

### Typography

- **Primary typeface**: Plus Jakarta Sans — load via `next/font/google` with `subsets: ["latin"]`, `variable: "--font-display"`, weights `[400, 500, 600, 700]`. Use for all headings (`h1`–`h4`) and body text.
- **Monospace**: Geist Mono — keep for code editor, transcript, timer, and numeric score displays.
- **Scale**: Body 16px / `leading-relaxed` (1.625). Display headings: `text-3xl` (30px) for page titles, `text-2xl` (24px) for section headings, `text-lg` (18px) for card titles.
- **Replace**: Remove Geist Sans from `layout.tsx`; replace `--font-sans` binding with Plus Jakarta Sans.

### Color tokens (light mode — proposed)

Replace the achromatic defaults with a green-accent palette suited to the job-search / progress domain:

```css
/* Brand accent — emerald green */
--accent-brand: oklch(0.62 0.17 155);          /* #22c55e equivalent */
--accent-brand-foreground: oklch(0.985 0 0);

/* Primary — keep near-black for high contrast */
--primary: oklch(0.20 0 0);
--primary-foreground: oklch(0.985 0 0);

/* Muted — very light grey tint */
--muted: oklch(0.97 0.005 240);
--muted-foreground: oklch(0.50 0.01 240);

/* Background — slight warm tint to avoid pure clinical white */
--background: oklch(0.99 0.002 90);
--foreground: oklch(0.14 0 0);

/* Card — slightly elevated from background */
--card: oklch(1 0 0);
--card-foreground: oklch(0.14 0 0);

/* Destructive — keep red */
--destructive: oklch(0.577 0.245 27.325);

/* Score chart tokens — replace grey steps with meaningful hues */
--chart-1: oklch(0.62 0.17 155);   /* green  — high score */
--chart-2: oklch(0.72 0.15 85);    /* yellow — mid score */
--chart-3: oklch(0.65 0.20 25);    /* orange — low-mid */
--chart-4: oklch(0.57 0.24 27);    /* red    — low score */
--chart-5: oklch(0.50 0.10 265);   /* blue   — neutral/info */
```

### Color tokens (dark mode — proposed)

```css
--background: oklch(0.13 0.005 265);       /* Deep navy-black */
--foreground: oklch(0.95 0 0);
--card: oklch(0.18 0.007 265);             /* Slightly elevated card */
--primary: oklch(0.92 0 0);
--accent: oklch(0.22 0.007 265);

/* Sidebar — keep the existing blue accent in dark mode, it's the only hue */
--sidebar-primary: oklch(0.55 0.20 155);  /* Switch to brand green */
```

### Shadow / elevation scale

```css
--shadow-sm:  0 1px 2px oklch(0 0 0 / 6%);
--shadow-md:  0 4px 12px oklch(0 0 0 / 10%);
--shadow-lg:  0 8px 24px oklch(0 0 0 / 14%);
--shadow-xl:  0 16px 40px oklch(0 0 0 / 18%);
```

Apply `shadow-sm` to cards in light mode (currently zero elevation). Active session controls bar: `shadow-lg`. Dropdown menus: `shadow-md`.

### Motion primitives

- **Enter**: `opacity-0 → opacity-100` + `translateY(4px) → translateY(0)`, `duration-150`, `ease-out`
- **Exit**: reverse, `duration-100`, `ease-in`
- **Skeleton pulse**: keep `animate-pulse` (already using it correctly)
- **Accordion height**: `max-height` transition — add `motion-safe:` prefix globally
- **Page transitions**: keep existing `motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150` in coaching layout; extend to all `(dashboard)` layout and interview setup pages

All transition utilities should be wrapped in `motion-safe:` where they are purely aesthetic. Functional transitions (e.g. error banner appearance) may remain without the guard.

### Icon library

Lucide — keep. Standardise stroke weight: current Lucide default (`strokeWidth={2}`) is acceptable; do not mix in any `strokeWidth={1.5}` variants.

**Fix globally**: Replace all raw HTML entities (`×`, `↻`, `*`) used as icons with the corresponding Lucide equivalents: `X`, `RefreshCw`, `Lightbulb`/`Info`.

### Anti-patterns to fix globally

1. Raw `<select>` elements — replace with shadcn `<Select>` (Dashboard filters)
2. `alert()` / `confirm()` — replace with shadcn `AlertDialog` and `useToast`/`Sonner` (STAR page)
3. `window.location.assign()` inside event handlers — replace with `router.push()` or `<Link>` (Header dropdown, billing buttons)
4. Hardcoded colour classes `text-blue-600`, `bg-green-50/50`, `text-green-600` — replace with semantic tokens
5. Icons inside `<label>` text without `aria-hidden` — add `aria-hidden="true"` to decorative inline icons (Planner form labels, STAR page h1)
6. Missing `aria-expanded` / `aria-controls` on toggle buttons (Show Transcript, AnalysisCard, FAQ items)

---

## Prioritized Part 2 backlog

Grouped by theme, ordered by impact × effort ratio:

### Theme A — Token layer (highest leverage, do first)

1. Load Plus Jakarta Sans via `next/font/google`, replace `--font-sans` in `layout.tsx`
2. Introduce brand accent green into `globals.css` token set
3. Replace chart tokens with hued steps (enables meaningful score visualisation)
4. Add light elevation to cards (`shadow-sm` in light mode)
5. Fix `--sidebar-primary` in dark mode to use brand green instead of blue

### Theme B — Global icon / element hygiene

6. Replace `&times;` → `<X>` in `BehavioralSetupForm.tsx:215` and behavioral session `page.tsx:234`
7. Replace `↻` → `<RefreshCw>` in technical session `page.tsx:298`
8. Replace `*` → `<Lightbulb>` (or `<Info>`) in coaching `behavioral/page.tsx:30`
9. Add `aria-hidden="true"` to decorative inline icons (Planner labels, STAR h1)
10. Replace raw `<select>` filters in Dashboard with shadcn `<Select>`

### Theme C — Skeleton system completion

11. Add loading skeleton to Sidebar `Recent Sessions` section
12. Conditionally render gaze skeleton in Feedback only for gaze-enabled sessions

### Theme D — Accessibility blockers

13. Wrap `confirm()` / `alert()` in STAR page with shadcn `AlertDialog` + `useToast`
14. Add `aria-expanded` + `aria-controls` to FAQ accordion items
15. Add `aria-expanded` + `aria-controls` to "Show Transcript" button in behavioral session
16. Add `aria-expanded` to `AnalysisCard` toggle in STAR page
17. Add `aria-label` to STAR form close button (`X`)
18. Verify destructive `CardTitle` colour contrast on Profile page; adjust if < 4.5:1

### Theme E — Motion / reduced-motion audit

19. Add `motion-safe:` prefix to FAQ `transition-all` accordion
20. Add `motion-safe:` to behavioral session timer colour transition
21. Fix `handleScrollToHowItWorks` to respect `prefers-reduced-motion`

### Theme F — Navigation and routing fixes

22. Replace `window.location.assign("/profile")` in Header dropdown with `router.push`
23. Add "Back to Dashboard" sticky header or breadcrumb to Feedback page (visible without scrolling)
24. Add a "Back to home" link on the login page

### Theme G — Empty & error states

25. Add error state to Planner `handleGenerate` (currently silent on failure)
26. Add retry button to technical session `problemError` state
27. Replace `animate-pulse` on `<p>Generating feedback...</p>` with a spinner icon
28. Fix Feedback error retry to reset state rather than `window.location.reload()`

### Theme H — Forms polish

29. Display current value on Behavioral Setup sliders (Interview Style, Difficulty)
30. Add `autoComplete="off"` to delete-account confirmation input on Profile
31. Improve mobile layout of billing upgrade buttons (annual "Best value" badge)
32. Add fade-out animation to Profile toast dismissal
