import type { GazeSample, GazeZone } from "./gaze-types";

// MediaPipe FaceLandmarker result type (minimal subset we need)
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceLandmarkerResult {
  faceLandmarks: Landmark[][];
  faceBlendshapes?: Array<{
    categories: Array<{ categoryName: string; score: number }>;
  }>;
}

// ---- MediaPipe landmark indices ----
// Left iris: 468-472, Right iris: 473-477
// Eye corners: left outer = 33, left inner = 133, right inner = 362, right outer = 263
// Upper/lower eyelid midpoints: left top = 159, left bottom = 145, right top = 386, right bottom = 374

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

// Head rotation keypoints (approximate from FaceMesh)
const NOSE_TIP = 1;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const FOREHEAD = 10;
const CHIN = 152;

/**
 * Compute the centroid of a set of landmarks by their indices.
 */
function centroid(landmarks: Landmark[], indices: number[]): Landmark {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const i of indices) {
    if (landmarks[i]) {
      x += landmarks[i].x;
      y += landmarks[i].y;
      z += landmarks[i].z;
      count++;
    }
  }
  if (count === 0) return { x: 0.5, y: 0.5, z: 0 };
  return { x: x / count, y: y / count, z: z / count };
}

/**
 * Compute the iris center from the 5 iris landmarks for a given eye.
 */
export function computeIrisCenter(
  landmarks: Landmark[],
  eye: "left" | "right"
): Landmark {
  return centroid(landmarks, eye === "left" ? LEFT_IRIS : RIGHT_IRIS);
}

/**
 * Compute the eye geometric center from corner and eyelid landmarks.
 */
export function computeEyeCenter(
  landmarks: Landmark[],
  eye: "left" | "right"
): Landmark {
  if (eye === "left") {
    return centroid(landmarks, [
      LEFT_EYE_OUTER,
      LEFT_EYE_INNER,
      LEFT_EYE_TOP,
      LEFT_EYE_BOTTOM,
    ]);
  }
  return centroid(landmarks, [
    RIGHT_EYE_OUTER,
    RIGHT_EYE_INNER,
    RIGHT_EYE_TOP,
    RIGHT_EYE_BOTTOM,
  ]);
}

/**
 * Compute the gaze direction as a normalized displacement vector.
 * eyeWidth is the pixel-normalized eye width (outer to inner corner).
 * Returns { x, y } normalized to [-1, 1] approximately.
 */
export function computeGazeDirection(
  irisCenter: Landmark,
  eyeCenter: Landmark,
  eyeWidth: number
): { x: number; y: number } {
  if (eyeWidth <= 0) return { x: 0, y: 0 };
  const dx = (irisCenter.x - eyeCenter.x) / eyeWidth;
  const dy = (irisCenter.y - eyeCenter.y) / eyeWidth;
  return { x: dx, y: dy };
}

/**
 * Estimate head yaw (left-right rotation) in degrees from face landmarks.
 * Uses the asymmetry between left and right ear distance to nose.
 */
function estimateHeadYaw(landmarks: Landmark[]): number {
  const nose = landmarks[NOSE_TIP];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  if (!nose || !leftEar || !rightEar) return 0;
  const leftDist = Math.sqrt((nose.x - leftEar.x) ** 2 + (nose.z - leftEar.z) ** 2);
  const rightDist = Math.sqrt((nose.x - rightEar.x) ** 2 + (nose.z - rightEar.z) ** 2);
  const sum = leftDist + rightDist;
  if (sum === 0) return 0;
  const ratio = (leftDist - rightDist) / (sum / 2);
  // Scale ratio to approximate degrees (empirically ~90° max rotation gives ratio ~1)
  return Math.max(-90, Math.min(90, ratio * 90));
}

/**
 * Estimate head pitch (up-down rotation) in degrees from face landmarks.
 */
function estimateHeadPitch(landmarks: Landmark[]): number {
  const nose = landmarks[NOSE_TIP];
  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];
  if (!nose || !forehead || !chin) return 0;
  const totalHeight = Math.abs(chin.y - forehead.y);
  if (totalHeight < 1e-6) return 0;
  const noseRelative = (nose.y - forehead.y) / totalHeight - 0.5;
  return Math.max(-45, Math.min(45, noseRelative * 90));
}

/**
 * Estimate gaze confidence based on iris landmark visibility.
 * Uses z-depth of iris landmarks as a proxy: front-facing has z near 0,
 * extreme angles cause z to deviate.
 */
function estimateConfidence(landmarks: Landmark[]): number {
  const leftIris = centroid(landmarks, LEFT_IRIS);
  const rightIris = centroid(landmarks, RIGHT_IRIS);
  // Both iris centers should have z near 0 when facing forward
  const avgAbsZ = (Math.abs(leftIris.z) + Math.abs(rightIris.z)) / 2;
  // Map to confidence: z = 0 → 1.0, z = 0.1 → ~0
  const confidence = Math.max(0, 1 - avgAbsZ * 10);
  return Math.round(confidence * 100) / 100;
}

// Zone classification thresholds
const YAW_THRESHOLD = 15; // degrees
const PITCH_UP_THRESHOLD = 10;
const PITCH_DOWN_THRESHOLD = 15;
const CONFIDENCE_THRESHOLD = 0.3;

/**
 * Classify the gaze zone based on gaze direction, head pose, and confidence.
 */
export function classifyGazeZone(
  gazeX: number,
  gazeY: number,
  headYaw: number,
  headPitch: number,
  confidence: number
): GazeZone {
  if (confidence < CONFIDENCE_THRESHOLD) return "off-screen";

  // Combine iris direction and head rotation for zone classification
  const combinedX = gazeX + headYaw / 90;
  const combinedY = gazeY + headPitch / 45;

  const absX = Math.abs(combinedX);
  const absY = Math.abs(combinedY);

  // Dominant direction
  if (absX > absY) {
    if (Math.abs(headYaw) > YAW_THRESHOLD || absX > 0.3) {
      return combinedX < 0 ? "left" : "right";
    }
  } else {
    if (headPitch < -PITCH_UP_THRESHOLD || combinedY < -0.2) {
      return "up";
    }
    if (headPitch > PITCH_DOWN_THRESHOLD || combinedY > 0.3) {
      return "down";
    }
  }

  return "center";
}

/**
 * Main entry point: extract a GazeSample from a FaceLandmarkerResult.
 * Returns null if no face was detected.
 */
export function extractGazeSample(
  result: FaceLandmarkerResult,
  timestampMs: number
): GazeSample | null {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null;
  }

  const landmarks = result.faceLandmarks[0];

  // Need at least enough landmarks for iris detection
  if (landmarks.length < 478) {
    return null;
  }

  const leftIrisCenter = computeIrisCenter(landmarks, "left");
  const leftEyeCenter = computeEyeCenter(landmarks, "left");
  const rightIrisCenter = computeIrisCenter(landmarks, "right");
  const rightEyeCenter = computeEyeCenter(landmarks, "right");

  const leftEyeWidth = Math.abs(
    (landmarks[LEFT_EYE_OUTER]?.x ?? 0) - (landmarks[LEFT_EYE_INNER]?.x ?? 0)
  );
  const rightEyeWidth = Math.abs(
    (landmarks[RIGHT_EYE_OUTER]?.x ?? 0) - (landmarks[RIGHT_EYE_INNER]?.x ?? 0)
  );

  const leftGaze = computeGazeDirection(leftIrisCenter, leftEyeCenter, leftEyeWidth);
  const rightGaze = computeGazeDirection(rightIrisCenter, rightEyeCenter, rightEyeWidth);

  // Average both eyes
  const gazeX = Math.max(-1, Math.min(1, (leftGaze.x + rightGaze.x) / 2));
  const gazeY = Math.max(-1, Math.min(1, (leftGaze.y + rightGaze.y) / 2));

  const headYaw = estimateHeadYaw(landmarks);
  const headPitch = estimateHeadPitch(landmarks);
  const confidence = estimateConfidence(landmarks);

  return {
    t: timestampMs,
    gaze_x: Math.round(gazeX * 1000) / 1000,
    gaze_y: Math.round(gazeY * 1000) / 1000,
    head_yaw: Math.round(headYaw * 10) / 10,
    head_pitch: Math.round(headPitch * 10) / 10,
    confidence,
  };
}
