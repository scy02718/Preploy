"use client";

import { useGLTF } from "@react-three/drei";
import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";

const AVATAR_PATH = "/avatars/interviewer.glb";

export interface AvatarModelRef {
  /** Set a morph target influence by name (0–1) */
  setMorphTarget: (name: string, value: number) => void;
  /** Get all available morph target names */
  getMorphTargetNames: () => string[];
}

interface AvatarModelProps {
  position?: [number, number, number];
  scale?: number;
}

export const AvatarModel = forwardRef<AvatarModelRef, AvatarModelProps>(
  function AvatarModel({ position = [0, -0.6, 0], scale = 1 }, ref) {
    const { scene } = useGLTF(AVATAR_PATH);
    const meshesRef = useRef<THREE.SkinnedMesh[]>([]);

    // Find all skinned meshes with morph targets
    useEffect(() => {
      const meshes: THREE.SkinnedMesh[] = [];
      scene.traverse((child) => {
        if (
          child instanceof THREE.SkinnedMesh &&
          child.morphTargetDictionary &&
          child.morphTargetInfluences
        ) {
          meshes.push(child);
        }
      });
      meshesRef.current = meshes;

      if (meshes.length > 0) {
        const names = Object.keys(meshes[0].morphTargetDictionary!);
        console.log(`Avatar loaded with ${names.length} morph targets:`, names);
      }
    }, [scene]);

    useImperativeHandle(ref, () => ({
      setMorphTarget(name: string, value: number) {
        for (const mesh of meshesRef.current) {
          const dict = mesh.morphTargetDictionary;
          const influences = mesh.morphTargetInfluences;
          if (dict && influences && name in dict) {
            influences[dict[name]] = value;
          }
        }
      },
      getMorphTargetNames() {
        const mesh = meshesRef.current[0];
        if (!mesh?.morphTargetDictionary) return [];
        return Object.keys(mesh.morphTargetDictionary);
      },
    }));

    return (
      <primitive object={scene} position={position} scale={scale} />
    );
  }
);

// Preload the avatar model
useGLTF.preload(AVATAR_PATH);
