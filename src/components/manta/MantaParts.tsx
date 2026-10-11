"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { beadEyes, blushPair, careTag, faceAlong, Merged, type Part, satinMat, SEAM, Z } from "@/components/creature/parts";
import { EYE_GUESS, surface } from "./mantaSdf";

/** 아가미 솔기: 배 쪽에 5쌍, 뒤로 갈수록 바깥으로 벌어진다 */
function gillParts(): Part[] {
  const parts: Part[] = [];
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 5; i++) {
      const a = surface.anchor(0.62 - i * 0.14, -0.5, side * (0.2 + i * 0.035), 0.01);
      // 표면을 따라 비스듬히 (몸 축에 대해 ≈ 65°)
      const q = faceAlong(a.n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, side * 0.45));
      parts.push({ geo: new THREE.CapsuleGeometry(0.011, 0.13, 4, 8), color: SEAM, pos: a.p, quat: q });
    }
  }
  return parts;
}

/** 만타 부품: 구슬 눈(머리 양옆), 볼터치, 배 아가미 5쌍, 꼬리 뿌리 케어 태그 → 1 드로우 (입은 없다) */
export function MantaParts() {
  const parts = useMemo(
    () => [
      ...beadEyes(surface, EYE_GUESS),
      ...blushPair(surface, 1.1, 0.04, 0.6, 0.065),
      ...gillParts(),
      ...careTag(surface, -1.0, 0.05, 0.14),
    ],
    [],
  );
  return <Merged parts={parts} material={satinMat} />;
}
