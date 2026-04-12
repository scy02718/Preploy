import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./Header";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
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
    render(<Header />);
    expect(screen.getAllByText("Preploy").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the theme toggle button", () => {
    const { container } = render(<Header />);
    const toggle = container.querySelector("[aria-label='Toggle theme']");
    expect(toggle).toBeTruthy();
  });

  it("renders Sign In link when unauthenticated", () => {
    render(<Header />);
    expect(screen.getAllByText("Sign In").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation links", () => {
    render(<Header />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Behavioral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Coaching").length).toBeGreaterThanOrEqual(1);
  });
});
