import * as THREE from "three";
import { type CreatureDef } from "@/components/creature/creatureFormat";
import { type Fin, makeFin, sdEllipsoid, sdFin, sdRoundCone, makeSurface, smin } from "@/components/creature/sdf";

/**
 * 돌고래 좌표계: +x = 부리(앞), +y = 위, +z = 오른쪽. 몸길이 ≈ 3.5 (x: 1.85 ~ -1.7)
 * 통통한 이마(멜론) + 짧은 부리 + 방추형 몸통 + 초승달 등지느러미 + 노 모양 가슴지느러미 2 + 수평 꼬리지느러미(flukes).
 * 메시는 scripts/bake-creature.mts dolphin 이 굽고, 런타임은 눈·입 앵커 계산에만 이 모듈을 쓴다.
 */

export const EYE_GUESS = { x: 1.22, y: 0.06, z: 0.42, r: 0.1 };

export function sdBody(px: number, py: number, pz: number) {
  const yy = py < 0 ? py * 1.08 : py; // 배는 살짝 납작
  // 이마(멜론) → 가슴(가장 두껍게) → 꼬리자루
  let d = sdRoundCone(px, yy, pz, 1.2, 0.06, 0, 0.45, 0.04, 0, 0.5, 0.56);
  d = smin(d, sdRoundCone(px, yy, pz, 0.45, 0.04, 0, -0.6, 0.06, 0, 0.56, 0.36), 0.3);
  d = smin(d, sdRoundCone(px, yy, pz, -0.6, 0.06, 0, -1.35, 0.1, 0, 0.36, 0.13), 0.25);
  // 멜론: 이마를 통통하게
  d = smin(d, sdEllipsoid(px - 1.12, yy - 0.12, pz, 0.5, 0.4, 0.44), 0.2);
  return d;
}

/** 부리(주둥이): 짧고 통통하게, 끝이 살짝 아래로 */
export const sdBeak = (px: number, py: number, pz: number) => sdRoundCone(px, py * 1.15, pz, 1.35, -0.06, 0, 1.78, -0.12, 0, 0.26, 0.13);

const DORSAL: Fin = makeFin(
  [
    [0.3, -0.05],
    [0.12, 0.35],
    [-0.22, 0.66],
    [-0.44, 0.62],
    [-0.36, 0.3],
    [-0.42, -0.05],
  ],
  0.08,
  0.06,
  new THREE.Vector3(-0.15, 0.46, 0),
  new THREE.Euler(0, 0, 0),
);
/** 오른쪽 가슴지느러미 (왼쪽은 |z| 로 거울상) */
const PECTORAL: Fin = makeFin(
  [
    [0.26, -0.05],
    [0.22, 0.3],
    [0.02, 0.62],
    [-0.2, 0.7],
    [-0.3, 0.45],
    [-0.26, -0.05],
  ],
  0.07,
  0.05,
  new THREE.Vector3(0.6, -0.3, 0.36),
  // 눕히고(x +90° 에 살짝 더 → 끝이 아래로) 뒤로 40° 쓸기
  new THREE.Euler(Math.PI / 2 + 0.4, -0.7, 0, "YXZ"),
);
/** 꼬리지느러미 오른쪽 절반 (수평, 왼쪽은 |z| 로 거울상). 뒷가장자리에 홈 */
const FLUKE: Fin = makeFin(
  [
    [0.16, 0.0],
    [0.12, 0.35],
    [-0.02, 0.7],
    [-0.24, 0.9],
    [-0.4, 0.82],
    [-0.34, 0.45],
    [-0.2, 0.0],
  ],
  0.06,
  0.045,
  new THREE.Vector3(-1.6, 0.1, 0),
  new THREE.Euler(Math.PI / 2, 0, 0, "YXZ"),
);

export function sdFins(px: number, py: number, pz: number) {
  const z = Math.abs(pz);
  let d = sdFin(px, py, pz, DORSAL);
  d = Math.min(d, sdFin(px, py, z, PECTORAL));
  d = Math.min(d, sdFin(px, py, z, FLUKE));
  return d;
}

export function sdDolphin(px: number, py: number, pz: number) {
  let d = smin(sdBody(px, py, pz), sdBeak(px, py, pz), 0.18);
  d = smin(d, sdFins(px, py, pz), 0.14);
  return d;
}

/** 표면 법선·투영·앵커 (부품 부착용) */
export const surface = makeSurface(sdDolphin);

/** 베이크 정의. 범위: x [-2.1, 2.0], y [-0.75, 1.25], z [-1.1, 1.1] */
export const DOLPHIN_DEF: CreatureDef = {
  name: "dolphin",
  manifest: { path: "components/dolphin/dolphinManifest.ts", exportName: "DOLPHIN_FILES" },
  sdf: sdDolphin,
  // 지느러미는 털 색만
  part: (x, y, z) => (sdFins(x, y, z) + 0.03 < Math.min(sdBody(x, y, z), sdBeak(x, y, z)) ? 0 : 1),
  gridScale: [2 / 4.1, 2 / 2.0, 2 / 2.2],
  gridOffset: [-0.05, 0.25, 0],
  resolution: 120,
};
