import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// --- Mock next/navigation ---------------------------------------------------
const mockPathname = vi.hoisted(() => vi.fn(() => "/dashboard"));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// --- Mock next-auth/react ---------------------------------------------------
const mockUseSession = vi.hoisted(() =>
  vi.fn(() => ({ data: { user: { email: "test@example.com" } } }))
);
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

import { FeedbackDialog } from "./FeedbackButton";

describe("FeedbackDialog", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
    vi.clearAllMocks();
  });

  // 111-2: dialog renders nothing when open=false
  it("renders nothing when open is false", () => {
    const { container } = render(
      <FeedbackDialog open={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  // 109-UI: modal opens (open=true)
  it("renders the feedback form when open is true", () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    expect(screen.getAllByText("Send Feedback").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("feedback-textarea")).toBeInTheDocument();
  });

  // 109-UI: Send is disabled until message is at least 5 chars
  it("Send button is disabled when message is empty", () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    const sendBtn = screen.getByTestId("feedback-send");
    expect(sendBtn).toBeDisabled();
  });

  it("Send button is disabled when message is fewer than 5 characters", () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    const textarea = screen.getByTestId("feedback-textarea");
    fireEvent.change(textarea, { target: { value: "Hi" } });
    const sendBtn = screen.getByTestId("feedback-send");
    expect(sendBtn).toBeDisabled();
  });

  it("Send button is enabled once message is 5+ characters", () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    const textarea = screen.getByTestId("feedback-textarea");
    fireEvent.change(textarea, { target: { value: "Hello world" } });
    const sendBtn = screen.getByTestId("feedback-send");
    expect(sendBtn).not.toBeDisabled();
  });

  // 109-UI: success "Thanks!" state
  it("shows success message after successful submission", async () => {
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    const textarea = screen.getByTestId("feedback-textarea");
    fireEvent.change(textarea, { target: { value: "This is my feedback message." } });
    const sendBtn = screen.getByTestId("feedback-send");
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    expect(screen.getByTestId("feedback-success")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Thanks!/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  // 109-UI: error message on non-OK response
  it("shows error message when fetch returns non-OK response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );
    render(<FeedbackDialog open={true} onClose={vi.fn()} />);
    const textarea = screen.getByTestId("feedback-textarea");
    fireEvent.change(textarea, { target: { value: "This is a feedback message." } });
    const sendBtn = screen.getByTestId("feedback-send");
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    expect(screen.getByTestId("feedback-error")).toBeInTheDocument();
  });

  // Close button calls onClose
  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<FeedbackDialog open={true} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /close feedback form/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
