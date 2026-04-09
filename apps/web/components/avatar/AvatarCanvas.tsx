"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { Suspense, ReactNode, useEffect } from "react";
import * as THREE from "three";

interface AvatarCanvasProps {
  children: ReactNode;
  className?: string;
}

// Points the camera at the avatar's face/chest area
function CameraTarget() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(new THREE.Vector3(0, 1, 0));
  }, [camera]);
  return null;
}

export function AvatarCanvas({ children, className }: AvatarCanvasProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{
          position: [0, 1.4, 1.2],
          fov: 28,
          near: 0.1,
          far: 10,
        }}
        style={{ background: "transparent" }}
      >
        <CameraTarget />
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 4]} intensity={0.8} castShadow />
        <directionalLight position={[-2, 1, -2]} intensity={0.3} />

        <Suspense fallback={null}>
          <Environment preset="apartment" />
          {children}
        </Suspense>

        <ContactShadows
          position={[0, -0.6, 0]}
          opacity={0.4}
          scale={3}
          blur={2}
        />
      </Canvas>
    </div>
  );
}
