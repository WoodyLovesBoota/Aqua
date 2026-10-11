"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Surface } from "./sdf";

/**
 * 눈·입·아가미·장식은 모두 작은 프리미티브 여러 개로 이뤄진다.
 * 드로우콜을 아끼기 위해 그룹마다 정점 색을 입혀 하나의 지오메트리로 합치고, 공용 머티리얼 셋 중 하나로 그린다.
 */
export const glossMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.08 });
export const matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
export const goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 });

export const BEAD = "#161412";
export const WHITE = "#fbf8f2";
export const SLEEPY = "#2a2622";
export const THREAD = "#b8282f";
export const SEAM = "#f7f1e6";
export const GOLD = "#f0b429";
export const PINK = "#f29aa8";
export const DARK = "#1d1b18";

export const Z = new THREE.Vector3(0, 0, 1);
export const FLIP = new THREE.Quaternion().setFromAxisAngle(Z, Math.PI);

/** 법선 n 이 로컬 +z 가 되도록 하는 회전 */
export function faceAlong(n: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(Z, n);
}

export interface Part {
  geo: THREE.BufferGeometry;
  color: string;
  pos?: THREE.Vector3 | [number, number, number];
  quat?: THREE.Quaternion;
  rot?: THREE.Euler | [number, number, number];
  scale?: [number, number, number];
  /** 부모 변환 (그룹 안에 있던 부품) */
  parent?: THREE.Matrix4;
}

function matrixOf(p: Part, out: THREE.Matrix4) {
  const pos = p.pos instanceof THREE.Vector3 ? p.pos : new THREE.Vector3(...(p.pos ?? [0, 0, 0]));
  const q = p.quat ?? (p.rot ? new THREE.Quaternion().setFromEuler(p.rot instanceof THREE.Euler ? p.rot : new THREE.Euler(...p.rot)) : new THREE.Quaternion());
  const s = new THREE.Vector3(...(p.scale ?? [1, 1, 1]));
  out.compose(pos, q, s);
  if (p.parent) out.premultiply(p.parent);
  return out;
}

export function groupMatrix(pos: THREE.Vector3 | [number, number, number], rotOrQuat?: THREE.Euler | [number, number, number] | THREE.Quaternion, scale?: [number, number, number]) {
  const p = pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos);
  const q =
    rotOrQuat instanceof THREE.Quaternion
      ? rotOrQuat
      : rotOrQuat
        ? new THREE.Quaternion().setFromEuler(rotOrQuat instanceof THREE.Euler ? rotOrQuat : new THREE.Euler(...rotOrQuat))
        : new THREE.Quaternion();
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(...(scale ?? [1, 1, 1])));
}

/** 부품들을 정점 색이 들어간 하나의 지오메트리로 합친다 */
function buildMerged(parts: Part[]): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const geos = parts.map((p) => {
    const g = p.geo.clone().applyMatrix4(matrixOf(p, m));
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    c.set(p.color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    p.geo.dispose();
    return g;
  });
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}

export function Merged({ parts, material }: { parts: Part[] | null; material: THREE.Material }) {
  const geo = useMemo(() => (parts && parts.length ? buildMerged(parts) : null), [parts]);
  useEffect(() => () => geo?.dispose(), [geo]);
  return geo ? <mesh geometry={geo} material={material} /> : null;
}


/** 눈·입·볼터치를 한 그룹으로 그릴 때의 반광 머티리얼 (구슬 눈 광택과 스티치 무광의 절충) */
export const satinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 });

/** 구슬 눈 한 쌍: 표면 앵커에 검은 구슬 + 흰 하이라이트 */
export function beadEyes(surface: Surface, guess: { x: number; y: number; z: number; r: number }, segments: [number, number] = [24, 16]): Part[] {
  const r = guess.r;
  return ([1, -1] as const).flatMap((side) => {
    const a = surface.anchor(guess.x, guess.y, side * guess.z);
    const parent = groupMatrix(a.p, faceAlong(a.n));
    return [
      { geo: new THREE.SphereGeometry(r, segments[0], segments[1]), color: BEAD, pos: [0, 0, r * 0.25], parent },
      { geo: new THREE.SphereGeometry(r * 0.22, 10, 10), color: WHITE, pos: [r * 0.3, r * 0.4, r * 1.0], parent },
    ];
  });
}

/** 볼터치 한 쌍: 뺨 표면에 납작한 분홍 타원 */
export function blushPair(surface: Surface, x: number, y: number, z: number, r: number, stretch = 1.4): Part[] {
  return ([1, -1] as const).map((side) => {
    const a = surface.anchor(x, y, side * z, 0.006);
    return { geo: new THREE.CircleGeometry(r, 20), color: PINK, pos: a.p, quat: faceAlong(a.n), scale: [stretch, 1, 1] };
  });
}

/**
 * 케어 태그: 봉제 인형의 배 솔기 근처(꼬리 쪽)에 달린 작은 천 라벨 + 붉은 줄.
 * 솔기 지점에서 꼬리(-x) 쪽으로 늘어져 몸에 거의 눕고, 끝이 살짝 들린다 (옆에서 봐도 면이 보이게). 2 박스 → 부품 병합 (드로우 추가 없음)
 */
export function careTag(surface: Surface, x: number, y: number, z: number, size = 1): Part[] {
  const a = surface.anchor(x, y, z);
  const n = a.n;
  const t = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x).normalize(); // 몸 앞뒤 방향(표면 접선)
  const b = new THREE.Vector3().crossVectors(n, t).normalize();
  // 로컬 x = 앞뒤, y = 접선 옆, z = 법선(태그 면의 법선). 끝(-x)이 들리도록 로컬 y 축으로 살짝 돌린다
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, b, n));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5));
  const w = 0.24 * size, h = 0.13 * size;
  const parent = groupMatrix(a.p.clone().addScaledVector(n, 0.02 * size), q);
  return [
    { geo: new THREE.BoxGeometry(w, h, 0.014 * size), color: SEAM, pos: [-w * 0.5, 0, 0], parent },
    { geo: new THREE.BoxGeometry(w * 0.9, h * 0.22, 0.017 * size), color: THREAD, pos: [-w * 0.5, 0, 0], parent },
  ];
}

/** 콧구멍 스티치 한 쌍: 주둥이 위 아주 짧은 어두운 실 두 가닥 */
export function nostrilPair(surface: Surface, x: number, y: number, z: number, len = 0.03): Part[] {
  return ([1, -1] as const).map((side) => {
    const a = surface.anchor(x, y, side * z, 0.004);
    return { geo: new THREE.CapsuleGeometry(0.011, len, 3, 8), color: DARK, pos: a.p, quat: faceAlong(a.n) };
  });
}
