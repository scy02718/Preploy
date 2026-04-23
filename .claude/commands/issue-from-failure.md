---
description: Capture a recent failure (test, lint, build, deploy) into a GitHub issue with the failing command, last 40 log lines, hypothesis, and suggested labels.
---

You are filing a GitHub issue for a failure that the user wants to defer rather than fix immediately.

## Step 1 — Identify the failure

Ask the user: "Which failure are we capturing?" Offer these choices:

1. Most recent QA gauntlet failure (paste the QA report)
2. Most recent /precommit failure (paste the failing step)
3. CI failure on a PR (provide PR number; you'll fetch via `gh run view`)
4. Custom (user pastes the failing command + output)

Wait for the user to reply before proceeding.

## Step 2 — Capture the context

Run each of these in its own Bash tool call:

```bash
git rev-parse HEAD
```

```bash
git branch --show-current
```

```bash
git log -1 --pretty=%s
```

For option 3 (CI failure), also run:

```bash
gh run view <run-id> --log-failed | tail -60
```

Record the commit SHA, branch name, and latest commit subject from the results.

## Step 3 — Draft the issue

Use this exact template:

```markdown
## What failed
<one-sentence summary>

## Failing command
```bash
<command>
```

## Last ~40 lines of output
```
<log tail>
```

## Branch / commit
- Branch: `<branch>`
- Commit: `<sha>` ("<latest commit subject>")

## Hypothesis
<2–3 sentences on the likely root cause. If unsure, say so explicitly — better than a wrong guess.>

## Suggested next step
<one concrete action: "regenerate migration", "update snapshot", "investigate flaky mock", etc.>
```

Before inserting the log tail, scan for environment variable names matching `*_KEY`, `*_SECRET`, or `*_TOKEN` and replace any adjacent values with `***`.

## Step 4 — Suggest labels

Fetch the available labels:

```bash
gh label list --repo scy02718/preploy
```

Default suggestions based on severity:

- `priority:high` — failure blocks builds, deploys, or `main`
- `priority:medium` — failure blocks a feature branch
- `priority:low` — intermittent or flaky failure
- `correctness` — test assertion failures
- `ci` — CI infrastructure failures
- `flaky` — failures that pass on retry

Pick the appropriate subset and list them for the user.

## Step 5 — Show preview, ask approval

Print the full issue title, body, and suggested labels in a readable block. Then ask:

> Reply "file" to create the issue, or paste edits and say "file" when ready.

Wait for explicit approval before proceeding.

## Step 6 — File via gh

Once the user says "file":

```bash
gh issue create --repo scy02718/preploy --title "<title>" --label "<l1,l2>" --body "<body>"
```

Print the resulting issue URL so the user can bookmark it.

## Rules

- Never file the issue without explicit user approval at Step 5 — `gh issue create` is user-visible and not easily undone.
- Never edit or close existing issues from this command.
- Never include secrets in the log tail — scan for env var names (`*_KEY`, `*_SECRET`, `*_TOKEN`) and replace values with `***`.

Common failures and fixes:

- Label not found → run `gh label list --repo scy02718/preploy` and pick the closest match, or omit the `--label` flag and add labels manually on GitHub.
- Body contains single quotes that break the shell command → pass the body via a heredoc or a temp file to avoid quoting issues.
- `gh` not authenticated → run `gh auth status` and follow the login prompt.
