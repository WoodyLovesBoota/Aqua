"use client";

import { useMemo } from "react";
import { beadEyes, blushPair, careTag, Merged, nostrilPair, satinMat } from "@/components/creature/parts";
import { EYE_GUESS, surface } from "./turtleSdf";

/** 바다거북 부품: 구슬 눈(머리 양옆 위), 볼터치, 콧구멍 2, 케어 태그 → 1 드로우 (입은 없다) */
export function TurtleParts() {
  const parts = useMemo(
    () => [
      ...beadEyes(surface, EYE_GUESS),
      ...blushPair(surface, 1.44, -0.02, 0.32, 0.06, 1.3),
      ...nostrilPair(surface, 1.67, 0.09, 0.05),
      // 등딱지 뒤 테두리 솔기에서 삐죽
      ...careTag(surface, -1.0, 0.0, 0.5, 0.9),
    ],
    [],
  );
  return <Merged parts={parts} material={satinMat} />;
}
