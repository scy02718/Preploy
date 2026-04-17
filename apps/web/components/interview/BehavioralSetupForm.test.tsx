import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BehavioralSetupForm } from "./BehavioralSetupForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockSetType, mockSetConfig, mockCreateSession } = vi.hoisted(() => ({
  mockSetType: vi.fn(),
  mockSetConfig: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("@/stores/interviewStore", () => {
  const useInterviewStore = () => ({
    config: {
      interview_style: 0.5,
      difficulty: 0.5,
      company_name: "",
      job_description: "",
      expected_questions: [],
    },
    setConfig: mockSetConfig,
    setType: mockSetType,
    createSession: mockCreateSession,
    quotaError: null,
    clearQuotaError: vi.fn(),
  });
  useInterviewStore.getState = () => ({ error: null });
  return { useInterviewStore };
});

vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: () => ({
    behavioralPrefill: null,
    clearPrefill: vi.fn(),
  }),
}));

// Mock fetch for question generation and user profile (gaze preference)
const mockFetch = vi.fn().mockImplementation((url: string) => {
  if (typeof url === "string" && url.includes("/api/users/me")) {
    return Promise.resolve({ ok: true, json: async () => ({ gazeTrackingEnabled: false }) });
  }
  return Promise.resolve({ ok: false, json: async () => ({}) });
});
global.fetch = mockFetch;

describe("BehavioralSetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders company name input", () => {
    render(<BehavioralSetupForm />);
    expect(screen.getAllByPlaceholderText(/google/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders job description textarea", () => {
    render(<BehavioralSetupForm />);
    expect(screen.getAllByPlaceholderText(/paste the job description/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders form sections", () => {
    render(<BehavioralSetupForm />);
    expect(screen.getAllByText(/company details/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/interview settings/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calls setType('behavioral') on mount", () => {
    render(<BehavioralSetupForm />);
    expect(mockSetType).toHaveBeenCalledWith("behavioral");
  });

  it("renders question count text", () => {
    render(<BehavioralSetupForm />);
    expect(screen.getAllByText("0/10 questions").length).toBeGreaterThanOrEqual(1);
  });

  it("typing in company name calls setConfig", async () => {
    const user = userEvent.setup();
    render(<BehavioralSetupForm />);
    await user.type(screen.getAllByPlaceholderText(/google/i)[0], "G");
    expect(mockSetConfig).toHaveBeenCalled();
  });

  it("submit calls createSession and navigates on success", async () => {
    const user = userEvent.setup();
    mockCreateSession.mockResolvedValue("session-123");

    render(<BehavioralSetupForm />);
    const buttons = screen.getAllByRole("button", { name: /start interview/i });
    await user.click(buttons[0]);

    expect(mockCreateSession).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/interview/behavioral/session");
  });

  it("shows style slider labels", () => {
    render(<BehavioralSetupForm />);
    expect(screen.getAllByText(/strict/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/casual/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders company-specific questions card", () => {
    render(<BehavioralSetupForm />);
    expect(
      screen.getAllByText(/company-specific questions/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("disables generate button when no company name", () => {
    render(<BehavioralSetupForm />);
    const buttons = screen.getAllByRole("button", {
      name: /generate likely questions/i,
    });
    expect(buttons[0]).toBeDisabled();
  });

  it("shows hint text when no company entered", () => {
    render(<BehavioralSetupForm />);
    expect(
      screen.getAllByText(/enter a company name/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not show gaze checkbox when user has gaze tracking disabled", async () => {
    // Default fetch mock returns gazeTrackingEnabled: false
    render(<BehavioralSetupForm />);
    await vi.waitFor(() => {
      expect(screen.queryByTestId("gaze-session-checkbox")).toBeNull();
    });
  });

  it("shows gaze checkbox when user has gaze tracking enabled", async () => {
    vi.mocked(mockFetch).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/users/me")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ gazeTrackingEnabled: true }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
    render(<BehavioralSetupForm />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("gaze-session-checkbox")).toBeTruthy();
    });
  });
});
