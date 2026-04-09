"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// Bone names vary by avatar rig — these cover common conventions
const ARM_BONE_NAMES = {
  leftUpperArm: ["LeftUpperArm", "LeftArm", "mixamorigLeftArm", "Left_Arm"],
  rightUpperArm: ["RightUpperArm", "RightArm", "mixamorigRightArm", "Right_Arm"],
  leftLowerArm: ["LeftLowerArm", "LeftForeArm", "mixamorigLeftForeArm", "Left_ForeArm"],
  rightLowerArm: ["RightLowerArm", "RightForeArm", "mixamorigRightForeArm", "Right_ForeArm"],
  spine: ["Spine", "mixamorigSpine", "Spine1"],
};

function findBone(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if (found) return;
    if (child instanceof THREE.Bone && names.some((n) => child.name.includes(n))) {
      found = child;
    }
  });
  return found;
}

export function IdlePose() {
  const { scene } = useThree();

  useEffect(() => {
    // Give the model a frame to load
    const timer = setTimeout(() => {
      // Rotate upper arms down from T-pose (~70 degrees)
      const leftUpperArm = findBone(scene, ARM_BONE_NAMES.leftUpperArm);
      const rightUpperArm = findBone(scene, ARM_BONE_NAMES.rightUpperArm);
      const leftLowerArm = findBone(scene, ARM_BONE_NAMES.leftLowerArm);
      const rightLowerArm = findBone(scene, ARM_BONE_NAMES.rightLowerArm);

      if (leftUpperArm) {
        leftUpperArm.rotation.z = THREE.MathUtils.degToRad(30);
        leftUpperArm.rotation.x = THREE.MathUtils.degToRad(70);
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = THREE.MathUtils.degToRad(-30);
        rightUpperArm.rotation.x = THREE.MathUtils.degToRad(70);
      }

      // Slightly bend the forearms inward
      if (leftLowerArm) {
        leftLowerArm.rotation.z = THREE.MathUtils.degToRad(5);
        leftLowerArm.rotation.y = THREE.MathUtils.degToRad(-20);
      }
      if (rightLowerArm) {
        rightLowerArm.rotation.z = THREE.MathUtils.degToRad(-5);
        rightLowerArm.rotation.y = THREE.MathUtils.degToRad(20);
      }

      const bones = [leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm].filter(Boolean);
      console.log(`IdlePose: adjusted ${bones.length} bones`);
    }, 100);

    return () => clearTimeout(timer);
  }, [scene]);

  return null;
}
