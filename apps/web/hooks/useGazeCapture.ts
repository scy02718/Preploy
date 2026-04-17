"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GazeSample } from "@/lib/gaze-types";
import { GAZE_SAMPLE_RATE_HZ, GAZE_MAX_SAMPLES } from "@/lib/gaze-types";
import { extractGazeSample } from "@/lib/gaze-geometry";

interface UseGazeCaptureOptions {
  videoElement: HTMLVideoElement | null;
  enabled: boolean;
  sessionStartTime: number;
}

interface UseGazeCaptureResult {
  samples: GazeSample[];
  flush: () => GazeSample[];
  isActive: boolean;
  isLoading: boolean;
}

export function useGazeCapture({
  videoElement,
  enabled,
  sessionStartTime,
}: UseGazeCaptureOptions): UseGazeCaptureResult {
  const [samples, setSamples] = useState<GazeSample[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const samplesRef = useRef<GazeSample[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceLandmarkerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
  }, []);

  const startCapture = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoElement) return;

    intervalRef.current = setInterval(() => {
      if (!faceLandmarkerRef.current || !videoElement || !mountedRef.current) return;
      if (videoElement.readyState < 2) return; // Not enough data

      try {
        const nowMs = Date.now();
        const result = faceLandmarkerRef.current.detectForVideo(
          videoElement,
          nowMs
        );
        const sample = extractGazeSample(result, nowMs - sessionStartTime);
        if (sample) {
          samplesRef.current = [
            ...samplesRef.current,
            sample,
          ].slice(-GAZE_MAX_SAMPLES);
          setSamples([...samplesRef.current]);
        }
      } catch {
        // Silent: video may not be ready yet
      }
    }, Math.round(1000 / GAZE_SAMPLE_RATE_HZ));

    setIsActive(true);
  }, [videoElement, sessionStartTime]);

  // Initialize MediaPipe when enabled + videoElement is ready
  useEffect(() => {
    if (!enabled || !videoElement) return;

    let cancelled = false;
    setIsLoading(true);

    async function init() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        if (cancelled || !mountedRef.current) return;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "/mediapipe/wasm"
        );
        if (cancelled || !mountedRef.current) return;

        const landmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: "/mediapipe/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFacialTransformationMatrixes: false,
            outputFaceBlendshapes: false,
          }
        );
        if (cancelled || !mountedRef.current) return;

        faceLandmarkerRef.current = landmarker;
        setIsLoading(false);
        startCapture();
      } catch {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [enabled, videoElement, startCapture]);

  // Pause on tab hidden, resume on visible
  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopCapture();
      } else if (
        document.visibilityState === "visible" &&
        faceLandmarkerRef.current &&
        videoElement
      ) {
        startCapture();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, videoElement, stopCapture, startCapture]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCapture();
      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {
          // Ignore close errors
        }
        faceLandmarkerRef.current = null;
      }
    };
  }, [stopCapture]);

  const flush = useCallback((): GazeSample[] => {
    const current = [...samplesRef.current];
    samplesRef.current = [];
    setSamples([]);
    return current;
  }, []);

  if (!enabled) {
    return {
      samples: [],
      flush: () => [],
      isActive: false,
      isLoading: false,
    };
  }

  return { samples, flush, isActive, isLoading };
}
