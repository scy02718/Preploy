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
  const [processingStep, setProcessingStep] = useState("");

  // Regeneration: users can regenerate the question up to 5 times per
  // session so they don't get stuck on a duplicate or an unfamiliar topic.
  const MAX_REGENERATIONS = 5;
  const [regenerationsLeft, setRegenerationsLeft] = useState(MAX_REGENERATIONS);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousProblems, setPreviousProblems] = useState<string[]>([]);

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

  // Regenerate problem handler — sends all previously-shown problem titles
  // so the LLM avoids repeats.
  const handleRegenerate = useCallback(async () => {
    if (regenerationsLeft <= 0 || isRegenerating) return;
    setIsRegenerating(true);
    setProblemError(null);

    // Track the current problem's title for the exclusion list
    const updatedExclusions = problem?.title
      ? [...previousProblems, problem.title]
      : previousProblems;
    setPreviousProblems(updatedExclusions);

    try {
      const res = await fetch("/api/problems/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: techConfig,
          excludeQuestions: updatedExclusions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setProblemError(data.error || "Failed to regenerate problem");
      } else {
        const data = await res.json();
        setProblem(data);
        setRegenerationsLeft((n) => n - 1);
      }
    } catch (err) {
      setProblemError(
        err instanceof Error ? err.message : "Failed to regenerate problem"
      );
    } finally {
      setIsRegenerating(false);
    }
  }, [regenerationsLeft, isRegenerating, problem, previousProblems, techConfig]);

  // End session handler
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsProcessing(true);

    try {
      // 1. Capture final code snapshot
      setProcessingStep("Saving code...");
      captureSnapshot("submit");

      // 2. Stop recording and get audio blob
      setProcessingStep("Stopping recording...");
      const audioBlob = await stopRecording();

      // 3. Transcribe audio
      if (audioBlob && audioBlob.size > 0) {
        setProcessingStep("Transcribing audio...");
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
      setProcessingStep("Saving code snapshots...");
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
      setProcessingStep("Finalizing session...");
      await endSession();

      // 6. Trigger feedback generation + badge check (fire-and-forget)
      setProcessingStep("Redirecting to feedback...");
      fetch(`/api/sessions/${sessionId}/feedback`, { method: "POST" }).catch(
        (err) => console.error("Failed to trigger feedback:", err)
      );
      fetch("/api/users/badges", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.awarded?.length > 0) {
            sessionStorage.setItem("new_badges", JSON.stringify(data.awarded));
          }
        })
        .catch((err) => console.error("Failed to check badges:", err));

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
    <div className="flex h-full flex-col p-6">
      {/* Title + badge skeleton */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      {/* Description skeleton */}
      <div className="mb-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${95 - i * 10}%` }}
          />
        ))}
      </div>
      {/* Example skeleton */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      {/* Loading message */}
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Generating problem...
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <ProblemDescription problem={problem} />
      </div>
      <div className="border-t px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleRegenerate}
          disabled={regenerationsLeft <= 0 || isRegenerating}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            regenerationsLeft <= 0
              ? "No regenerations remaining this session"
              : `Regenerate problem (${regenerationsLeft} left)`
          }
        >
          {isRegenerating
            ? "Generating..."
            : `↻ New question (${regenerationsLeft}/${MAX_REGENERATIONS} left)`}
        </button>
      </div>
    </div>
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
      processingStep={processingStep}
    />
  );
}
