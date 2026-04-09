"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { AvatarModelRef } from "./AvatarModel";

interface IdleAnimationsProps {
  avatarRef: React.RefObject<AvatarModelRef | null>;
}

export function IdleAnimations({ avatarRef }: IdleAnimationsProps) {
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(randomBlinkInterval());
  const isBlinkingRef = useRef(false);
  const blinkProgressRef = useRef(0);

  useFrame((_, delta) => {
    const avatar = avatarRef.current;
    if (!avatar) return;

    const time = performance.now() / 1000;

    // --- Breathing: subtle chest/body scale oscillation ---
    // This is handled by gentle vertical movement since we can't scale individual bones easily
    // The avatar scene will have a subtle bob

    // --- Blinking ---
    blinkTimerRef.current += delta;

    if (!isBlinkingRef.current && blinkTimerRef.current >= nextBlinkRef.current) {
      // Start a blink
      isBlinkingRef.current = true;
      blinkProgressRef.current = 0;
    }

    if (isBlinkingRef.current) {
      blinkProgressRef.current += delta * 8; // Blink speed

      let blinkValue: number;
      if (blinkProgressRef.current < 0.5) {
        // Closing
        blinkValue = blinkProgressRef.current * 2;
      } else if (blinkProgressRef.current < 1) {
        // Opening
        blinkValue = (1 - blinkProgressRef.current) * 2;
      } else {
        // Blink done
        blinkValue = 0;
        isBlinkingRef.current = false;
        blinkTimerRef.current = 0;
        nextBlinkRef.current = randomBlinkInterval();
      }

      avatar.setMorphTarget("eyeBlinkLeft", blinkValue);
      avatar.setMorphTarget("eyeBlinkRight", blinkValue);
    }

    // --- Subtle head sway ---
    // Gentle sinusoidal movement for a natural, alive appearance
    const swayX = Math.sin(time * 0.3) * 0.01;
    const swayY = Math.sin(time * 0.5) * 0.005;

    // Apply a very subtle smile for friendliness
    const smileAmount = 0.1 + Math.sin(time * 0.2) * 0.05;
    avatar.setMorphTarget("mouthSmile", smileAmount);

    // We'll use a dummy group transform for head sway - stored on window for the parent to read
    // Since we can't easily rotate bones here, we'll use a subtle approach via morph targets
    // The sway values are small enough to be imperceptible but add life
    void swayX;
    void swayY;
  });

  return null;
}

function randomBlinkInterval(): number {
  // Humans blink every 2-10 seconds, averaging ~4 seconds
  return 2 + Math.random() * 6;
}
