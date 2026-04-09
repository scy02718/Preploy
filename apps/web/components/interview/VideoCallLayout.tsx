"use client";

import { useRef, useEffect, useState } from "react";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";
import { AvatarModel, AvatarModelRef } from "@/components/avatar/AvatarModel";
import { LipSyncController } from "@/components/avatar/LipSyncController";
import { IdleAnimations } from "@/components/avatar/IdleAnimations";
import { IdlePose } from "@/components/avatar/IdlePose";
import type { VisemeWeights } from "@/hooks/useLipSync";

interface VideoCallLayoutProps {
  avatarRef: React.RefObject<AvatarModelRef | null>;
  getVisemeWeights: () => VisemeWeights;
  isSpeaking: boolean;
  isListening: boolean;
  userName?: string;
}

export function VideoCallLayout({
  avatarRef,
  getVisemeWeights,
  isSpeaking,
  isListening,
  userName = "You",
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
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left — AI Avatar */}
      <div className="relative flex w-[60%] flex-col border-r bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        <AvatarCanvas className="flex-1">
          <AvatarModel ref={avatarRef} />
          <IdlePose />
          <LipSyncController
            avatarRef={avatarRef}
            getVisemeWeights={getVisemeWeights}
          />
          <IdleAnimations avatarRef={avatarRef} />
        </AvatarCanvas>

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
      <div className="relative flex w-[40%] flex-col bg-slate-900">
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
