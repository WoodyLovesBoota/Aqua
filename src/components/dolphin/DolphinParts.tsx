"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { beadEyes, blushPair, careTag, faceAlong, Merged, type Part, satinMat, SEAM, Z } from "@/components/creature/parts";
import { EYE_GUESS, surface } from "./dolphinSdf";

/** 숨구멍: 머리 위 작은 가로 스티치 */
function blowhole(): Part {
  const a = surface.anchor(0.85, 0.6, 0, 0.01);
  return { geo: new THREE.CapsuleGeometry(0.014, 0.09, 4, 8), color: SEAM, pos: a.p, quat: faceAlong(a.n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, Math.PI / 2)) };
}

/** 돌고래 부품: 구슬 눈 2, 볼터치, 숨구멍, 꼬리자루 옆 케어 태그 → 1 드로우 (입은 없다) */
export function DolphinParts() {
  const parts = useMemo(
    () => [
      ...beadEyes(surface, EYE_GUESS),
      ...blushPair(surface, 1.1, -0.08, 0.48, 0.065),
      blowhole(),
      ...careTag(surface, -1.0, -0.02, 0.24),
    ],
    [],
  );
  return <Merged parts={parts} material={satinMat} />;
}
