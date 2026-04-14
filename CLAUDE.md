# Instructions for Claude — Preploy monorepo

## Monorepo layout

```
apps/
  web/      Next.js 16 (App Router) + Drizzle ORM + Vitest        → see apps/web/CLAUDE.md
  api/      FastAPI Python service (GPT analysis)                  → see apps/api/CLAUDE.md
packages/
  shared/   Shared TypeScript types and constants
```

When working inside `apps/web` or `apps/api`, the per-app `CLAUDE.md` is the
source of truth — read it first.

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
npx turbo lint typecheck test           # ESLint + ruff + tsc + unit/component tests
cd apps/web && npm run test:integration # Real Postgres integration tests
```

If any of these fail, fix the issue before committing — CI will reject the push.
The Stop hook in `.claude/settings.json` runs the first command automatically
when Claude finishes a turn that touched source files; you should still run the
integration suite manually before pushing.

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
- Never use `console.log` in server-side code (Next.js API routes or FastAPI
  endpoints). See per-app CLAUDE.md for the structured logger pattern.
- Never commit secrets or files containing them (`.env`, `credentials.json`).
