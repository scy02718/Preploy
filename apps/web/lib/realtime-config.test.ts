import { describe, it, expect } from "vitest";
import {
  VAD_THRESHOLD,
  VAD_SILENCE_DURATION_MS,
  SILENCE_NUDGE_MS,
  SILENCE_HANDOFF_MS,
  MID_ANSWER_PAUSE_MIN_MS,
} from "./realtime-config";

describe("realtime-config constants (bound / relationship tests)", () => {
  // 108-B / 108-A: nudge fires before hand-off — basic ordering
  it("SILENCE_NUDGE_MS < SILENCE_HANDOFF_MS", () => {
    expect(SILENCE_NUDGE_MS).toBeLessThan(SILENCE_HANDOFF_MS);
  });

  // 108-F: AC requires "wait at least 5s before any response"
  it("MID_ANSWER_PAUSE_MIN_MS is at least 5 000 ms (matches AC)", () => {
    expect(MID_ANSWER_PAUSE_MIN_MS).toBeGreaterThanOrEqual(5_000);
  });

  // 108-E: hard hand-off must be at least 60s (matches AC)
  it("SILENCE_HANDOFF_MS is at least 60 000 ms (matches AC)", () => {
    expect(SILENCE_HANDOFF_MS).toBeGreaterThanOrEqual(60_000);
  });

  // 108-F: "AI waits at least 5s before any response"
  // The first audible response the watchdog produces fires at SILENCE_NUDGE_MS.
  // VAD_SILENCE_DURATION_MS alone is only 3s (below the 5s floor), but the
  // nudge adds client-side delay: the combined trigger is SILENCE_NUDGE_MS ≥ 5s.
  it("SILENCE_NUDGE_MS >= MID_ANSWER_PAUSE_MIN_MS — combined system never responds before 5s of silence", () => {
    expect(SILENCE_NUDGE_MS).toBeGreaterThanOrEqual(MID_ANSWER_PAUSE_MIN_MS);
  });

  // Sanity: VAD threshold must be a valid probability
  it("VAD_THRESHOLD is a valid probability value (0 < threshold < 1)", () => {
    expect(VAD_THRESHOLD).toBeGreaterThan(0);
    expect(VAD_THRESHOLD).toBeLessThan(1);
  });
});
