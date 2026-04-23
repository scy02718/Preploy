"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface SessionControlsProps {
  isConnected: boolean;
  isMuted: boolean;
  onMute: () => void;
  onUnmute: () => void;
  onEndSession: () => void;
  /**
   * Whether the session has fully initialized (first interviewer turn delivered).
   * Defaults to true for backward compatibility. When false, the End Session
   * button is visually disabled with "Starting session…" microcopy so users
   * can't end before the interview kicks off (which would produce an empty
   * transcript and infinite-load on the feedback page).
   */
  sessionInitialized?: boolean;
}

export function SessionControls({
  isConnected,
  isMuted,
  onMute,
  onUnmute,
  onEndSession,
  sessionInitialized = true,
}: SessionControlsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

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
    <div className="flex items-center justify-between border-t bg-background px-6 py-3">
      {/* Timer */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected
                ? "animate-pulse bg-green-500"
                : "bg-yellow-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
        </div>
        <span className="font-mono text-lg font-medium tabular-nums">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Mute/Unmute */}
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="sm"
          onClick={isMuted ? onUnmute : onMute}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Button>

        {/* End Session */}
        {showConfirm ? (
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
        ) : !sessionInitialized ? (
          /* Disabled state — session still initializing. Rendered as a styled
             span (not a button) so the browser never fires a click event, but
             with aria-disabled + role="button" so screen readers still announce
             it as a disabled button. min-h/min-w keep the 44×44 touch target. */
          <span
            role="button"
            aria-disabled="true"
            className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-sm font-medium text-destructive/50 opacity-60 motion-safe:transition-opacity motion-safe:duration-[var(--duration-base)]"
          >
            Starting session…
          </span>
        ) : (
          <Button variant="destructive" size="sm" onClick={handleEndClick}>
            End Session
          </Button>
        )}
      </div>
    </div>
  );
}
