---
description: Run `graphify update .` to refresh the knowledge graph and summarize what changed (god nodes, communities, edge count).
---

You are refreshing the graphify knowledge graph at `graphify-out/` so future sessions read the current code.

## Step 1 — Sanity check

Run:

```bash
ls graphify-out/graph.json
```

If the file is missing, refuse and tell the user: "graphify has never been initialized in this repo. Run `graphify init .` first, then re-run this command."

Run (informational — shows what working-tree state the refresh will capture):

```bash
git status --porcelain | head -20
```

Print the output so the user knows whether the graph will reflect committed or uncommitted changes.

## Step 2 — Capture pre-state

Read `graphify-out/GRAPH_REPORT.md` lines 1–20 (Corpus Check, Summary, and the first few God Nodes). Record:

- File count
- Word count
- Node count
- Edge count
- Community count
- Top 5 god nodes by edge count (name + edge count)

## Step 3 — Refresh

```bash
graphify update .
```

This is AST-only and incurs no API cost. Wait for the command to complete before reading the report.

If the command fails (e.g. the graphify CLI is not installed or not on `$PATH`), report the full error output and stop. Do not attempt to install graphify.

## Step 4 — Capture post-state

Re-read `graphify-out/GRAPH_REPORT.md` lines 1–20 and record the same fields as Step 2.

## Step 5 — Diff and report

Print exactly this format (fill in real values):

```
Graph refreshed
  Files:           <before> → <after>  (Δ <±n>)
  Nodes:           <before> → <after>  (Δ <±n>)
  Edges:           <before> → <after>  (Δ <±n>)
  Communities:     <before> → <after>

  New god nodes:   <list any that newly appear in the top-10, or "none">
  Dropped god nodes: <list any that fell out of the top-10, or "none">

Recommendation: <one sentence — e.g. "no significant structural change" or "POST() climbed to 60 edges; consider splitting that route">
```

## Rules

- Never modify any file under `graphify-out/` manually — only `graphify update .` may write there.
- If `graphify update .` fails, report the error and stop. Do not attempt to install graphify or work around the failure.
