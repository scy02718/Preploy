#!/usr/bin/env node
/**
 * Vercel-aware build wrapper.
 *
 * On Vercel (`process.env.VERCEL === "1"`), runs `drizzle-kit migrate`
 * against the production database BEFORE `next build`. A failed migration
 * aborts the deploy, so the new code never goes live against a stale schema.
 *
 * Local builds (no VERCEL env var) and CI builds skip the migrate step —
 * CI uses a dummy SUPABASE_DB_URL from .env.ci that would not connect, and
 * developers should run `npm run db:migrate` manually against their local
 * database when needed.
 *
 * Why this script and not just `drizzle-kit migrate && next build` in the
 * package.json `build` field: that would break CI and local builds. A small
 * Node wrapper is the cleanest gate.
 */
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL === "1") {
  if (!process.env.SUPABASE_DB_URL) {
    console.error(
      "ERROR: SUPABASE_DB_URL must be set in Vercel env vars for the build-time migrate step."
    );
    process.exit(1);
  }
  console.log("[vercel-build] Applying drizzle migrations against production DB...");
  run("npx", ["drizzle-kit", "migrate"]);
  console.log("[vercel-build] Migrations applied successfully.");
}

run("npx", ["next", "build"]);
