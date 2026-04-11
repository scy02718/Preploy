import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TechnicalSetupForm } from "./TechnicalSetupForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockSetType, mockSetConfig, mockCreateSession, configOverride } = vi.hoisted(() => ({
  mockSetType: vi.fn(),
  mockSetConfig: vi.fn(),
  mockCreateSession: vi.fn(),
  configOverride: { value: {} as Record<string, unknown> },
}));

vi.mock("@/stores/interviewStore", () => {
  const useInterviewStore = () => ({
    config: {
      interview_type: "leetcode",
      focus_areas: [],
      language: "python",
      difficulty: "medium",
      ...configOverride.value,
    },
    setConfig: mockSetConfig,
    setType: mockSetType,
    createSession: mockCreateSession,
  });
  useInterviewStore.getState = () => ({ error: null });
  return { useInterviewStore };
});

describe("TechnicalSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configOverride.value = {};
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
});
