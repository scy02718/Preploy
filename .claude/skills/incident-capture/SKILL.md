---
name: incident-capture
description: When the user describes a recurring failure mode ("we got burned by X", "this bit us again", "let's not repeat this"), produce the 3-part incident artifact — CLAUDE.md addition, subagent-enforceable guard, optional GitHub issue. TRIGGER proactively whenever the user describes a past or recurring incident worth codifying. DO NOT TRIGGER for hypothetical or one-off failures.
---

# Incident Capture

Preploy's CLAUDE.md is dense with hard-won lessons: "PRs #36 and #51 burned us on drizzle journal staging", "PRs #52 and #53 burned us on top-level SDK init". Those lessons each took an outage to learn. This skill turns the ritual of capturing them into a structured 3-part artifact, so the lesson lands in CLAUDE.md, in the enforcing subagent, and optionally in GitHub — all in one pass, not scattered across three different ad-hoc edits.

## When to use

- User says "we got burned by …", "this bit us again", "let's not repeat this", "we should remember to …".
- User describes a near-miss they want to harden against.
- During a postmortem or after a CI failure that revealed a missing guard.

## What you produce — three artifacts, in order

### Artifact 1 — CLAUDE.md addition

Identify the right CLAUDE.md by scope:
- **Root `CLAUDE.md`** — monorepo-wide rules (migration staging, branch hygiene, PR verification).
- **`apps/web/CLAUDE.md`** — Next.js / API / SDK / test conventions.

Read the surrounding section of the target file so the new paragraph fits the structure — same heading level, same declarative voice, same "why / safe pattern" shape. Do not append to the end; find the semantically right home.

Template:

```markdown
### <rule title>

<One-sentence rule, declarative>. <One-sentence reason citing the incident
("This bit us in PR #<n>" if applicable)>.

Safe pattern:
```<lang>
<minimal example>
```
```

Keep it short. Three paragraphs max. Long incident docs rot; short rules survive.

### Artifact 2 — Subagent-enforceable guard

Identify which subagent should enforce the new rule, and draft the exact bullet/check in that file's existing voice:

| Rule type | Target file |
|-----------|-------------|
| Test coverage gaps | `.claude/agents/qa-tester.md` |
| Diff-readable conventions | `.claude/agents/pr-reviewer.md` (add to relevant checklist section) |
| UI/design conventions | `.claude/agents/design-reviewer.md` |
| LLM-call hygiene | `.claude/skills/openai-call-audit/SKILL.md` (add a new rule) |
| Schema/migration rules | `.claude/agents/pr-reviewer.md` → "Schema and migrations" section |

Show the user EXACTLY where to insert the new bullet:
- **File path** (absolute)
- **Section heading** it belongs under
- **Before/after which existing bullet** it should appear

### Artifact 3 — Optional GitHub issue

If the rule needs one-time code-level work (add a missing helper, refactor existing call sites to use a new wrapper, backfill missing tests), draft a GitHub issue body using the same format as the `github-issues` skill:

- **Title**: imperative, ≤70 chars.
- **Body**: Context (why), Acceptance criteria (verifiable bullets), Notes (related PRs/files).
- **Labels**: suggest from existing repo labels — typically `tech-debt` + `priority:medium` or `priority:high`.

If the rule is purely preventive (no existing code to fix), skip Artifact 3 and say so explicitly.

## Workflow

1. **Clarify if needed.** Ask the user up to three questions if any of these are unclear:
   - What was the failure / what went wrong?
   - What was the root cause (not the symptom)?
   - What pattern should future code follow instead?

2. **Read before writing.** Read the relevant CLAUDE.md section AND the target subagent file. Match their voice exactly — declarative sentences, no fluff, real examples over abstract descriptions.

3. **Produce all three drafted artifacts in a single message.** Show full text for each, clearly labeled Artifact 1 / 2 / 3.

4. **Wait for approval.** Say: "Reply 'apply' to write these changes." Do not write to any file before the user confirms.

5. **On apply:** Write each artifact as a separate Edit/Write/Bash call so the user can see each step. File the GitHub issue last (if applicable).

## Rules

- Never write to CLAUDE.md or any subagent file without explicit approval at step 4.
- Never invent an incident — if the user is hypothesizing rather than recounting a real failure, ask them to clarify before producing artifacts.
- Keep the CLAUDE.md addition SHORT. Three paragraphs max.
- Cite the PR / issue number when known. Anonymous lessons are forgotten faster.
- When filing a GitHub issue (Artifact 3), check for duplicates with `gh issue list --repo scy02718/preploy --state open --search "<keywords>"` before creating.
