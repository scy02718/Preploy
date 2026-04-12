import { describe, it, expect } from "vitest";
import {
  buildCompanyQuestionsPrompt,
  getCompanyHint,
} from "./company-questions";

describe("getCompanyHint", () => {
  it("returns hint for known company (case insensitive)", () => {
    const hint = getCompanyHint("Amazon");
    expect(hint).toContain("Leadership Principles");
  });

  it("returns hint for lowercase company", () => {
    const hint = getCompanyHint("google");
    expect(hint).toContain("Googleyness");
  });

  it("returns null for unknown company", () => {
    expect(getCompanyHint("UnknownStartupXYZ")).toBeNull();
  });

  it("trims whitespace before matching", () => {
    const hint = getCompanyHint("  meta  ");
    expect(hint).toContain("Meta");
  });

  it("returns hint for facebook as alias of meta", () => {
    const hint = getCompanyHint("Facebook");
    expect(hint).toContain("Meta");
  });
});

describe("buildCompanyQuestionsPrompt", () => {
  it("includes company name in prompt", () => {
    const prompt = buildCompanyQuestionsPrompt("Google");
    expect(prompt).toContain("Google");
  });

  it("includes company hint when company is known", () => {
    const prompt = buildCompanyQuestionsPrompt("Amazon");
    expect(prompt).toContain("Leadership Principles");
  });

  it("does not include company hint for unknown company", () => {
    const prompt = buildCompanyQuestionsPrompt("SmallStartup");
    expect(prompt).not.toContain("Company context:");
  });

  it("includes role when provided", () => {
    const prompt = buildCompanyQuestionsPrompt("Google", "Senior Engineer");
    expect(prompt).toContain("Senior Engineer");
    expect(prompt).toContain("Tailor questions to this role");
  });

  it("does not include role section when role is undefined", () => {
    const prompt = buildCompanyQuestionsPrompt("Google");
    expect(prompt).not.toContain("Tailor questions to this role");
  });

  it("does not include role section when role is empty/whitespace", () => {
    const prompt = buildCompanyQuestionsPrompt("Google", "   ");
    expect(prompt).not.toContain("Tailor questions to this role");
  });

  it("uses default count of 8", () => {
    const prompt = buildCompanyQuestionsPrompt("Google");
    expect(prompt).toContain("Generate 8 likely");
  });

  it("uses custom count when provided", () => {
    const prompt = buildCompanyQuestionsPrompt("Google", undefined, 10);
    expect(prompt).toContain("Generate 10 likely");
  });

  it("includes expected JSON format instructions", () => {
    const prompt = buildCompanyQuestionsPrompt("Google");
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"tip"');
  });

  it("includes instruction to be company-specific", () => {
    const prompt = buildCompanyQuestionsPrompt("Google");
    expect(prompt).toContain("specific to the company");
  });

  it("trims company name", () => {
    const prompt = buildCompanyQuestionsPrompt("  Netflix  ");
    expect(prompt).toContain("Netflix would ask");
  });
});
