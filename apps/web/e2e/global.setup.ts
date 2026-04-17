/**
 * Playwright global setup — creates a seeded test user in the DB and mints a
 * NextAuth v5–compatible JWE session cookie so authenticated tests bypass
 * Google OAuth entirely.
 *
 * The session cookie is written to e2e/.auth/user.json and loaded by the
 * "chromium" project via `storageState`.
 *
 * NextAuth v5 (beta.30) uses @auth/core which encrypts session cookies as JWE
 * (A256CBC-HS512) via the `encode` helper from `@auth/core/jwt`.  We call
 * that same helper here to produce an identical token that the NextAuth
 * middleware will accept.
 */

import { test as setup } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import postgres from "postgres";

// ---- Constants ---------------------------------------------------------------

export const E2E_USER = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "e2e-test@preploy.dev",
  name: "E2E Test User",
};

const AUTH_SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "dummy-auth-secret-for-ci-only";

const DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.SUPABASE_DB_URL ??
  "postgresql://test:test@localhost:5433/interview_assistant_test";

// Cookie name for non-HTTPS origins (NextAuth v5 default)
const SESSION_COOKIE_NAME = "authjs.session-token";

const AUTH_DIR = path.join(__dirname, ".auth");
const STORAGE_STATE_PATH = path.join(AUTH_DIR, "user.json");

// ---- Setup test --------------------------------------------------------------

setup("authenticate test user", async () => {
  // 1. Ensure the .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 2. Seed the test user into the DB (idempotent upsert)
  //    Also sets tour_skipped_at so the onboarding tour never triggers
  //    during E2E tests (avoids spotlight interference with smoke flows).
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres(DB_URL, { prepare: false });
    await sql`
      INSERT INTO users (id, email, name, plan, tour_skipped_at, created_at, updated_at)
      VALUES (
        ${E2E_USER.id}::uuid,
        ${E2E_USER.email},
        ${E2E_USER.name},
        'free',
        '2026-01-01T00:00:00Z'::timestamptz,
        now(),
        now()
      )
      ON CONFLICT (id) DO UPDATE
        SET email           = EXCLUDED.email,
            name            = EXCLUDED.name,
            tour_skipped_at = '2026-01-01T00:00:00Z'::timestamptz,
            updated_at      = now()
    `;
    console.log("[global.setup] Test user seeded:", E2E_USER.email);
  } catch (err) {
    // Non-fatal: tests that don't depend on the DB will still pass.
    console.warn(
      "[global.setup] DB seed skipped (DB may not be running):",
      (err as Error).message
    );
  } finally {
    if (sql) await sql.end();
  }

  // 3. Mint a NextAuth v5–compatible JWE session token.
  //    `encode` from @auth/core/jwt uses hkdf to derive the encryption key
  //    from AUTH_SECRET + salt, then wraps the payload as A256CBC-HS512 JWE.
  //    The `salt` must equal the cookie name to match the server's decode logic.
  const { encode } = await import("@auth/core/jwt");
  const token = await encode({
    token: {
      sub: E2E_USER.id,
      id: E2E_USER.id,
      name: E2E_USER.name,
      email: E2E_USER.email,
    },
    secret: AUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
    maxAge: 60 * 60 * 24, // 24 hours
  });

  // 4. Write storage state (cookies) that Playwright will inject for each test
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const hostname = new URL(baseUrl).hostname;

  const storageState = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value: token,
        domain: hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log(
    "[global.setup] Auth storage state written to",
    STORAGE_STATE_PATH
  );
});
