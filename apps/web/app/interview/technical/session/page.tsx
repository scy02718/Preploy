"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useInterviewStore } from "@/stores/interviewStore";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useCodeSnapshots } from "@/hooks/useCodeSnapshots";
import type { TechnicalSessionConfig } from "@interview-assistant/shared";
import { TechnicalSessionLayout } from "@/components/interview/TechnicalSessionLayout";
import {
  ProblemDescription,
  type Problem,
} from "@/components/editor/ProblemDescription";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { MicIndicator } from "@/components/interview/MicIndicator";

export default function TechnicalSessionPage() {
  const router = useRouter();

  const { sessionId, config, type, status, startSession, endSession } =
    useInterviewStore();

  const techConfig = config as TechnicalSessionConfig;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemLoading, setProblemLoading] = useState(true);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { startRecording, stopRecording, isRecording, audioLevel } =
    useAudioRecorder();

  const sessionStartTimeRef = useRef(Date.now());
  const {
    code,
    setCode,
    language,
    setLanguage,
    resetCode,
    captureSnapshot,
    getSnapshots,
  } = useCodeSnapshots({
    sessionStartTime: sessionStartTimeRef.current,
    initialLanguage: techConfig.language ?? "python",
  });

  // Redirect if no session or wrong type
  useEffect(() => {
    if (!sessionId || type !== "technical") {
      router.replace("/interview/technical/setup");
    }
  }, [sessionId, type, router]);

  // Start session, fetch problem, start recording on mount
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!sessionId || status !== "configuring" || hasStartedRef.current) return;
    hasStartedRef.current = true;

    async function init() {
      await startSession();
      sessionStartTimeRef.current = Date.now();

      // Start mic recording
      try {
        await startRecording();
      } catch (err) {
        console.error("Failed to start recording:", err);
      }

      // Fetch problem
      try {
        const res = await fetch("/api/problems/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: techConfig }),
        });

        if (!res.ok) {
          const data = await res.json();
          setProblemError(data.error || "Failed to generate problem");
        } else {
          const data = await res.json();
          setProblem(data);
        }
      } catch (err) {
        setProblemError(
          err instanceof Error ? err.message : "Failed to generate problem"
        );
      } finally {
        setProblemLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // End session handler
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsProcessing(true);

    try {
      // 1. Capture final code snapshot
      captureSnapshot("submit");

      // 2. Stop recording and get audio blob
      const audioBlob = await stopRecording();

      // 3. Transcribe audio
      if (audioBlob && audioBlob.size > 0) {
        try {
          const formData = new FormData();
          formData.append(
            "audio",
            audioBlob,
            "recording.webm"
          );
          formData.append("session_id", sessionId);

          const transcribeRes = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (transcribeRes.ok) {
            const { entries } = await transcribeRes.json();

            // Save transcript
            if (entries && entries.length > 0) {
              await fetch(`/api/sessions/${sessionId}/transcript`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entries }),
              });
            }
          }
        } catch (err) {
          console.error("Transcription failed:", err);
        }
      }

      // 4. Save code snapshots
      const snapshots = getSnapshots();
      if (snapshots.length > 0) {
        try {
          await fetch(`/api/sessions/${sessionId}/snapshots`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshots }),
          });
        } catch (err) {
          console.error("Failed to save snapshots:", err);
        }
      }

      // 5. End session in DB
      await endSession();

      // 6. Trigger feedback generation (fire-and-forget)
      fetch(`/api/sessions/${sessionId}/feedback`, { method: "POST" }).catch(
        (err) => console.error("Failed to trigger feedback:", err)
      );

      // 7. Navigate to feedback page
      router.push(`/dashboard/sessions/${sessionId}/feedback`);
    } catch (err) {
      console.error("End session error:", err);
      setIsProcessing(false);
    }
  }, [
    sessionId,
    captureSnapshot,
    stopRecording,
    getSnapshots,
    endSession,
    router,
  ]);

  // Don't render until we have a session
  if (!sessionId || type !== "technical") return null;

  // Problem panel content
  const problemPanel = problemLoading ? (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${80 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  ) : problemError ? (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <p className="text-sm text-destructive">{problemError}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Try ending the session and starting a new one.
      </p>
    </div>
  ) : problem ? (
    <ProblemDescription problem={problem} />
  ) : null;

  // Editor panel content
  const editorPanel = (
    <>
      <EditorToolbar
        language={language}
        onLanguageChange={setLanguage}
        onReset={resetCode}
      />
      <div className="flex-1">
        <CodeEditor language={language} value={code} onChange={setCode} />
      </div>
    </>
  );

  return (
    <TechnicalSessionLayout
      problemPanel={problemPanel}
      editorPanel={editorPanel}
      micIndicator={
        <MicIndicator isRecording={isRecording} audioLevel={audioLevel} />
      }
      onEndSession={handleEndSession}
      isProcessing={isProcessing}
    />
  );
}
