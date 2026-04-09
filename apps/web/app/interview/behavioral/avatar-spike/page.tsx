"use client";

import { useRef, useState, useCallback } from "react";
import { AvatarCanvas } from "@/components/avatar/AvatarCanvas";
import { AvatarModel, AvatarModelRef } from "@/components/avatar/AvatarModel";
import { LipSyncController } from "@/components/avatar/LipSyncController";
import { IdleAnimations } from "@/components/avatar/IdleAnimations";
import { IdlePose } from "@/components/avatar/IdlePose";
import { useLipSync } from "@/hooks/useLipSync";

export default function AvatarSpikePage() {
  const avatarRef = useRef<AvatarModelRef>(null);
  const { getVisemeWeights, connectAnalyser, disconnect, isActive } =
    useLipSync();
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playTestAudio = useCallback(async () => {
    setError(null);

    try {
      const text =
        "Hello! Welcome to your mock interview. I'm excited to learn more about your experience and background. Let's start with a simple question: can you tell me about yourself and what brings you here today?";

      // Create an AudioContext with a destination stream so we can analyze
      // the browser's speech synthesis output for lip-sync
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Create analyser to feed into lip-sync
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;

      // Use MediaStreamDestination to capture speech audio
      const dest = ctx.createMediaStreamDestination();

      // Connect analyser inline: source -> analyser -> destination
      // We'll use an oscillator as a proxy that reacts to speech
      // Unfortunately Web Speech API doesn't expose a MediaStream directly,
      // so we use a polling approach: detect if speech is active and drive
      // a synthetic signal through the analyser

      // Create a speech-driven oscillator setup
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 150;
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(dest);
      oscillator.start();

      // Connect lip-sync to this analyser
      connectAnalyser(ctx, analyser);

      // Modulate the gain to simulate speech patterns
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;

      // Vary frequency and gain randomly to create mouth movement
      let modulationInterval: ReturnType<typeof setInterval>;

      utterance.onstart = () => {
        modulationInterval = setInterval(() => {
          // Random frequency shifts to trigger different visemes
          oscillator.frequency.value = 100 + Math.random() * 500;
          // Vary volume to create natural-looking open/close
          gainNode.gain.value = 0.03 + Math.random() * 0.1;
        }, 80); // Update every 80ms for natural variation
      };

      utterance.onpause = () => {
        gainNode.gain.value = 0;
      };

      utterance.onresume = () => {
        gainNode.gain.value = 0.3;
      };

      utterance.onend = () => {
        clearInterval(modulationInterval);
        gainNode.gain.value = 0;
        oscillator.stop();
        setIsPlaying(false);
        disconnect();
      };

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to play test audio");
    }
  }, [connectAnalyser, disconnect]);

  const stopAudio = useCallback(() => {
    window.speechSynthesis.cancel();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    disconnect();
    setIsPlaying(false);
  }, [disconnect]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-bold">3D Avatar Lip-Sync Spike</h1>
      <p className="mb-6 text-muted-foreground">
        Test 3D avatar rendering with lip-sync driven by audio
      </p>

      {/* Avatar viewport */}
      <div className="mb-6 overflow-hidden rounded-lg border bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
        <AvatarCanvas className="aspect-video w-full">
          <AvatarModel ref={avatarRef} />
          <IdlePose />
          <LipSyncController
            avatarRef={avatarRef}
            getVisemeWeights={getVisemeWeights}
          />
          <IdleAnimations avatarRef={avatarRef} />
        </AvatarCanvas>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-center gap-4">
        {!isPlaying ? (
          <button
            onClick={playTestAudio}
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Play Test Audio
          </button>
        ) : (
          <button
            onClick={stopAudio}
            className="rounded-lg bg-destructive px-6 py-3 font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            Stop
          </button>
        )}

        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full transition-colors ${
              isActive ? "animate-pulse bg-green-500" : "bg-green-500/20"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isActive ? "Lip-sync active" : "Idle"}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <h3 className="mb-2 font-medium">What to verify:</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>Avatar renders in the viewport with proper lighting</li>
          <li>
            <strong>Idle animations:</strong> subtle blinking and slight smile
            should be visible even before playing audio
          </li>
          <li>
            Click <strong>Play Test Audio</strong> — the avatar&apos;s mouth
            should move in sync with the generated audio
          </li>
          <li>Different mouth shapes (visemes) should be visible as audio plays</li>
          <li>Performance should stay at 60fps (no jank or stuttering)</li>
        </ul>
      </div>
    </div>
  );
}
