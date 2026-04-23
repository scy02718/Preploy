import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HintButton } from "./HintButton";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("HintButton", () => {
  it("is disabled when hintsUsed >= hintsLimit", () => {
    render(
      <HintButton
        hintsUsed={1}
        hintsLimit={1}
        isLoading={false}
        onClick={vi.fn()}
        plan="free"
      />
    );
    const button = screen.getByRole("button", { name: /hint/i });
    expect(button).toBeDisabled();
  });

  it("shows correct remaining count for free user with 0 used", () => {
    render(
      <HintButton
        hintsUsed={0}
        hintsLimit={1}
        isLoading={false}
        onClick={vi.fn()}
        plan="free"
      />
    );
    // Use getAllByText since shadcn may render multiple
    const elements = screen.getAllByText(/Hint \(1 left\)/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("shows correct remaining count for pro user with 0 used", () => {
    render(
      <HintButton
        hintsUsed={0}
        hintsLimit={3}
        isLoading={false}
        onClick={vi.fn()}
        plan="pro"
      />
    );
    const elements = screen.getAllByText(/Hint \(3 left\)/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("does not call onClick when disabled (exhausted)", () => {
    const onClick = vi.fn();
    render(
      <HintButton
        hintsUsed={1}
        hintsLimit={1}
        isLoading={false}
        onClick={onClick}
        plan="free"
      />
    );
    const button = screen.getByRole("button", { name: /hint/i });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders spinner and loading text when isLoading is true", () => {
    render(
      <HintButton
        hintsUsed={0}
        hintsLimit={3}
        isLoading={true}
        onClick={vi.fn()}
        plan="pro"
      />
    );
    expect(screen.getByText(/Getting hint/i)).toBeDefined();
  });

  it("shows upgrade nudge for free user with exhausted hints", () => {
    render(
      <HintButton
        hintsUsed={1}
        hintsLimit={1}
        isLoading={false}
        onClick={vi.fn()}
        plan="free"
      />
    );
    const link = screen.getByRole("link", { name: /upgrade/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("does not show upgrade nudge for pro user even when exhausted", () => {
    render(
      <HintButton
        hintsUsed={3}
        hintsLimit={3}
        isLoading={false}
        onClick={vi.fn()}
        plan="pro"
      />
    );
    expect(screen.queryByRole("link", { name: /upgrade/i })).toBeNull();
  });
});
