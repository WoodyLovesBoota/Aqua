import * as THREE from "three";

/**
 * 마리나베이 배치 데이터 (순수 값). 좌표는 블록 중심 기준 월드 단위, 윗면 y = TOP.
 * 카메라는 +x+z 쪽에서 내려다보므로 키 큰 것(샌즈·플라이어·가든스)은 뒤(−z), 낮은 것(에스플러네이드·헬릭스)은 앞에 둔다.
 */
export const BLOCK = { W: 20, D: 14, CORNER: 1.3, TOP: 0, LAND_H: 0.9, STRATA: 1.3, LID_H: 7.6 };
export const TOP = BLOCK.TOP;
export const WATER_Y = TOP - 0.24;

/** 만(마리나 저수지) 윤곽 조종점 (x, z) — 앞오른쪽으로 헬릭스 다리가 건너는 물길 */
const BAY_CTRL: [number, number][] = [
  [-6.0, -1.4], [-4.8, -3.0], [-2.2, -3.4], [0.8, -3.3], [3.4, -3.2], [5.0, -2.6], [5.6, -1.0], [5.3, 0.5],
  [6.3, 1.4], [7.6, 2.4], [7.3, 3.5], [6.0, 3.0], [4.4, 2.2], [2.2, 2.9], [-0.4, 3.4], [-2.8, 3.2], [-4.8, 2.2], [-6.1, 0.6],
];
/** 매끈한 만 윤곽 (x, z) 200점 */
export const BAY_PTS = new THREE.SplineCurve(BAY_CTRL.map(([x, z]) => new THREE.Vector2(x, z)).concat([new THREE.Vector2(BAY_CTRL[0][0], BAY_CTRL[0][1])])).getSpacedPoints(200);
export const BAY_CENTER = new THREE.Vector2(-0.4, 0);
const BAY_MIN = BAY_PTS.reduce((m, p) => m.min(p), new THREE.Vector2(Infinity, Infinity));
const BAY_MAX = BAY_PTS.reduce((m, p) => m.max(p), new THREE.Vector2(-Infinity, -Infinity));
export const BAY_BOX = { minX: BAY_MIN.x, maxX: BAY_MAX.x, minZ: BAY_MIN.y, maxZ: BAY_MAX.y };

/** 만 안인가 (짝수-홀수 판정) */
export function inBay(x: number, z: number) {
  let inside = false;
  for (let a = 0, b = BAY_PTS.length - 1; a < BAY_PTS.length; b = a++) {
    const A = BAY_PTS[a], B = BAY_PTS[b];
    if (A.y > z !== B.y > z && x < ((B.x - A.x) * (z - A.y)) / (B.y - A.y) + A.x) inside = !inside;
  }
  return inside;
}

/** 만 윤곽 Shape (xy 평면, y = −z — rotateX(−90°) 로 눕힌다) */
export function bayShape() {
  const s = new THREE.Shape();
  BAY_PTS.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
  return s;
}

/** 랜드마크 자리 */
export const SITES = {
  sands: { x: 1.4, z: -5.0, towersX: [-0.9, 1.4, 3.7], H: 4.6 },
  lotus: { x: -3.5, z: -3.9, ry: 0.5, scale: 1 },
  flyer: { x: -6.9, z: -4.5, ry: 0.62 },
  helix: { a: [5.4, 3.75] as [number, number], b: [7.5, 1.25] as [number, number] },
  esplanade: { domes: [[-3.0, 4.85, 1.12, 0.95, -0.5], [-0.85, 5.15, 0.9, 0.85, -0.35]] as [number, number, number, number, number][], lobby: [-1.92, 5.0] as [number, number], theatre: [-1.3, 3.95] as [number, number] },
  merlion: { x: -6.45, z: 0.9, ry: 0.12, scale: 1.55 },
  fullerton: { x: -8.4, z: -0.4, ry: 0.1 },
  supertrees: [[6.6, -5.4, 2.6], [7.5, -4.5, 2.0], [8.4, -5.6, 2.9], [7.5, -6.3, 1.7], [9.0, -4.3, 1.9], [6.3, -3.8, 1.6], [9.1, -6.2, 1.5], [8.2, -3.4, 1.45]] as [number, number, number][],
  domes: { flower: [8.45, -1.5] as [number, number], cloud: [8.65, 0.75] as [number, number] },
  lawns: [[-5.4, 4.8, 1.0], [1.6, 5.4, 1.3], [4.4, 5.6, 0.9], [-1.5, -5.7, 0.6], [-8.6, 4.9, 1.0], [6.3, -0.4, 0.7], [-8.6, -3.0, 0.9], [-4.6, -5.8, 0.7]] as [number, number, number][],
  boats: [[-1.8, -0.4, 0.6, "#c8463d"], [2.0, 1.2, -0.9, "#2f6fb0"], [-3.8, 1.4, 2.2, "#c8463d"], [3.0, -1.9, 0.2, "#e0a52e"]] as [number, number, number, string][],
};
