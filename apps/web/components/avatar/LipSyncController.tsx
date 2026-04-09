"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { AvatarModelRef } from "./AvatarModel";
import type { VisemeWeights } from "@/hooks/useLipSync";

interface LipSyncControllerProps {
  avatarRef: React.RefObject<AvatarModelRef | null>;
  getVisemeWeights: () => VisemeWeights;
  /** Interpolation factor for smoothing (0 = no movement, 1 = instant snap). Default 0.3 */
  lerpFactor?: number;
  /** Maximum morph target influence (0–1). Caps how far the mouth opens. Default 0.35 */
  maxInfluence?: number;
}

export function LipSyncController({
  avatarRef,
  getVisemeWeights,
  lerpFactor = 0.3,
  maxInfluence = 0.35,
}: LipSyncControllerProps) {
  const prevWeightsRef = useRef<VisemeWeights>({});

  useFrame(() => {
    const avatar = avatarRef.current;
    if (!avatar) return;

    const targetWeights = getVisemeWeights();
    const prev = prevWeightsRef.current;

    for (const [name, target] of Object.entries(targetWeights)) {
      const clamped = Math.min(target, maxInfluence);
      // Lerp from previous to target for smooth transitions
      const current = prev[name] ?? 0;
      const smoothed = current + (clamped - current) * lerpFactor;
      avatar.setMorphTarget(name, smoothed);
      prev[name] = smoothed;
    }
  });

  return null;
}
