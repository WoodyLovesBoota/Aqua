import * as THREE from "three";

/**
 * 전주 배치 데이터 (순수 값). 좌표는 블록 중심 기준 월드 단위, 윗면 y = TOP.
 * 카메라가 +x+z 쪽에서 내려다보므로 키 큰 것(오목대 언덕·풍남문·전동성당)은 뒤(−z), 시장·극장·물길은 앞에 둔다.
 * 목업(target-mockup.html) 경계 검사로 블록 가장자리 0.35 안쪽에 들어오는 것을 확인한 자리다.
 */
export const BLOCK = { W: 20, D: 14, CORNER: 1.3, TOP: 0, LAND_H: 0.9, STRATA: 1.3, LID_H: 7.6 };
export const TOP = BLOCK.TOP;
export const WATER_Y = TOP - 0.25;

/** 전주천 중심선 (앞왼쪽으로 굽이진 물길) */
export const STREAM = new THREE.SplineCurve([[-8.55, 0.45], [-7.6, 1.7], [-6.6, 3.2], [-5.0, 4.4], [-3.5, 5.1], [-2.6, 5.7]].map(([x, z]) => new THREE.Vector2(x, z)));
const HW = 0.72; // 반폭

/** 물길 윤곽 (x, z): 양쪽 둑 + 둥근 두 끝 */
export const STREAM_PTS = (() => {
  const L: THREE.Vector2[] = [], R: THREE.Vector2[] = [], N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = STREAM.getPoint(t), tg = STREAM.getTangent(t), n = new THREE.Vector2(-tg.y, tg.x), w = HW * (0.85 + 0.25 * Math.sin(t * 9));
    L.push(p.clone().addScaledVector(n, w));
    R.push(p.clone().addScaledVector(n, -w));
  }
  const cap = (c: THREE.Vector2, tg: THREE.Vector2) => {
    const out: THREE.Vector2[] = [], n = new THREE.Vector2(-tg.y, tg.x);
    for (let k = 1; k < 10; k++) {
      const a = (k / 10) * Math.PI;
      out.push(c.clone().addScaledVector(n, Math.cos(a) * HW * 0.85).addScaledVector(tg, Math.sin(a) * HW * 0.85));
    }
    return out;
  };
  return [...L, ...cap(STREAM.getPoint(1), STREAM.getTangent(1)), ...R.reverse(), ...cap(STREAM.getPoint(0), STREAM.getTangent(0).clone().negate())];
})();

export function streamShape() {
  const s = new THREE.Shape();
  STREAM_PTS.forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
  return s;
}

/** 물길 안인가 (짝수-홀수 판정) */
export function inStream(x: number, z: number) {
  let inside = false;
  for (let a = 0, b = STREAM_PTS.length - 1; a < STREAM_PTS.length; b = a++) {
    const A = STREAM_PTS[a], B = STREAM_PTS[b];
    if (A.y > z !== B.y > z && x < ((B.x - A.x) * (z - A.y)) / (B.y - A.y) + A.x) inside = !inside;
  }
  return inside;
}

/** 랜드마크 자리 [x, z, 회전 y, 배율] */
export const SITES = {
  hanbyeok: [-7.6, 3.5, 0.6, 1],
  omokdae: [-6.7, -4.2, 0, 1],
  gate: [0.4, -4.7, 0, 1.15],
  cathedral: [6.6, -3.8, -0.42, 1],
  market: [6.6, 3.3, 0, 1],
  cinema: [2.5, 5.95, 0, 1],
  fan: [0.2, 5.6, -0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** 경기전 담장 (중심·폭·깊이) */
export const GYEONGGI = { x: 0.8, z: -1.0, w: 5.0, d: 2.9 };
