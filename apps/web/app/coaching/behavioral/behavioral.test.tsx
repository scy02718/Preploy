import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock prefillStore for CompetencyChips component
const mockSetBehavioralPrefill = vi.fn();
vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: (selector: (s: { setBehavioralPrefill: typeof mockSetBehavioralPrefill }) => unknown) =>
    selector({ setBehavioralPrefill: mockSetBehavioralPrefill }),
}));

// Mock next/navigation for CompetencyChips component
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import BehavioralPage from "./page";

describe("BehavioralPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: migrated content
  it("renders the STAR Method heading", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("The STAR Method").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all four STAR components (Situation, Task, Action, Result)", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText(/S — Situation/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/T — Task/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/A — Action/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R — Result/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Common Question Categories section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Common Question Categories").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Tips for Success section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Tips for Success").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Practice Behavioral Interview button link", () => {
    const { container } = render(<BehavioralPage />);
    const link = container.querySelector('a[href="/interview/behavioral/setup"]');
    expect(link).toBeTruthy();
  });

  it("renders at least one tip about metrics", () => {
    render(<BehavioralPage />);
    const metricsText = screen.getAllByText(/metrics/i);
    expect(metricsText.length).toBeGreaterThanOrEqual(1);
  });

  // New: competency chips
  it("renders clickable competency chips for at least 4 competencies", () => {
    render(<BehavioralPage />);
    const chips = ["Leadership", "Conflict", "Ambiguity", "Impact"];
    chips.forEach((chip) => {
      expect(screen.getAllByTestId(`chip-${chip}`).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("clicking a competency chip expands example questions for that competency", () => {
    render(<BehavioralPage />);
    fireEvent.click(screen.getByTestId("chip-Leadership"));
    expect(screen.getByTestId("panel-Leadership")).toBeTruthy();
    expect(screen.getAllByText(/led a team/i).length).toBeGreaterThanOrEqual(1);
  });

  it("Practice this button routes to /interview/behavioral/setup via prefillStore", () => {
    render(<BehavioralPage />);
    fireEvent.click(screen.getByTestId("chip-Failure"));
    fireEvent.click(screen.getByTestId("practice-btn-Failure"));
    expect(mockSetBehavioralPrefill).toHaveBeenCalledWith(
      expect.objectContaining({ expected_questions: expect.any(Array) })
    );
    expect(mockPush).toHaveBeenCalledWith("/interview/behavioral/setup");
  });

  // New: What Interviewers Look For section
  it("renders What Interviewers Look For section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("What Interviewers Look For").length).toBeGreaterThanOrEqual(1);
  });

  // New: Red Flags section
  it("renders Red Flags to Avoid section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Red Flags to Avoid").length).toBeGreaterThanOrEqual(1);
  });

  // New: CTA for STAR Prep
  it("renders CTA linking to /star (STAR Prep)", () => {
    const { container } = render(<BehavioralPage />);
    const starLink = container.querySelector('a[href="/star"]');
    expect(starLink).toBeTruthy();
  });

  // New: Worked example section
  it("renders the Worked Example section", () => {
    render(<BehavioralPage />);
    expect(screen.getAllByText("Worked Example").length).toBeGreaterThanOrEqual(1);
  });
});
