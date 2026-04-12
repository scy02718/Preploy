import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeakAreas, WeakArea } from "./WeakAreas";

const SAMPLE_AREAS: WeakArea[] = [
  { topic: "lack of metrics", count: 5, total: 8 },
  { topic: "vague examples", count: 3, total: 8 },
  { topic: "poor structure", count: 2, total: 8 },
];

describe("WeakAreas", () => {
  it("renders weak areas sorted by frequency", () => {
    render(<WeakAreas areas={SAMPLE_AREAS} />);
    expect(screen.getAllByText("Weak Areas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("lack of metrics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("vague examples").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("poor structure").length).toBeGreaterThanOrEqual(1);
  });

  it("shows session counts", () => {
    render(<WeakAreas areas={SAMPLE_AREAS} />);
    expect(screen.getAllByText("5/8 sessions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3/8 sessions").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no areas", () => {
    render(<WeakAreas areas={[]} />);
    expect(
      screen.getAllByText(/No weak areas identified yet/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows link to coaching page", () => {
    render(<WeakAreas areas={SAMPLE_AREAS} />);
    const links = screen.getAllByText("View coaching tips to improve");
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].closest("a")?.getAttribute("href")).toBe("/coaching");
  });
});
