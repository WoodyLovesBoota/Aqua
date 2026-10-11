import * as THREE from "three";
import { type CreatureDef } from "@/components/creature/creatureFormat";
import { type Fin, makeFin, sdEllipsoid, sdFin, sdPolygon, sdRoundCone, makeSurface, smin, smoothPoly, smoothstep } from "@/components/creature/sdf";

/**
 * 만타 좌표계: +x = 입(앞), +y = 위, +z = 오른쪽. 날개폭 ≈ 3.7 (z: ±1.85), 몸길이 ≈ 2.5 (x: 1.5 ~ -1.0) + 꼬리 (x → -2.5)
 * 납작 타원체 몸통 + 뒤로 쓸린 넓은 날개(가슴지느러미) + 앞으로 뻗은 머리지느러미 2 + 가는 꼬리 + 작은 등지느러미.
 * 메시는 scripts/bake-creature.mts manta 가 굽고, 런타임은 눈·입 앵커 계산에만 이 모듈을 쓴다.
 */

export const SPAN = 1.85;
export const EYE_GUESS = { x: 0.98, y: 0.1, z: 0.6, r: 0.11 };

// ---------- 날개 평면형 (x: 앞뒤, s: 바깥 방향 = |z|) ----------
const WING_POLY = smoothPoly(
  [
    [0.92, 0.25],
    [0.8, 0.72],
    [0.46, 1.25],
    [0.08, 1.7],
    [-0.22, 1.82],
    [-0.4, 1.68],
    [-0.52, 1.3],
    [-0.7, 0.85],
    [-0.9, 0.25],
  ],
  40,
);

export function sdBody(px: number, py: number, pz: number) {
  const yy = py < 0 ? py * 1.15 : py; // 배는 살짝 납작
  let d = sdEllipsoid(px - 0.2, yy, pz, 1.1, 0.5, 0.72);
  d = smin(d, sdEllipsoid(px + 0.55, yy * 1.1, pz, 0.85, 0.3, 0.52), 0.3);
  return d;
}

export function sdWings(px: number, py: number, pz: number) {
  const s = Math.abs(pz);
  const t = Math.min(s / SPAN, 1);
  // 날개 끝이 살짝 들린다
  const y = py - 0.16 * t * t;
  const d2 = sdPolygon(px, s, WING_POLY);
  // 뿌리 두껍고 끝으로 얇게, 가장자리로 갈수록 0 으로 수렴하는 렌즈 단면
  const tip = smoothstep(0.25, SPAN, s);
  const thickMax = 0.34 * (1 - tip) + 0.05 * tip;
  const h = Math.min(thickMax, 0.015 + -d2 * 0.55);
  const dz = Math.abs(y) - h;
  const r = 0.045;
  const a = d2 + r, b = dz;
  const oa = Math.max(a, 0), ob = Math.max(b, 0);
  return Math.min(Math.max(a, b), 0) + Math.sqrt(oa * oa + ob * ob) - r;
}

/** 머리지느러미: 앞으로 뻗은 납작하고 넓은 노 2개, 끝이 서로를 향해 살짝 말린다 */
export function sdLobes(px: number, py: number, pz: number) {
  let d = Infinity;
  for (const side of [1, -1]) {
    const z = (pz - side * 0.5) * 0.8; // 가로로 넓게
    const curl = side * 0.1 * Math.max(0, px - 0.95);
    d = Math.min(d, sdRoundCone(px, py * 1.55, z + curl, 0.95, 0.02, 0, 1.55, -0.01, 0, 0.18, 0.13) / 1.25);
  }
  return d;
}

export function sdTail(px: number, py: number, pz: number) {
  // 꼬리 끝이 살짝 위로
  return sdRoundCone(px, py, pz, -1.05, 0.02, 0, -2.45, 0.14, 0, 0.1, 0.03);
}

const DORSAL: Fin = makeFin(
  [
    [0.12, -0.05],
    [0.04, 0.14],
    [-0.08, 0.2],
    [-0.18, 0.16],
    [-0.2, -0.05],
  ],
  0.045,
  0.035,
  new THREE.Vector3(-0.8, 0.2, 0),
  new THREE.Euler(0, 0, 0),
);
export const sdDorsal = (px: number, py: number, pz: number) => sdFin(px, py, pz, DORSAL);

export function sdManta(px: number, py: number, pz: number) {
  let d = smin(sdBody(px, py, pz), sdWings(px, py, pz), 0.45);
  d = smin(d, sdLobes(px, py, pz), 0.12);
  d = smin(d, sdTail(px, py, pz), 0.16);
  d = smin(d, sdDorsal(px, py, pz), 0.07);
  return d;
}

/** 표면 법선·투영·앵커 (부품 부착용) */
export const surface = makeSurface(sdManta);

/** 베이크 정의. 범위: x [-2.6, 1.7], y [-0.55, 0.75], z [-2.0, 2.0] */
export const MANTA_DEF: CreatureDef = {
  name: "manta",
  manifest: { path: "components/manta/mantaManifest.ts", exportName: "MANTA_FILES" },
  sdf: sdManta,
  // 꼬리·등지느러미는 털 색만 (배 색 제외)
  part: (x, y, z) => (Math.min(sdTail(x, y, z), sdDorsal(x, y, z)) + 0.03 < Math.min(sdBody(x, y, z), sdWings(x, y, z), sdLobes(x, y, z)) ? 0 : 1),
  gridScale: [2 / 4.3, 2 / 1.3, 2 / 4.0],
  gridOffset: [-0.45, 0.1, 0],
  resolution: 128,
};
