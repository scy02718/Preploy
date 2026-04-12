import { describe, it, expect } from "vitest";
import { buildResumeQuestionsPrompt } from "./resume-prompt-builder";

const SAMPLE_RESUME = `John Doe
Software Engineer at Acme Corp
- Led migration of monolith to microservices, reducing latency by 40%
- Built real-time data pipeline with Kafka and Flink
- Managed team of 5 engineers
Skills: TypeScript, Python, AWS, Kubernetes`;

describe("buildResumeQuestionsPrompt", () => {
  it("includes the resume text in the prompt", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
    });
    expect(result).toContain("Acme Corp");
    expect(result).toContain("reducing latency by 40%");
  });

  it("generates behavioral-specific instructions", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
    });
    expect(result).toContain("behavioral interview questions");
    expect(result).toContain("STAR format");
    expect(result).toContain("leadership");
    expect(result).toContain("conflict resolution");
  });

  it("generates technical-specific instructions", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "technical",
    });
    expect(result).toContain("technical interview questions");
    expect(result).toContain("system design");
    expect(result).toContain("scalability");
    expect(result).toContain("architecture");
  });

  it("includes company name when provided", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
      company: "Google",
    });
    expect(result).toContain("interviewing at Google");
  });

  it("includes role when provided", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
      role: "Senior Software Engineer",
    });
    expect(result).toContain("Senior Software Engineer");
  });

  it("includes both company and role when provided", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "technical",
      company: "Meta",
      role: "Staff Engineer",
    });
    expect(result).toContain("interviewing at Meta");
    expect(result).toContain("Staff Engineer");
  });

  it("omits company when not provided", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
    });
    expect(result).not.toContain("interviewing at");
  });

  it("omits role when not provided", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
    });
    expect(result).not.toContain("target role");
  });

  it("trims whitespace from company and role", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
      company: "  Google  ",
      role: "  SWE  ",
    });
    expect(result).toContain("interviewing at Google.");
    expect(result).toContain("target role is: SWE.");
  });

  it("ignores empty-string company and role", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
      company: "   ",
      role: "   ",
    });
    expect(result).not.toContain("interviewing at");
    expect(result).not.toContain("target role");
  });

  it("requests JSON array output format", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: SAMPLE_RESUME,
      questionType: "behavioral",
    });
    expect(result).toContain("JSON array");
    expect(result).toContain('"question"');
    expect(result).toContain('"resume_reference"');
    expect(result).toContain('"category"');
  });

  it("works with minimal resume text", () => {
    const result = buildResumeQuestionsPrompt({
      resumeText: "Jane Smith - Software Engineer",
      questionType: "technical",
    });
    expect(result).toContain("Jane Smith");
    expect(result).toContain("technical interview questions");
  });
});
