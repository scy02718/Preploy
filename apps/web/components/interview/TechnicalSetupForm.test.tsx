import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TechnicalSetupForm } from "./TechnicalSetupForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockSetType, mockSetConfig, mockCreateSession, configOverride, prefillOverride } = vi.hoisted(() => ({
  mockSetType: vi.fn(),
  mockSetConfig: vi.fn(),
  mockCreateSession: vi.fn(),
  configOverride: { value: {} as Record<string, unknown> },
  prefillOverride: { value: null as null | { interview_type?: string; focus_areas?: string[]; additional_instructions?: string; resume_id?: string } },
}));

vi.mock("@/stores/interviewStore", () => {
  const mockClearQuotaError = vi.fn();
  const useInterviewStore = (selector?: (s: unknown) => unknown) => {
    const state = {
      config: {
        interview_type: "leetcode",
        focus_areas: [] as string[],
        language: "python",
        difficulty: "medium",
        additional_instructions: undefined as string | undefined,
        ...configOverride.value,
      },
      setConfig: mockSetConfig,
      setType: mockSetType,
      createSession: mockCreateSession,
      quotaError: null,
      clearQuotaError: mockClearQuotaError,
    };
    if (selector) return selector(state);
    return state;
  };
  useInterviewStore.getState = () => ({ error: null });
  return { useInterviewStore };
});

const mockClearPrefill = vi.fn();
vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: () => ({
    technicalPrefill: prefillOverride.value,
    clearPrefill: mockClearPrefill,
  }),
}));

describe("TechnicalSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configOverride.value = {};
    prefillOverride.value = null;
  });

  it("renders interview type options", () => {
    render(<TechnicalSetupForm />);
    expect(screen.getAllByText("LeetCode-style").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("System Design").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Frontend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Backend").length).toBeGreaterThanOrEqual(1);
  });

  it("renders focus area checkboxes for leetcode", () => {
    render(<TechnicalSetupForm />);
    expect(screen.getAllByText("Arrays").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dynamic Programming").length).toBeGreaterThanOrEqual(1);
  });

  it("renders difficulty options", () => {
    render(<TechnicalSetupForm />);
    expect(screen.getAllByText("Easy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Medium").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Hard").length).toBeGreaterThanOrEqual(1);
  });

  it("calls setType('technical') on mount", () => {
    render(<TechnicalSetupForm />);
    expect(mockSetType).toHaveBeenCalledWith("technical");
  });

  it("submit button is disabled when no focus areas selected", () => {
    render(<TechnicalSetupForm />);
    const buttons = screen.getAllByRole("button", { name: /start interview/i });
    expect(buttons[0]).toBeDisabled();
  });

  it("shows 0 selected text", () => {
    render(<TechnicalSetupForm />);
    expect(screen.getAllByText("0 selected").length).toBeGreaterThanOrEqual(1);
  });

  it("renders programming language selector", () => {
    render(<TechnicalSetupForm />);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Programming Language").length).toBeGreaterThanOrEqual(1);
  });

  // 123-A: "Other" checkbox present in every focus-area group
  it("123-A: renders Other checkbox in the leetcode focus-area grid", () => {
    render(<TechnicalSetupForm />);
    // "Other" label should appear among the focus area checkboxes
    const otherLabels = screen.getAllByText("Other");
    expect(otherLabels.length).toBeGreaterThanOrEqual(1);
  });

  // 123-B: Checking Other reveals the specialization textarea; unchecking hides it
  it("123-B: checking Other calls setConfig with other in focus_areas", () => {
    render(<TechnicalSetupForm />);

    // Textarea should NOT be present initially
    expect(screen.queryByPlaceholderText("Specify a topic…")).toBeNull();

    // Click the Other checkbox label to toggle it
    const otherLabel = screen.getAllByText("Other")[0].closest("label");
    expect(otherLabel).not.toBeNull();
    fireEvent.click(otherLabel!);

    // After checking, setConfig should have been called with "other" in focus_areas
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ focus_areas: expect.arrayContaining(["other"]) })
    );
  });

  // 123-C: Typing → setConfig with prefix in additional_instructions
  it("123-C: typing in Other textarea merges prefix into additional_instructions", () => {
    // Start with "other" already in config focus_areas so the textarea is shown
    configOverride.value = {
      focus_areas: ["other"],
      additional_instructions: undefined,
    };

    render(<TechnicalSetupForm />);

    const textarea = screen.getByPlaceholderText("Specify a topic…");
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea, { target: { value: "GPU shaders" } });

    // setConfig should be called with additional_instructions containing the prefix
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        additional_instructions: expect.stringContaining("Other focus area: GPU shaders"),
      })
    );
  });

  // 123-D: Unchecking clears Other textarea + strips segment from additional_instructions
  it("123-D: unchecking Other strips segment from additional_instructions", () => {
    configOverride.value = {
      focus_areas: ["arrays", "other"],
      additional_instructions: "Other focus area: GPU shaders",
    };

    render(<TechnicalSetupForm />);

    // The textarea should be visible since "other" is in focus_areas
    const textarea = screen.getByPlaceholderText("Specify a topic…");
    expect(textarea).toBeTruthy();

    // Find and click the Other label to uncheck it
    const otherLabels = screen.getAllByText("Other");
    const otherLabel = otherLabels[0].closest("label");
    expect(otherLabel).not.toBeNull();
    fireEvent.click(otherLabel!);

    // setConfig called — focus_areas should not include "other"
    const calls = mockSetConfig.mock.calls;
    const lastCall = calls[calls.length - 1][0] as Record<string, unknown>;
    expect((lastCall.focus_areas as string[]).includes("other")).toBe(false);
    // Either undefined or a string without the Other prefix
    const instr = lastCall.additional_instructions as string | undefined;
    if (instr) {
      expect(instr).not.toContain("Other focus area:");
    }
  });

  // 123-E: Submit disabled when Other checked but text empty
  it("123-E: submit is disabled when Other is checked but text is empty", () => {
    configOverride.value = {
      focus_areas: ["other"],
      additional_instructions: undefined,
    };

    render(<TechnicalSetupForm />);

    // With "other" checked and no text, submit should be disabled
    const buttons = screen.getAllByRole("button", { name: /start interview/i });
    expect(buttons[0]).toBeDisabled();
  });

  // Prefill consumption tests
  it("applies interview_type from technicalPrefill on mount", () => {
    prefillOverride.value = { interview_type: "system_design" };
    render(<TechnicalSetupForm />);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ interview_type: "system_design", focus_areas: [] })
    );
  });

  it("applies focus_areas from technicalPrefill on mount", () => {
    prefillOverride.value = { focus_areas: ["arrays", "graphs"] };
    render(<TechnicalSetupForm />);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ focus_areas: ["arrays", "graphs"] })
    );
  });

  it("applies additional_instructions from technicalPrefill on mount", () => {
    prefillOverride.value = { additional_instructions: "Focus on DP" };
    render(<TechnicalSetupForm />);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({ additional_instructions: "Focus on DP" })
    );
  });

  it("calls clearPrefill after applying technicalPrefill", () => {
    prefillOverride.value = { interview_type: "frontend" };
    render(<TechnicalSetupForm />);
    expect(mockClearPrefill).toHaveBeenCalledOnce();
  });

  it("does not call clearPrefill when technicalPrefill is null", () => {
    prefillOverride.value = null;
    render(<TechnicalSetupForm />);
    expect(mockClearPrefill).not.toHaveBeenCalled();
  });
});
