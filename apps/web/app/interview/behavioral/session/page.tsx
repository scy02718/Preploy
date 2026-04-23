"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useInterviewStore } from "@/stores/interviewStore";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useGazeCapture } from "@/hooks/useGazeCapture";
import { buildBehavioralSystemPrompt } from "@/lib/prompts";
import { BEHAVIORAL_SESSION_MAX_DURATION_SECONDS } from "@/lib/plans";
import type { BehavioralSessionConfig } from "@preploy/shared";
import { VideoCallLayout } from "@/components/interview/VideoCallLayout";
import { SessionControls } from "@/components/interview/SessionControls";
import { Loader2, X } from "lucide-react";

export default function BehavioralSessionPage() {
  const router = useRouter();
  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number | null>(null);
  const autoEndTriggeredRef = useRef(false);

  // Video element ref for gaze capture
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const {
    sessionId,
    config,
    status,
    startSession,
    endSession,
    addTranscriptEntry,
  } = useInterviewStore();

  const behavioralConfig = config as BehavioralSessionConfig;
  // gaze_enabled is set during session setup; defaults to false
  const gazeSessionEnabled = behavioralConfig.gaze_enabled === true;

  // Build system prompt from config
  const systemPrompt = useMemo(
    () => buildBehavioralSystemPrompt(behavioralConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config]
  );

  const voice = useRealtimeVoice({ systemPrompt });

  // Gaze capture — only active if user opted in for this session
  const sessionStartTime = sessionStartRef.current ?? Date.now();
  const gaze = useGazeCapture({
    videoElement,
    enabled: gazeSessionEnabled,
    sessionStartTime,
  });

  // Wire the webcam video element from VideoCallLayout once it's available.
  const handleWebcamReady = useCallback((el: HTMLVideoElement) => {
    setVideoElement(el);
  }, []);

  // Redirect to setup if no session
  useEffect(() => {
    if (!sessionId) {
      router.replace("/interview/behavioral/setup");
    }
  }, [sessionId, router]);

  // Start session and connect voice on mount
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (sessionId && status === "configuring" && !hasStartedRef.current) {
      hasStartedRef.current = true;
      sessionStartRef.current = Date.now();
      startSession();
      voice.connect();
    }

    return () => {
      // Cleanup on unmount (React Strict Mode remount)
      voice.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Sync voice transcript entries into the Zustand store
  useEffect(() => {
    const entries = voice.transcript;
    if (entries.length === 0) return;

    const latest = entries[entries.length - 1];
    addTranscriptEntry({
      speaker: latest.speaker === "assistant" ? "ai" : "user",
      text: latest.text,
      timestamp_ms: latest.timestamp,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcript.length]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [voice.transcript.length]);

  // Wall-clock timer: ticks every 500ms, updates elapsed seconds state, and
  // auto-ends the session at BEHAVIORAL_SESSION_MAX_DURATION_SECONDS. The
  // cap is the primary cost gate for behavioral sessions (a runaway session
  // with continuous voice streaming is the most expensive thing this product
  // can do). Enforced client-side for v1; the backend spend cap from issue
  // #68 is the eventual belt-and-suspenders.
  useEffect(() => {
    if (!sessionStartRef.current) return;
    const interval = setInterval(() => {
      if (!sessionStartRef.current) return;
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setElapsedSeconds(elapsed);
      if (
        elapsed >= BEHAVIORAL_SESSION_MAX_DURATION_SECONDS &&
        !autoEndTriggeredRef.current
      ) {
        autoEndTriggeredRef.current = true;
        handleEndSession();
      }
    }, 500);
    return () => clearInterval(interval);
    // handleEndSession is stable via useCallback; including it would create
    // a recreate-interval loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // End session handler
  const handleEndSession = useCallback(async () => {
    voice.disconnect();

    // Save transcript
    if (sessionId) {
      const entries = useInterviewStore.getState().transcript;
      try {
        await fetch(`/api/sessions/${sessionId}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
      } catch (err) {
        console.error("Failed to save transcript:", err);
      }

      // Save gaze samples if enabled for this session
      if (gazeSessionEnabled) {
        const samples = gaze.flush();
        if (samples.length > 0) {
          try {
            await fetch(`/api/sessions/${sessionId}/gaze-samples`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ samples }),
            });
          } catch (err) {
            console.error("Failed to save gaze samples:", err);
          }
        }
      }
    }

    await endSession();

    // Fire-and-forget: trigger feedback generation + badge check in background
    fetch(`/api/sessions/${sessionId}/feedback`, { method: "POST" }).catch(
      (err) => console.error("Failed to trigger feedback generation:", err)
    );
    fetch("/api/users/badges", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.awarded?.length > 0) {
          sessionStorage.setItem("new_badges", JSON.stringify(data.awarded));
        }
      })
      .catch((err) => console.error("Failed to check badges:", err));

    router.push(`/dashboard/sessions/${sessionId}/feedback`);
  }, [voice, sessionId, endSession, router, gazeSessionEnabled, gaze]);

  // Don't render until we have a session
  if (!sessionId) return null;

  const remainingSeconds = Math.max(
    0,
    BEHAVIORAL_SESSION_MAX_DURATION_SECONDS - elapsedSeconds
  );
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const isLastMinute = remainingSeconds <= 60 && remainingSeconds > 0;
  const formattedRemaining = `${remainingMin}:${remainingSec
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Session timer — top-right, counts down from 20:00. Turns destructive
          red in the last minute so the user knows the session will auto-end. */}
      <div
        className={`absolute top-4 right-4 z-10 rounded-md border bg-background/90 px-3 py-1.5 text-sm font-medium tabular-nums shadow backdrop-blur transition-colors motion-safe:duration-[var(--duration-base)] ${
          isLastMinute
            ? "border-destructive/60 text-destructive"
            : "text-muted-foreground"
        }`}
        data-testid="session-timer"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Time remaining: ${formattedRemaining}`}
      >
        {formattedRemaining} left
      </div>

      {/* Gaze loading indicator — shown briefly while MediaPipe initializes */}
      {gazeSessionEnabled && gaze.isLoading && (
        <div className="absolute top-4 left-4 z-10 rounded-md border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow backdrop-blur">
          Loading presence analysis...
        </div>
      )}

      {/* Connecting overlay — visible while the Realtime voice channel is
          negotiating. The bottom-bar "Connecting…" text is easy to miss while
          the user is looking at the 3D interviewer; this top-center pill
          gives a clearer "AI is about to speak to you" cue. Hidden once
          connected, and suppressed if voice.error is set (the error banner
          below takes over in that case). */}
      {!voice.isConnected && !voice.error && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow backdrop-blur"
        >
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Connecting to your AI interviewer…
          </span>
        </div>
      )}

      {/* Video call area */}
      <VideoCallLayout
        isSpeaking={voice.isSpeaking}
        isListening={voice.isListening}
        aiAudioLevel={voice.isSpeaking ? 0.5 : 0}
        onWebcamReady={gazeSessionEnabled ? handleWebcamReady : undefined}
      />

      {/* Transcript overlay */}
      {showTranscript && (
        <div
          id="session-transcript-panel"
          className="absolute bottom-16 right-4 z-10 h-64 w-80 overflow-y-auto rounded-lg border bg-background/90 p-3 shadow-lg backdrop-blur"
          role="region"
          aria-label="Live transcript"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Live Transcript
            </span>
            <button
              onClick={() => setShowTranscript(false)}
              aria-label="Close transcript"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {voice.transcript.map((entry, i) => (
              <div key={i}>
                <span
                  className={`font-medium ${
                    entry.speaker === "assistant"
                      ? "text-[color:var(--chart-5)]"
                      : "text-primary"
                  }`}
                >
                  {entry.speaker === "assistant" ? "Interviewer" : "You"}:
                </span>{" "}
                <span className="text-foreground/80">{entry.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* Transcript toggle button — ≥44px touch target per WCAG AA; announces
          expanded state and the panel it controls. */}
      {!showTranscript && (
        <button
          onClick={() => setShowTranscript(true)}
          aria-expanded={false}
          aria-controls="session-transcript-panel"
          className="absolute bottom-16 right-4 z-10 inline-flex h-11 items-center rounded-md border bg-background/80 px-4 text-xs font-medium text-muted-foreground shadow backdrop-blur transition-colors hover:bg-background hover:text-foreground"
        >
          Show Transcript
        </button>
      )}

      {/* Error display */}
      {voice.error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {voice.error}
        </div>
      )}

      {/* Controls */}
      <SessionControls
        isConnected={voice.isConnected}
        isMuted={voice.isMuted}
        onMute={voice.mute}
        onUnmute={voice.unmute}
        onEndSession={handleEndSession}
        sessionInitialized={voice.transcript.length > 0}
      />
    </div>
  );
}
