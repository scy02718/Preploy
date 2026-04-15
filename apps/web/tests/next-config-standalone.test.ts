import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("next.config.ts standalone output", () => {
  it("sets output: 'standalone' so the Docker runner stage has a self-contained server", () => {
    const src = readFileSync(resolve(__dirname, "../next.config.ts"), "utf8");
    expect(src).toMatch(/output:\s*["']standalone["']/);
  });
});
