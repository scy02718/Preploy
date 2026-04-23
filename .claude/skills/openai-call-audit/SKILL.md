---
name: openai-call-audit
description: Verify new OpenAI API calls use withOpenAIRetry (retry on transient errors), checkOpenAICap (per-user cost ceiling), createRequestLogger (cost tracking), and lazy-init the SDK client (no module-load instantiation). TRIGGER when the diff touches apps/web/lib/ or apps/web/app/api/ files that import openai or call OpenAI APIs. DO NOT TRIGGER for non-LLM code, frontend changes, or schema changes.
---

# OpenAI Call Audit

Preploy already has `withOpenAIRetry`, `checkOpenAICap`, and a lazy-init pattern for the OpenAI client. The recurring failure mode is that new code skips these helpers — directly calling `openai.chat.completions.create` with no retry, no cap, no log line, or instantiating the client at module load (which crashes `next build`'s page-data collection phase per PRs #52/#53). This skill is the deterministic check: run it before every PR that adds or touches an OpenAI call site.

## When to use

- Before opening a PR that adds or modifies an OpenAI call site.
- As a pre-flight check inside `feature-implementer` when the story touches LLM analysis.
- On demand when the user asks "are all our OpenAI calls wrapped?"

## How to run

Identify candidate files (each grep its own Bash tool call):

```bash
git fetch origin main
git diff origin/main...HEAD --name-only -- 'apps/web/lib/**' 'apps/web/app/api/**' | xargs -I{} grep -l 'openai\|OpenAI' {} 2>/dev/null
```

For each candidate file, run all six rules below.

## Audit rules

### Rule 1 — Lazy-init only (BLOCK)

The OpenAI client must be instantiated INSIDE a function (route handler or factory), never at module top level.

```bash
git diff origin/main...HEAD -- <file> | grep -nE '^\+.*new OpenAI\('
```

For each match, read the surrounding context (5 lines before/after) to confirm whether the instantiation is at module scope or inside a function. Flag any top-level `const openai = new OpenAI(...)` as BLOCK. See `apps/web/CLAUDE.md` "SDK clients — lazy-init only" for the two safe patterns (inline handler or Proxy factory).

### Rule 2 — Every call wrapped in `withOpenAIRetry` (BLOCK)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '^\+.*openai\.(chat|completions|embeddings|images|audio)\.[a-z]+\.create\('
```

For each match, verify the call is inside a `withOpenAIRetry(...)` wrapper. If not, BLOCK.

### Rule 3 — Per-user cost cap before each call (REQUEST CHANGES)

```bash
git diff origin/main...HEAD -- <file> | grep -nE '^\+.*await checkOpenAICap\('
```

For each new OpenAI call site found by Rule 2, verify there is a preceding `await checkOpenAICap(session.user.id, ...)` in the same function scope. If missing, REQUEST CHANGES.

### Rule 4 — Logger present (REQUEST CHANGES)

For each candidate file, verify `createRequestLogger` or `logger` is imported AND a log line wraps the OpenAI call (info before, error in the catch). Silent OpenAI calls become invisible cost overruns.

```bash
git diff origin/main...HEAD -- <file> | grep -nE 'createRequestLogger|from "@/lib/logger"'
```

If neither import is present in the new diff AND the file is making a new OpenAI call, REQUEST CHANGES.

### Rule 5 — No `console.log` in API routes (REQUEST CHANGES)

```bash
git diff origin/main...HEAD -- 'apps/web/app/api/**' | grep -nE '^\+.*console\.(log|error|warn|info)'
```

Fix: replace with `log.info(...)` / `log.error(...)` from `createRequestLogger`. See `apps/web/CLAUDE.md` "Logging" section.

### Rule 6 — API key read from env, never hardcoded (BLOCK)

```bash
git diff origin/main...HEAD -- <file> | grep -nE 'apiKey:\s*"[^"]+"|api_key:\s*"[^"]+"|sk-[a-zA-Z0-9]{20,}'
```

Any hit is a leaked key. BLOCK immediately and tell the user to rotate the key before doing anything else.

## Output format

```
OpenAI call audit — <n> candidate files

apps/web/app/api/coaching/route.ts
  Rule 1 (lazy-init):       ✓
  Rule 2 (withOpenAIRetry): ✗ BLOCK   L88: openai.chat.completions.create not wrapped
  Rule 3 (checkOpenAICap):  ✗ REQUEST CHANGES   L86: missing await checkOpenAICap before call
  Rule 4 (logger):          ✓
  Rule 5 (no console.log):  ✓
  Rule 6 (no leaked keys):  ✓

apps/web/lib/analysis.ts
  Rule 1 (lazy-init):       ✓
  Rule 2 (withOpenAIRetry): ✓
  Rule 3 (checkOpenAICap):  ✓
  Rule 4 (logger):          ✓
  Rule 5 (no console.log):  N/A (not an api/ file)
  Rule 6 (no leaked keys):  ✓

Verdict: BLOCK — fix Rule 2 in apps/web/app/api/coaching/route.ts before merging.
```

## Rules

- Read-only.
- When uncertain whether a call is wrapped (e.g. the helper is extracted to a different file), follow the call chain via Read until you can decide. Do not guess.
- Only flag `+ ` lines (new code being added). Do not flag context lines or removed code.
