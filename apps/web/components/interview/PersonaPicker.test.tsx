import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BEHAVIORAL_PERSONAS } from "@/lib/personas";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be before any imports that consume these modules
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
import { PersonaPicker } from "./PersonaPicker";

// The 4 Pro-only persona ids (all except "default")
const PRO_PERSONA_IDS = BEHAVIORAL_PERSONAS.filter((p) => p.proOnly).map(
  (p) => p.id
);

describe("PersonaPicker", () => {
  it("plan='free': all 5 options appear in the DOM after opening; 4 have data-pro-locked='true'; default does not", async () => {
    mockUsePlan.mockReturnValue({ plan: "free" });
    render(<PersonaPicker value="default" onChange={() => {}} />);

    // Open the select to reveal the option items
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);

    // All 5 labels should now appear in the document
    for (const persona of BEHAVIORAL_PERSONAS) {
      expect(
        screen.getAllByText(persona.label).length
      ).toBeGreaterThanOrEqual(1);
    }

    // 4 items have data-pro-locked="true"
    const locked = document.querySelectorAll('[data-pro-locked="true"]');
    expect(locked.length).toBe(PRO_PERSONA_IDS.length);
  });

  it("plan='pro': no data-pro-locked attribute anywhere after opening", async () => {
    mockUsePlan.mockReturnValue({ plan: "pro" });
    render(<PersonaPicker value="default" onChange={() => {}} />);

    // Open the select
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);

    const locked = document.querySelectorAll('[data-pro-locked="true"]');
    expect(locked.length).toBe(0);
  });

  it("plan='free': the default option is selectable and calls onChange('default')", async () => {
    mockUsePlan.mockReturnValue({ plan: "free" });
    const onChange = vi.fn();
    render(<PersonaPicker value="amazon-lp" onChange={onChange} />);

    // Open the select
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);

    // Find the default option and click it
    const defaultOptions = screen.getAllByText("Alex (default)");
    // Click the last one (the option in the dropdown, not the trigger display value)
    await userEvent.click(defaultOptions[defaultOptions.length - 1]);

    // onChange called with "default"
    expect(onChange).toHaveBeenCalledWith("default");
  });

  it("plan='free': locked Pro items render with data-pro-locked='true' and aria-disabled='true'", async () => {
    mockUsePlan.mockReturnValue({ plan: "free" });
    render(<PersonaPicker value="default" onChange={() => {}} />);

    // Open the select to render items
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);

    // Locked items should have both data-pro-locked and aria-disabled attributes
    const locked = document.querySelectorAll('[data-pro-locked="true"]');
    expect(locked.length).toBe(4); // 4 pro-only personas

    // All locked items should also have aria-disabled="true"
    for (const item of locked) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("clicking a locked Pro item does NOT call onChange (free user)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockUsePlan.mockReturnValue({ plan: "free" });

    render(<PersonaPicker value="default" onChange={onChange} />);

    // Open the select trigger
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    // Click a Pro-locked option — "Amazon LP"
    // The item has aria-disabled="true" which shadcn/base-ui SelectItem honours
    // by intercepting pointer events so the underlying select value never changes,
    // meaning onChange is never invoked.
    const lockedItem = screen.getAllByText(/Amazon LP/i);
    await user.click(lockedItem[lockedItem.length - 1]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("plan=undefined: renders nothing", () => {
    mockUsePlan.mockReturnValue({ plan: undefined });
    const { container } = render(
      <PersonaPicker value="default" onChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
