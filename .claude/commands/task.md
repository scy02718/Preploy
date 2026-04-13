---
description: Pick up a task from Tasks.md, plan it, implement it, test it, and mark it complete.
argument-hint: <story-or-task-id>
---

You are working on task **$ARGUMENTS** from `Tasks.md`.

## Step 1 — Read the task

1. Open `Tasks.md` and find the entry for `$ARGUMENTS`.
2. Read the full story description, acceptance criteria, and any sub-tasks.
3. Open `Backlog.md` and check whether this story has historical context there.
4. If `$ARGUMENTS` is empty or ambiguous, list the next 3 unstarted tasks from
   `Tasks.md` and ask the user which one to pick up.

## Step 2 — Plan

Summarize back to the user, in under 200 words:

- What the story asks for
- The files you expect to create or modify
- Which tests you will write (unit, component, integration)
- Any database schema changes (if so, the migration plan)
- Any open questions or assumptions

**Stop and wait for the user to approve the plan** before writing any code.

## Step 3 — Implement

Once approved, hand the work off to the `feature-implementer` subagent. Pass it
the story text and your approved plan.

## Step 4 — Test

After the implementer reports done, run `/precommit`. Do not declare the task
finished until every check passes.

## Step 5 — Mark complete

1. Update `Tasks.md` to mark `$ARGUMENTS` as complete (follow the existing
   format used by adjacent tasks — usually `[x]` checkboxes or a status field).
2. Stage the changes with `git add` (specific files only — never `git add -A`).
3. Suggest a Conventional Commits message in the form
   `feat: <story summary> (Story $ARGUMENTS)`.
4. **Do not** commit or push unless the user explicitly says so.
