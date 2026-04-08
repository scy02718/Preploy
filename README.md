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

## Getting Started

```bash
npm install
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
npm run dev   # starts Next.js on :3000 and FastAPI on :8000
```
