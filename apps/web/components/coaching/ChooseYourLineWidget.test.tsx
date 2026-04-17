import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChooseYourLineWidget } from "./ChooseYourLineWidget";
import type { ChoiceItem } from "./ChooseYourLineWidget";

const SAMPLE_SCENARIO = "You just finished implementing a brute-force solution. What do you say?";

const SAMPLE_CHOICES: ChoiceItem[] = [
  {
    line: "Moving on to the next problem.",
    feedback: "This signals you don't recognise the issue.",
    ideal: false,
  },
  {
    line: "I think this works — do you have questions?",
    feedback: "Deflecting misses a chance to demonstrate proactive problem-solving.",
    ideal: false,
  },
  {
    line: "I realise this is O(n²). Let me optimise using a hash map.",
    feedback: "This is the ideal response — name the complexity, propose a next step.",
    ideal: true,
  },
  {
    line: "Silent continued coding.",
    feedback: "Silence is a red flag.",
    ideal: false,
  },
];

describe("ChooseYourLineWidget", () => {
  it("renders the scenario text", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    expect(screen.getAllByText(SAMPLE_SCENARIO).length).toBeGreaterThanOrEqual(1);
  });

  it("renders at least 2 choice buttons", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    const choices = screen.getAllByTestId(/choice-\d+/);
    expect(choices.length).toBeGreaterThanOrEqual(2);
  });

  it("renders all 4 choices with labels A-D", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    expect(screen.getAllByTestId("choice-0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("choice-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("choice-2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("choice-3").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show feedback before a choice is selected", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    expect(screen.queryByTestId("choice-feedback")).toBeNull();
  });

  it("clicking a choice displays feedback", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    fireEvent.click(screen.getByTestId("choice-0"));
    expect(screen.getByTestId("choice-feedback")).toBeTruthy();
    expect(screen.getAllByText(/This signals you don't recognise/i).length).toBeGreaterThanOrEqual(1);
  });

  it("ideal choice feedback says Best response", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    fireEvent.click(screen.getByTestId("choice-2"));
    const feedback = screen.getByTestId("choice-feedback");
    expect(feedback.textContent).toContain("Best response");
  });

  it("non-ideal choice feedback says Not the strongest choice", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    fireEvent.click(screen.getByTestId("choice-0"));
    const feedback = screen.getByTestId("choice-feedback");
    expect(feedback.textContent).toContain("Not the strongest choice");
  });

  it("ideal feedback differs from non-ideal feedback text", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    fireEvent.click(screen.getByTestId("choice-2"));
    const idealFeedback = screen.getByTestId("choice-feedback").textContent ?? "";

    fireEvent.click(screen.getByTestId("choice-0"));
    const nonIdealFeedback = screen.getByTestId("choice-feedback").textContent ?? "";

    expect(idealFeedback).not.toBe(nonIdealFeedback);
  });

  it("clicking the same choice again hides feedback", () => {
    render(<ChooseYourLineWidget scenario={SAMPLE_SCENARIO} choices={SAMPLE_CHOICES} />);
    fireEvent.click(screen.getByTestId("choice-1"));
    expect(screen.getByTestId("choice-feedback")).toBeTruthy();
    fireEvent.click(screen.getByTestId("choice-1"));
    expect(screen.queryByTestId("choice-feedback")).toBeNull();
  });
});
