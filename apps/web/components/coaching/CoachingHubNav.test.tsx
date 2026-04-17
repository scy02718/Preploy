import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState, useContext, createContext } from "react";

// --- Mock next/navigation ---------------------------------------------------
const mockPathname = vi.hoisted(() => vi.fn(() => "/coaching/hiring-overview"));
const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

// --- Context for the stateful dropdown mock ---------------------------------
type DropdownCtxType = { open: boolean; setOpen: (v: boolean) => void };
const DropdownCtx = createContext<DropdownCtxType>({
  open: false,
  setOpen: () => {},
});

// --- Mock DropdownMenu using React state so open/close actually re-renders --
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
      <DropdownCtx.Provider value={{ open, setOpen }}>
        <div data-testid="dropdown-root">{children}</div>
      </DropdownCtx.Provider>
    );
  },
  DropdownMenuTrigger: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLButtonElement>) => {
    const { setOpen } = useContext(DropdownCtx);
    return (
      <button
        data-testid="dropdown-trigger"
        onClick={() => setOpen(true)}
        {...props}
      >
        {children}
      </button>
    );
  },
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => {
    const { open } = useContext(DropdownCtx);
    return open ? (
      <div data-testid="dropdown-content">{children}</div>
    ) : null;
  },
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div data-testid="dropdown-item" onClick={onClick} role="menuitem">
      {children}
    </div>
  ),
}));

import { CoachingHubNav } from "./CoachingHubNav";

describe("CoachingHubNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 116-B: Hub nav renders 4 tabs as links with correct hrefs
  it("renders all 4 tabs as links with correct href attributes", () => {
    mockPathname.mockReturnValue("/coaching/hiring-overview");
    const { container } = render(<CoachingHubNav />);
    const links = container.querySelectorAll("a");
    const hrefs = Array.from(links).map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/coaching/hiring-overview");
    expect(hrefs).toContain("/coaching/behavioral");
    expect(hrefs).toContain("/coaching/technical");
    expect(hrefs).toContain("/coaching/communication");
  });

  // 116-C: Active-state class applied on hiring-overview tab
  it("applies active class when pathname is /coaching/hiring-overview", () => {
    mockPathname.mockReturnValue("/coaching/hiring-overview");
    const { container } = render(<CoachingHubNav />);
    const hiringLink = container.querySelector(
      'a[href="/coaching/hiring-overview"]'
    );
    expect(hiringLink?.className).toContain("bg-accent");
    expect(hiringLink?.className).toContain("text-accent-foreground");
  });

  // 116-C: Active-state class applied on behavioral tab
  it("applies active class when pathname is /coaching/behavioral", () => {
    mockPathname.mockReturnValue("/coaching/behavioral");
    const { container } = render(<CoachingHubNav />);
    const behavioralLink = container.querySelector(
      'a[href="/coaching/behavioral"]'
    );
    expect(behavioralLink?.className).toContain("bg-accent");
    expect(behavioralLink?.className).toContain("text-accent-foreground");
    // Other tabs should NOT have active class
    const hiringLink = container.querySelector(
      'a[href="/coaching/hiring-overview"]'
    );
    expect(hiringLink?.className).not.toContain("bg-accent");
  });

  // 116-E: Mobile picker shows current tab label in trigger
  it("mobile picker trigger shows current tab label (Technical)", () => {
    mockPathname.mockReturnValue("/coaching/technical");
    render(<CoachingHubNav />);
    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger.textContent).toContain("Technical");
  });

  // 116-E: Mobile picker opens and lists all 4 destinations when clicked
  it("mobile picker opens to list all 4 destinations when clicked", () => {
    mockPathname.mockReturnValue("/coaching/behavioral");
    render(<CoachingHubNav />);

    // Before click: content not visible
    expect(screen.queryByTestId("dropdown-content")).toBeNull();

    // Click trigger
    const trigger = screen.getByTestId("dropdown-trigger");
    fireEvent.click(trigger);

    // After click: content shows all 4 items
    expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();
    const items = screen.getAllByTestId("dropdown-item");
    expect(items.length).toBe(4);
    const itemTexts = items.map((item) => item.textContent);
    expect(itemTexts).toContain("Hiring Overview");
    expect(itemTexts).toContain("Behavioral");
    expect(itemTexts).toContain("Technical");
    expect(itemTexts).toContain("Communication");
  });

  // Active class applies correctly even when pathname has a deeper path
  it("active class applies correctly on /coaching/behavioral/extra-path", () => {
    mockPathname.mockReturnValue("/coaching/behavioral/extra-path");
    const { container } = render(<CoachingHubNav />);
    const behavioralLink = container.querySelector(
      'a[href="/coaching/behavioral"]'
    );
    expect(behavioralLink?.className).toContain("bg-accent");
  });
});
