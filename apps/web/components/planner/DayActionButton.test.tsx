import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PlanDay } from "@/lib/plan-generator";

// Hoist mock state so it can be read in assertions
const mockPush = vi.fn();
const mockSetStarPrepPrefill = vi.fn();
const mockSetBehavioralPrefill = vi.fn();
const mockSetTechnicalPrefill = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/stores/prefillStore", () => ({
  usePrefillStore: (selector: (s: {
    setStarPrepPrefill: typeof mockSetStarPrepPrefill;
    setBehavioralPrefill: typeof mockSetBehavioralPrefill;
    setTechnicalPrefill: typeof mockSetTechnicalPrefill;
  }) => unknown) =>
    selector({
      setStarPrepPrefill: mockSetStarPrepPrefill,
      setBehavioralPrefill: mockSetBehavioralPrefill,
      setTechnicalPrefill: mockSetTechnicalPrefill,
    }),
}));

import { DayActionButton } from "./DayActionButton";

function makeDay(overrides: Partial<PlanDay>): PlanDay {
  return {
    date: "2026-04-15",
    focus: "behavioral",
    topics: ["STAR method", "Leadership"],
    session_type: "behavioral",
    completed: false,
    ...overrides,
  };
}

describe("DayActionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Practice Behavioral' for behavioral day type", () => {
    render(<DayActionButton day={makeDay({ day_type: "behavioral" })} />);
    expect(screen.getAllByText(/Practice Behavioral/i).length).toBeGreaterThan(0);
  });

  it("renders 'Practice Technical' for technical day type", () => {
    render(<DayActionButton day={makeDay({ focus: "technical", day_type: "technical" })} />);
    expect(screen.getAllByText(/Practice Technical/i).length).toBeGreaterThan(0);
  });

  it("renders 'Go to STAR Prep' for star-prep day type", () => {
    render(<DayActionButton day={makeDay({ day_type: "star-prep" })} />);
    expect(screen.getAllByText(/Go to STAR Prep/i).length).toBeGreaterThan(0);
  });

  it("renders 'Review Resume' for resume day type", () => {
    render(<DayActionButton day={makeDay({ day_type: "resume" })} />);
    expect(screen.getAllByText(/Review Resume/i).length).toBeGreaterThan(0);
  });

  it("renders 'Go to Coaching' for coaching day type", () => {
    render(<DayActionButton day={makeDay({ day_type: "coaching" })} />);
    expect(screen.getAllByText(/Go to Coaching/i).length).toBeGreaterThan(0);
  });

  it("navigates to /interview/behavioral/setup on click for behavioral day", () => {
    render(<DayActionButton day={makeDay({ day_type: "behavioral" })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockPush).toHaveBeenCalledWith("/interview/behavioral/setup");
  });

  it("navigates to /interview/technical/setup on click for technical day", () => {
    render(<DayActionButton day={makeDay({ focus: "technical", day_type: "technical" })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockPush).toHaveBeenCalledWith("/interview/technical/setup");
  });

  it("navigates to /star on click for star-prep day", () => {
    render(<DayActionButton day={makeDay({ day_type: "star-prep" })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockPush).toHaveBeenCalledWith("/star");
  });

  it("calls setStarPrepPrefill with topics when clicking star-prep day", () => {
    const topics = ["STAR method", "Leadership story"];
    render(<DayActionButton day={makeDay({ day_type: "star-prep", topics })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockSetStarPrepPrefill).toHaveBeenCalledWith({ focus_topics: topics });
  });

  it("falls back to focus field for legacy days without day_type", () => {
    // Legacy day: has focus=behavioral, no day_type
    const legacyDay: PlanDay = {
      date: "2026-04-15",
      focus: "behavioral",
      topics: ["STAR"],
      session_type: "behavioral",
      completed: false,
      // day_type intentionally absent
    };
    render(<DayActionButton day={legacyDay} />);
    expect(screen.getAllByText(/Practice Behavioral/i).length).toBeGreaterThan(0);
  });

  it("navigates to /coaching for coaching day type", () => {
    render(<DayActionButton day={makeDay({ day_type: "coaching" })} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockPush).toHaveBeenCalledWith("/coaching");
  });
});
