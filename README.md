# Interview Assistant

AI-powered mock interview practice with real-time feedback.

## Prerequisites

- Node.js 20+
- Python 3.12+
- A [Supabase](https://supabase.com) account (free tier works)

## Supabase Setup

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note the project URL and anon key from **Settings > API**
3. Get the database connection string from **Settings > Database > Connection string > URI** (use the `Transaction` pooler mode for serverless)
4. Copy `.env.example` to `.env` and fill in:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Run migrations: `cd apps/web && npx drizzle-kit push`

## 3D Avatar Setup

The behavioral interview uses a 3D avatar with lip-sync. You need a GLB avatar file with **viseme blend shapes** (morph targets) and **ARKit blend shapes** for facial animations.

### Option A: Avaturn (recommended)

[Avaturn](https://avaturn.me/) creates realistic 3D avatars from a selfie with viseme and ARKit blend shapes included out of the box.

1. **Create an account** at [avaturn.me](https://avaturn.me/) (free tier available)

2. **Create your avatar:**
   - Click **"Create Avatar"**
   - Upload a selfie or use one of the preset options
   - Customize appearance (face, hair, outfit, etc.)
   - Choose **Half-body** for the interview video-call layout

3. **Export as GLB:**
   - Once your avatar is ready, click the **Export** / **Download** button
   - Select **GLB** format
   - Make sure **ARKit blend shapes** and **Visemes** are enabled in export settings
   - Download the file

4. **Place the file in the project:**
   ```bash
   mv ~/Downloads/avatar.glb apps/web/public/avatars/interviewer.glb
   ```

### Option B: Sketchfab (pre-made models)

You can find free avatars with blend shapes on [Sketchfab](https://sketchfab.com/tags/blendshapes):

1. Search for avatars tagged with **"blendshapes"** or **"viseme"**
2. Filter by **Downloadable** and **Free**
3. Download in **GLB** format
4. Place as `apps/web/public/avatars/interviewer.glb`

> Make sure the model includes Oculus/ARKit viseme morph targets (see table below).

### Option C: Custom avatar (Blender)

If you have a custom model, you can add viseme blend shapes in [Blender](https://www.blender.org/) using the [CATS Blender Plugin](https://github.com/teamneoneko/Cats-Blender-Plugin):

1. Import your model into Blender
2. Install CATS plugin → use **Viseme** panel to auto-generate viseme shape keys
3. Export as GLB with morph targets enabled

### Required morph targets

The app uses these morph targets for lip-sync and idle animations:

| Morph Target | Purpose |
|---|---|
| `viseme_sil` | Silence / mouth closed |
| `viseme_aa` | "ah" sound |
| `viseme_E` | "eh" sound |
| `viseme_I` | "ee" sound |
| `viseme_O` | "oh" sound |
| `viseme_U` | "oo" sound |
| `viseme_FF` | "f" / "v" sounds |
| `viseme_TH` | "th" sound |
| `viseme_PP` | "p" / "b" / "m" sounds |
| `viseme_SS` | "s" / "z" sounds |
| `viseme_CH` | "sh" / "ch" sounds |
| `viseme_nn` | "n" / "ng" sounds |
| `viseme_RR` | "r" sound |
| `viseme_DD` | "d" / "t" sounds |
| `viseme_kk` | "k" / "g" sounds |
| `eyeBlinkLeft` | Left eye blink (idle animation) |
| `eyeBlinkRight` | Right eye blink (idle animation) |
| `mouthSmile` | Smile (idle animation) |

### Verifying morph targets

Inspect your GLB file at [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/) — drag your file in and check the **Morph Targets** section to confirm viseme blend shapes are present.

The app expects the avatar at **`apps/web/public/avatars/interviewer.glb`**.

## Getting Started

```bash
npm install
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
npm run dev   # starts Next.js on :3000 and FastAPI on :8000
```

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
