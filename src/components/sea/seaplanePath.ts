import * as THREE from "three";
import { TANK } from "./lagoonNav";

/**
 * 수상기 경로 — 닫힌 CatmullRom 스플라인 한 바퀴. 좌표는 월드 xz, y 는 수면(TANK.TOP) 기준 고도.
 * 오른쪽 바깥 상공 → 강하 → 앞바다 활주로(z ≈ 2.0, 섬·산호·방갈로 금지 구역 밖) 착수 → 활주 → 이륙 → 왼쪽 벽 너머 상승 →
 * 블록 뒤를 돌아 → 오른쪽에서 다시 진입. 조종점마다 속도(u/s)·피치 보정(플레어·이륙 회전)을 적고 호 길이로 보간한다.
 */
export type Phase = "approach" | "taxi" | "takeoff" | "climb" | "loop";

interface Knot {
  p: [number, number, number];
  v: number; // 이 점에서의 속도 (월드/초)
  pitch?: number; // 자세 피치 보정 (rad) — 플레어·이륙 회전
  phase: Phase; // 이 점부터 다음 점까지의 구간 이름
}

const HX = TANK.W / 2; // 8.5
export const RUNWAY_Z = 1.85; // 섬 앞 산호 원(+0.3)·앞 모래톱 산호·정적 보트(3.9, 2.9)·방갈로 구역 사이의 열린 물
/** 조종점. x 는 ±14 안(데스크톱 프레임 가장자리), 뒤쪽 선회는 돔(높이 4) 위 고도 5~6 */
export const CIRCUIT: Knot[] = [
  // 오른쪽 바깥 사분원(중심 11,−1.1 · 반지름 3.5): +z 방향으로 들어와 활주로 연장선(z ≈ 2.4)에 −x 방향으로 정렬된다
  { p: [14.5, 2.6, -1.1], v: 3.0, phase: "approach" },
  { p: [14.03, 2.2, 0.65], v: 2.8, phase: "approach" },
  { p: [12.75, 1.6, 1.93], v: 2.6, phase: "approach" },
  { p: [11.0, 1.0, 2.4], v: 2.4, phase: "approach" }, // 최종 진입 (돔 앞 오른쪽 벽을 통과)
  { p: [7.6, 0.3, RUNWAY_Z + 0.15], v: 2.0, pitch: 0.18, phase: "approach" }, // 플레어 (기수 들기)
  { p: [5.6, 0, RUNWAY_Z], v: 1.6, pitch: 0.08, phase: "taxi" }, // 착수
  { p: [2.0, 0, RUNWAY_Z], v: 1.0, phase: "taxi" },
  { p: [-1.5, 0, RUNWAY_Z], v: 0.9, phase: "takeoff" }, // 활주 끝 → 가속
  { p: [-4.6, 0.1, RUNWAY_Z], v: 1.7, pitch: 0.2, phase: "takeoff" }, // 이륙 회전
  { p: [-HX - 1.2, 1.2, 1.4], v: 2.4, pitch: 0.1, phase: "climb" }, // 왼쪽 벽 너머 상승
  { p: [-13.5, 2.6, -1.5], v: 2.8, phase: "loop" }, // 왼쪽 바깥 (NDC ≈ −0.72, 0.78)
  { p: [-12.0, 3.2, -6.2], v: 2.9, phase: "loop" },
  { p: [-5.5, 3.5, -8.8], v: 2.9, phase: "loop" }, // 블록 뒤 (돔 뒤 벽 너머, 화면 위 0.9 안)
  { p: [3.5, 3.5, -8.9], v: 2.9, phase: "loop" },
  { p: [10.0, 3.2, -6.0], v: 2.9, phase: "loop" },
  { p: [13.2, 2.9, -3.6], v: 3.0, phase: "loop" }, // 오른쪽 바깥 → 사분원으로
];
/** `?plane=park` 정지 자리 (활주로 가운데, 기수 −x) */
export const PARK = { x: 0.5, z: RUNWAY_Z, yaw: Math.PI };

const DIVS = 1200;

export interface Circuit {
  length: number;
  pointAt(s: number, out: THREE.Vector3): THREE.Vector3;
  tangentAt(s: number, out: THREE.Vector3): THREE.Vector3;
  speedAt(s: number): number;
  pitchBiasAt(s: number): number;
  phaseAt(s: number): Phase;
  /** 조종점 k 의 호 길이 자리 */
  knotS: number[];
}

export function makeCircuit(knots: Knot[] = CIRCUIT): Circuit {
  const curve = new THREE.CatmullRomCurve3(
    knots.map((k) => new THREE.Vector3(...k.p)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = DIVS;
  const lengths = curve.getLengths(DIVS);
  const length = lengths[DIVS];
  // 조종점 k 는 t = k/N — 호 길이 표에서 그 자리를 읽는다
  const N = knots.length;
  const knotS = knots.map((_, k) => lengths[Math.round((k / N) * DIVS)]);
  const seg = (s: number) => {
    let k = 0;
    while (k + 1 < N && knotS[k + 1] <= s) k++;
    const s0 = knotS[k];
    const s1 = k + 1 < N ? knotS[k + 1] : length;
    return { k, f: s1 > s0 ? THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1) : 0 };
  };
  const lerpProp = (s: number, get: (k: Knot) => number) => {
    const { k, f } = seg(s);
    const a = get(knots[k]), b = get(knots[(k + 1) % N]);
    return a + (b - a) * THREE.MathUtils.smoothstep(f, 0, 1);
  };
  const wrap = (s: number) => ((s % length) + length) % length;
  return {
    length,
    knotS,
    pointAt: (s, out) => curve.getPointAt(wrap(s) / length, out),
    tangentAt: (s, out) => curve.getTangentAt(wrap(s) / length, out).normalize(),
    speedAt: (s) => lerpProp(wrap(s), (k) => k.v),
    pitchBiasAt: (s) => lerpProp(wrap(s), (k) => k.pitch ?? 0),
    phaseAt: (s) => knots[seg(wrap(s)).k].phase,
  };
}
