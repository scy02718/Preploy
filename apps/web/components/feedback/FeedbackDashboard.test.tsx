import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { GazeDistribution, GazeTimelineBucket } from "@/lib/gaze-metrics";
import { FeedbackDashboard } from "./FeedbackDashboard";

const BEHAVIORAL_FEEDBACK = {
  overallScore: 7.5,
  summary: "Solid performance in behavioral interview.",
  strengths: ["Clear examples", "Structure was logical"],
  weaknesses: ["Could add more metrics"],
  answerAnalyses: [
    {
      question: "Describe a leadership experience",
      answer_summary: "Led a migration",
      score: 8.0,
      feedback: "Thorough response",
      suggestions: ["Add numbers"],
    },
  ],
};

const TECHNICAL_FEEDBACK = {
  ...BEHAVIORAL_FEEDBACK,
  codeQualityScore: 6.5,
  explanationQualityScore: 8.5,
  timelineAnalysis: [
    { timestamp_ms: 0, event_type: "speech" as const, summary: "Explained approach" },
    { timestamp_ms: 3000, event_type: "code_change" as const, summary: "Wrote initial code", code: "x = 1" },
  ],
};

describe("FeedbackDashboard", () => {
  it("renders summary text", () => {
    render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" />
    );
    expect(screen.getByText("Solid performance in behavioral interview.")).toBeInTheDocument();
  });

  it("renders strengths and weaknesses", () => {
    render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" />
    );
    expect(screen.getAllByText("Clear examples").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Could add more metrics").length).toBeGreaterThanOrEqual(1);
  });

  it("renders answer breakdown with behavioral title", () => {
    render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" />
    );
    expect(screen.getAllByText("Per-Answer Breakdown").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Describe a leadership experience").length).toBeGreaterThanOrEqual(1);
  });

  it("behavioral mode does NOT render CodeQualityCard or TimelineView", () => {
    render(
      <FeedbackDashboard
        feedback={BEHAVIORAL_FEEDBACK}
        sessionId="test-id"
        sessionType="behavioral"
      />
    );
    expect(screen.queryByText("Code Quality")).toBeNull();
    expect(screen.queryByText("Session Timeline")).toBeNull();
  });

  it("technical mode renders CodeQualityCard", () => {
    render(
      <FeedbackDashboard
        feedback={TECHNICAL_FEEDBACK}
        sessionId="test-id"
        sessionType="technical"
      />
    );
    expect(screen.getAllByText("Code Quality").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Explanation Quality").length).toBeGreaterThanOrEqual(1);
  });

  it("technical mode renders TimelineView", () => {
    render(
      <FeedbackDashboard
        feedback={TECHNICAL_FEEDBACK}
        sessionId="test-id"
        sessionType="technical"
      />
    );
    expect(screen.getAllByText("Session Timeline").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Explained approach").length).toBeGreaterThanOrEqual(1);
  });

  it("technical mode uses Performance Analysis title", () => {
    render(
      <FeedbackDashboard
        feedback={TECHNICAL_FEEDBACK}
        sessionId="test-id"
        sessionType="technical"
      />
    );
    expect(screen.getAllByText("Performance Analysis").length).toBeGreaterThanOrEqual(1);
  });

  it("behavioral links to behavioral setup page", () => {
    const { container } = render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" sessionType="behavioral" />
    );
    const links = container.querySelectorAll('a[href="/interview/behavioral/setup"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("technical links to technical setup page", () => {
    const { container } = render(
      <FeedbackDashboard feedback={TECHNICAL_FEEDBACK} sessionId="test-id" sessionType="technical" />
    );
    const links = container.querySelectorAll('a[href="/interview/technical/setup"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Export PDF button", () => {
    render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" />
    );
    expect(screen.getAllByText("Export PDF").length).toBeGreaterThanOrEqual(1);
  });

  it("behavioral session with gaze data renders GazePresenceCard", () => {
    const gazeDistribution: GazeDistribution = {
      center_pct: 75,
      up_pct: 5,
      down_pct: 10,
      left_pct: 5,
      right_pct: 5,
      off_screen_pct: 0,
    };
    const gazeTimeline: GazeTimelineBucket[] = [
      { bucket_start_s: 0, dominant_zone: "center", center_pct: 80 },
    ];
    render(
      <FeedbackDashboard
        feedback={{
          ...BEHAVIORAL_FEEDBACK,
          gazeConsistencyScore: 78,
          gazeDistribution,
          gazeCoverage: 0.9,
          gazeTimeline,
        }}
        sessionId="test-id"
        sessionType="behavioral"
      />
    );
    // GazePresenceCard renders "Eye Contact" as the CardTitle
    expect(screen.getAllByText("Eye Contact").length).toBeGreaterThanOrEqual(1);
  });

  it("behavioral session without gaze data omits GazePresenceCard", () => {
    render(
      <FeedbackDashboard
        feedback={BEHAVIORAL_FEEDBACK}
        sessionId="test-id"
        sessionType="behavioral"
      />
    );
    expect(screen.queryByText("Eye Contact")).toBeNull();
  });

  it("renders Pro analysis banner when feedback.analysisTier is 'pro'", () => {
    render(
      <FeedbackDashboard
        feedback={{ ...BEHAVIORAL_FEEDBACK, analysisTier: "pro" }}
        sessionId="test-id"
      />
    );
    const banner = screen.getByTestId("pro-analysis-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Pro analysis");
  });

  it("does not render Pro analysis banner when feedback.analysisTier is 'free'", () => {
    render(
      <FeedbackDashboard
        feedback={{ ...BEHAVIORAL_FEEDBACK, analysisTier: "free" }}
        sessionId="test-id"
      />
    );
    expect(screen.queryByTestId("pro-analysis-banner")).toBeNull();
  });

  it("does not render Pro analysis banner when feedback.analysisTier is null (old pre-column row)", () => {
    render(
      <FeedbackDashboard
        feedback={{ ...BEHAVIORAL_FEEDBACK, analysisTier: null }}
        sessionId="test-id"
      />
    );
    expect(screen.queryByTestId("pro-analysis-banner")).toBeNull();
  });

  it("does not render Pro analysis banner when feedback.analysisTier is undefined", () => {
    render(
      <FeedbackDashboard feedback={BEHAVIORAL_FEEDBACK} sessionId="test-id" />
    );
    expect(screen.queryByTestId("pro-analysis-banner")).toBeNull();
  });
});
