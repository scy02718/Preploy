#!/usr/bin/env bash
#
# Stop hook: runs after Claude finishes a turn.
# Re-prompts Claude if lint/typecheck/test fails on touched packages.
#
# Behavior:
#   - Detects whether the working tree has any modifications under
#     apps/web or packages/shared. Skips gracefully if not (read-only
#     turns should not pay the cost).
#   - Runs `npx turbo lint typecheck test` scoped via --filter to whichever
#     packages were touched.
#   - On failure, exits 2 with a stderr message — Claude Code surfaces this
#     back to the model, which will then fix and re-run.
#   - On success, exits 0 silently.
#
# This is the deterministic enforcement of the pre-commit checklist in
# CLAUDE.md. It does NOT run the integration suite (that requires Docker
# and is too slow for a per-turn hook). Run /precommit manually for that.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Skip if there are no source modifications.
changed=$(git status --porcelain | awk '{print $2}' | grep -E '^(apps/web|packages/shared)/' || true)
if [ -z "$changed" ]; then
  exit 0
fi

filters=()
if echo "$changed" | grep -q '^apps/web/'; then
  filters+=("--filter=@interview-assistant/web")
fi
if echo "$changed" | grep -q '^packages/shared/'; then
  filters+=("--filter=@interview-assistant/shared")
fi

# If turbo is not installed locally yet (fresh clone), skip silently.
if [ ! -x "node_modules/.bin/turbo" ] && [ ! -x "node_modules/.bin/npx" ]; then
  exit 0
fi

# Run the gate. Capture both stdout and stderr to the log file.
# Note: order matters — `>file 2>&1` redirects stdout to file then merges
# stderr into stdout. The reverse order (`2>&1 >file`) silently drops stderr.
if ! npx --no-install turbo lint typecheck test "${filters[@]}" >/tmp/precommit-gate.log 2>&1; then
  {
    echo "Stop-hook: pre-commit gate failed."
    echo "The lint/typecheck/test suite failed for the packages you touched:"
    echo "  ${filters[*]}"
    echo ""
    echo "Last 40 lines of output:"
    tail -n 40 /tmp/precommit-gate.log
    echo ""
    echo "Fix the underlying issue and re-run. Do not bypass with --no-verify."
  } >&2
  exit 2
fi

exit 0
