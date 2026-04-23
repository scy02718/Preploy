---
name: design-tokens-audit
description: Scan changed UI files for hardcoded brand colors, non-semantic tokens, off-brand fonts, or motion without prefers-reduced-motion guards — violations of Preploy's editorial coaching studio design system. TRIGGER when the diff touches apps/web/app/, apps/web/components/, apps/web/app/globals.css, or tailwind config. DO NOT TRIGGER for backend-only changes, schema changes, or test-only diffs.
---

# Design Tokens Audit

Preploy has a locked design system: Fraunces + Instrument Sans + Geist Mono on warm-paper / ink-navy / cedar tokens, with motion-safe-only animations. All primitives live as CSS custom properties in `apps/web/app/globals.css`. This skill is the deterministic half of the design-reviewer workflow — it surfaces violations as fast greps so judgment-heavy review can focus on the smell test, not pattern-matching.

## When to use

- Before opening a PR that touches UI.
- As input to the `design-reviewer` subagent (it depends on this skill).
- On demand when the user asks "is this PR clean against our design tokens?"

## How to run

First, identify changed UI files (each grep its own Bash tool call):

```bash
git fetch origin main
git diff origin/main...HEAD --name-only -- 'apps/web/app/**' 'apps/web/components/**' 'apps/web/app/globals.css' 'apps/web/tailwind.config.*'
```

For each file in the result, run each audit rule below as a separate Bash call.

## Audit rules — each rule = one grep + one severity + one suggested fix

### Rule 1 — Hardcoded brand colors (BLOCK)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '(text|bg|border|fill|stroke|ring|outline)-(red|green|blue|yellow|orange|emerald|rose|sky|amber|violet|fuchsia|lime|teal|cyan|indigo)-[0-9]{2,3}'
```

Fix: replace with semantic token (`text-primary`, `text-destructive`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`) or chart token (`text-[var(--chart-1)]`).

### Rule 2 — Raw hex / rgb / hsl literals (BLOCK)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|oklch\('
```

Note: `oklch` is allowed only in `globals.css` where the token table lives — flag it anywhere else.

Fix: replace with the CSS custom property token from `globals.css`.

### Rule 3 — Off-brand font references (REQUEST CHANGES)

```bash
git diff origin/main...HEAD -- <file> | grep -nE 'Inter|Plus Jakarta|Space Grotesk|Roboto(\s|,|;|\b)|Helvetica|Arial|sans-serif'
```

Fix: use `font-sans` (→ Instrument Sans), `font-display` (→ Fraunces, h1/hero only), or `font-mono` (→ Geist Mono).

### Rule 4 — Fraunces in dense UI (REQUEST CHANGES)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '(font-display|--font-display).*\b(Card|Sheet|Dialog|Alert|Button|Tab|Badge)' || \
git diff origin/main...HEAD -- <file> | grep -nE '(CardTitle|SheetTitle|DialogTitle|AlertTitle).*font-display'
```

Fix: Fraunces is reserved for `h1`, hero headlines, and score numerals only. Use `font-sans` for component titles. `--font-heading` is mapped to `--font-sans` for exactly this reason.

### Rule 5 — Motion without `prefers-reduced-motion` guard (REQUEST CHANGES)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '(transition-|animate-|duration-[0-9])' | grep -v 'motion-safe:'
```

Fix: prefix with `motion-safe:`. For durations, prefer `[var(--duration-base)]` / `[var(--duration-fast)]` / `[var(--duration-slow)]` over arbitrary ms numbers. `globals.css` has a safety net that caps durations to 0.01ms under `prefers-reduced-motion`, but that is not licence to skip the prefix.

### Rule 6 — Pure-black shadows on warm bg (NIT)

```bash
git diff origin/main...HEAD -- <file> | grep -nE 'shadow-black|shadow-\[.*#000|box-shadow:.*rgb\(0,\s*0,\s*0'
```

Fix: use the warm-tinted shadow scale defined in `globals.css` (`--shadow-xs` through `--shadow-xl`). Pure-black shadows on a warm background read cheap.

### Rule 7 — Layout convention drift (NIT)

Check changed `page.tsx` files for missing `max-w-6xl`:

```bash
git diff origin/main...HEAD --name-only -- 'apps/web/app/**/page.tsx' | while read f; do \
  grep -L 'max-w-6xl' "$f" 2>/dev/null && echo "MISSING max-w-6xl: $f"; \
done
```

Fix: top-level page containers should use `max-w-6xl mx-auto`. Two-column layouts should use `md:grid-cols-2`.

## Output format

Print a per-file table:

```
apps/web/app/foo/page.tsx
  Rule 1 (hardcoded colors):  3 violations  [BLOCK]
    L42:  text-red-600
    L58:  bg-emerald-50
    L91:  text-blue-500 → suggest: text-primary
  Rule 5 (motion safety):     1 violation   [REQUEST CHANGES]
    L120: animate-pulse → suggest: motion-safe:animate-pulse

apps/web/components/bar/Card.tsx
  No violations.
```

End with a one-line summary:

```
Audited <n> files — <a> BLOCK, <b> REQUEST CHANGES, <c> NIT.
```

## Rules

- Read-only — never edit files. Just report.
- Skip files not in the trigger scope; report `N/A — no UI changes` for the whole audit.
- When a violation appears inside a `+ ` line (new code), it is a real finding. When it appears on a ` ` (context) or `- ` (removed) line, skip it — do not flag code being deleted.
