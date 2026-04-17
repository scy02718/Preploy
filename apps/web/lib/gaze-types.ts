export interface GazeSample {
  t: number; // timestamp ms since session start
  gaze_x: number; // normalized [-1, 1]
  gaze_y: number; // normalized [-1, 1]
  head_yaw: number; // degrees
  head_pitch: number; // degrees
  confidence: number; // 0-1
}

export type GazeZone =
  | "center"
  | "up"
  | "down"
  | "left"
  | "right"
  | "off-screen";

export const GAZE_SAMPLE_RATE_HZ = 2;
export const GAZE_MAX_SAMPLES = 3600; // 2 Hz × 25 min × ~1.2 safety
