import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./Header";

// Mutable pathname so individual tests can override it
const mockPathname = { value: "/dashboard" };

// Mock next/navigation — Header uses both usePathname and useRouter (the
// latter for the Profile dropdown item's client-side nav).
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// Hoisted mock for usePlan so individual tests can flip the return value
const { usePlanMock } = vi.hoisted(() => ({ usePlanMock: vi.fn() }));
vi.mock("@/hooks/usePlan", () => ({
  usePlan: usePlanMock,
  signOutAndClearPlan: vi.fn(),
}));

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

describe("Header", () => {
  // useReportTimezone fires a PATCH on mount when session is authenticated.
  // Stub fetch so tests don't see unexpected network calls or warnings.
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("renders the app title", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Preploy").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the theme toggle button", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/dashboard";
    const { container } = render(<Header />);
    const toggle = container.querySelector("[aria-label='Toggle theme']");
    expect(toggle).toBeTruthy();
  });

  it("renders Sign In link when unauthenticated", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation links", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Behavioral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Coaching").length).toBeGreaterThanOrEqual(1);
  });

  it("renders STAR Prep, Resume, and Achievements navigation links", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/dashboard";
    render(<Header />);
    const starLinks = screen.getAllByRole("link", { name: "STAR Prep" });
    expect(starLinks.length).toBeGreaterThanOrEqual(1);
    expect(starLinks[0]).toHaveAttribute("href", "/star");

    const resumeLinks = screen.getAllByRole("link", { name: "Resume" });
    expect(resumeLinks.length).toBeGreaterThanOrEqual(1);
    expect(resumeLinks[0]).toHaveAttribute("href", "/resume");

    const achievementsLinks = screen.getAllByRole("link", { name: "Achievements" });
    expect(achievementsLinks.length).toBeGreaterThanOrEqual(1);
    expect(achievementsLinks[0]).toHaveAttribute("href", "/achievements");
  });

  it("highlights active route for STAR Prep", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockPathname.value = "/star";
    render(<Header />);
    const starLinks = screen.getAllByRole("link", { name: "STAR Prep" });
    // The active nav link should have the active class applied
    const activeLink = starLinks.find((el) =>
      el.className.includes("bg-accent") && el.className.includes("text-accent-foreground")
    );
    expect(activeLink).toBeTruthy();
  });

  // ---- Pro badge tests ----

  it("renders \"Pro\" badge with aria-label \"Pro plan\" when plan is \"pro\"", () => {
    usePlanMock.mockReturnValue({ plan: "pro" });
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", name: "Alice", email: "alice@example.com", image: null } },
      status: "authenticated",
    });
    mockPathname.value = "/dashboard";
    render(<Header />);

    // Badge text
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
    // aria-label
    expect(screen.getByLabelText("Pro plan")).toBeTruthy();
  });

  it("does not render the Pro badge when plan is \"free\"", () => {
    usePlanMock.mockReturnValue({ plan: "free" });
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", name: "Alice", email: "alice@example.com", image: null } },
      status: "authenticated",
    });
    mockPathname.value = "/dashboard";
    render(<Header />);

    // No badge with aria-label
    expect(screen.queryByLabelText("Pro plan")).toBeNull();
    // No element with text "Pro" (nav links have none)
    expect(screen.queryByText("Pro")).toBeNull();
  });

  it("does not render the Pro badge (or any placeholder) when plan is undefined (loading)", () => {
    usePlanMock.mockReturnValue({ plan: undefined });
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", name: "Alice", email: "alice@example.com", image: null } },
      status: "authenticated",
    });
    mockPathname.value = "/dashboard";
    const { container } = render(<Header />);

    // No badge text
    expect(screen.queryByText("Pro")).toBeNull();
    // No aria-label on a badge
    expect(screen.queryByLabelText("Pro plan")).toBeNull();
    // No animate-pulse sibling next to the avatar (only the loading state div has animate-pulse)
    const pulsing = container.querySelectorAll(".animate-pulse");
    // The only animate-pulse allowed is from status==="loading" branch, which isn't active here
    expect(pulsing.length).toBe(0);
  });
});
