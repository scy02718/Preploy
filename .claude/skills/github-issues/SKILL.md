---
name: github-issues
description: Create GitHub issues (including hierarchical parent / sub-issue trees) from a free-form task description. Use this skill whenever the user asks to "file an issue", "open a ticket", "break this down into issues", "create sub-issues", "turn this task into GitHub issues", or describes work that should be tracked in GitHub — even if they do not explicitly say the word "issue".
---

# github-issues

Turn a task description into one or more GitHub issues, with parent/child hierarchy where it makes sense.

## When to use

Trigger on any of:
- "file an issue for …" / "open a ticket for …"
- "break this down into issues" / "create sub-issues for …"
- "track this in GitHub" / "add this to the backlog"
- The user describes multi-step work and the repo tracks work in GitHub Issues.

Default target repo for this project: **`scy02718/preploy`** (confirm if unsure).

## Workflow

Follow these steps in order. Do not skip the confirmation step — issue creation is user-visible and hard to undo cleanly.

### 1. Understand the task

- Read the user's description carefully.
- If the task is large enough to have natural sub-tasks (≥2 clearly separable pieces of work), plan a **parent + children** hierarchy.
- If it is a single unit of work, plan **one flat issue**.
- Before writing anything, run `mcp__github__list_issues` (or `gh issue list`) to check for duplicates. Surface matches to the user rather than creating a redundant issue.

### 2. Draft the issues

For each issue, draft:
- **Title** — imperative, ≤70 chars (`Add X`, `Fix Y`, not `Adding X`).
- **Body** — include:
  - **Context** — why this matters (1–3 sentences).
  - **Acceptance criteria** — bullet checklist of observable outcomes.
  - **Notes / links** — related files, issues, or docs if known.
- **Labels** — only labels that already exist in the repo. Use `mcp__github__list_issues` output or `gh label list` to confirm before applying.

For a hierarchy, the parent issue body should contain a task-list of the children (GitHub auto-links them), e.g.:

```markdown
## Sub-tasks
- [ ] Child A
- [ ] Child B
```

Children should reference the parent in their body (`Part of #<parent>`).

### 3. Confirm with the user

Show the full plan (titles + bodies + labels + hierarchy) **before** creating anything. Wait for explicit approval. If the user edits, redraft and reconfirm.

### 4. Create the issues

Use the GitHub MCP tools in this order:

1. **Create the parent** with `mcp__github__issue_write` (`method: "create"`). Capture the returned `number` **and** `id` (the numeric node id, not the issue number).
2. **Create each child** the same way. Capture each child's `id`.
3. **Link children as sub-issues** with `mcp__github__sub_issue_write`:
   ```
   method: "add"
   owner, repo
   issue_number: <parent issue number>
   sub_issue_id: <child's id — NOT the child's issue number>
   ```

**Critical gotcha:** `sub_issue_write` requires the child's internal **id**, not its `number`. `issue_write` returns both in its response — read the `id` field from that response. If it is missing, fetch it with `mcp__github__issue_read` or `gh api repos/{owner}/{repo}/issues/{number} --jq .id`.

If `sub_issue_write` is unavailable or the repo does not support the sub-issues feature, fall back to:
- Putting a task list in the parent body (GitHub renders this as a tracked checklist).
- Adding `Part of #<parent>` in each child body.

### 5. Report back

After creation, print a compact summary with clickable URLs:

```
Parent:  #123 Add interview timer              → https://github.com/.../issues/123
  ├─ #124 Wire start/stop controls             → https://github.com/.../issues/124
  └─ #125 Persist elapsed time across reloads  → https://github.com/.../issues/125
```

## Style rules for issue bodies

- No fluff, no emojis unless the user uses them first.
- Acceptance criteria must be verifiable ("POST /foo returns 200 with `{id}`"), not aspirational ("works well").
- Reference code with `path/to/file.ts:42` when pointing at specific lines.
- Do **not** paste long code dumps into issue bodies — link to files instead.

## Duplicate & scope guards

- Always search before creating. A matching open issue > a new one.
- If the user's request actually belongs in `Tasks.md` (small, internal, non-tracked work), say so and ask which they want.
- Never create issues in a repo other than the one the user named or the project default without explicit confirmation.

## Example

User: *"We need to add a timer to the interview screen — start, stop, and it should survive a reload."*

Plan to confirm:
- **Parent:** `Add interview timer to interview screen`
  - Context: Users currently have no visible indicator of elapsed interview time.
  - Acceptance criteria: timer visible on `/interview/[id]`; child issues closed.
  - Sub-tasks: #child1, #child2
- **Child 1:** `Wire timer start/stop controls` — AC: start/stop buttons drive a `useTimer` hook; unit tests cover transitions.
- **Child 2:** `Persist timer state across reloads` — AC: elapsed time stored in DB or localStorage; reload within same session resumes within 1s accuracy.

After approval: create parent → create children → link via `sub_issue_write` → print summary.
