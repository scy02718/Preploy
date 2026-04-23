import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FocusDirectiveField } from "./FocusDirectiveField";

// planRef allows individual tests to control the plan returned by usePlan.
const planRef = { current: undefined as "free" | "pro" | undefined };

vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({ plan: planRef.current }),
}));

describe("FocusDirectiveField", () => {
  const noop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    planRef.current = undefined;
  });

  it("plan === undefined → renders nothing", () => {
    planRef.current = undefined;
    const { container } = render(
      <FocusDirectiveField value="" onChange={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("plan === 'free' → renders link to /pricing#custom_topic", () => {
    planRef.current = "free";
    render(<FocusDirectiveField value="" onChange={noop} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/pricing#custom_topic");
  });

  it("plan === 'free' → shows 'Available on Pro' copy", () => {
    planRef.current = "free";
    render(<FocusDirectiveField value="" onChange={noop} />);
    expect(screen.getAllByText(/available on pro/i).length).toBeGreaterThanOrEqual(1);
  });

  it("plan === 'free' → no textarea in the DOM", () => {
    planRef.current = "free";
    render(<FocusDirectiveField value="" onChange={noop} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("plan === 'pro' → renders enabled textarea", () => {
    planRef.current = "pro";
    render(<FocusDirectiveField value="" onChange={noop} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("plan === 'pro' → typing fires onChange with new value", () => {
    planRef.current = "pro";
    const onChange = vi.fn();
    render(<FocusDirectiveField value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "leadership" } });
    expect(onChange).toHaveBeenCalledWith("leadership");
  });

  it("plan === 'pro' → counter shows value.length/500", () => {
    planRef.current = "pro";
    render(<FocusDirectiveField value="hello" onChange={noop} />);
    expect(screen.getAllByText("5/500").length).toBeGreaterThanOrEqual(1);
  });

  it("plan === 'pro' → counter starts at 0/500 for empty value", () => {
    planRef.current = "pro";
    render(<FocusDirectiveField value="" onChange={noop} />);
    expect(screen.getAllByText("0/500").length).toBeGreaterThanOrEqual(1);
  });
});
