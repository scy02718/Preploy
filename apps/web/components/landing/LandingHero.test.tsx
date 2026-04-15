import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingHero } from "./LandingHero";

const { mockUseRouter, mockUsePathname, mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseRouter: vi.fn(),
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
  usePathname: mockUsePathname,
}));

mockUseRouter.mockReturnValue({ push: mockPush });
mockUsePathname.mockReturnValue("/");

describe("LandingHero", () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;
  let getElementById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoViewMock = vi.fn();
    getElementById = vi.spyOn(document, "getElementById").mockReturnValue({
      scrollIntoView: scrollIntoViewMock,
    } as unknown as HTMLElement);
  });

  afterEach(() => {
    getElementById.mockRestore();
  });

  it("renders the primary headline", () => {
    render(<LandingHero />);
    expect(
      screen.getByText("Practice interviews until the real one feels easy")
    ).toBeTruthy();
  });

  it("renders the sub-headline explaining who and how", () => {
    render(<LandingHero />);
    expect(
      screen.getByText(/voice-to-voice mock interviews/i)
    ).toBeTruthy();
  });

  it("primary CTA links to /login", () => {
    render(<LandingHero />);
    const cta = screen.getByTestId("primary-cta");
    expect(cta.getAttribute("href")).toBe("/login");
  });

  it("primary CTA has correct text", () => {
    render(<LandingHero />);
    expect(screen.getByText("Start a free mock interview")).toBeTruthy();
  });

  it("secondary CTA scrolls to how-it-works section", () => {
    render(<LandingHero />);
    const secondaryCta = screen.getByTestId("secondary-cta");
    fireEvent.click(secondaryCta);
    expect(getElementById).toHaveBeenCalledWith("how-it-works");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("secondary CTA has correct text", () => {
    render(<LandingHero />);
    expect(screen.getByText("See how it works")).toBeTruthy();
  });

  it("renders the Preploy logo", () => {
    render(<LandingHero />);
    const logo = screen.getByAltText("Preploy");
    expect(logo).toBeTruthy();
  });
});
