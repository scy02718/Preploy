import { describe, it, expect, vi } from "vitest";
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

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: vi.fn(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

describe("Header", () => {
  it("renders the app title", () => {
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Preploy").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the theme toggle button", () => {
    mockPathname.value = "/dashboard";
    const { container } = render(<Header />);
    const toggle = container.querySelector("[aria-label='Toggle theme']");
    expect(toggle).toBeTruthy();
  });

  it("renders Sign In link when unauthenticated", () => {
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation links", () => {
    mockPathname.value = "/dashboard";
    render(<Header />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Behavioral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Coaching").length).toBeGreaterThanOrEqual(1);
  });

  it("renders STAR Prep, Resume, and Achievements navigation links", () => {
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
    mockPathname.value = "/star";
    render(<Header />);
    const starLinks = screen.getAllByRole("link", { name: "STAR Prep" });
    // The active nav link should have the active class applied
    const activeLink = starLinks.find((el) =>
      el.className.includes("bg-accent") && el.className.includes("text-accent-foreground")
    );
    expect(activeLink).toBeTruthy();
  });
});
