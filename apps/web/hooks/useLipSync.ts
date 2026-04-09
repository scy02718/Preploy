"use client";

import { useRef, useCallback, useState } from "react";

// Viseme names matching Ready Player Me / Avaturn morph targets
const VISEME_NAMES = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
] as const;

export type VisemeName = (typeof VISEME_NAMES)[number];

export interface VisemeWeights {
  [key: string]: number;
}

// Pre-defined mouth poses that look natural when blended.
// Each pose activates multiple visemes at once for realistic shapes.
// We cycle through these based on audio energy so the mouth
// appears to form different shapes while speaking.
const MOUTH_POSES: { visemes: Partial<Record<VisemeName, number>> }[] = [
  // Slightly open, neutral
  { visemes: { viseme_aa: 0.3, viseme_O: 0.1, viseme_nn: 0.1 } },
  // Wide "ee"
  { visemes: { viseme_I: 0.3, viseme_E: 0.15, viseme_SS: 0.05 } },
  // Rounded "oh"
  { visemes: { viseme_O: 0.3, viseme_U: 0.15 } },
  // Closed lips "mm/pp"
  { visemes: { viseme_PP: 0.3, viseme_nn: 0.1 } },
  // "Ff/vv" — teeth on lip
  { visemes: { viseme_FF: 0.25, viseme_I: 0.1 } },
  // Open "ah"
  { visemes: { viseme_aa: 0.35, viseme_E: 0.1 } },
  // "Th" tongue
  { visemes: { viseme_TH: 0.2, viseme_DD: 0.1, viseme_I: 0.05 } },
  // "Ss" narrow
  { visemes: { viseme_SS: 0.2, viseme_I: 0.15, viseme_nn: 0.05 } },
];

export function useLipSync() {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | MediaStreamAudioSourceNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Track which pose we're on and when to switch
  const poseIndexRef = useRef(0);
  const poseSwitchTimerRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // Get current viseme weights based on audio energy + pose cycling
  const getVisemeWeights = useCallback((): VisemeWeights => {
    const weights: VisemeWeights = {};
    for (const name of VISEME_NAMES) {
      weights[name] = 0;
    }

    const analyser = analyserRef.current;
    if (!analyser || !frequencyDataRef.current) {
      return weights;
    }

    analyser.getByteFrequencyData(frequencyDataRef.current);
    const data = frequencyDataRef.current;

    // Calculate overall volume (RMS-like)
    let totalEnergy = 0;
    for (let i = 0; i < data.length; i++) {
      totalEnergy += data[i] / 255;
    }
    const avgEnergy = totalEnergy / data.length;

    // Time tracking for pose switching
    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    if (avgEnergy < 0.03) {
      // Silence — gently close mouth
      weights["viseme_sil"] = 0.05;
      poseSwitchTimerRef.current = 0;
      return weights;
    }

    // Advance pose timer — switch pose every 100-200ms for natural variation
    poseSwitchTimerRef.current += delta;
    const switchInterval = 0.1 + Math.random() * 0.1;
    if (poseSwitchTimerRef.current >= switchInterval) {
      poseSwitchTimerRef.current = 0;
      // Pick a different pose (avoid repeating the same one)
      let next = poseIndexRef.current;
      while (next === poseIndexRef.current) {
        next = Math.floor(Math.random() * MOUTH_POSES.length);
      }
      poseIndexRef.current = next;
    }

    // Apply current pose, scaled by audio energy
    const pose = MOUTH_POSES[poseIndexRef.current];
    const energyScale = Math.min(1, avgEnergy * 5);

    for (const [viseme, strength] of Object.entries(pose.visemes)) {
      weights[viseme] = (strength ?? 0) * energyScale;
    }

    return weights;
  }, []);

  // Connect an AudioBuffer (e.g., from a file) for lip-sync analysis
  const connectAudioBuffer = useCallback(
    (audioBuffer: AudioBuffer): { play: () => void; stop: () => void } => {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceRef.current = source;

      return {
        play: () => {
          source.start(0);
          setIsActive(true);
          source.onended = () => setIsActive(false);
        },
        stop: () => {
          try {
            source.stop();
          } catch {
            // Already stopped
          }
          setIsActive(false);
        },
      };
    },
    []
  );

  // Connect a MediaStream (e.g., from AI audio output) for lip-sync analysis
  const connectMediaStream = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    analyserRef.current = analyser;
    frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;
    setIsActive(true);
  }, []);

  // Connect an existing AudioContext and AnalyserNode (for piping from playback)
  const connectAnalyser = useCallback(
    (audioContext: AudioContext, analyser: AnalyserNode) => {
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setIsActive(true);
    },
    []
  );

  const disconnect = useCallback(() => {
    if (sourceRef.current && "stop" in sourceRef.current) {
      try {
        (sourceRef.current as AudioBufferSourceNode).stop();
      } catch {
        // Already stopped
      }
    }
    sourceRef.current = null;
    analyserRef.current = null;
    frequencyDataRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
  }, []);

  return {
    getVisemeWeights,
    connectAudioBuffer,
    connectMediaStream,
    connectAnalyser,
    disconnect,
    isActive,
    visemeNames: VISEME_NAMES,
  };
}
