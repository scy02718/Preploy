import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TechnicalSessionLayout } from "./TechnicalSessionLayout";

// Mock next/navigation — TechnicalSessionLayout itself doesn't use the router
// but the shared Button component may pull in route context on some versions.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/interview/technical/session",
}));

function renderLayout(props: Partial<Parameters<typeof TechnicalSessionLayout>[0]> = {}) {
  return render(
    <TechnicalSessionLayout
      problemPanel={<div>Problem content</div>}
      editorPanel={<div>Editor content</div>}
      micIndicator={<div>Mic</div>}
      onEndSession={vi.fn()}
      isProcessing={false}
      {...props}
    />
  );
}

describe("TechnicalSessionLayout — End Session button gate", () => {
  it("shows 'Starting session…' microcopy when sessionInitialized is false", () => {
    renderLayout({ sessionInitialized: false });
    const elements = screen.getAllByText(/starting session/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("marks the button as aria-disabled when sessionInitialized is false", () => {
    renderLayout({ sessionInitialized: false });
    const btn = screen.getByRole("button", { name: /starting session/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows 'End Session' button (not disabled) when sessionInitialized is true", () => {
    renderLayout({ sessionInitialized: true });
    const endBtn = screen.getByRole("button", { name: /end session/i });
    // Should be a real button without aria-disabled
    expect(endBtn.getAttribute("aria-disabled")).toBeNull();
  });

  it("shows confirm dialog when End Session is clicked and session is initialized", () => {
    renderLayout({ sessionInitialized: true });
    const endBtn = screen.getByRole("button", { name: /end session/i });
    fireEvent.click(endBtn);
    const confirmElements = screen.getAllByText(/end interview\?/i);
    expect(confirmElements.length).toBeGreaterThan(0);
  });

  it("does not show confirm dialog when clicking the disabled span (not initialized)", () => {
    renderLayout({ sessionInitialized: false });
    const disabledEl = screen.getByRole("button", { name: /starting session/i });
    fireEvent.click(disabledEl);
    expect(screen.queryByText(/end interview\?/i)).toBeNull();
  });

  it("defaults sessionInitialized to true (backward compatibility)", () => {
    // When prop is omitted entirely, End Session button should be enabled
    renderLayout({}); // no sessionInitialized prop
    const endBtn = screen.getByRole("button", { name: /end session/i });
    expect(endBtn.getAttribute("aria-disabled")).toBeNull();
  });
});
