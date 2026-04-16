import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// --- Mock next/navigation ---------------------------------------------------
const mockPathname = vi.hoisted(() => vi.fn(() => "/dashboard"));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

// --- Mock next-auth/react (needed by FeedbackDialog inside Sidebar) ----------
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { email: "test@example.com" } } }),
}));

// --- Mock FeedbackDialog to keep Sidebar tests focused ----------------------
const mockFeedbackDialog = vi.hoisted(() => vi.fn());
vi.mock("@/components/shared/FeedbackButton", () => ({
  FeedbackDialog: (props: { open: boolean; onClose: () => void }) => {
    mockFeedbackDialog(props);
    return props.open ? (
      <div data-testid="feedback-dialog-open">FeedbackDialog</div>
    ) : null;
  },
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock fetch to return empty sessions (sidebar fetches recent sessions)
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sessions: [], pagination: { totalCount: 0 } }), {
        status: 200,
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  // 111-1: Sidebar renders a "Feedback" nav entry
  it("renders a Feedback entry in the navigation", () => {
    render(<Sidebar />);
    // The Feedback button should be present
    expect(screen.getByTestId("sidebar-feedback-button")).toBeInTheDocument();
    expect(
      screen.getAllByText("Feedback").length
    ).toBeGreaterThanOrEqual(1);
  });

  // 111-1: Feedback entry is below the divider (navigation section)
  it("renders the Feedback entry as a button (not a link)", () => {
    render(<Sidebar />);
    const feedbackBtn = screen.getByTestId("sidebar-feedback-button");
    expect(feedbackBtn.tagName).toBe("BUTTON");
  });

  // 111-3: Clicking the Sidebar Feedback entry opens the FeedbackDialog
  it("opens FeedbackDialog when Feedback button is clicked", async () => {
    render(<Sidebar />);
    const feedbackBtn = screen.getByTestId("sidebar-feedback-button");

    // Dialog should not be open initially
    expect(screen.queryByTestId("feedback-dialog-open")).toBeNull();

    await act(async () => {
      fireEvent.click(feedbackBtn);
    });

    // Dialog should now be open
    expect(screen.getByTestId("feedback-dialog-open")).toBeInTheDocument();
  });

  // Verify that other nav links still render
  it("renders the main navigation links", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Behavioral Interview").length).toBeGreaterThanOrEqual(1);
  });
});
