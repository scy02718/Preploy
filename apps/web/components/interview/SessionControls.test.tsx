import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionControls } from "./SessionControls";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/interview/behavioral/session",
}));

function renderControls(props: Partial<Parameters<typeof SessionControls>[0]> = {}) {
  return render(
    <SessionControls
      isConnected={true}
      isMuted={false}
      onMute={vi.fn()}
      onUnmute={vi.fn()}
      onEndSession={vi.fn()}
      {...props}
    />
  );
}

describe("SessionControls — End Session button gate", () => {
  it("shows 'Starting session…' microcopy when sessionInitialized is false", () => {
    renderControls({ sessionInitialized: false });
    const elements = screen.getAllByText(/starting session/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("marks the element as aria-disabled when sessionInitialized is false", () => {
    renderControls({ sessionInitialized: false });
    const btn = screen.getByRole("button", { name: /starting session/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows 'End Session' button (not disabled) when sessionInitialized is true", () => {
    renderControls({ sessionInitialized: true });
    const endBtn = screen.getByRole("button", { name: /end session/i });
    expect(endBtn.getAttribute("aria-disabled")).toBeNull();
  });

  it("shows confirm dialog when End Session is clicked and session is initialized", () => {
    renderControls({ sessionInitialized: true });
    const endBtn = screen.getByRole("button", { name: /end session/i });
    fireEvent.click(endBtn);
    const confirmElements = screen.getAllByText(/end interview\?/i);
    expect(confirmElements.length).toBeGreaterThan(0);
  });

  it("does not show confirm dialog when clicking the disabled span (not initialized)", () => {
    renderControls({ sessionInitialized: false });
    const disabledEl = screen.getByRole("button", { name: /starting session/i });
    fireEvent.click(disabledEl);
    expect(screen.queryByText(/end interview\?/i)).toBeNull();
  });

  it("defaults sessionInitialized to true (backward compatibility)", () => {
    renderControls({}); // no sessionInitialized prop
    const endBtn = screen.getByRole("button", { name: /end session/i });
    expect(endBtn.getAttribute("aria-disabled")).toBeNull();
  });
});
