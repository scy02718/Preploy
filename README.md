# Interview Assistant

AI-powered mock interview practice with real-time feedback. Practice behavioral and technical interviews, get scored by AI, and track your improvement over time.

**Two interview modes:**
- **Behavioral** — Voice-to-voice mock interview with real-time AI conversation and STAR-method feedback
- **Technical** — Split-panel coding session with Monaco editor, problem generation, mic recording for verbal explanations, and code + speech analysis

## Project Structure

Turborepo monorepo with three workspaces:

```
apps/
  web/          Next.js 16 frontend + API routes (Drizzle ORM, Supabase Postgres)
  api/          FastAPI Python service (GPT-powered feedback analysis)
packages/
  shared/       Shared TypeScript types, constants, and schemas
```

## Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.12+**
- **Docker** (for local integration tests)
- A [Supabase](https://supabase.com) account (free tier works)
- An [OpenAI](https://platform.openai.com) API key
- Google OAuth credentials (for login via NextAuth)

## Setup

### 1. Install dependencies

```bash
npm install
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Where to get it |
|----------|----------------|
| `SUPABASE_URL` | Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_DB_URL` | Supabase dashboard → Settings → Database → Connection string (Transaction pooler) |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` for local dev |
| `PYTHON_API_URL` | `http://localhost:8000` (default) |
| `SENTRY_DSN` | [sentry.io](https://sentry.io) → Project Settings → Client Keys (optional, leave blank to disable) |
| `NEXT_PUBLIC_SENTRY_DSN` | Same as `SENTRY_DSN` (needed for client-side error capture) |

### 3. Run database migrations

```bash
cd apps/web && npm run db:migrate
```

> **For schema changes:** Edit `lib/schema.ts`, then run `npm run db:generate` to create a versioned SQL migration file. Commit the generated file in `drizzle/`. See CLAUDE.md for the full workflow.

### 4. Start development

```bash
npm run dev   # starts Next.js on :3000 and FastAPI on :8000
```

## CI Pipeline

Every push to `main` and every pull request runs the full CI pipeline via GitHub Actions:

```
lint-typecheck → unit-tests         → build
               → integration-tests  ↗
```

| Job | What it runs |
|-----|-------------|
| **lint-typecheck** | ESLint (web) + ruff (Python) + `tsc --noEmit` |
| **unit-tests** | Vitest unit/component tests + pytest |
| **integration-tests** | Integration tests against a real Postgres service container |
| **build** | `next build` production build |

No real API keys or secrets are needed — the pipeline uses dummy env vars from `.env.ci` and a Postgres container spun up automatically by GitHub Actions.

## Running Tests

### Unit Tests (no Docker needed)

```bash
turbo test                           # All unit tests across both workspaces

cd apps/web && npm test              # Web unit tests only
cd apps/api && npm test              # Python unit tests only

cd apps/web && npm run test:coverage # Web unit tests with coverage
cd apps/api && npm run test:coverage # Python unit tests with coverage
```

### Integration Tests (requires Docker)

Integration tests run against a real PostgreSQL database in Docker. Only `auth()` is mocked — all database queries are real, matching production behavior exactly.

```bash
# 1. Start the test database (stays running between test runs)
docker compose up -d test-db

# 2. Run integration tests
cd apps/web && npm run test:integration

# 3. When done for the day
docker compose down
```

The test database:
- Postgres 16 on **port 5433** (won't conflict with local Postgres on 5432)
- Uses **tmpfs** (RAM disk) — fast, no data persists after container stops
- Schema is **wiped and re-migrated** automatically each test run via `tests/global-setup.ts`

### Where to Put Tests

| Type | Location | Naming |
|---|---|---|
| Web unit tests | Next to the source file | `*.test.ts` / `*.test.tsx` |
| Web integration tests | Next to the route handler | `*.integration.test.ts` |
| Python tests | `apps/api/tests/` | `test_*.py` |
| Test DB helpers | `apps/web/tests/` | Shared setup/cleanup utilities |

### Writing New Tests

**Unit tests** — for pure logic (`lib/`, `services/`, `stores/`, utils):
- Create `myfile.test.ts` next to `myfile.ts`
- Import from vitest: `import { describe, it, expect } from "vitest"`

**Integration tests** — for API routes that touch the database:
- Create `route.integration.test.ts` next to `route.ts`
- Mock `@/lib/auth` for auth simulation, mock `@/lib/db` to point at `getTestDb()` from `tests/setup-db.ts`
- Use `beforeAll` to seed test users, `beforeEach` to clean data between tests

**Python tests** — for FastAPI services:
- Create `tests/test_myservice.py`
- Mock external APIs (OpenAI) with `unittest.mock.patch`
- Use the `client` fixture from `conftest.py` for endpoint tests
