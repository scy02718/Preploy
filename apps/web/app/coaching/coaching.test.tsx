import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachingPage from "./page";

describe("CoachingPage", () => {
  it("renders the page title", () => {
    render(<CoachingPage />);
    expect(screen.getAllByText("Interview Coaching").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four tab triggers", () => {
    render(<CoachingPage />);
    expect(screen.getAllByText("Behavioral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("LeetCode").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("System Design").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Communication").length).toBeGreaterThanOrEqual(1);
  });

  it("renders behavioral content by default (STAR method)", () => {
    render(<CoachingPage />);
    expect(screen.getAllByText("The STAR Method").length).toBeGreaterThanOrEqual(1);
  });

  it("renders practice buttons with correct links", () => {
    const { container } = render(<CoachingPage />);
    const behavioralLink = container.querySelector('a[href="/interview/behavioral/setup"]');
    expect(behavioralLink).toBeTruthy();
  });
});
