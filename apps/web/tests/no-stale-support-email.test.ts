/**
 * Regression guard: no source file may contain support@preploy.tech.
 *
 * Allowlist:
 *   - noreply@preploy.tech — the verified Resend sender domain, in active use.
 *
 * Ignored paths:
 *   - node_modules, .next, drizzle — generated / dependency code
 *   - apps/web/README.md — contains the noreply example for documentation
 *   - apps/web/middleware.ts — CANONICAL_HOST = "preploy.tech" (not email)
 *   - apps/web/app/api/billing/ — test fixtures using https://preploy.tech URLs
 *   - this file itself — contains the allowlist strings
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const WEB_ROOT = resolve(__dirname, "..");

// Directories to skip entirely
const IGNORED_DIRS = new Set(["node_modules", ".next", "drizzle"]);

// Specific files to skip (relative to WEB_ROOT)
const IGNORED_FILES = new Set([
  "README.md",
  "middleware.ts",
  // This file itself — it contains the pattern in its allowlist comments
  "tests/no-stale-support-email.test.ts",
]);

// Directories whose contents should be skipped entirely
const IGNORED_PATH_PREFIXES = [
  join(WEB_ROOT, "app", "api", "billing"),
];

// Pattern: any email address at preploy.tech domain
const STALE_EMAIL_RE = /[a-z0-9._-]+@preploy\.tech/gi;

// Allowlisted addresses — these are legitimate and must stay
const ALLOWLIST = new Set(["noreply@preploy.tech"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip billing test directory
      if (IGNORED_PATH_PREFIXES.some((prefix) => full.startsWith(prefix))) continue;
      walk(full, acc);
    } else if (/\.(ts|tsx|js|jsx|json|md|html|css)$/.test(entry)) {
      // Skip specific files
      const rel = full.slice(WEB_ROOT.length + 1); // relative to WEB_ROOT
      if (IGNORED_FILES.has(rel)) continue;
      acc.push(full);
    }
  }
  return acc;
}

describe("No stale support@preploy.tech email addresses in source", () => {
  it("finds zero non-allowlisted @preploy.tech email addresses", () => {
    const files = walk(WEB_ROOT);
    const violations: { file: string; line: number; match: string }[] = [];

    for (const filePath of files) {
      const src = readFileSync(filePath, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        // Reset lastIndex for global regex
        STALE_EMAIL_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = STALE_EMAIL_RE.exec(line)) !== null) {
          const matched = m[0].toLowerCase();
          if (!ALLOWLIST.has(matched)) {
            violations.push({
              file: filePath.slice(WEB_ROOT.length + 1),
              line: idx + 1,
              match: m[0],
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      console.error(
        "Stale @preploy.tech email addresses found:\n" +
          violations
            .map((v) => `  ${v.file}:${v.line}  →  "${v.match}"`)
            .join("\n")
      );
    }

    expect(violations).toEqual([]);
    // Sanity: we actually scanned something
    expect(files.length).toBeGreaterThan(0);
  });
});
