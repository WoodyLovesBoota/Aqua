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

const HX = TANK.W / 2;
export const RUNWAY_Z = 1.85; // 섬 앞 산호 원(+0.3)·앞 모래톱 산호·정적 보트(3.9, 2.9)·방갈로 구역 사이의 열린 물
/**
 * 젤리 뚜껑(돔: 반폭 HX·반깊이 6.8·높이 4) 안에서만 난다. 앞바다 위 경주로 모양 한 바퀴:
 * 활주로(z 1.85, −x 방향) → 왼쪽 반원 선회 상승 → 앞쪽 직선(z 5.0, +x, 고도 ≈ 2.5) → 오른쪽 반원 선회 강하 → 착수.
 * 반원은 반지름 1.575(z 1.85 ↔ 5.0) — 날개 반폭 0.75 까지 벽에서 0.4 이상 떨어지게 중심을 벽에서 2.9 안쪽에 둔다.
 * 섬 야자수(관 높이 ≤ 3.1)·방갈로는 전부 z < 0 이라 경로(z ≥ 1.85)와 만나지 않는다.
 */
const TR = 1.575;
const TZ = RUNWAY_Z + TR; // 반원 중심 z
const D45 = TR * Math.SQRT1_2;
const LX = -(HX - 2.9), RX = HX - 2.9; // 왼쪽·오른쪽 반원 중심 x
const OUT_Z = RUNWAY_Z + 2 * TR; // 앞쪽 직선 z
export const CIRCUIT: Knot[] = [
  { p: [3.5, 2.55, OUT_Z], v: 2.3, phase: "loop" }, // 앞쪽 직선 (카메라에 가장 가깝다)
  { p: [RX, 2.35, OUT_Z], v: 2.2, phase: "approach" }, // 오른쪽 반원 — 선회하며 강하
  { p: [RX + D45, 1.9, TZ + D45], v: 2.1, phase: "approach" },
  { p: [RX + TR, 1.45, TZ], v: 2.0, phase: "approach" },
  { p: [RX + D45, 1.05, TZ - D45], v: 1.9, phase: "approach" },
  { p: [RX, 0.7, RUNWAY_Z], v: 1.8, phase: "approach" }, // 최종 진입
  { p: [RX - 2.2, 0.25, RUNWAY_Z], v: 1.6, pitch: 0.18, phase: "approach" }, // 플레어 (기수 들기)
  { p: [RX - 3.9, 0, RUNWAY_Z], v: 1.4, pitch: 0.08, phase: "taxi" }, // 착수
  { p: [0.8, 0, RUNWAY_Z], v: 0.9, phase: "taxi" },
  { p: [-2.0, 0, RUNWAY_Z], v: 0.9, phase: "takeoff" }, // 활주 끝 → 가속
  { p: [LX + 2.6, 0.15, RUNWAY_Z], v: 1.6, pitch: 0.2, phase: "takeoff" }, // 이륙 회전
  { p: [LX, 0.8, RUNWAY_Z], v: 1.9, pitch: 0.1, phase: "climb" }, // 왼쪽 반원 — 선회하며 상승
  { p: [LX - D45, 1.3, TZ - D45], v: 2.0, phase: "climb" },
  { p: [LX - TR, 1.8, TZ], v: 2.1, phase: "loop" },
  { p: [LX - D45, 2.2, TZ + D45], v: 2.2, phase: "loop" },
  { p: [LX, 2.45, OUT_Z], v: 2.3, phase: "loop" },
  { p: [-1.0, 2.6, OUT_Z], v: 2.3, phase: "loop" },
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
