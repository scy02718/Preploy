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

const { mockPrefillRef, mockClearPrefill } = vi.hoisted(() => ({
  mockPrefillRef: { current: null as { expected_questions?: string[]; company_name?: string; resume_id?: string } | null },
  mockClearPrefill: vi.fn(),
}));

vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: () => ({
    behavioralPrefill: mockPrefillRef.current,
    clearPrefill: mockClearPrefill,
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
    mockPrefillRef.current = null;
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

  // ---------------------------------------------------------------------------
  // Regression: STAR "Practice this question" prefill must survive the effect
  // that runs `setType("behavioral")`. The bug (pre-fix) was that the prefill
  // effect and the setType effect were combined into one useEffect keyed on
  // `behavioralPrefill`; `clearPrefill` at the end of the first run changed
  // the dep, re-ran the effect, which re-called setType — and setType resets
  // config to DEFAULT_BEHAVIORAL_CONFIG, wiping the just-applied prefill.
  // ---------------------------------------------------------------------------
  it("prefill survives: setType fires exactly once on mount even when prefill clears", () => {
    mockPrefillRef.current = {
      expected_questions: ["Tell me about a time you led under pressure"],
    };
    render(<BehavioralSetupForm />);
    expect(mockSetType).toHaveBeenCalledTimes(1);
    expect(mockSetType).toHaveBeenCalledWith("behavioral");
  });

  it("prefill survives: setConfig is called with expected_questions from STAR handoff", () => {
    mockPrefillRef.current = {
      expected_questions: [
        "Tell me about a time you led under pressure",
        "Describe a difficult technical challenge",
      ],
    };
    render(<BehavioralSetupForm />);
    expect(mockSetConfig).toHaveBeenCalledWith({
      expected_questions: [
        "Tell me about a time you led under pressure",
        "Describe a difficult technical challenge",
      ],
    });
    expect(mockClearPrefill).toHaveBeenCalledTimes(1);
  });

  it("prefill survives: setConfig is called with company_name + resume_id together", () => {
    mockPrefillRef.current = {
      company_name: "Stripe",
      resume_id: "resume-123",
      expected_questions: ["Walk me through your resume"],
    };
    render(<BehavioralSetupForm />);
    expect(mockSetConfig).toHaveBeenCalledWith({ company_name: "Stripe" });
    expect(mockSetConfig).toHaveBeenCalledWith({
      expected_questions: ["Walk me through your resume"],
    });
    expect(mockSetConfig).toHaveBeenCalledWith({ resume_id: "resume-123" });
  });

  it("no prefill: setConfig is NOT called on mount (empty prefill path)", () => {
    mockPrefillRef.current = null;
    render(<BehavioralSetupForm />);
    // setConfig may be called by unrelated effects (e.g. gaze preference fetch)
    // but never with prefill fields on a null-prefill mount.
    const prefillCalls = mockSetConfig.mock.calls.filter((call) => {
      const arg = call[0] as Record<string, unknown>;
      return "expected_questions" in arg || "company_name" in arg || "resume_id" in arg;
    });
    expect(prefillCalls).toHaveLength(0);
  });
});
