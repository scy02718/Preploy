import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const WEB_ROOT = resolve(__dirname, "..");
const README_PATH = join(WEB_ROOT, "README.md");
const IGNORED_DIRS = new Set(["node_modules", ".next", "tests", "drizzle"]);
const ENV_RE = /process\.env\.([A-Z0-9_]+)/g;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("README env-variable audit", () => {
  it("classifies every process.env.X referenced in apps/web as BUILD_TIME_BAKED or RUNTIME_ONLY", () => {
    const files = walk(WEB_ROOT);
    const found = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      let m: RegExpExecArray | null;
      while ((m = ENV_RE.exec(src)) !== null) {
        found.add(m[1]);
      }
    }

    const readme = readFileSync(README_PATH, "utf8");

    const missing: string[] = [];
    const unclassified: string[] = [];
    for (const name of found) {
      // Look for a table row mentioning the variable name (wrapped in backticks
      // to avoid matching the same word used in a sentence above the table).
      const rowRe = new RegExp(
        "\\|\\s*`" +
          name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") +
          "`\\s*\\|\\s*(BUILD_TIME_BAKED|RUNTIME_ONLY)\\s*\\|",
      );
      if (!readme.includes(name)) {
        missing.push(name);
      } else if (!rowRe.test(readme)) {
        unclassified.push(name);
      }
    }

    if (missing.length || unclassified.length) {
      // Print actionable diagnostics before the assertion fails.
      console.error(
        "README env audit failed.\n  missing from README: " +
          JSON.stringify(missing) +
          "\n  present but not classified BUILD_TIME_BAKED|RUNTIME_ONLY: " +
          JSON.stringify(unclassified),
      );
    }

    expect(missing).toEqual([]);
    expect(unclassified).toEqual([]);
    // Sanity: we actually scanned something.
    expect(found.size).toBeGreaterThan(0);
  });
});
