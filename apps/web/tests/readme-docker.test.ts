import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("README Local Docker section", () => {
  const readme = readFileSync(resolve(__dirname, "../README.md"), "utf8");

  it("has a ## Local Docker heading", () => {
    expect(readme).toMatch(/^##\s+Local Docker\s*$/m);
  });

  it("references the required container env keys and .env.local", () => {
    expect(readme).toContain("HOSTNAME");
    expect(readme).toContain("DATABASE_URL");
    expect(readme).toContain(".env.local");
  });
});
