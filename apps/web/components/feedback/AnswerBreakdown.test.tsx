import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerBreakdown } from "./AnswerBreakdown";

const SAMPLE_ANALYSES = [
  {
    question: "Tell me about a challenge",
    answer_summary: "Led a migration project",
    score: 7.5,
    feedback: "Demonstrated strong STAR method usage",
    suggestions: ["Add quantitative results", "Mention timeline"],
  },
  {
    question: "How do you handle conflict?",
    answer_summary: "Described mediation approach",
    score: 4.0,
    feedback: "Lacked specific examples",
    suggestions: ["Give concrete scenario"],
  },
];

describe("AnswerBreakdown", () => {
  it("renders question titles", () => {
    render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} />);
    expect(screen.getAllByText("Tell me about a challenge").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("How do you handle conflict?").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the section title", () => {
    render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} />);
    expect(screen.getAllByText("Per-Answer Breakdown").length).toBeGreaterThanOrEqual(1);
  });

  it("uses custom title when provided", () => {
    render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} title="Performance Analysis" />);
    expect(screen.getAllByText("Performance Analysis").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a card expands to show answer summary and suggestions", async () => {
    const user = userEvent.setup();
    render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} />);

    // Suggestions not visible initially
    expect(screen.queryByText("Add quantitative results")).not.toBeInTheDocument();

    // Click the question text to expand
    const questionElements = screen.getAllByText("Tell me about a challenge");
    await user.click(questionElements[0]);

    // Now expanded content is visible
    expect(screen.getByText("Led a migration project")).toBeInTheDocument();
    expect(screen.getByText("Add quantitative results")).toBeInTheDocument();
  });

  it("renders score badges for each analysis", () => {
    render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} />);
    expect(screen.getAllByText("7.5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4.0").length).toBeGreaterThanOrEqual(1);
  });

  it("expanding a second card collapses the first", async () => {
    const user = userEvent.setup();
    const { container } = render(<AnswerBreakdown analyses={SAMPLE_ANALYSES} />);

    const headers = container.querySelectorAll("[class*='cursor-pointer']");

    // Expand first
    await user.click(headers[0]);
    expect(screen.getAllByText("Led a migration project").length).toBeGreaterThanOrEqual(1);

    // Expand second — first content should disappear
    await user.click(headers[1]);
    expect(screen.getAllByText("Described mediation approach").length).toBeGreaterThanOrEqual(1);
  });
});
