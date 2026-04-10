import { describe, it, expect } from "vitest";
import { getBoilerplate } from "./code-templates";

describe("getBoilerplate", () => {
  it("returns Python boilerplate with def solution", () => {
    const result = getBoilerplate("python");
    expect(result).toContain("def solution");
    expect(result).toContain("pass");
  });

  it("returns JavaScript boilerplate with function solution", () => {
    const result = getBoilerplate("javascript");
    expect(result).toContain("function solution");
  });

  it("returns Java boilerplate with class Solution", () => {
    const result = getBoilerplate("java");
    expect(result).toContain("class Solution");
    expect(result).toContain("public void solution");
  });

  it("returns C++ boilerplate with class and include", () => {
    const result = getBoilerplate("cpp");
    expect(result).toContain("#include");
    expect(result).toContain("class Solution");
  });

  it("returns Go boilerplate with package main", () => {
    const result = getBoilerplate("go");
    expect(result).toContain("package main");
    expect(result).toContain("func solution");
  });

  it("returns non-empty string for all supported languages", () => {
    for (const lang of ["python", "javascript", "java", "cpp", "go"]) {
      expect(getBoilerplate(lang).length).toBeGreaterThan(0);
    }
  });

  it("returns empty string for unknown language", () => {
    expect(getBoilerplate("rust")).toBe("");
    expect(getBoilerplate("")).toBe("");
    expect(getBoilerplate("cobol")).toBe("");
  });
});
