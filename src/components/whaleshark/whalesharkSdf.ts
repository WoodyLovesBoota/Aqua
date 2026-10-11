import * as THREE from "three";
import { type CreatureDef } from "@/components/creature/creatureFormat";
import { type Fin, makeFin, sdEllipsoid, sdFin, sdRoundBox, sdRoundCone, makeSurface, smin } from "@/components/creature/sdf";

/**
 * 고래상어 좌표계: +x = 입(앞), +y = 위, +z = 오른쪽. 몸길이 ≈ 4.5 (x: 1.95 ~ -2.55)
 * 넓고 납작한 머리(앞이 네모난 입) + 굵은 방추 몸통 + 등 능선 3줄 + 큰 등지느러미·제2등지느러미 + 넓은 가슴지느러미 + 위가 긴 초승달 꼬리.
 */

export const EYE_GUESS = { x: 1.5, y: 0.02, z: 0.78, r: 0.07 };

export function sdBody(px: number, py: number, pz: number) {
  const yy = py < 0 ? py * 1.1 : py;
  // 머리: 넓고 납작하게 (윗면 평평), 앞은 둥근 상자로 네모난 입
  let d = sdRoundBox(px - 1.35, yy * 1.25 + 0.02, pz, 0.45, 0.36, 0.72, 0.3);
  d = smin(d, sdEllipsoid(px - 1.0, yy, pz, 0.9, 0.5, 0.8), 0.25);
  // 몸통 → 꼬리자루
  d = smin(d, sdRoundCone(px, yy, pz, 0.9, 0.02, 0, -0.5, 0.05, 0, 0.64, 0.58), 0.3);
  d = smin(d, sdRoundCone(px, yy, pz, -0.5, 0.05, 0, -1.5, 0.1, 0, 0.58, 0.26), 0.3);
  d = smin(d, sdRoundCone(px, yy, pz, -1.5, 0.1, 0, -2.05, 0.12, 0, 0.26, 0.12), 0.2);
  return d;
}

/** 등 능선 3줄: 가운데 + 양옆, 몸 윤곽을 따라 가늘게 */
export function sdRidges(px: number, py: number, pz: number) {
  let d = Infinity;
  const z = Math.abs(pz);
  // 가운데
  d = Math.min(d, sdRoundCone(px, py, z, 1.0, 0.58, 0, -0.5, 0.62, 0, 0.1, 0.1));
  d = Math.min(d, sdRoundCone(px, py, z, -0.5, 0.62, 0, -1.5, 0.36, 0, 0.1, 0.06));
  // 옆 (|z| 로 거울상)
  d = Math.min(d, sdRoundCone(px, py, z, 1.0, 0.44, 0.44, -0.5, 0.48, 0.42, 0.09, 0.09));
  d = Math.min(d, sdRoundCone(px, py, z, -0.5, 0.48, 0.42, -1.5, 0.28, 0.21, 0.09, 0.055));
  return d;
}

const DORSAL: Fin = makeFin(
  [
    [0.38, -0.05],
    [0.12, 0.5],
    [-0.22, 0.8],
    [-0.48, 0.74],
    [-0.42, 0.3],
    [-0.5, -0.05],
  ],
  0.1,
  0.07,
  new THREE.Vector3(-0.35, 0.56, 0),
  new THREE.Euler(0, 0, 0),
);
const DORSAL2: Fin = makeFin(
  [
    [0.16, -0.03],
    [0.05, 0.22],
    [-0.1, 0.32],
    [-0.22, 0.26],
    [-0.22, -0.03],
  ],
  0.06,
  0.04,
  new THREE.Vector3(-1.45, 0.3, 0),
  new THREE.Euler(0, 0, 0),
);
/** 꼬리: 위 엽이 길고 아래 엽이 짧은 초승달 (수직) */
const TAIL: Fin = makeFin(
  [
    [0.2, 0.05],
    [0.0, 0.5],
    [-0.3, 0.98],
    [-0.56, 0.92],
    [-0.46, 0.5],
    [-0.42, 0.1],
    [-0.44, -0.25],
    [-0.52, -0.55],
    [-0.34, -0.58],
    [-0.14, -0.32],
    [0.1, -0.1],
  ],
  0.09,
  0.06,
  new THREE.Vector3(-2.1, 0.12, 0),
  new THREE.Euler(0, 0, 0),
);
/** 오른쪽 가슴지느러미 (왼쪽은 |z| 로 거울상): 넓고 뒤로 쓸린 노 */
const PECTORAL: Fin = makeFin(
  [
    [0.3, -0.05],
    [0.3, 0.4],
    [0.08, 0.85],
    [-0.22, 0.92],
    [-0.4, 0.55],
    [-0.34, -0.05],
  ],
  0.09,
  0.06,
  new THREE.Vector3(0.5, -0.34, 0.5),
  new THREE.Euler(Math.PI / 2 + 0.35, -0.6, 0, "YXZ"),
);
/** 배지느러미 (작게) */
const PELVIC: Fin = makeFin(
  [
    [0.14, -0.03],
    [0.14, 0.2],
    [0.0, 0.4],
    [-0.14, 0.42],
    [-0.2, 0.2],
    [-0.16, -0.03],
  ],
  0.06,
  0.04,
  new THREE.Vector3(-0.95, -0.42, 0.3),
  new THREE.Euler(Math.PI / 2 + 0.5, -0.9, 0, "YXZ"),
);

export function sdFins(px: number, py: number, pz: number) {
  const z = Math.abs(pz);
  let d = sdFin(px, py, pz, DORSAL);
  d = Math.min(d, sdFin(px, py, pz, DORSAL2));
  d = Math.min(d, sdFin(px, py, pz, TAIL));
  d = Math.min(d, sdFin(px, py, z, PECTORAL));
  d = Math.min(d, sdFin(px, py, z, PELVIC));
  return d;
}

export function sdWhaleShark(px: number, py: number, pz: number) {
  let d = smin(sdBody(px, py, pz), sdRidges(px, py, pz), 0.1);
  d = smin(d, sdFins(px, py, pz), 0.16);
  return d;
}

/** 표면 법선·투영·앵커 (부품 부착용) */
export const surface = makeSurface(sdWhaleShark);

/** 베이크 정의. 범위: x [-2.8, 2.1], y [-0.85, 1.45], z [-1.5, 1.5] */
export const WHALESHARK_DEF: CreatureDef = {
  name: "whaleshark",
  manifest: { path: "components/whaleshark/whalesharkManifest.ts", exportName: "WHALESHARK_FILES" },
  sdf: sdWhaleShark,
  // 지느러미는 털 색만. 능선은 몸(점무늬 포함)
  part: (x, y, z) => (sdFins(x, y, z) + 0.03 < Math.min(sdBody(x, y, z), sdRidges(x, y, z)) ? 0 : 1),
  gridScale: [2 / 4.9, 2 / 2.3, 2 / 3.0],
  gridOffset: [-0.35, 0.3, 0],
  resolution: 128,
};
