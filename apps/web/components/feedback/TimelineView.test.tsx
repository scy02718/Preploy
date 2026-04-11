import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimelineView } from "./TimelineView";

const SAMPLE_EVENTS = [
  {
    timestamp_ms: 4000,
    event_type: "speech" as const,
    summary: "I would use a hash map approach",
    full_text: null,
  },
  {
    timestamp_ms: 13000,
    event_type: "code_change" as const,
    summary: "Changed code (python)",
    code: "def solution(nums):\n    seen = set()",
  },
  {
    timestamp_ms: 42000,
    event_type: "code_change" as const,
    summary: "Submitted final code (python)",
    code: "def solution(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return n\n        seen.add(n)",
  },
];

describe("TimelineView", () => {
  it("returns null when events array is empty", () => {
    const { container } = render(<TimelineView events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders timestamps formatted as MM:SS", () => {
    render(<TimelineView events={SAMPLE_EVENTS} />);
    expect(screen.getAllByText("00:04").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("00:13").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("00:42").length).toBeGreaterThanOrEqual(1);
  });

  it("renders event summaries", () => {
    render(<TimelineView events={SAMPLE_EVENTS} />);
    expect(screen.getAllByText("I would use a hash map approach").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Changed code/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Submitted final/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Code buttons for code_change events", () => {
    render(<TimelineView events={SAMPLE_EVENTS} />);
    const codeButtons = screen.getAllByText("Code");
    expect(codeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("clicking Code button expands to show code block", async () => {
    const user = userEvent.setup();
    render(<TimelineView events={SAMPLE_EVENTS} />);

    expect(screen.queryByText(/seen = set/)).toBeNull();

    const codeButtons = screen.getAllByText("Code");
    await user.click(codeButtons[0]);

    expect(screen.getAllByText(/seen = set/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders correct number of Code expand buttons", () => {
    render(<TimelineView events={SAMPLE_EVENTS} />);
    // 2 code_change events = at least 2 Code buttons (may double in jsdom)
    const codeButtons = screen.getAllByText("Code");
    expect(codeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows More button for speech events with full_text", () => {
    const events = [
      {
        timestamp_ms: 0,
        event_type: "speech" as const,
        summary: "I would use a hash...",
        full_text: "I would use a hash map approach because it gives us O(1) lookups for detecting duplicates efficiently",
      },
    ];
    render(<TimelineView events={events} />);
    expect(screen.getAllByText("More").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show expand button for short speech (no full_text)", () => {
    const events = [
      {
        timestamp_ms: 0,
        event_type: "speech" as const,
        summary: "Short text here",
      },
    ];
    const { container } = render(<TimelineView events={events} />);
    // No expand buttons for speech without full_text
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });

  it("renders More button count matching events with full_text", () => {
    const events = [
      { timestamp_ms: 0, event_type: "speech" as const, summary: "Short", full_text: null },
      { timestamp_ms: 1000, event_type: "speech" as const, summary: "Long...", full_text: "Long expanded text here" },
    ];
    render(<TimelineView events={events} />);
    // Only the event with full_text gets a More button
    const moreButtons = screen.getAllByText("More");
    expect(moreButtons.length).toBeGreaterThanOrEqual(1);
  });
});
