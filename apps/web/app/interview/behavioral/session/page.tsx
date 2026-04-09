"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useInterviewStore } from "@/stores/interviewStore";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useLipSync } from "@/hooks/useLipSync";
import { buildBehavioralSystemPrompt } from "@/lib/prompts";
import { VideoCallLayout } from "@/components/interview/VideoCallLayout";
import { SessionControls } from "@/components/interview/SessionControls";
import { AvatarModelRef } from "@/components/avatar/AvatarModel";

export default function BehavioralSessionPage() {
  const router = useRouter();
  const avatarRef = useRef<AvatarModelRef>(null);
  const lipSyncConnectedRef = useRef(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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
    () => buildBehavioralSystemPrompt(config),
    [config]
  );

  const voice = useRealtimeVoice({ systemPrompt });
  const lipSync = useLipSync();

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
      startSession();
      voice.connect();
    }

    return () => {
      // Cleanup on unmount (React Strict Mode remount)
      voice.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Connect lip-sync to voice playback analyser when available
  useEffect(() => {
    if (
      voice.playbackContext &&
      voice.playbackAnalyser &&
      !lipSyncConnectedRef.current
    ) {
      lipSync.connectAnalyser(voice.playbackContext, voice.playbackAnalyser);
      lipSyncConnectedRef.current = true;
    }
  }, [voice.playbackContext, voice.playbackAnalyser, lipSync]);

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

  // End session handler
  const handleEndSession = useCallback(async () => {
    voice.disconnect();
    lipSync.disconnect();
    lipSyncConnectedRef.current = false;

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
    router.push(`/dashboard/sessions/${sessionId}/feedback`);
  }, [voice, lipSync, sessionId, endSession, router]);

  // Don't render until we have a session
  if (!sessionId) return null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Video call area */}
      <VideoCallLayout
        avatarRef={avatarRef}
        getVisemeWeights={lipSync.getVisemeWeights}
        isSpeaking={voice.isSpeaking}
        isListening={voice.isListening}
        userName={undefined}
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
