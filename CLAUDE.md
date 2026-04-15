# Instructions for Claude — Preploy monorepo

## Monorepo layout

```
apps/
  web/      Next.js 16 (App Router) + Drizzle ORM + Vitest        → see apps/web/CLAUDE.md
packages/
  shared/   Shared TypeScript types and constants
```

When working inside `apps/web`, the per-app `CLAUDE.md` is the source of
truth — read it first.

## Workflow

When asked about a **task**, read `Tasks.md`, find the relevant story, and follow
its acceptance criteria. When the task is complete, update `Tasks.md` to mark
it done.

When asked about a **new feature idea** or tech debt, check open GitHub Issues
first (use the GitHub MCP or `gh issue list --repo scy02718/interview-assistant`)
to see whether it is already filed.

`Backlog.md` is archived at `dev_logs/Backlog-archive.md` — new tech debt and
deferred fixes should be filed as GitHub Issues, not appended to the archive.

After making code changes significant enough to be a unit of work, recommend a
commit message for those specific changes.

## Pre-commit checklist (mandatory)

Before marking any story or task complete, run **all** of:

```bash
npx turbo lint typecheck test           # ESLint + tsc + unit/component tests
cd apps/web && npm run test:integration # Real Postgres integration tests
cd apps/web && npm run test:e2e:smoke   # Playwright E2E smoke suite
```

If any of these fail, fix the issue before committing — CI will reject the push.
The Stop hook in `.claude/settings.json` runs the first command automatically
when Claude finishes a turn that touched source files; you should still run the
integration suite manually before pushing.

## E2E smoke tests

`apps/web/e2e/` contains Playwright smoke tests for golden paths (landing,
auth, dashboard, interview setup, profile).  These run against a production
build — NOT `next dev`.

- Extend only for **new top-level user flows** (golden paths).
- **Bug repros and edge cases** go in integration tests, not E2E.
- Tag every test with `@smoke` so CI selects it with `--grep @smoke`.
- Auth state is pre-minted by `e2e/global.setup.ts` and stored in
  `e2e/.auth/user.json` (gitignored).

See `apps/web/README.md` → "E2E tests" for local run instructions.

## Skills available in this repo

The skills below live in `.claude/skills/` and trigger automatically when
relevant. You don't need to invoke them by name.

- **`webapp-testing`** — Playwright browser testing. Use whenever you need to
  click through the running web app, verify rendered UI, or capture screenshots.
- **`claude-api`** — Anthropic SDK reference. Use only when a story explicitly
  asks to add or modify Claude API calls. The web app currently uses OpenAI;
  do not silently swap providers.
- **`skill-creator`** — Use only when the user asks to create or improve a
  project-specific skill.

## Subagents (the autonomous-loop roles)

The `.claude/agents/` directory holds specialized roles:

- `pm-proposer` — reads open GitHub Issues + `Tasks.md`, proposes the next stories
- `tech-lead-planner` — reads the codebase and drafts an implementation plan
- `feature-implementer` — writes the code + tests
- `qa-tester` — runs the test suites and uses `webapp-testing` to exercise the UI
- `pr-reviewer` — diffs against `main`, checks the rules in this file, drafts a PR

The `/standup` slash command runs them in sequence with approval gates between
each role.

### Orchestration rule — always use the subagent chain

When implementing features — whether via `/standup`, a single manual story, or
a parallel rollout wave — always delegate each gate to its subagent:
`feature-implementer` → `qa-tester` → `pr-reviewer`. **Do not run
lint/typecheck/test manually in the main conversation** even when it feels
faster, and even when parallelizing multiple branches. Why: the main context
stays clean, the gate stays consistent across stories, and `pr-reviewer`
cannot be accidentally skipped because you already "saw" the diff. Manual
orchestration must still follow the same sequence `/standup` enforces.

## Database schema changes

When modifying `apps/web/lib/schema.ts`, always use versioned migrations:

```bash
cd apps/web
npm run db:generate   # Generate SQL migration
# review the generated SQL in drizzle/
npm run db:migrate    # Apply locally
```

**Never** use `db:push` for committed work. Commit the generated SQL files in
`drizzle/` — they are the source of truth.

## Other repo-wide rules

- Conventional Commits style (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- Branch naming: `feature/{story-number}-{short-description}` for feature work.
- Never use `console.log` in server-side code (Next.js API routes). See the
  per-app CLAUDE.md for the structured logger pattern.
- Never commit secrets or files containing them (`.env`, `credentials.json`).

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
