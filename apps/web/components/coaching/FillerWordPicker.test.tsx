import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FillerWordPicker } from "./FillerWordPicker";
import type { FillerWord } from "./FillerWordPicker";

const SAMPLE_FILLERS: FillerWord[] = [
  {
    word: "um",
    before: "\"I, um, worked on a project.\"",
    after: "\"I worked on a project.\"",
    tip: "Replace with a brief pause.",
  },
  {
    word: "like",
    before: "\"It was like a really complex problem.\"",
    after: "\"It was a genuinely complex problem.\"",
    tip: "Cut it and replace vague words with concrete ones.",
  },
  {
    word: "basically",
    before: "\"I basically rewrote the service.\"",
    after: "\"I rewrote the service.\"",
    tip: "Own the work without hedging.",
  },
];

describe("FillerWordPicker", () => {
  it("renders all filler word chips", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    expect(screen.getAllByTestId("filler-chip-um").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("filler-chip-like").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("filler-chip-basically").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show panel before a chip is selected", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    expect(screen.queryByTestId("filler-panel-um")).toBeNull();
    expect(screen.queryByTestId("filler-panel-like")).toBeNull();
  });

  it("clicking a filler chip shows before/after panel", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    fireEvent.click(screen.getByTestId("filler-chip-um"));
    expect(screen.getByTestId("filler-panel-um")).toBeTruthy();
    expect(screen.getAllByText(/worked on a project/i).length).toBeGreaterThanOrEqual(1);
  });

  it("panel shows both before and after text", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    fireEvent.click(screen.getByTestId("filler-chip-like"));
    const panel = screen.getByTestId("filler-panel-like");
    expect(panel.textContent).toContain("Before");
    expect(panel.textContent).toContain("After");
    expect(panel.textContent).toContain("really complex problem");
    expect(panel.textContent).toContain("genuinely complex problem");
  });

  it("panel shows the tip for the selected filler", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    fireEvent.click(screen.getByTestId("filler-chip-basically"));
    const panel = screen.getByTestId("filler-panel-basically");
    expect(panel.textContent).toContain("Own the work without hedging");
  });

  it("clicking the same chip again hides the panel", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    fireEvent.click(screen.getByTestId("filler-chip-um"));
    expect(screen.getByTestId("filler-panel-um")).toBeTruthy();
    fireEvent.click(screen.getByTestId("filler-chip-um"));
    expect(screen.queryByTestId("filler-panel-um")).toBeNull();
  });

  it("clicking a different chip switches the panel", () => {
    render(<FillerWordPicker fillers={SAMPLE_FILLERS} />);
    fireEvent.click(screen.getByTestId("filler-chip-um"));
    expect(screen.getByTestId("filler-panel-um")).toBeTruthy();
    fireEvent.click(screen.getByTestId("filler-chip-like"));
    expect(screen.queryByTestId("filler-panel-um")).toBeNull();
    expect(screen.getByTestId("filler-panel-like")).toBeTruthy();
  });
});
