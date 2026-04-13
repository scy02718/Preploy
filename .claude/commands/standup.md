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
**full** story text — including the "How we'll prove it works" section from
the PM's proposal. The planner is required to map each scenario to a specific
test in the plan. When it reports back, present the plan to the user:

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

Launch the `feature-implementer` subagent with:

1. The approved plan from the Tech Lead (including the story-trace mapping
   of scenarios → tests).
2. The original story from the PM (including "How we'll prove it works").
3. An explicit reminder: "Every scenario in 'How we'll prove it works' must
   end up as a real assertion in a real test file. QA will cross-reference."

Let it run to completion. It will write code, write tests, and make the
implementation follow the per-app `CLAUDE.md` rules.

**No user gate here** — the developer runs autonomously until done. The next
gate (QA) is what catches mistakes.

### Gate 4 — QA Tester (automated gate, not a user gate)

Launch the `qa-tester` subagent. It will:

1. Run lint, typecheck, unit, component, and integration tests
2. If the change touches the UI, start the dev server and use the
   `webapp-testing` skill to click through the affected pages
3. Verify test coverage exists and is meaningful (not empty or skipped)
4. Cross-reference the story's "How we'll prove it works" scenarios against
   the tests added
5. Report a structured pass/fail summary with a fix-list on failure

#### QA → Developer fix-up loop

If QA reports **any** failure, do NOT advance to the reviewer. Instead:

1. Take the QA report's `Fix-list` section verbatim.
2. Re-launch the `feature-implementer` subagent with **just the fix-list**
   as its task (not the original story). Tell it: "QA found these issues.
   Fix only these. Do not make unrelated changes."
3. Once the implementer reports done, re-launch `qa-tester` (a fresh run,
   not a delta — the gauntlet always runs end-to-end).
4. Loop at most **3 times**.

After 3 failed QA passes, stop the loop and present a structured handoff to
the user:

```
QA loop exhausted (3/3 attempts) on story: <title>

What we tried:
  Attempt 1: <one-line fix summary> → failed on <step>
  Attempt 2: <one-line fix summary> → failed on <step>
  Attempt 3: <one-line fix summary> → failed on <step>

QA's hypothesis on the root blocker:
  <copy "Why this is stuck" paragraph from the last QA report>

Recommended next steps:
  - <option 1, e.g., "revise the plan with tech-lead-planner">
  - <option 2, e.g., "split the story into two smaller pieces">
  - <option 3, e.g., "investigate the schema mismatch manually">

Reply with the option number, "abort" to discard the branch, or free-form
guidance to retry.
```

This is the only place in the loop where a hard failure surfaces to the
user mid-story. Do not silently keep retrying.

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
