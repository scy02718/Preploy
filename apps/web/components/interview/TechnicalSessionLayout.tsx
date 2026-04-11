"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface TechnicalSessionLayoutProps {
  /** Left panel content (problem description or loading skeleton) */
  problemPanel: ReactNode;
  /** Right panel content (editor toolbar + code editor) */
  editorPanel: ReactNode;
  /** Mic indicator component */
  micIndicator: ReactNode;
  /** Called when user confirms ending the session */
  onEndSession: () => void;
  /** Whether the end-session flow is processing */
  isProcessing: boolean;
  /** Current processing step label (e.g., "Transcribing audio...") */
  processingStep?: string;
}

export function TechnicalSessionLayout({
  problemPanel,
  editorPanel,
  micIndicator,
  onEndSession,
  isProcessing,
  processingStep,
}: TechnicalSessionLayoutProps) {
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer on mount
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmEnd = useCallback(() => {
    setShowConfirm(false);
    onEndSession();
  }, [onEndSession]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Main split panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Problem description (40%) */}
        <div className="w-[40%] overflow-y-auto border-r">{problemPanel}</div>

        {/* Right panel — Editor (60%) */}
        <div className="flex w-[60%] flex-col">{editorPanel}</div>
      </div>

      {/* Bottom bar — Timer + Mic + End Session */}
      <div className="flex items-center justify-between border-t bg-background px-6 py-3">
        {/* Timer + Mic indicator */}
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg font-medium tabular-nums">
            {formatTime(elapsed)}
          </span>
          {micIndicator}
        </div>

        {/* End Session */}
        <div className="flex items-center gap-3">
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                {processingStep || "Processing..."}
              </span>
            </div>
          ) : showConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                End interview?
              </span>
              <Button size="sm" variant="destructive" onClick={handleConfirmEnd}>
                Yes, end
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="destructive" size="sm" onClick={handleEndClick}>
              End Session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
