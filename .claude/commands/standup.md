---
description: Run the full autonomous loop — PM proposes, Tech Lead plans, Dev implements, QA tests, Reviewer drafts a PR. You only approve/reject between roles.
---

You are running the autonomous development loop for the Preploy monorepo.
The user wants to sit at the top of this loop and only say yes/no between
roles. **Never** skip a gate. **Never** proceed without explicit approval.

There are 5 roles, each implemented as a subagent in `.claude/agents/`:

| # | Role           | Subagent              | Output                                  |
|---|----------------|-----------------------|-----------------------------------------|
| 1 | Product Manager| `pm-proposer`         | 1–3 proposed stories with acceptance criteria |
| 2 | Tech Lead      | `tech-lead-planner`   | Step-by-step implementation plan        |
| 3 | Developer      | `feature-implementer` | Code + tests on a feature branch        |
| 4 | QA Tester      | `qa-tester`           | Test report (lint/typecheck/unit/integration/UI) |
| 5 | Code Reviewer  | `pr-reviewer`         | Diff review + draft PR description      |

## The loop

### Gate 1 — Product Manager

Launch the `pm-proposer` subagent. Pass it the user's high-level intent (or
"propose the next 1–3 stories from the backlog" if no intent was given).

When it reports back, present its proposed stories to the user in a compact
format:

```
Proposed stories:
  1. <title> — <one-line summary>
  2. <title> — <one-line summary>
  3. <title> — <one-line summary>

Reply with the number(s) you want to proceed with, or "no" to stop.
```

**Stop and wait for the user.** Do not call the next subagent until the user
picks at least one story.

### Gate 2 — Tech Lead

For each approved story, launch the `tech-lead-planner` subagent. Pass it the
story text. When it reports back, present the plan to the user:

```
Implementation plan for <story title>:
  Files to create:    <list>
  Files to modify:    <list>
  Schema changes:     <yes/no — details if yes>
  Tests to write:     <unit / component / integration counts>
  Estimated risk:     <low/medium/high — why>

Reply "yes" to proceed, "revise" with feedback, or "no" to skip.
```

**Stop and wait.** If the user says "revise," re-launch the planner with their
feedback. If "yes," continue.

### Gate 3 — Developer (no gate, runs to completion)

Launch the `feature-implementer` subagent with the approved plan. Let it run
to completion. It will write code, write tests, and make the implementation
follow the per-app `CLAUDE.md` rules.

**No user gate here** — the developer runs autonomously until done. The next
gate (QA) is what catches mistakes.

### Gate 4 — QA Tester (automated gate, not a user gate)

Launch the `qa-tester` subagent. It will:

1. Run `/precommit` (lint + typecheck + unit + integration tests)
2. If the change touches the UI, start the dev server and use the
   `webapp-testing` skill to click through the affected pages
3. Report a structured pass/fail summary

If QA reports **any** failure, do NOT advance to the reviewer. Instead, hand
the failure report back to `feature-implementer` for a fix-up pass and re-run
QA. Loop at most 3 times. After 3 failed QA passes, stop and surface the
problem to the user.

### Gate 5 — Code Reviewer

Once QA passes, launch the `pr-reviewer` subagent. It will read the diff
against `main`, check it against the per-app `CLAUDE.md` rules, and draft a PR
title + body.

Present the draft to the user:

```
Ready to open PR:
  Title:  <pr title>
  Body:
    <pr body preview>

Reply "open" to create the PR, "revise" with feedback, or "hold" to stop here.
```

**Stop and wait.** Only call `mcp__github__create_pull_request` if the user
says "open." Never push to `main` directly. Never force-push.

## Hard rules

- **Never** skip a gate.
- **Never** mark a story complete unless the QA gate passed.
- **Never** open a PR without explicit user approval.
- **Never** modify files outside the scope of the approved plan without
  pausing to ask the user.
- If any subagent reports it cannot complete its task, stop the loop and
  report to the user — do not try to "route around" the failure.
