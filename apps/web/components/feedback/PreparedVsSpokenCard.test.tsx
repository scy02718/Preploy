import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreparedVsSpokenCard, PreparedVsSpokenCardSkeleton } from "./PreparedVsSpokenCard";

const FULL_DRIFT = {
  added: ["Mentioned the budget constraints explicitly"],
  omitted: ["The 3-month timeline detail was dropped"],
  tightened: ["Condensed the background from 3 sentences to 1"],
  loosened: ["Vague about the technical solution used"],
};

const EMPTY_DRIFT = {
  added: [],
  omitted: [],
  tightened: [],
  loosened: [],
};

describe("PreparedVsSpokenCard", () => {
  it("renders all 4 section headings", () => {
    render(<PreparedVsSpokenCard driftAnalysis={FULL_DRIFT} />);
    expect(screen.getAllByText(/added/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/omitted/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tightened/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/loosened/i).length).toBeGreaterThan(0);
  });

  it("renders bullet items for each section when data is present", () => {
    render(<PreparedVsSpokenCard driftAnalysis={FULL_DRIFT} />);
    expect(screen.getByText("Mentioned the budget constraints explicitly")).toBeDefined();
    expect(screen.getByText("The 3-month timeline detail was dropped")).toBeDefined();
    expect(screen.getByText("Condensed the background from 3 sentences to 1")).toBeDefined();
    expect(screen.getByText("Vague about the technical solution used")).toBeDefined();
  });

  it("renders empty-state labels when arrays are empty", () => {
    render(<PreparedVsSpokenCard driftAnalysis={EMPTY_DRIFT} />);
    expect(screen.getByText(/nothing new added/i)).toBeDefined();
    expect(screen.getByText(/nothing key was left out/i)).toBeDefined();
    expect(screen.getByText(/no notable tightening/i)).toBeDefined();
    expect(screen.getByText(/no notable loosening/i)).toBeDefined();
  });

  it("renders 'Prepared vs. Spoken' card title", () => {
    render(<PreparedVsSpokenCard driftAnalysis={FULL_DRIFT} />);
    expect(screen.getAllByText(/prepared vs\. spoken/i).length).toBeGreaterThan(0);
  });

  it("handles mixed empty and populated sections", () => {
    const mixedDrift = {
      added: ["Added detail about stakeholder buy-in"],
      omitted: [],
      tightened: [],
      loosened: ["Less specific about the outcome metrics"],
    };
    render(<PreparedVsSpokenCard driftAnalysis={mixedDrift} />);
    expect(screen.getByText("Added detail about stakeholder buy-in")).toBeDefined();
    expect(screen.getByText(/nothing key was left out/i)).toBeDefined();
    expect(screen.getByText(/no notable tightening/i)).toBeDefined();
    expect(screen.getByText("Less specific about the outcome metrics")).toBeDefined();
  });
});

describe("PreparedVsSpokenCardSkeleton", () => {
  it("renders without crashing", () => {
    render(<PreparedVsSpokenCardSkeleton />);
    // Should render 4 skeleton sections matching card shape
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});
