import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparePage from "./page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty sessions list
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [], pagination: { totalCount: 0 } }),
    });
  });

  it("renders the page title", () => {
    render(<ComparePage />);
    expect(screen.getAllByText("Compare Sessions").length).toBeGreaterThanOrEqual(1);
  });

  it("renders session selectors", () => {
    render(<ComparePage />);
    expect(screen.getAllByText("Session A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Session B").length).toBeGreaterThanOrEqual(1);
  });

  it("renders default feedback prompt when no session selected", () => {
    render(<ComparePage />);
    expect(
      screen.getAllByText("Select a session above to view feedback.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders back link to dashboard", () => {
    render(<ComparePage />);
    const links = document.querySelectorAll('a[href="/dashboard"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
