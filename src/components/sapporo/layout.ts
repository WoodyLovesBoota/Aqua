import * as THREE from "three";

/**
 * 삿포로 배치 데이터 (순수 값). 좌표는 블록 중심 기준 월드 단위, 윗면 y = TOP.
 * 카메라가 +x+z 쪽에서 내려다보므로 키 큰 것(모이와산·TV 타워·눈 성)은 뒤(−z), 낮은 것(온천·스케이트장·야타이)은 앞에 둔다.
 * 모든 물체는 블록 가장자리에서 0.35 안쪽 — 목업 경계 검사로 튀어나온 것(료칸·산·앞줄 나무·구름)을 옮긴 자리다.
 */
export const BLOCK = { W: 20, D: 14, CORNER: 1.3, TOP: 0, LAND_H: 0.9, STRATA: 1.3, LID_H: 7.6 };
export const TOP = BLOCK.TOP;
/** 온천 수면 높이 (땅보다 살짝 아래) */
export const WATER_Y = TOP - 0.2;

/** 노천탕 윤곽 (x, z) — 앞왼쪽, 중심 (−6.2, 3.0) 기준 1.3 배 */
export const POOL_C = new THREE.Vector2(-6.2, 3.0);
const POOL_CTRL: [number, number][] = [[-7.4, 2.2], [-6.2, 1.7], [-5.0, 2.0], [-4.5, 2.9], [-4.9, 3.9], [-6.0, 4.3], [-7.2, 4.0], [-7.8, 3.1]].map(([x, z]) => [POOL_C.x + (x - POOL_C.x) * 1.3, POOL_C.y + (z - POOL_C.y) * 1.3]);
export const POOL_PTS = new THREE.SplineCurve(POOL_CTRL.map(([x, z]) => new THREE.Vector2(x, z)).concat([new THREE.Vector2(POOL_CTRL[0][0], POOL_CTRL[0][1])])).getSpacedPoints(80);

/** 탕 윤곽 → 도형 (xy 평면, rotateX(−π/2) 뒤 xz 가 되게 z 를 뒤집어 둔다) */
export function poolShape() {
  const s = new THREE.Shape();
  POOL_PTS.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
  return s;
}

/** 탕 안인가 (짝수-홀수 판정) */
export function inPool(x: number, z: number) {
  let inside = false;
  for (let a = 0, b = POOL_PTS.length - 1; a < POOL_PTS.length; b = a++) {
    const A = POOL_PTS[a], B = POOL_PTS[b];
    if (A.y > z !== B.y > z && x < ((B.x - A.x) * (z - A.y)) / (B.y - A.y) + A.x) inside = !inside;
  }
  return inside;
}

/** 랜드마크 자리 [x, z, 회전 y, 배율] */
export const SITES = {
  ryokan: [-7.6, 5.2, 0.1, 1.15],
  stoneLantern: [-3.9, 1.5, 0, 1.4],
  mountain: [-6.3, -3.4, 0, 0.89],
  tower: [6.9, -3.7, 0.55, 1],
  castle: [1.6, -3.45, 0, 1.35],
  snowman: [4.6, -2.8, 0.5, 1.2],
  clock: [-0.7, 2.5, -0.15, 1.4],
  akarenga: [6.4, 4.1, -0.35, 1.35],
  rink: [2.4, 3.3, 0, 1],
  yatai: [1.4, 6.0, -0.25, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** 오도리 공원 띠 (z 중심, x 중심) */
export const ODORI = { x: 1.4, z: -2.75 };
/** 노면전차 선로: z, x 시작·끝 */
export const TRAM = { z: 0.95, x0: -3.4, x1: 9.4 };
/** 가로등 자리 (오도리·시계탑 사이) */
export const LAMPS: [number, number][] = [[-2.6, -1.4], [0, -1.4], [2.6, -1.4], [5.2, -1.4], [-3.2, 1.6], [3.6, 2.2], [7.8, 2.4]];
