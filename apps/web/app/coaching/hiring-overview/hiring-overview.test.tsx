import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HiringOverviewPage from "./page";

describe("HiringOverviewPage", () => {
  it("renders the How Hiring Works heading", () => {
    render(<HiringOverviewPage />);
    expect(screen.getAllByText("How Hiring Works").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all 6 funnel stage headings", () => {
    render(<HiringOverviewPage />);
    expect(screen.getAllByText("Sourcing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Recruiter Screen").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical Screen").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Onsite Loop").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Debrief").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Offer").length).toBeGreaterThanOrEqual(1);
  });

  it("renders exactly 6 stage cards via data-testid", () => {
    render(<HiringOverviewPage />);
    const cards = screen.getAllByTestId(/stage-card/);
    expect(cards.length).toBe(6);
  });

  it("renders the Where Preploy Fits section", () => {
    render(<HiringOverviewPage />);
    expect(screen.getAllByText("Where Preploy Fits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders a link to /interview/behavioral/setup", () => {
    const { container } = render(<HiringOverviewPage />);
    const link = container.querySelector('a[href="/interview/behavioral/setup"]');
    expect(link).toBeTruthy();
  });

  it("renders a link to /interview/technical/setup", () => {
    const { container } = render(<HiringOverviewPage />);
    const link = container.querySelector('a[href="/interview/technical/setup"]');
    expect(link).toBeTruthy();
  });

  it("renders the animated stepper with motion-safe classes", () => {
    const { container } = render(<HiringOverviewPage />);
    const stageCards = container.querySelectorAll("[data-testid^='stage-card']");
    // Each card should have motion-safe animation classes
    stageCards.forEach((card) => {
      expect(card.className).toContain("motion-safe:animate-in");
    });
  });

  it("renders Reading the Funnel section", () => {
    render(<HiringOverviewPage />);
    expect(screen.getAllByText("Reading the Funnel").length).toBeGreaterThanOrEqual(1);
  });
});
