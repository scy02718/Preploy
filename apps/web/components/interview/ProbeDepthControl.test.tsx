import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------
import { ProbeDepthControl } from "./ProbeDepthControl";

describe("ProbeDepthControl", () => {
  it("renders 3 toggle buttons for Pro users", () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    render(<ProbeDepthControl value={2} onChange={() => {}} />);

    expect(screen.getAllByText("Gentle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Intense").length).toBeGreaterThan(0);
  });

  it("clicking Standard calls onChange(2)", async () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    const onChange = vi.fn();
    render(<ProbeDepthControl value={1} onChange={onChange} />);

    // Click the "Standard" button
    const standardBtn = screen.getAllByText("Standard")[0];
    await userEvent.click(standardBtn);

    expect(onChange).toHaveBeenCalledWith(2);
    // Ensure it's called with a number, not a string
    expect(typeof onChange.mock.calls[0][0]).toBe("number");
  });

  it("renders the locked pill for Free users", () => {
    mockUsePlan.mockReturnValue({ plan: "free" });
    render(<ProbeDepthControl value={0} onChange={() => {}} />);

    expect(screen.getAllByText(/Available on Pro/i).length).toBeGreaterThan(0);

    // No toggle buttons in the DOM
    expect(screen.queryByText("Gentle")).toBeNull();
    expect(screen.queryByText("Standard")).toBeNull();
    expect(screen.queryByText("Intense")).toBeNull();
  });

  it("renders nothing while plan is loading", () => {
    mockUsePlan.mockReturnValue({ plan: undefined });
    const { container } = render(<ProbeDepthControl value={0} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
