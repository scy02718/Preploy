import { describe, it, expect } from "vitest";
import {
  computeIrisCenter,
  computeEyeCenter,
  computeGazeDirection,
  classifyGazeZone,
  extractGazeSample,
  type Landmark,
  type FaceLandmarkerResult,
} from "./gaze-geometry";

// ---- helpers ----

function makeLandmark(x: number, y: number, z: number): Landmark {
  return { x, y, z };
}

/** Build a minimal 478-landmark array with all points at (0.5, 0.5, 0). */
function makeLandmarks(overrides: Record<number, Landmark> = {}): Landmark[] {
  const landmarks: Landmark[] = Array(478)
    .fill(null)
    .map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [idx, lm] of Object.entries(overrides)) {
    landmarks[Number(idx)] = lm;
  }
  return landmarks;
}

function makeResult(landmarks: Landmark[]): FaceLandmarkerResult {
  return { faceLandmarks: [landmarks] };
}

// ---- computeIrisCenter ----

describe("computeIrisCenter", () => {
  it("returns centroid of left iris landmarks (468-472)", () => {
    const landmarks = makeLandmarks({
      468: { x: 0.4, y: 0.5, z: 0 },
      469: { x: 0.42, y: 0.5, z: 0 },
      470: { x: 0.41, y: 0.48, z: 0 },
      471: { x: 0.39, y: 0.51, z: 0 },
      472: { x: 0.38, y: 0.5, z: 0 },
    });
    const center = computeIrisCenter(landmarks, "left");
    expect(center.x).toBeCloseTo(0.4, 2);
    expect(center.y).toBeCloseTo(0.498, 2);
  });

  it("returns centroid of right iris landmarks (473-477)", () => {
    const landmarks = makeLandmarks({
      473: { x: 0.6, y: 0.5, z: 0 },
      474: { x: 0.62, y: 0.5, z: 0 },
      475: { x: 0.61, y: 0.48, z: 0 },
      476: { x: 0.59, y: 0.51, z: 0 },
      477: { x: 0.58, y: 0.5, z: 0 },
    });
    const center = computeIrisCenter(landmarks, "right");
    expect(center.x).toBeCloseTo(0.6, 2);
  });
});

// ---- computeEyeCenter ----

describe("computeEyeCenter", () => {
  it("computes left eye center from corners and eyelids", () => {
    const landmarks = makeLandmarks({
      33: { x: 0.3, y: 0.5, z: 0 }, // left outer
      133: { x: 0.4, y: 0.5, z: 0 }, // left inner
      159: { x: 0.35, y: 0.45, z: 0 }, // top
      145: { x: 0.35, y: 0.55, z: 0 }, // bottom
    });
    const center = computeEyeCenter(landmarks, "left");
    expect(center.x).toBeCloseTo(0.35, 2);
    expect(center.y).toBeCloseTo(0.5, 2);
  });
});

// ---- computeGazeDirection ----

describe("computeGazeDirection", () => {
  it("returns zero vector when iris = eye center", () => {
    const lm = makeLandmark(0.5, 0.5, 0);
    const dir = computeGazeDirection(lm, lm, 0.05);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });

  it("returns positive x when iris is right of eye center", () => {
    const iris = makeLandmark(0.55, 0.5, 0);
    const eye = makeLandmark(0.5, 0.5, 0);
    const dir = computeGazeDirection(iris, eye, 0.1);
    expect(dir.x).toBeGreaterThan(0);
  });

  it("returns zero when eyeWidth is zero (guard against divide-by-zero)", () => {
    const lm = makeLandmark(0.5, 0.5, 0);
    const dir = computeGazeDirection(lm, lm, 0);
    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
  });
});

// ---- classifyGazeZone ----

describe("classifyGazeZone", () => {
  it("returns center for low displacement and neutral head pose", () => {
    expect(classifyGazeZone(0, 0, 0, 0, 0.9)).toBe("center");
  });

  it("returns off-screen for low confidence", () => {
    expect(classifyGazeZone(0, 0, 0, 0, 0.2)).toBe("off-screen");
  });

  it("returns off-screen exactly at the confidence threshold boundary (0.3 → off-screen)", () => {
    // Boundary: confidence < 0.3 → off-screen
    expect(classifyGazeZone(0, 0, 0, 0, 0.29)).toBe("off-screen");
    expect(classifyGazeZone(0, 0, 0, 0, 0.3)).toBe("center");
  });

  it("returns left for significant leftward yaw", () => {
    expect(classifyGazeZone(0, 0, -30, 0, 0.8)).toBe("left");
  });

  it("returns right for significant rightward yaw", () => {
    expect(classifyGazeZone(0, 0, 30, 0, 0.8)).toBe("right");
  });

  it("returns up for upward head pitch", () => {
    expect(classifyGazeZone(0, -0.4, 0, -20, 0.8)).toBe("up");
  });

  it("returns down for downward head pitch", () => {
    expect(classifyGazeZone(0, 0.4, 0, 20, 0.8)).toBe("down");
  });
});

// ---- extractGazeSample ----

describe("extractGazeSample", () => {
  it("returns null when no faces detected", () => {
    const result: FaceLandmarkerResult = { faceLandmarks: [] };
    expect(extractGazeSample(result, 0)).toBeNull();
  });

  it("returns null when landmark array is too short (< 478)", () => {
    const result: FaceLandmarkerResult = {
      faceLandmarks: [Array(100).fill({ x: 0.5, y: 0.5, z: 0 })],
    };
    expect(extractGazeSample(result, 0)).toBeNull();
  });

  it("returns a GazeSample with values in valid ranges", () => {
    const landmarks = makeLandmarks();
    const sample = extractGazeSample(makeResult(landmarks), 1000);
    expect(sample).not.toBeNull();
    if (!sample) return;
    expect(sample.t).toBe(1000);
    expect(sample.gaze_x).toBeGreaterThanOrEqual(-1);
    expect(sample.gaze_x).toBeLessThanOrEqual(1);
    expect(sample.gaze_y).toBeGreaterThanOrEqual(-1);
    expect(sample.gaze_y).toBeLessThanOrEqual(1);
    expect(sample.head_yaw).toBeGreaterThanOrEqual(-90);
    expect(sample.head_yaw).toBeLessThanOrEqual(90);
    expect(sample.head_pitch).toBeGreaterThanOrEqual(-45);
    expect(sample.head_pitch).toBeLessThanOrEqual(45);
    expect(sample.confidence).toBeGreaterThanOrEqual(0);
    expect(sample.confidence).toBeLessThanOrEqual(1);
  });

  it("passes the timestamp through unchanged", () => {
    const landmarks = makeLandmarks();
    const sample = extractGazeSample(makeResult(landmarks), 5000);
    expect(sample?.t).toBe(5000);
  });
});
