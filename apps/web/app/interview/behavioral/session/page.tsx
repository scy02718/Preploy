"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useInterviewStore } from "@/stores/interviewStore";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { buildBehavioralSystemPrompt } from "@/lib/prompts";
import { BEHAVIORAL_SESSION_MAX_DURATION_SECONDS } from "@/lib/plans";
import type { BehavioralSessionConfig } from "@interview-assistant/shared";
import { VideoCallLayout } from "@/components/interview/VideoCallLayout";
import { SessionControls } from "@/components/interview/SessionControls";

export default function BehavioralSessionPage() {
  const router = useRouter();
  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number | null>(null);
  const autoEndTriggeredRef = useRef(false);

  const {
    sessionId,
    config,
    status,
    startSession,
    endSession,
    addTranscriptEntry,
  } = useInterviewStore();

  // Build system prompt from config
  const systemPrompt = useMemo(
    () => buildBehavioralSystemPrompt(config as BehavioralSessionConfig),
    [config]
  );

  const voice = useRealtimeVoice({ systemPrompt });

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
    }

    await endSession();

    // Fire-and-forget: trigger feedback generation + badge check in background
    fetch(`/api/sessions/${sessionId}/feedback`, { method: "POST" }).catch(
      (err) => console.error("Failed to trigger feedback generation:", err)
    );
    fetch("/api/users/badges", { method: "POST" }).catch(
      (err) => console.error("Failed to check badges:", err)
    );

    router.push(`/dashboard/sessions/${sessionId}/feedback`);
  }, [voice, sessionId, endSession, router]);

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
        className={`absolute top-4 right-4 z-10 rounded-md border bg-background/90 px-3 py-1.5 text-sm font-medium shadow backdrop-blur ${
          isLastMinute
            ? "border-destructive/60 text-destructive"
            : "text-muted-foreground"
        }`}
        data-testid="session-timer"
        aria-label={`Time remaining: ${formattedRemaining}`}
      >
        {formattedRemaining} left
      </div>

      {/* Video call area */}
      <VideoCallLayout
        isSpeaking={voice.isSpeaking}
        isListening={voice.isListening}
        aiAudioLevel={voice.isSpeaking ? 0.5 : 0}
      />

      {/* Transcript overlay */}
      {showTranscript && (
        <div className="absolute bottom-16 right-4 z-10 h-64 w-80 overflow-y-auto rounded-lg border bg-background/90 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Live Transcript
            </span>
            <button
              onClick={() => setShowTranscript(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {voice.transcript.map((entry, i) => (
              <div key={i}>
                <span
                  className={`font-medium ${
                    entry.speaker === "assistant"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-green-600 dark:text-green-400"
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

      {/* Transcript toggle button */}
      {!showTranscript && (
        <button
          onClick={() => setShowTranscript(true)}
          className="absolute bottom-16 right-4 z-10 rounded-md border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow backdrop-blur hover:bg-background"
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
      />
    </div>
  );
}
