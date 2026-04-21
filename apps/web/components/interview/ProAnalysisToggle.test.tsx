import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be before any imports that use these modules
// ---------------------------------------------------------------------------
const { mockUsePlan } = vi.hoisted(() => ({
  mockUsePlan: vi.fn(),
}));

vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => mockUsePlan(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------
import { ProAnalysisToggle } from "./ProAnalysisToggle";

const FREE_USAGE = { plan: "free", used: 0, limit: 0, periodEnd: null };
const PRO_USAGE_UNDER = { plan: "pro", used: 3, limit: 10, periodEnd: "2026-05-01T00:00:00.000Z" };
const PRO_USAGE_EXHAUSTED = { plan: "pro", used: 10, limit: 10, periodEnd: "2026-05-01T00:00:00.000Z" };

describe("ProAnalysisToggle", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("renders nothing for Free users", () => {
    mockUsePlan.mockReturnValue({ plan: "free" });
    const { container } = render(
      <ProAnalysisToggle value={false} onChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Switch and '3 of 10 left' subline for Pro user under quota", async () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PRO_USAGE_UNDER,
    });

    render(<ProAnalysisToggle value={false} onChange={() => {}} />);

    // Wait for fetch to resolve and loading skeleton to disappear
    await waitFor(() => {
      expect(screen.getAllByText(/3 of 10 left this month/i).length).toBeGreaterThan(0);
    });

    // Switch should be present and enabled
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeInTheDocument();
    expect(switchEl).not.toBeDisabled();

    // Label text
    expect(screen.getAllByText(/Use Pro analysis for this session/i).length).toBeGreaterThan(0);
  });

  it("renders disabled exhausted banner when used equals limit", async () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PRO_USAGE_EXHAUSTED,
    });

    render(<ProAnalysisToggle value={false} onChange={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getAllByText(/You've used all 10 Pro analyses this month/i).length
      ).toBeGreaterThan(0);
    });

    // No switch should be rendered in exhausted state
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("onChange fires when the Switch is clicked", async () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PRO_USAGE_UNDER,
    });

    const onChange = vi.fn();
    render(<ProAnalysisToggle value={false} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.queryByRole("switch")).toBeInTheDocument();
    });

    const switchEl = screen.getByRole("switch");
    await userEvent.click(switchEl);
    // shadcn Switch onCheckedChange passes (checked, event) — assert only the
    // first argument (the new boolean value).
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe(true);
  });
});
