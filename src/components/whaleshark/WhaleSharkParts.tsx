"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { beadEyes, blushPair, careTag, faceAlong, Merged, type Part, satinMat, SEAM } from "@/components/creature/parts";
import { EYE_GUESS, surface } from "./whalesharkSdf";

/** 아가미 솔기: 머리 뒤 옆면에 5줄 */
function gillParts(): Part[] {
  const parts: Part[] = [];
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 5; i++) {
      const a = surface.anchor(0.9 - i * 0.13, -0.02, side * 0.75, 0.01);
      parts.push({ geo: new THREE.CapsuleGeometry(0.012, 0.2, 2, 6), color: SEAM, pos: a.p, quat: faceAlong(a.n) });
    }
  }
  return parts;
}

/** 고래상어 부품: 작은 구슬 눈 2(머리 양끝), 볼터치, 아가미 5쌍, 꼬리자루 케어 태그 → 1 드로우 (입은 없다) */
export function WhaleSharkParts() {
  const parts = useMemo(
    () => [
      ...beadEyes(surface, EYE_GUESS, [20, 14]),
      ...blushPair(surface, 1.42, -0.1, 0.62, 0.07),
      ...gillParts(),
      ...careTag(surface, -1.3, -0.02, 0.34, 1.15),
    ],
    [],
  );
  return <Merged parts={parts} material={satinMat} />;
}
