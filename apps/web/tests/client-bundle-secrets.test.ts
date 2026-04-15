import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const WEB_ROOT = resolve(__dirname, "..");
const STATIC_DIR = join(WEB_ROOT, ".next", "static");

const FORBIDDEN = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function walkJs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkJs(full, acc);
    } else if (entry.endsWith(".js")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("client bundle secret audit", () => {
  it("contains zero references to server-only secret variable names in .next/static/**/*.js", () => {
    // If .next/static does not exist (fresh checkout / `npx turbo test` without
    // a prior `next build`), the glob returns zero files and the
    // zero-matches assertion trivially passes. Run
    // `npm run test:bundle-audit` for the thorough check that builds first.
    const files = walkJs(STATIC_DIR);
    const hits: Array<{ file: string; secret: string }> = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const secret of FORBIDDEN) {
        if (src.includes(secret)) {
          hits.push({ file: f, secret });
        }
      }
    }

    if (hits.length > 0) {
      console.error("Client bundle leaked secret references:", hits);
    }
    expect(hits).toEqual([]);
  });
});
