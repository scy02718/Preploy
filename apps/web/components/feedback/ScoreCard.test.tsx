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
});
