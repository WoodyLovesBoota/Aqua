import * as THREE from "three";

/**
 * 파리 배치 데이터 (순수 값). 좌표는 블록 중심 기준 월드 단위, 윗면 y = TOP.
 * 카메라가 +x+z 쪽에서 내려다보므로 키 큰 것(에펠·몽마르트르·개선문)은 뒤(−z), 센강·시테섬은 앞에 둔다.
 * 목업(.visual-check/paris/target-mockup.html) 경계 검사로 블록 가장자리 0.35 안쪽에 들어오는 것을 확인한 자리다.
 */
export const BLOCK = { W: 20, D: 14, CORNER: 1.3, TOP: 0, LAND_H: 0.9, STRATA: 1.3, LID_H: 7.6 };
export const TOP = BLOCK.TOP;
export const WATER_Y = TOP - 0.3;

/** 센강 중심선 (앞쪽을 굽이쳐 흐른다) */
export const SEINE = new THREE.SplineCurve([[-9.0, 3.4], [-6.3, 4.4], [-2.8, 4.0], [0.6, 3.3], [4.8, 3.7], [9.0, 4.4]].map(([x, z]) => new THREE.Vector2(x, z)));

/** 중심선 위에서 x 가 가장 가까운 매개변수 t */
export function tAtX(x: number) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 400; i++) {
    const d = Math.abs(SEINE.getPoint(i / 400).x - x);
    if (d < bd) {
      bd = d;
      best = i / 400;
    }
  }
  return best;
}

export const T_ISLE = tAtX(5.0);
/** 반폭: 시테섬 부근에서 두 갈래로 넓어진다 */
export const hwAt = (t: number) => 0.78 + 0.62 * Math.exp(-Math.pow((t - T_ISLE) / 0.07, 2));

/** 강 윤곽 (x, z): 양쪽 둑 + 둥근 두 끝 */
export const SEINE_PTS = (() => {
  const L: THREE.Vector2[] = [], R: THREE.Vector2[] = [], N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = SEINE.getPoint(t), tg = SEINE.getTangent(t), n = new THREE.Vector2(-tg.y, tg.x), w = hwAt(t);
    L.push(p.clone().addScaledVector(n, w));
    R.push(p.clone().addScaledVector(n, -w));
  }
  const cap = (c: THREE.Vector2, dir: THREE.Vector2) => {
    const out: THREE.Vector2[] = [], n = new THREE.Vector2(-dir.y, dir.x);
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      out.push(c.clone().addScaledVector(n, Math.cos(a) * 0.78).addScaledVector(dir, Math.sin(a) * 0.62));
    }
    return out;
  };
  return [...L, ...cap(SEINE.getPoint(1), SEINE.getTangent(1)), ...R.reverse(), ...cap(SEINE.getPoint(0), SEINE.getTangent(0).clone().negate())];
})();

export function seineShape() {
  const s = new THREE.Shape();
  SEINE_PTS.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
  return s;
}

/** 시테섬: 강 가운데 타원 (중심·회전·반지름) */
export const ISLE = (() => {
  const c = SEINE.getPoint(T_ISLE), tg = SEINE.getTangent(T_ISLE);
  return { x: c.x, z: c.y, ry: -Math.atan2(tg.y, tg.x), a: 1.75, b: 0.62 };
})();

function inPoly(pts: THREE.Vector2[], x: number, z: number) {
  let inside = false;
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const A = pts[a], B = pts[b];
    if (A.y > z !== B.y > z && x < ((B.x - A.x) * (z - A.y)) / (B.y - A.y) + A.x) inside = !inside;
  }
  return inside;
}

/** 센강 물 위인가 (섬 제외) */
export function inSeine(x: number, z: number) {
  if (!inPoly(SEINE_PTS, x, z)) return false;
  const dx = x - ISLE.x, dz = z - ISLE.z, c = Math.cos(ISLE.ry), s = Math.sin(ISLE.ry);
  const u = dx * c - dz * s, v = dx * s + dz * c; // 섬 로컬 (rotation.y = ry 의 역)
  return (u / (ISLE.a + 0.06)) ** 2 + (v / (ISLE.b + 0.06)) ** 2 > 1;
}

/** 다리·배를 강에 맞춰 놓기: 강 축 t 에서의 점·접선·법선(앞쪽 +z) */
export function riverFrame(t: number) {
  const p = SEINE.getPoint(t), tg = SEINE.getTangent(t);
  return { p, tg, n: new THREE.Vector2(-tg.y, tg.x) };
}

/** 랜드마크 자리 [x, z, 회전 y, 배율] */
export const SITES = {
  eiffel: [-6.6, -3.5, 0.08, 1],
  carousel: [-4.0, 1.65, 0.3, 1],
  sacrecoeur: [0.8, -4.6, 0, 1],
  moulin: [-2.6, -1.6, 0.35, 1],
  louvre: [2.4, -0.75, 0, 1],
  concorde: [-0.6, 0.9, 0, 1],
  arc: [6.3, -4.75, 0.15, 1], // 오스만 건물에 가리지 않게 큰길 왼쪽 뒤로 (목업은 6.8, −4.5)
  morris: [5.15, 1.3, 0, 1],
  metro: [0.2, 2.4, -0.2, 1],
  wallace: [-0.6, -0.55, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** 오스만 건물 두 채 [z, 칸 수] (x = 8.65, 큰길 동쪽) */
export const HAUSSMANN = { x: 8.65, w: 1.1, h: 1.35, rows: [[-1.65, 6], [0.75, 7]] as const };
