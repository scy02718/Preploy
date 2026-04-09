"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface TranscriptEntry {
  speaker: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface UseRealtimeVoiceOptions {
  systemPrompt?: string;
  voice?: string;
}

interface UseRealtimeVoiceReturn {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  transcript: TranscriptEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  mute: () => void;
  unmute: () => void;
  error: string | null;
  /** AudioContext used for AI audio playback — use for lip-sync integration */
  playbackContext: AudioContext | null;
  /** AnalyserNode on the playback path — feed into useLipSync.connectAnalyser() */
  playbackAnalyser: AnalyserNode | null;
}

export function useRealtimeVoice(
  options: UseRealtimeVoiceOptions = {}
): UseRealtimeVoiceReturn {
  const {
    systemPrompt = "You are a friendly interviewer. Ask the user to tell you about themselves.",
    voice = "verse",
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const currentAssistantTextRef = useRef("");
  const currentUserTextRef = useRef("");
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const shouldReconnectRef = useRef(false);

  // Schedule-based audio playback — avoids race conditions by scheduling
  // chunks at precise times on the AudioContext timeline
  const nextPlayTimeRef = useRef(0);
  const scheduleDrainRef = useRef(false);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensurePlaybackContext = useCallback(() => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      const analyser = playbackContextRef.current.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(playbackContextRef.current.destination);
      playbackAnalyserRef.current = analyser;
      nextPlayTimeRef.current = 0;
    }
    return playbackContextRef.current;
  }, []);

  // Drain the queue: schedule all buffered chunks back-to-back
  const drainQueue = useCallback(() => {
    if (scheduleDrainRef.current) return; // already draining
    scheduleDrainRef.current = true;

    const ctx = ensurePlaybackContext();
    const analyser = playbackAnalyserRef.current;

    let lastEndTime = nextPlayTimeRef.current;

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;

      const int16 = new Int16Array(chunk);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      if (analyser) {
        source.connect(analyser);
      } else {
        source.connect(ctx.destination);
      }

      // Schedule at the next available time (no overlap possible)
      const startAt = Math.max(lastEndTime, ctx.currentTime);
      source.start(startAt);
      lastEndTime = startAt + audioBuffer.duration;
    }

    nextPlayTimeRef.current = lastEndTime;
    scheduleDrainRef.current = false;

    // Mark speaking and set a timeout to clear it when playback finishes
    isSpeakingRef.current = true; setIsSpeaking(true);
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    const remainingMs = Math.max(0, (lastEndTime - ctx.currentTime) * 1000);
    speakingTimeoutRef.current = setTimeout(() => {
      // Only clear speaking if no new audio has been queued
      if (audioQueueRef.current.length === 0) {
        isSpeakingRef.current = false; setIsSpeaking(false);
      }
    }, remainingMs + 100);
  }, [ensurePlaybackContext]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "session.created":
            console.log("Realtime session created");
            break;

          case "session.updated":
            console.log("Session updated");
            break;

          // GA event names
          case "response.output_audio.delta":
          // Beta fallback
          case "response.audio.delta": {
            // Decode base64 audio and queue for playback
            const binaryString = atob(msg.delta);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioQueueRef.current.push(bytes.buffer);
            drainQueue();
            break;
          }

          // GA event names
          case "response.output_audio_transcript.delta":
          // Beta fallback
          case "response.audio_transcript.delta":
            currentAssistantTextRef.current += msg.delta;
            break;

          // GA event names
          case "response.output_audio_transcript.done":
          // Beta fallback
          case "response.audio_transcript.done":
            if (currentAssistantTextRef.current.trim()) {
              setTranscript((prev) => [
                ...prev,
                {
                  speaker: "assistant",
                  text: currentAssistantTextRef.current.trim(),
                  timestamp: Date.now(),
                },
              ]);
            }
            currentAssistantTextRef.current = "";
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (msg.transcript?.trim()) {
              setTranscript((prev) => [
                ...prev,
                {
                  speaker: "user",
                  text: msg.transcript.trim(),
                  timestamp: Date.now(),
                },
              ]);
            }
            currentUserTextRef.current = "";
            break;

          case "input_audio_buffer.speech_started":
            setIsListening(true);
            break;

          case "input_audio_buffer.speech_stopped":
            setIsListening(false);
            break;

          case "error":
            console.error("Realtime API error:", msg.error);
            setError(msg.error?.message || "Realtime API error");
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    },
    [drainQueue]
  );

  const connect = useCallback(async () => {
    // Prevent double-connect (React Strict Mode runs effects twice)
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return;
    }

    setError(null);
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;

    // 1. Get ephemeral token
    let tokenData: { value?: string; client_secret?: { value?: string } };
    try {
      const res = await fetch("/api/realtime/token", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get token");
      }
      tokenData = await res.json();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get session token"
      );
      return;
    }

    // GA endpoint returns { value: "ek_..." }, beta returns { client_secret: { value: "..." } }
    const ephemeralKey = tokenData.value ?? tokenData.client_secret?.value;
    if (!ephemeralKey) {
      setError("No ephemeral key returned");
      return;
    }

    // 2. Request mic access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch {
      setError(
        "Microphone access denied. Please allow microphone access and try again."
      );
      return;
    }

    // 3. Connect WebSocket to OpenAI Realtime API
    const ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview`,
      ["realtime", `openai-insecure-api-key.${ephemeralKey}`]
    );
    wsRef.current = ws;

    ws.onopen = async () => {
      setIsConnected(true);

      // Send session config
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: ["audio"],
            instructions: systemPrompt,
            audio: {
              input: {
                format: {
                  type: "audio/pcm",
                  rate: 24000,
                },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 10000,
                },
              },
              output: {
                format: {
                  type: "audio/pcm",
                  rate: 24000,
                },
                voice,
              },
            },
          },
        })
      );

      // 4. Set up mic capture via AudioWorklet
      try {
        const audioContext = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = audioContext;

        await audioContext.audioWorklet.addModule("/audio-processor.js");

        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(
          audioContext,
          "audio-processor"
        );
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (e) => {
          if (
            e.data.type === "audio" &&
            ws.readyState === WebSocket.OPEN &&
            !isMutedRef.current &&
            !isSpeakingRef.current
          ) {
            // Convert ArrayBuffer to base64
            const bytes = new Uint8Array(e.data.audio);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64,
              })
            );
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
      } catch (err) {
        console.error("AudioWorklet setup error:", err);
        setError("Failed to set up audio capture");
      }
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsListening(false);
      isSpeakingRef.current = false; setIsSpeaking(false);

      // Auto-reconnect with exponential backoff
      if (
        shouldReconnectRef.current &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
        reconnectAttemptsRef.current++;
        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
        );
        setTimeout(() => {
          if (shouldReconnectRef.current) {
            connect();
          }
        }, delay);
      }
    };
  }, [systemPrompt, voice, handleMessage]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop mic
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Close audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    playbackAnalyserRef.current = null;

    workletNodeRef.current = null;
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    scheduleDrainRef.current = false;
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    isSpeakingRef.current = false; setIsSpeaking(false);
  }, []);

  // Keep audio context alive when tab loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && audioContextRef.current) {
        // Resume audio context if it was suspended when tab lost focus
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  const mute = useCallback(() => {
    isMutedRef.current = true;
    setIsMuted(true);
  }, []);
  const unmute = useCallback(() => {
    isMutedRef.current = false;
    setIsMuted(false);
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    isMuted,
    transcript,
    connect,
    disconnect,
    mute,
    unmute,
    error,
    playbackContext: playbackContextRef.current,
    playbackAnalyser: playbackAnalyserRef.current,
  };
}
