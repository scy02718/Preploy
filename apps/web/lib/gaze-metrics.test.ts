import { describe, it, expect } from "vitest";
import type { GazeSample } from "./gaze-types";
import {
  computeCoverage,
  computeGazeConsistencyScore,
  computeGazeDistribution,
  bucketSamplesForTimeline,
} from "./gaze-metrics";

function makeSample(overrides?: Partial<GazeSample>): GazeSample {
  return {
    t: 0,
    gaze_x: 0,
    gaze_y: 0,
    head_yaw: 0,
    head_pitch: 0,
    confidence: 0.9,
    ...overrides,
  };
}

// Samples that classifyGazeZone will classify as "center":
// gaze_x=0, gaze_y=0, head_yaw=0, head_pitch=0, confidence=0.9
function makeCenterSample(t: number, confidence = 0.9): GazeSample {
  return makeSample({ t, gaze_x: 0, gaze_y: 0, head_yaw: 0, head_pitch: 0, confidence });
}

// Samples that should be classified as "left":
// head_yaw=-30 > YAW_THRESHOLD(15), combined_x negative
function makeLeftSample(t: number, confidence = 0.9): GazeSample {
  return makeSample({ t, gaze_x: -0.5, gaze_y: 0, head_yaw: -30, head_pitch: 0, confidence });
}

// Samples with low confidence → off-screen
function makeOffScreenSample(t: number): GazeSample {
  return makeSample({ t, confidence: 0.1 }); // below CONFIDENCE_THRESHOLD(0.3)
}

describe("computeCoverage", () => {
  it("returns 0 for empty samples", () => {
    expect(computeCoverage([], 10000)).toBe(0);
  });

  it("returns 0 when sessionDurationMs <= 0", () => {
    const samples = [makeCenterSample(0), makeCenterSample(5000)];
    expect(computeCoverage(samples, 0)).toBe(0);
    expect(computeCoverage(samples, -1)).toBe(0);
  });

  it("returns 0 for a single sample", () => {
    expect(computeCoverage([makeCenterSample(0)], 10000)).toBe(0);
  });

  it("returns ~1.0 when samples span the full session duration", () => {
    const samples = [makeCenterSample(0), makeCenterSample(10000)];
    expect(computeCoverage(samples, 10000)).toBeCloseTo(1.0, 5);
  });

  it("returns ~0.5 when samples span half the session", () => {
    const samples = [makeCenterSample(0), makeCenterSample(5000)];
    expect(computeCoverage(samples, 10000)).toBeCloseTo(0.5, 5);
  });

  it("clamps to 1.0 when span exceeds session duration", () => {
    const samples = [makeCenterSample(0), makeCenterSample(12000)];
    expect(computeCoverage(samples, 10000)).toBe(1.0);
  });
});

describe("computeGazeConsistencyScore", () => {
  it("returns null for empty samples", () => {
    expect(computeGazeConsistencyScore([], 10000)).toBeNull();
  });

  it("returns null when coverage < 0.5 (suppressed)", () => {
    // span = 4000ms out of 10000ms = 0.4 coverage
    const samples = [makeCenterSample(0), makeCenterSample(4000)];
    expect(computeGazeConsistencyScore(samples, 10000)).toBeNull();
  });

  it("returns 100 when all samples are center with sufficient coverage", () => {
    const samples = [makeCenterSample(0), makeCenterSample(5000), makeCenterSample(10000)];
    const score = computeGazeConsistencyScore(samples, 10000);
    expect(score).toBe(100);
  });

  it("returns a low score when all samples are looking left", () => {
    const samples = [makeLeftSample(0), makeLeftSample(5000), makeLeftSample(10000)];
    const score = computeGazeConsistencyScore(samples, 10000);
    expect(score).not.toBeNull();
    expect(score!).toBe(0);
  });

  it("returns a mid-range score for an even mix of center and left samples", () => {
    const samples = [
      makeCenterSample(0),
      makeLeftSample(2000),
      makeCenterSample(4000),
      makeLeftSample(6000),
      makeCenterSample(8000),
      makeLeftSample(10000),
    ];
    const score = computeGazeConsistencyScore(samples, 10000);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(0);
    expect(score!).toBeLessThan(100);
  });

  it("weights low-confidence samples down", () => {
    // Two center samples with high confidence, one off-screen with very low confidence
    const highConfCenter1 = makeCenterSample(0, 0.9);
    const highConfCenter2 = makeCenterSample(5000, 0.9);
    const lowConfOff = makeOffScreenSample(10000);

    const samples = [highConfCenter1, highConfCenter2, lowConfOff];
    const score = computeGazeConsistencyScore(samples, 10000);
    expect(score).not.toBeNull();
    // high-confidence center samples should dominate the score
    expect(score!).toBeGreaterThan(80);
  });

  it("rounds to 1 decimal place", () => {
    // 2 center, 1 left — each with equal confidence 0.9
    const samples = [
      makeCenterSample(0, 0.9),
      makeCenterSample(5000, 0.9),
      makeLeftSample(10000, 0.9),
    ];
    const score = computeGazeConsistencyScore(samples, 10000);
    expect(score).not.toBeNull();
    // Score = 100 * (0.9+0.9) / (0.9+0.9+0.9) = 100 * 1.8/2.7 = 66.666... → 66.7
    expect(score).toBe(66.7);
  });
});

describe("computeGazeDistribution", () => {
  it("returns null for empty samples", () => {
    expect(computeGazeDistribution([])).toBeNull();
  });

  it("returns 100% center when all samples are center", () => {
    const samples = [makeCenterSample(0), makeCenterSample(1000), makeCenterSample(2000)];
    const dist = computeGazeDistribution(samples);
    expect(dist).not.toBeNull();
    expect(dist!.center_pct).toBe(100);
    expect(dist!.up_pct).toBe(0);
    expect(dist!.down_pct).toBe(0);
    expect(dist!.left_pct).toBe(0);
    expect(dist!.right_pct).toBe(0);
    expect(dist!.off_screen_pct).toBe(0);
  });

  it("returns expected percentages for a known input mix", () => {
    const samples = [
      makeCenterSample(0),
      makeCenterSample(1000),
      makeLeftSample(2000),
      makeLeftSample(3000),
      makeOffScreenSample(4000),
    ];
    const dist = computeGazeDistribution(samples);
    expect(dist).not.toBeNull();
    // 2 center / 5 = 40%
    expect(dist!.center_pct).toBe(40);
    // 2 left / 5 = 40%
    expect(dist!.left_pct).toBe(40);
    // 1 off-screen / 5 = 20%
    expect(dist!.off_screen_pct).toBe(20);
  });

  it("all percentages sum to ~100", () => {
    const samples = [
      makeCenterSample(0),
      makeLeftSample(1000),
      makeOffScreenSample(2000),
    ];
    const dist = computeGazeDistribution(samples);
    expect(dist).not.toBeNull();
    const sum =
      dist!.center_pct +
      dist!.up_pct +
      dist!.down_pct +
      dist!.left_pct +
      dist!.right_pct +
      dist!.off_screen_pct;
    expect(sum).toBeCloseTo(100, 0);
  });
});

describe("bucketSamplesForTimeline", () => {
  it("returns empty array for no samples", () => {
    expect(bucketSamplesForTimeline([])).toEqual([]);
  });

  it("groups 30s of samples into 3 buckets of 10s each", () => {
    const samples: GazeSample[] = [];
    for (let t = 0; t < 30000; t += 1000) {
      samples.push(makeCenterSample(t));
    }
    const buckets = bucketSamplesForTimeline(samples, 10);
    expect(buckets).toHaveLength(3);
    expect(buckets[0].bucket_start_s).toBe(0);
    expect(buckets[1].bucket_start_s).toBe(10);
    expect(buckets[2].bucket_start_s).toBe(20);
  });

  it("each bucket has the correct dominant_zone and center_pct", () => {
    // First 10s: center samples → dominant = center
    // Next 10s: left samples → dominant = left
    const samples: GazeSample[] = [
      ...Array.from({ length: 5 }, (_, i) => makeCenterSample(i * 2000)),
      ...Array.from({ length: 5 }, (_, i) => makeLeftSample(10000 + i * 2000)),
    ];
    const buckets = bucketSamplesForTimeline(samples, 10);
    expect(buckets[0].dominant_zone).toBe("center");
    expect(buckets[0].center_pct).toBe(100);
    expect(buckets[1].dominant_zone).toBe("left");
    expect(buckets[1].center_pct).toBe(0);
  });

  it("returns buckets sorted by bucket_start_s ascending", () => {
    // Insert samples out of order (Map iteration order depends on insertion)
    const samples: GazeSample[] = [
      makeCenterSample(20000),
      makeCenterSample(0),
      makeCenterSample(10000),
    ];
    const buckets = bucketSamplesForTimeline(samples, 10);
    expect(buckets[0].bucket_start_s).toBeLessThan(buckets[1].bucket_start_s);
    if (buckets.length > 2) {
      expect(buckets[1].bucket_start_s).toBeLessThan(buckets[2].bucket_start_s);
    }
  });
});
