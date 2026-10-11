import { S } from "./lagoonHeight";

/**
 * 리조트 배치 데이터 — 소품을 그리는 Resort.tsx 와 손님 길찾기(guestNav)·그림자가 같이 읽는다 (순수 데이터, .ts 라 Node 점검 스크립트도 import 한다).
 * 좌표는 10×8 기준 × S.
 */
export const DECK_Y = 0.12; // 수면 위 데크 높이 (판자 윗면 = DECK_Y + 0.0125)
export const PLANK_W = 0.26;
export const HUT = 0.56; // 방갈로 축소 배율 (기준 한 변 1)
export const DECK_TOP = DECK_Y + 0.0125;
/** 방갈로 발판 윗면 (로컬 ly 0.02 × HUT 위) */
export const HUT_FLOOR = DECK_Y + 0.02 + 0.02 * HUT;

const sc = ([x, z]: [number, number]): [number, number] => [x * S, z * S];

/** 데크 보도 척추선 — 섬 모래톱에서 바다 쪽(피어 끝)으로 */
export const SPINE: [number, number][] = (
  [
    [-0.75, -2.5],
    [0.9, -2.35],
    [2.4, -1.95],
    [3.4, -1.25],
  ] as [number, number][]
).map(sc);

/** 방갈로 위치·방향. 보도에서 짧은 다리로 이어진다. 테라스(+lz)가 보도를 향한 채 둘(0·4)은 손님이 들어간다 */
export const BUNGALOWS: { x: number; z: number; yaw: number }[] = (
  [
    { x: 0.7, z: -3.2, yaw: 0.1 },
    { x: 1.75, z: -3.15, yaw: -0.2 },
    { x: 2.8, z: -2.9, yaw: 0.3 },
    { x: 3.75, z: -2.3, yaw: 0.6 },
    { x: 1.25, z: -1.5, yaw: 0.2 },
    { x: 2.3, z: -1.05, yaw: -0.3 },
    { x: 3.3, z: -0.4, yaw: 0.5 },
    { x: 4.1, z: -1.4, yaw: 0.9 },
  ] as { x: number; z: number; yaw: number }[]
).map((b) => ({ ...b, x: b.x * S, z: b.z * S }));

/** 야자수 (줄기 기준 키 h) */
export interface PalmDef {
  x: number;
  z: number;
  h: number;
  yaw: number;
  ph: number;
}

export const PALMS: PalmDef[] = (
  [
    { x: -2.9, z: -2.6, h: 2.2, yaw: 3.6, ph: 0 },
    { x: -2.05, z: -2.85, h: 1.85, yaw: 4.4, ph: 1.1 },
    { x: -1.45, z: -2.25, h: 1.55, yaw: 5.6, ph: 2.3 },
    { x: -2.6, z: -1.45, h: 2.0, yaw: 1.4, ph: 0.7 },
    { x: -3.25, z: -2.0, h: 1.7, yaw: 2.6, ph: 1.8 },
    { x: -1.85, z: -1.55, h: 1.4, yaw: 0.6, ph: 2.9 },
    { x: -1.05, z: -2.75, h: 1.2, yaw: 5.0, ph: 0.4 },
    { x: -3.4, z: -1.2, h: 1.3, yaw: 2.0, ph: 1.4 },
  ] as PalmDef[]
).map((p) => ({ ...p, x: p.x * S, z: p.z * S }));

/** 섬 횃불 자리 — 모래 셰이더의 따뜻한 빛 웅덩이도 이 자리를 쓴다 */
export const TORCHES: [number, number][] = (
  [
    [-2.25, -1.15],
    [-1.25, -1.65],
    [-3.3, -2.95],
    [-0.95, -2.45],
  ] as [number, number][]
).map(sc);

export const UMBRELLAS: { x: number; z: number; lean: number }[] = [
  { x: -2.0, z: -1.35, lean: 0.3 },
  { x: -2.85, z: -2.75, lean: -0.2 },
  { x: -1.5, z: -1.95, lean: 0.1 },
].map((u) => ({ ...u, x: u.x * S, z: u.z * S }));

/** 선베드 (yaw: 발 쪽 = 로컬 +x, 등받이는 −x 끝) */
export const SUNBEDS: { x: number; z: number; yaw: number }[] = [
  { x: -1.75, z: -1.1, yaw: 0.4 },
  { x: -1.95, z: -0.95, yaw: 0.4 },
  { x: -2.6, z: -2.95, yaw: -0.3 },
].map((b) => ({ ...b, x: b.x * S, z: b.z * S }));

export const BUSHES: { x: number; z: number; s: number }[] = [
  { x: -3.1, z: -2.2, s: 1 },
  { x: -2.35, z: -2.95, s: 0.8 },
  { x: -1.7, z: -2.5, s: 0.9 },
  { x: -2.9, z: -1.3, s: 0.7 },
  { x: -1.3, z: -2.1, s: 0.6 },
].map((b) => ({ ...b, x: b.x * S, z: b.z * S }));

/** 해먹: 야자수 인덱스 두 개 사이, 가운데 모래 높이 + HAMMOCK_H 에 매고 HAMMOCK_SAG 만큼 처진다 */
export const HAMMOCK = { a: 0, b: 3, h: 0.55, sag: 0.22 };

/** 정적 보트 (리조트 병합) — 손님이 타는 보트는 피어 끝에 따로 매어 둔다 (Guests) */
export const STATIC_BOATS: { x: number; z: number; yaw: number }[] = [{ x: 2.3 * S, z: 1.7 * S, yaw: 0.7 }];

/** 섬 바위 중 손님이 피할 것 (SeaScene rocks 와 같은 자리) */
export const ISLAND_ROCKS: { x: number; z: number; r: number }[] = [
  { x: -3.0 * S, z: -0.9 * S, r: 0.3 },
  { x: -1.4 * S, z: -1.4 * S, r: 0.22 },
];

/** 방갈로로 가는 다리가 척추선에서 시작하는 점 (척추선에 가장 가까운 점) */
export function bridgeStart(h: { x: number; z: number }): [number, number] {
  let best: [number, number] = SPINE[0];
  let bd = Infinity;
  for (let i = 0; i < SPINE.length - 1; i++) {
    const [ax, az] = SPINE[i];
    const [bx, bz] = SPINE[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const t = Math.max(0, Math.min(1, ((h.x - ax) * vx + (h.z - az) * vz) / (vx * vx + vz * vz)));
    const px = ax + vx * t;
    const pz = az + vz * t;
    const d = Math.hypot(h.x - px, h.z - pz);
    if (d < bd) {
      bd = d;
      best = [px, pz];
    }
  }
  return best;
}

/** 방갈로 로컬 → 월드 (xz). 로컬은 한 변 1 기준, 앞(테라스) = +lz */
export function hutToWorld(h: { x: number; z: number; yaw: number }, lx: number, lz: number): [number, number] {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  return [h.x + (c * lx + s * lz) * HUT, h.z + (-s * lx + c * lz) * HUT];
}
/** 월드 → 방갈로 로컬 (xz) */
export function hutToLocal(h: { x: number; z: number; yaw: number }, x: number, z: number): [number, number] {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const dx = (x - h.x) / HUT, dz = (z - h.z) / HUT;
  return [c * dx - s * dz, s * dx + c * dz];
}
