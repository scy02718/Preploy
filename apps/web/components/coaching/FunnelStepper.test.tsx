import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FunnelStepper } from "./FunnelStepper";
import type { FunnelStage } from "./FunnelStepper";

const SAMPLE_STAGES: FunnelStage[] = [
  {
    number: 1,
    title: "Sourcing",
    who: "Recruiter",
    signals: "Resume fit",
    timeline: "Ongoing",
    preployFit: "Prepare your pitch",
  },
  {
    number: 2,
    title: "Technical Screen",
    who: "Engineer",
    signals: "Coding, problem-solving",
    timeline: "45-60 min",
    preployFit: "Technical sessions simulate this",
  },
  {
    number: 3,
    title: "Onsite Loop",
    who: "3-6 interviewers",
    signals: "Behavioral, coding, design",
    timeline: "Half day",
    preployFit: "Both session types help",
  },
];

describe("FunnelStepper", () => {
  it("renders all stage titles", () => {
    render(<FunnelStepper stages={SAMPLE_STAGES} />);
    expect(screen.getAllByText("Sourcing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Technical Screen").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Onsite Loop").length).toBeGreaterThanOrEqual(1);
  });

  it("renders stage numbers for each stage", () => {
    render(<FunnelStepper stages={SAMPLE_STAGES} />);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("renders who/signals/timeline/preployFit for each stage", () => {
    render(<FunnelStepper stages={SAMPLE_STAGES} />);
    expect(screen.getAllByText("Recruiter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Resume fit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ongoing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Prepare your pitch").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the correct number of stage cards", () => {
    render(<FunnelStepper stages={SAMPLE_STAGES} />);
    const cards = screen.getAllByTestId(/stage-card/);
    expect(cards.length).toBe(3);
  });

  it("renders an empty stepper when no stages given", () => {
    const { container } = render(<FunnelStepper stages={[]} />);
    const cards = container.querySelectorAll("[data-testid^='stage-card']");
    expect(cards.length).toBe(0);
  });
});
