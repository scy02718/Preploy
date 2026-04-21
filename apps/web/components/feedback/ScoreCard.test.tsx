import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreCard } from "./ScoreCard";

describe("ScoreCard", () => {
  it("renders the score formatted to one decimal", () => {
    render(<ScoreCard score={7.5} summary="Nice work" />);
    expect(screen.getByText("7.5")).toBeInTheDocument();
  });

  it("renders the summary text", () => {
    render(<ScoreCard score={5} summary="Average performance overall" />);
    expect(screen.getByText("Average performance overall")).toBeInTheDocument();
  });

  it("applies red styling for score below 4", () => {
    const { container } = render(<ScoreCard score={2.0} summary="summary" />);
    expect(container.querySelector("[class*='text-red']")).toBeTruthy();
    expect(screen.getByText("Needs Work")).toBeInTheDocument();
  });

  it("applies yellow styling for score 4-6", () => {
    const { container } = render(<ScoreCard score={5.0} summary="summary" />);
    expect(container.querySelector("[class*='text-yellow']")).toBeTruthy();
  });

  it("applies green styling for score 7-8", () => {
    const { container } = render(<ScoreCard score={8.0} summary="summary" />);
    expect(container.querySelector("[class*='text-green']")).toBeTruthy();
  });

  it("applies blue styling for score 9+", () => {
    const { container } = render(<ScoreCard score={9.5} summary="summary" />);
    expect(container.querySelector("[class*='text-blue']")).toBeTruthy();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("caps the summary height so Pro-tier 500-800 word summaries scroll inside the card", () => {
    // Pro-tier prompts ask for a 500-800 word overall summary, which was
    // blowing out the card height on the feedback dashboard. Guard against
    // regression by asserting the summary stays bounded + scrollable.
    const longSummary = "x".repeat(2000);
    render(<ScoreCard score={5} summary={longSummary} />);
    const summary = screen.getByText(longSummary);
    expect(summary.className).toContain("max-h-40");
    expect(summary.className).toContain("overflow-y-auto");
  });
});
