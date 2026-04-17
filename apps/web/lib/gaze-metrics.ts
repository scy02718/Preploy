import type { GazeSample, GazeZone } from "./gaze-types";
import { classifyGazeZone } from "./gaze-geometry";

export interface GazeDistribution {
  center_pct: number;
  up_pct: number;
  down_pct: number;
  left_pct: number;
  right_pct: number;
  off_screen_pct: number;
}

export interface GazeTimelineBucket {
  bucket_start_s: number;
  dominant_zone: GazeZone;
  center_pct: number;
}

/**
 * Compute the fraction of the session covered by gaze samples.
 * Coverage = (last sample t - first sample t) / sessionDurationMs, clamped 0-1.
 */
export function computeCoverage(
  samples: GazeSample[],
  sessionDurationMs: number
): number {
  if (samples.length === 0 || sessionDurationMs <= 0) return 0;
  if (samples.length === 1) return 0;
  const span = samples[samples.length - 1].t - samples[0].t;
  return Math.min(1, Math.max(0, span / sessionDurationMs));
}

/**
 * Compute a gaze consistency score (0-100) based on how often the user
 * maintained camera-forward gaze. Returns null when coverage is below 50%.
 */
export function computeGazeConsistencyScore(
  samples: GazeSample[],
  sessionDurationMs: number
): number | null {
  if (samples.length === 0) return null;

  const coverage = computeCoverage(samples, sessionDurationMs);
  if (coverage < 0.5) return null;

  let totalWeight = 0;
  let centerWeight = 0;

  for (const sample of samples) {
    const zone = classifyGazeZone(
      sample.gaze_x,
      sample.gaze_y,
      sample.head_yaw,
      sample.head_pitch,
      sample.confidence
    );
    totalWeight += sample.confidence;
    if (zone === "center") {
      centerWeight += sample.confidence;
    }
  }

  if (totalWeight === 0) return null;

  const score = (100 * centerWeight) / totalWeight;
  return Math.round(score * 10) / 10;
}

/**
 * Compute the distribution of gaze zones as percentages.
 * Returns null when there are no samples.
 */
export function computeGazeDistribution(
  samples: GazeSample[]
): GazeDistribution | null {
  if (samples.length === 0) return null;

  const counts: Record<GazeZone, number> = {
    center: 0,
    up: 0,
    down: 0,
    left: 0,
    right: 0,
    "off-screen": 0,
  };

  for (const sample of samples) {
    const zone = classifyGazeZone(
      sample.gaze_x,
      sample.gaze_y,
      sample.head_yaw,
      sample.head_pitch,
      sample.confidence
    );
    counts[zone]++;
  }

  const total = samples.length;
  const pct = (zone: GazeZone) =>
    Math.round((counts[zone] / total) * 1000) / 10;

  return {
    center_pct: pct("center"),
    up_pct: pct("up"),
    down_pct: pct("down"),
    left_pct: pct("left"),
    right_pct: pct("right"),
    off_screen_pct: pct("off-screen"),
  };
}

/**
 * Group samples into time buckets and summarize each bucket.
 */
export function bucketSamplesForTimeline(
  samples: GazeSample[],
  bucketSeconds = 10
): GazeTimelineBucket[] {
  if (samples.length === 0) return [];

  const bucketMs = bucketSeconds * 1000;
  const bucketMap = new Map<number, GazeSample[]>();

  for (const sample of samples) {
    const bucketKey = Math.floor(sample.t / bucketMs);
    if (!bucketMap.has(bucketKey)) {
      bucketMap.set(bucketKey, []);
    }
    bucketMap.get(bucketKey)!.push(sample);
  }

  const result: GazeTimelineBucket[] = [];

  for (const [bucketKey, bucketSamples] of bucketMap) {
    const zoneCounts: Record<GazeZone, number> = {
      center: 0,
      up: 0,
      down: 0,
      left: 0,
      right: 0,
      "off-screen": 0,
    };

    for (const sample of bucketSamples) {
      const zone = classifyGazeZone(
        sample.gaze_x,
        sample.gaze_y,
        sample.head_yaw,
        sample.head_pitch,
        sample.confidence
      );
      zoneCounts[zone]++;
    }

    let dominantZone: GazeZone = "center";
    let maxCount = 0;
    for (const [zone, count] of Object.entries(zoneCounts) as [GazeZone, number][]) {
      if (count > maxCount) {
        maxCount = count;
        dominantZone = zone;
      }
    }

    const centerPct =
      bucketSamples.length > 0
        ? Math.round((zoneCounts["center"] / bucketSamples.length) * 1000) / 10
        : 0;

    result.push({
      bucket_start_s: bucketKey * bucketSeconds,
      dominant_zone: dominantZone,
      center_pct: centerPct,
    });
  }

  // Sort by bucket start time
  result.sort((a, b) => a.bucket_start_s - b.bucket_start_s);

  return result;
}
