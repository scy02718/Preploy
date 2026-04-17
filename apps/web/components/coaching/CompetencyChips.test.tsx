import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock prefillStore
const mockSetBehavioralPrefill = vi.fn();
vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: (selector: (s: { setBehavioralPrefill: typeof mockSetBehavioralPrefill }) => unknown) =>
    selector({ setBehavioralPrefill: mockSetBehavioralPrefill }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { CompetencyChips } from "./CompetencyChips";
import type { CompetencyItem } from "./CompetencyChips";

const SAMPLE_ITEMS: CompetencyItem[] = [
  {
    competency: "Leadership",
    questions: [
      "Tell me about a time you led a team.",
      "How do you influence without authority?",
    ],
  },
  {
    competency: "Conflict",
    questions: [
      "Describe a disagreement you resolved.",
      "How do you push back constructively?",
    ],
  },
  {
    competency: "Failure",
    questions: [
      "Tell me about a project that didn't go as planned.",
      "What was your biggest professional setback?",
    ],
  },
  {
    competency: "Ambiguity",
    questions: [
      "How do you decide when information is incomplete?",
      "Tell me about an unclear project.",
    ],
  },
];

describe("CompetencyChips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all competency chips", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    expect(screen.getAllByTestId("chip-Leadership").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("chip-Conflict").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("chip-Failure").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("chip-Ambiguity").length).toBeGreaterThanOrEqual(1);
  });

  it("renders at least 4 chips for 4 competencies", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    const chips = screen.getAllByRole("button").filter((btn) =>
      SAMPLE_ITEMS.some((item) => btn.textContent === item.competency)
    );
    expect(chips.length).toBeGreaterThanOrEqual(4);
  });

  it("does not show panel before a chip is clicked", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    expect(screen.queryByTestId("panel-Leadership")).toBeNull();
    expect(screen.queryByTestId("panel-Conflict")).toBeNull();
  });

  it("clicking a chip expands the panel with example questions", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    fireEvent.click(screen.getByTestId("chip-Leadership"));
    expect(screen.getByTestId("panel-Leadership")).toBeTruthy();
    expect(screen.getAllByText(/Tell me about a time you led a team/i).length).toBeGreaterThanOrEqual(1);
  });

  it("clicking the same chip again collapses the panel", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    fireEvent.click(screen.getByTestId("chip-Conflict"));
    expect(screen.getByTestId("panel-Conflict")).toBeTruthy();
    fireEvent.click(screen.getByTestId("chip-Conflict"));
    expect(screen.queryByTestId("panel-Conflict")).toBeNull();
  });

  it("clicking a different chip switches the panel", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    fireEvent.click(screen.getByTestId("chip-Leadership"));
    expect(screen.getByTestId("panel-Leadership")).toBeTruthy();
    fireEvent.click(screen.getByTestId("chip-Failure"));
    expect(screen.queryByTestId("panel-Leadership")).toBeNull();
    expect(screen.getByTestId("panel-Failure")).toBeTruthy();
  });

  it("Practice this button calls setBehavioralPrefill with competency questions", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    fireEvent.click(screen.getByTestId("chip-Leadership"));
    const practiceBtn = screen.getByTestId("practice-btn-Leadership");
    fireEvent.click(practiceBtn);
    expect(mockSetBehavioralPrefill).toHaveBeenCalledWith({
      expected_questions: SAMPLE_ITEMS[0].questions,
    });
  });

  it("Practice this button navigates to /interview/behavioral/setup", () => {
    render(<CompetencyChips items={SAMPLE_ITEMS} />);
    fireEvent.click(screen.getByTestId("chip-Conflict"));
    fireEvent.click(screen.getByTestId("practice-btn-Conflict"));
    expect(mockPush).toHaveBeenCalledWith("/interview/behavioral/setup");
  });
});
