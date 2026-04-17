import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GazePresenceCard } from "./GazePresenceCard";
import type { GazeDistribution, GazeTimelineBucket } from "@/lib/gaze-metrics";

const FULL_DISTRIBUTION: GazeDistribution = {
  center_pct: 80,
  up_pct: 5,
  down_pct: 5,
  left_pct: 5,
  right_pct: 5,
  off_screen_pct: 0,
};

const WANDERING_DISTRIBUTION: GazeDistribution = {
  center_pct: 30,
  up_pct: 5,
  down_pct: 35,
  left_pct: 15,
  right_pct: 10,
  off_screen_pct: 5,
};

const OFF_SCREEN_DISTRIBUTION: GazeDistribution = {
  center_pct: 40,
  up_pct: 5,
  down_pct: 5,
  left_pct: 5,
  right_pct: 20,
  off_screen_pct: 25,
};

const SAMPLE_TIMELINE: GazeTimelineBucket[] = [
  { bucket_start_s: 0, dominant_zone: "center", center_pct: 90 },
  { bucket_start_s: 10, dominant_zone: "left", center_pct: 20 },
  { bucket_start_s: 20, dominant_zone: "center", center_pct: 85 },
];

describe("GazePresenceCard", () => {
  it("renders strong eye contact copy for a high score (85)", () => {
    render(
      <GazePresenceCard
        gazeConsistencyScore={85}
        gazeDistribution={FULL_DISTRIBUTION}
        gazeCoverage={0.9}
        gazeTimeline={SAMPLE_TIMELINE}
      />
    );
    expect(
      screen.getAllByText(/strong eye contact throughout/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/excellent/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mixed eye contact copy for a mid score (45)", () => {
    render(
      <GazePresenceCard
        gazeConsistencyScore={45}
        gazeDistribution={WANDERING_DISTRIBUTION}
        gazeCoverage={0.8}
        gazeTimeline={SAMPLE_TIMELINE}
      />
    );
    expect(
      screen.getAllByText(/mixed eye contact/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders Needs Work copy for a low score (25)", () => {
    render(
      <GazePresenceCard
        gazeConsistencyScore={25}
        gazeDistribution={WANDERING_DISTRIBUTION}
        gazeCoverage={0.7}
        gazeTimeline={SAMPLE_TIMELINE}
      />
    );
    expect(
      screen.getAllByText(/wandered frequently/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/needs work/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders insufficient data fallback when score is null", () => {
    render(
      <GazePresenceCard
        gazeConsistencyScore={null}
        gazeDistribution={null}
        gazeCoverage={null}
        gazeTimeline={null}
      />
    );
    expect(
      screen.getAllByText(/couldn't track your gaze/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders animate-pulse skeleton when isLoading=true", () => {
    const { container } = render(
      <GazePresenceCard
        gazeConsistencyScore={null}
        gazeDistribution={null}
        gazeCoverage={null}
        gazeTimeline={null}
        isLoading={true}
      />
    );
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders actionable tip when off_screen_pct > 20", () => {
    render(
      <GazePresenceCard
        gazeConsistencyScore={65}
        gazeDistribution={OFF_SCREEN_DISTRIBUTION}
        gazeCoverage={0.85}
        gazeTimeline={SAMPLE_TIMELINE}
      />
    );
    expect(
      screen.getAllByText(/notes near your camera/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders timeline strip when gazeTimeline has buckets", () => {
    const { container } = render(
      <GazePresenceCard
        gazeConsistencyScore={75}
        gazeDistribution={FULL_DISTRIBUTION}
        gazeCoverage={0.9}
        gazeTimeline={SAMPLE_TIMELINE}
      />
    );
    expect(
      screen.getAllByText(/gaze timeline/i).length
    ).toBeGreaterThanOrEqual(1);
    // 3 buckets should render as flex children
    const timelineContainer = container.querySelector(".flex.h-6");
    expect(timelineContainer).not.toBeNull();
    expect(timelineContainer!.children.length).toBe(3);
  });
});
