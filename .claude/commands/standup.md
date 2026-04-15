---
description: Run the full autonomous loop — PM proposes, Tech Lead plans, Dev implements, QA tests, Reviewer drafts a PR. You only approve/reject between roles.
---

You are running the autonomous development loop for the Preploy monorepo.
The user sits at the top of this loop. When a story is well-defined and
low-risk, auto-advance through every gate — including opening the PR.
Stop and ask only when something is ambiguous, risky, or when an automated
check returns a judgment the user should see.

## Auto-advance policy

All gates are **soft gates**. Auto-advance when the per-gate criteria below
are met; stop and ask when any criterion fails.

Announce every auto-advance in one line (e.g. `Auto-advancing: plan is
low-risk and maps 1:1 to the story's "prove it works" scenarios`) so the
user can interrupt if they disagree.

There are 5 roles, each implemented as a subagent in `.claude/agents/`:

| # | Role           | Subagent              | Output                                  |
|---|----------------|-----------------------|-----------------------------------------|
| 1 | Product Manager| `pm-proposer`         | 1–3 proposed stories with acceptance criteria |
| 2 | Tech Lead      | `tech-lead-planner`   | Step-by-step implementation plan        |
| 3 | Developer      | `feature-implementer` | Code + tests on a feature branch        |
| 4 | QA Tester      | `qa-tester`           | Test report (lint/typecheck/unit/integration/UI) |
| 5 | Code Reviewer  | `pr-reviewer`         | Diff review + draft PR description      |

## The loop

### Gate 1 — Product Manager (soft gate)

Launch the `pm-proposer` subagent. Pass it the user's high-level intent (or
"propose the next 1–3 stories from the backlog" if no intent was given).

**Auto-advance** when ALL of the following hold:
- The user's initial intent named a specific story, issue number, or
  unambiguous scope (e.g. "do issue #42", "implement the timer story").
- The PM returns exactly one story that matches that intent.
- The story has concrete acceptance criteria and a "How we'll prove it
  works" section.

In that case, announce the pick in one line and proceed to Gate 2 without
asking.

**Stop and ask** when any of the following hold:
- The user's intent was open-ended ("what's next?", "propose something",
  no intent given).
- The PM returned multiple stories and it is not obvious which to pick.
- Acceptance criteria are vague, missing, or conflict with the user's intent.

In that case, present:

```
Proposed stories:
  1. <title> — <one-line summary>
  2. <title> — <one-line summary>
  3. <title> — <one-line summary>

Reply with the number(s) you want to proceed with, or "no" to stop.
```

Wait for the user before continuing.

### Gate 2 — Tech Lead (soft gate)

For each approved story, launch the `tech-lead-planner` subagent. Pass it the
**full** story text — including the "How we'll prove it works" section from
the PM's proposal. The planner is required to map each scenario to a specific
test in the plan.

**Auto-advance** when ALL of the following hold:
- Estimated risk is **low**.
- No schema changes, OR schema changes are additive (new table / new
  nullable column) and stay within the approved story scope.
- Every scenario in "How we'll prove it works" is mapped to a specific test
  in the plan.
- Files to modify are confined to the packages the story names; no stray
  edits to shared infra, CI config, auth, or billing code.
- The plan does not introduce new external dependencies.

In that case, print a one-line summary (`Auto-advancing plan: low risk, N
tests mapped, no schema changes`) and proceed to Gate 3.

**Stop and ask** when any of the above is false, when risk is medium/high,
or when the plan touches anything listed in the "always-ask" set above:

```
Implementation plan for <story title>:
  Files to create:    <list>
  Files to modify:    <list>
  Schema changes:     <yes/no — details if yes>
  Tests to write:     <unit / component / integration counts>
  Estimated risk:     <low/medium/high — why>
  Why I'm asking:     <which auto-advance criterion failed>

Reply "yes" to proceed, "revise" with feedback, or "no" to skip.
```

If the user says "revise," re-launch the planner with their feedback.

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

### Gate 5 — Code Reviewer (soft gate)

Once QA passes, launch the `pr-reviewer` subagent. It reads the diff against
`main`, checks it against the per-app `CLAUDE.md` rules, and returns a
verdict: `APPROVE`, `REQUEST CHANGES`, or `BLOCK`, plus a drafted PR title
and body.

**Auto-advance** when the verdict is `APPROVE`:

1. Push the current feature branch to `origin` if it is not already pushed
   (or is behind its upstream).
2. Call `mcp__github__create_pull_request` with the drafted title and body,
   base `main`, head = current branch.
3. Print a one-line summary to the user: `Opened PR #<n>: <title> → <url>`.

Never push to `main` directly. Never force-push. Never merge the PR — the
user still reviews and merges it themselves.

**Stop and ask** when the verdict is `REQUEST CHANGES` or `BLOCK`:

```
Reviewer verdict: <REQUEST CHANGES | BLOCK> on <story title>

Issues found:
  - <severity>: <file:line> — <issue>
  - ...

Draft PR (not yet opened):
  Title:  <pr title>
  Body:
    <pr body preview>

Options:
  1. "fix" — send the issues back to the implementer as a fix-list (one pass)
  2. "open anyway" — open the PR as-is (you'll address the issues in the PR)
  3. "hold" — stop here, do not open a PR
```

Wait for the user. On `fix`, re-launch the `feature-implementer` with the
reviewer's issues as its task (same pattern as the QA fix-up loop, **max 1
attempt**), then re-run QA end-to-end and re-run the reviewer. On `open
anyway`, proceed with the auto-advance steps above. On `hold`, stop.

## Hard rules

- All gates may auto-advance when their criteria are met; when in doubt,
  stop and ask. Always announce auto-advances in one line so the user can
  interrupt.
- **Never** open a PR unless the reviewer verdict is `APPROVE` **or** the
  user explicitly said `open anyway` after seeing the reviewer's issues.
- **Never** mark a story complete unless the QA gate passed.
- **Never** merge the PR. Opening is fine; merging is always the user's call.
- **Never** push to `main` directly. **Never** force-push.
- **Never** modify files outside the scope of the approved plan without
  pausing to ask the user.
- If any subagent reports it cannot complete its task, stop the loop and
  report to the user — do not try to "route around" the failure.
