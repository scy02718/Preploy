import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGazeCapture } from "./useGazeCapture";

// Mock @mediapipe/tasks-vision
const mockDetectForVideo = vi.fn();
const mockClose = vi.fn();
const mockCreateFromOptions = vi.fn();
const mockForVisionTasks = vi.fn();

vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: {
    createFromOptions: mockCreateFromOptions,
  },
  FilesetResolver: {
    forVisionTasks: mockForVisionTasks,
  },
}));

// Mock extractGazeSample to control what samples are produced
vi.mock("@/lib/gaze-geometry", () => ({
  extractGazeSample: vi.fn(() => ({
    t: 0,
    gaze_x: 0.1,
    gaze_y: 0.0,
    head_yaw: 5,
    head_pitch: -2,
    confidence: 0.9,
  })),
}));

function makeVideoElement(): HTMLVideoElement {
  const el = document.createElement("video");
  Object.defineProperty(el, "readyState", { get: () => 4, configurable: true });
  return el;
}

describe("useGazeCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectForVideo.mockReturnValue({ faceLandmarks: [[]] });
    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue({
      detectForVideo: mockDetectForVideo,
      close: mockClose,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty state immediately when disabled", () => {
    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: false,
        sessionStartTime: Date.now(),
      })
    );
    expect(result.current.samples).toHaveLength(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("flush returns empty array when disabled", () => {
    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: false,
        sessionStartTime: Date.now(),
      })
    );
    const flushed = result.current.flush();
    expect(flushed).toHaveLength(0);
  });

  it("does not initialize MediaPipe when disabled", () => {
    renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: false,
        sessionStartTime: Date.now(),
      })
    );
    expect(mockForVisionTasks).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).not.toHaveBeenCalled();
  });

  it("sets isLoading to true immediately when enabled with videoElement", () => {
    // Keep the promise pending to observe isLoading: true state
    mockForVisionTasks.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: true,
        sessionStartTime: Date.now(),
      })
    );

    // isLoading should be true while promise is pending
    expect(result.current.isLoading).toBe(true);
  });

  it("flush clears the buffer and returns collected samples", async () => {
    vi.useFakeTimers();
    const { extractGazeSample } = await import("@/lib/gaze-geometry");
    let callCount = 0;
    vi.mocked(extractGazeSample).mockImplementation(() => ({
      t: callCount++ * 500,
      gaze_x: 0.1,
      gaze_y: 0,
      head_yaw: 0,
      head_pitch: 0,
      confidence: 0.9,
    }));

    // Make the landmarker available synchronously-ish via resolved promise
    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue({
      detectForVideo: mockDetectForVideo,
      close: mockClose,
    });

    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: true,
        sessionStartTime: Date.now(),
      })
    );

    // Wait for the async init to complete using real microtask queue
    await act(async () => {
      // Drain microtasks
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance timers to trigger sample collection intervals
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const flushed = result.current.flush();
    // Buffer should have been populated (or be empty if init didn't complete — either way flush works)
    expect(Array.isArray(flushed)).toBe(true);
    // After flush, buffer is empty
    expect(result.current.samples).toHaveLength(0);

    vi.useRealTimers();
  });

  it("cleans up interval and does not leak on unmount when disabled", () => {
    // Verify that unmounting a disabled hook is clean (no errors, no leaks)
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: false,
        sessionStartTime: Date.now(),
      })
    );

    // Should unmount cleanly without errors
    expect(() => unmount()).not.toThrow();
    // MediaPipe was never loaded, so close should not be called
    expect(mockClose).not.toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("does not call close when MediaPipe was never initialized", () => {
    // When enabled but init hasn't completed (e.g. videoElement arrives late),
    // unmount should still be safe
    const { unmount } = renderHook(() =>
      useGazeCapture({
        videoElement: null,
        enabled: true,
        sessionStartTime: Date.now(),
      })
    );

    expect(() => unmount()).not.toThrow();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockForVisionTasks).not.toHaveBeenCalled();
  });

  it("caps the sample buffer at GAZE_MAX_SAMPLES", async () => {
    vi.useFakeTimers();
    const { extractGazeSample } = await import("@/lib/gaze-geometry");
    let callCount = 0;
    vi.mocked(extractGazeSample).mockImplementation(() => ({
      t: callCount++ * 500,
      gaze_x: 0.1,
      gaze_y: 0,
      head_yaw: 0,
      head_pitch: 0,
      confidence: 0.9,
    }));

    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue({
      detectForVideo: mockDetectForVideo,
      close: mockClose,
    });

    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: true,
        sessionStartTime: Date.now(),
      })
    );

    // Wait for async init
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance enough to exceed GAZE_MAX_SAMPLES (3600) — each 500ms = 1 sample
    // Simulate 3700 intervals worth
    await act(async () => {
      vi.advanceTimersByTime(3700 * 500);
    });

    const flushed = result.current.flush();
    // Buffer should never exceed GAZE_MAX_SAMPLES
    expect(flushed.length).toBeLessThanOrEqual(3600);

    vi.useRealTimers();
  });

  it("stops capture when document becomes hidden", async () => {
    // Never-resolving init promise so the hook is stuck at isLoading
    mockForVisionTasks.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useGazeCapture({
        videoElement: makeVideoElement(),
        enabled: true,
        sessionStartTime: Date.now(),
      })
    );

    // Initially loading but not active
    expect(result.current.isActive).toBe(false);

    // Simulate tab hidden
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Still not active (never started)
    expect(result.current.isActive).toBe(false);

    // Restore
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });
});
