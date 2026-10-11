"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { SharkConfig } from "@/store/sharkStore";
import { BEAD, careTag, DARK, faceAlong, GOLD, glossMat, goldMat, groupMatrix, matteMat, Merged, type Part, PINK, SEAM, SLEEPY, WHITE } from "@/components/creature/parts";
import { EYE_GUESS, eyeAnchor, gillPoints, headTop, projectToSurface, surface, surfaceAnchor } from "./sharkSdf";

// ---------- 눈 ----------
function eyeParts(side: 1 | -1, eyeStyle: SharkConfig["eyeStyle"], eyeSize: number): Part[] {
  const r = EYE_GUESS.r * eyeSize;
  const anchor = eyeAnchor(side);
  const parent = groupMatrix(anchor.p, faceAlong(anchor.n));
  const sphere = (rad: number, w: number, h: number) => new THREE.SphereGeometry(rad, w, h);
  switch (eyeStyle) {
    case "button": {
      const parts: Part[] = [{ geo: sphere(r, 24, 16), color: BEAD, scale: [1, 1, 0.55], pos: [0, 0, r * 0.3], parent }];
      for (const a of [-1, 1]) for (const b of [-1, 1]) parts.push({ geo: sphere(r * 0.12, 8, 8), color: WHITE, pos: [a * r * 0.32, b * r * 0.32, r * 0.8], parent });
      return parts;
    }
    case "sleepy": {
      const inner = parent.clone().multiply(groupMatrix([0, 0, r * 0.15]));
      return [
        { geo: new THREE.TorusGeometry(r * 0.8, r * 0.16, 8, 20, Math.PI), color: SLEEPY, rot: [0, 0, Math.PI], pos: [0, r * 0.15, 0], parent: inner },
        { geo: new THREE.CapsuleGeometry(r * 0.1, r * 0.3, 4, 8), color: SLEEPY, pos: [-r * 0.8, r * 0.1, 0], rot: [0, 0, 0.5], parent: inner },
        { geo: new THREE.CapsuleGeometry(r * 0.1, r * 0.3, 4, 8), color: SLEEPY, pos: [r * 0.8, r * 0.1, 0], rot: [0, 0, -0.5], parent: inner },
      ];
    }
    case "sparkle":
      return [
        { geo: sphere(r * 1.15, 24, 16), color: BEAD, pos: [0, 0, r * 0.2], parent },
        { geo: sphere(r * 0.38, 12, 12), color: WHITE, pos: [r * 0.35, r * 0.45, r * 1.05], parent },
        { geo: sphere(r * 0.18, 10, 10), color: WHITE, pos: [-r * 0.3, -r * 0.4, r * 1.15], parent },
      ];
    default:
      return [
        { geo: sphere(r, 24, 16), color: BEAD, pos: [0, 0, r * 0.25], parent },
        { geo: sphere(r * 0.22, 10, 10), color: WHITE, pos: [r * 0.3, r * 0.4, r * 1.0], parent },
      ];
  }
}

/** 아가미 솔기(인형처럼 밝은 실로 세 줄) + 꼬리 쪽 배 솔기의 케어 태그 */
function gillParts(): Part[] {
  return [...[gillPoints(1), gillPoints(-1)].flat().map((g) => ({ geo: new THREE.CapsuleGeometry(0.012, 0.16, 4, 8), color: SEAM, pos: g.p, quat: faceAlong(g.n) }) as Part), ...careTag(surface, -0.75, -0.3, 0.38)];
}

// ---------- 장식 ----------
function headParts(head: SharkConfig["head"], accent: string): { parts: Part[]; material: THREE.Material } | null {
  const top = headTop();
  if (head === "tophat") {
    const parent = groupMatrix([top.x - 0.02, top.y - 0.04, 0], [0.06, 0, 0.1]);
    return {
      material: matteMat,
      parts: [
        { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.035, 32), color: accent, parent },
        { geo: new THREE.CylinderGeometry(0.26, 0.28, 0.36, 32), color: accent, pos: [0, 0.2, 0], parent },
        { geo: new THREE.CylinderGeometry(0.285, 0.285, 0.07, 32), color: DARK, pos: [0, 0.06, 0], parent },
      ],
    };
  }
  if (head === "party") {
    const parent = groupMatrix([top.x, top.y - 0.04, 0.06], [0.08, 0, -0.15]);
    return {
      material: matteMat,
      parts: [
        { geo: new THREE.ConeGeometry(0.2, 0.52, 24), color: accent, pos: [0, 0.25, 0], parent },
        { geo: new THREE.SphereGeometry(0.06, 12, 12), color: WHITE, pos: [0, 0.53, 0], parent },
      ],
    };
  }
  if (head === "flower") {
    const a = surfaceAnchor(1.2, 0.4, 0.45, 0.0);
    const parent = groupMatrix(a.p, faceAlong(a.n));
    const parts: Part[] = [0, 1, 2, 3, 4].map((i) => {
      const ang = (i / 5) * Math.PI * 2;
      return { geo: new THREE.SphereGeometry(0.085, 14, 10), color: accent, pos: [Math.cos(ang) * 0.12, Math.sin(ang) * 0.12, 0.03], scale: [1, 1, 0.45], parent };
    });
    parts.push({ geo: new THREE.SphereGeometry(0.06, 12, 12), color: GOLD, pos: [0, 0, 0.07], parent });
    return { material: matteMat, parts };
  }
  if (head === "crown") {
    const parent = groupMatrix([top.x, top.y - 0.03, 0]);
    const parts: Part[] = [
      { geo: new THREE.CylinderGeometry(0.24, 0.22, 0.16, 24, 1, true), color: GOLD, pos: [0, 0.08, 0], parent },
      { geo: new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), color: GOLD, parent },
    ];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      parts.push({ geo: new THREE.ConeGeometry(0.045, 0.12, 4), color: GOLD, pos: [Math.cos(ang) * 0.235, 0.2, Math.sin(ang) * 0.235], parent });
    }
    return { material: goldMat, parts };
  }
  return null;
}

function neckParts(neck: SharkConfig["neck"], accent: string): Part[] | null {
  if (neck === "bowtie") {
    const a = surfaceAnchor(0.95, -0.7, 0, 0.04);
    const parent = groupMatrix(a.p, faceAlong(a.n));
    // 로컬 z = 표면 법선. 날개는 표면을 따라 좌우(x)로
    return [
      { geo: new THREE.BoxGeometry(0.24, 0.17, 0.07), color: accent, pos: [0.14, 0, 0.03], rot: [0, 0.3, 0], parent },
      { geo: new THREE.BoxGeometry(0.24, 0.17, 0.07), color: accent, pos: [-0.14, 0, 0.03], rot: [0, -0.3, 0], parent },
      { geo: new THREE.SphereGeometry(0.06, 12, 12), color: accent, pos: [0, 0, 0.05], parent },
    ];
  }
  if (neck === "scarf") {
    // 몸통(이 위치 반지름 ≈0.53)에 감기는 띠 + 매듭 + 늘어진 끝
    const parent = groupMatrix([0.82, -0.02, 0], undefined, [1, 0.93, 1]);
    return [
      { geo: new THREE.CylinderGeometry(0.6, 0.64, 0.22, 40, 1, true), color: accent, rot: [0, 0, Math.PI / 2], parent },
      { geo: new THREE.SphereGeometry(0.07, 12, 12), color: accent, pos: [0.02, -0.5, 0.3], parent },
      { geo: new THREE.BoxGeometry(0.14, 0.3, 0.06), color: accent, pos: [0.1, -0.66, 0.34], rot: [0.2, 0, 0.25], parent },
      { geo: new THREE.BoxGeometry(0.12, 0.24, 0.06), color: accent, pos: [-0.06, -0.62, 0.38], rot: [0.3, 0, -0.2], parent },
    ];
  }
  return null;
}

function faceParts(face: SharkConfig["face"]): Part[] | null {
  if (face === "glasses") {
    const eyes = [eyeAnchor(1), eyeAnchor(-1)];
    const noseX = projectToSurface(new THREE.Vector3(1.9, 0.05, 0), 0.02).x;
    const parts: Part[] = eyes.map((e) => ({
      geo: new THREE.TorusGeometry(EYE_GUESS.r * 1.55, 0.018, 8, 32),
      color: DARK,
      pos: e.p.clone().addScaledVector(e.n, 0.07),
      quat: faceAlong(e.n),
    }));
    parts.push({ geo: new THREE.CylinderGeometry(0.014, 0.014, (EYE_GUESS.z + 0.02) * 2, 8), color: DARK, pos: [noseX, EYE_GUESS.y + 0.03, 0], rot: [Math.PI / 2, 0, 0] });
    for (const e of eyes) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.014, 0.014, Math.abs(noseX - e.p.x) + 0.02, 8),
        color: DARK,
        pos: [(noseX + e.p.x) / 2, EYE_GUESS.y + 0.03, e.p.z + e.n.z * 0.07],
        rot: [0, 0, Math.PI / 2],
      });
    }
    return parts;
  }
  if (face === "blush") {
    return [1, -1].map((s) => {
      const p = projectToSurface(new THREE.Vector3(1.8, 0.03, s * 0.64), 0.006);
      const n = p.clone().sub(projectToSurface(new THREE.Vector3(1.8, 0.03, s * 0.64), -0.05)).normalize();
      return { geo: new THREE.CircleGeometry(0.07, 20), color: PINK, pos: p, quat: faceAlong(n), scale: [1.4, 1, 1] };
    });
  }
  return null;
}

export function SharkHeadParts({ config }: { config: SharkConfig }) {
  const { eyeStyle, eyeSize, head, neck, face, accentColor } = config;
  const eyes = useMemo(() => [...eyeParts(1, eyeStyle, eyeSize), ...eyeParts(-1, eyeStyle, eyeSize)], [eyeStyle, eyeSize]);
  const gills = useMemo(() => gillParts(), []);
  const headAcc = useMemo(() => headParts(head, accentColor), [head, accentColor]);
  const neckAcc = useMemo(() => neckParts(neck, accentColor), [neck, accentColor]);
  const faceAcc = useMemo(() => faceParts(face), [face]);

  return (
    <group>
      <Merged parts={eyes} material={glossMat} />
      <Merged parts={gills} material={matteMat} />
      {headAcc && <Merged parts={headAcc.parts} material={headAcc.material} />}
      <Merged parts={neckAcc} material={matteMat} />
      <Merged parts={faceAcc} material={matteMat} />
    </group>
  );
}
