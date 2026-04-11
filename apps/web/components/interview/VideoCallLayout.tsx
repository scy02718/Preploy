"use client";

import { useRef, useEffect, useState } from "react";

interface VideoCallLayoutProps {
  isSpeaking: boolean;
  isListening: boolean;
  /** Audio level 0-1 for the AI voice visualizer */
  aiAudioLevel?: number;
  userName?: string;
  /** Optional callback to receive the webcam video element once it's ready */
  onWebcamReady?: (video: HTMLVideoElement) => void;
}

export function VideoCallLayout({
  isSpeaking,
  isListening,
  aiAudioLevel = 0,
  userName = "You",
  onWebcamReady,
}: VideoCallLayoutProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Start webcam
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          onWebcamReady?.(videoRef.current);
        }
      } catch {
        setWebcamError("Camera access denied");
      }
    }

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulsing scale based on audio level
  const pulseScale = 1 + aiAudioLevel * 0.4;
  const pulseOpacity = 0.3 + aiAudioLevel * 0.5;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left — AI Interviewer visualizer */}
      <div className="relative flex w-1/2 flex-col items-center justify-center border-r bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        {/* Pulsing circle */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulse ring */}
          <div
            className="absolute h-40 w-40 rounded-full bg-primary/20 transition-transform duration-150"
            style={{
              transform: `scale(${pulseScale})`,
              opacity: pulseOpacity,
            }}
          />
          {/* Middle ring */}
          <div
            className="absolute h-32 w-32 rounded-full bg-primary/30 transition-transform duration-150"
            style={{
              transform: `scale(${1 + aiAudioLevel * 0.2})`,
            }}
          />
          {/* Inner circle */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <span className="text-3xl">AI</span>
          </div>
        </div>

        {/* Name label */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
            AI Interviewer
          </span>
          {isSpeaking && (
            <span className="rounded bg-green-600/80 px-2 py-0.5 text-xs text-white">
              Speaking...
            </span>
          )}
        </div>
      </div>

      {/* Right — User webcam */}
      <div className="relative flex w-1/2 flex-col bg-slate-900">
        {webcamError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {webcamError}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="flex-1 object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Name label */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {userName}
          </span>
          {isListening && (
            <span className="rounded bg-blue-600/80 px-2 py-0.5 text-xs text-white">
              Listening...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
