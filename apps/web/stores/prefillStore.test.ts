import { describe, it, expect, beforeEach } from "vitest";
import { usePrefillStore } from "./prefillStore";

function resetStore() {
  usePrefillStore.setState({
    behavioralPrefill: null,
    technicalPrefill: null,
  });
}

describe("usePrefillStore — clearResumeReference", () => {
  beforeEach(() => {
    resetStore();
  });

  it("clears resume_id from behavioralPrefill while preserving other fields", () => {
    usePrefillStore.setState({
      behavioralPrefill: {
        company_name: "Acme",
        expected_questions: ["Q1", "Q2"],
        resume_id: "resume-abc",
      },
    });

    usePrefillStore.getState().clearResumeReference("resume-abc");

    const { behavioralPrefill } = usePrefillStore.getState();
    expect(behavioralPrefill).not.toBeNull();
    expect(behavioralPrefill?.resume_id).toBeUndefined();
    expect(behavioralPrefill?.company_name).toBe("Acme");
    expect(behavioralPrefill?.expected_questions).toEqual(["Q1", "Q2"]);
  });

  it("clears resume_id from technicalPrefill while preserving other fields", () => {
    usePrefillStore.setState({
      technicalPrefill: {
        focus_areas: ["algorithms"],
        additional_instructions: "Focus on DP",
        resume_id: "resume-abc",
      },
    });

    usePrefillStore.getState().clearResumeReference("resume-abc");

    const { technicalPrefill } = usePrefillStore.getState();
    expect(technicalPrefill).not.toBeNull();
    expect(technicalPrefill?.resume_id).toBeUndefined();
    expect(technicalPrefill?.focus_areas).toEqual(["algorithms"]);
    expect(technicalPrefill?.additional_instructions).toBe("Focus on DP");
  });

  it("sets prefill to null when resume_id is the only field", () => {
    usePrefillStore.setState({
      behavioralPrefill: { resume_id: "resume-only" },
      technicalPrefill: { resume_id: "resume-only" },
    });

    usePrefillStore.getState().clearResumeReference("resume-only");

    const { behavioralPrefill, technicalPrefill } = usePrefillStore.getState();
    expect(behavioralPrefill).toBeNull();
    expect(technicalPrefill).toBeNull();
  });

  it("is a no-op when the resumeId does not match any prefill", () => {
    usePrefillStore.setState({
      behavioralPrefill: {
        company_name: "Beta Corp",
        resume_id: "resume-xyz",
      },
      technicalPrefill: {
        focus_areas: ["system-design"],
        resume_id: "resume-xyz",
      },
    });

    usePrefillStore.getState().clearResumeReference("resume-different");

    const { behavioralPrefill, technicalPrefill } = usePrefillStore.getState();
    expect(behavioralPrefill?.resume_id).toBe("resume-xyz");
    expect(technicalPrefill?.resume_id).toBe("resume-xyz");
  });
});
