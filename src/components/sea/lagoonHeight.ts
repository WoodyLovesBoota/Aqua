/**
 * 라군 바닥 높이맵 — 모래섬은 언덕들의 max.
 * k=2 는 가우시안(완만한 여울), k=4 는 윗면이 평평한 모래톱.
 * JS(지오메트리·AI 회피)와 GLSL(수심 색·거품)이 같은 식을 쓴다.
 */
interface Bump {
  x: number;
  z: number;
  sigma: number;
  amp: number; // 바닥 기준 높이
  k: 2 | 4;
}

/** 맵 배율 — 레이아웃 좌표는 10×8 기준으로 적고 S 로 늘린다 (1.7 → 17×13.6, lagoonNav.TANK 와 같이 바꾼다). 소품·생물 크기는 절대 단위라 안 커진다 */
export const S = 1.7;
const BUMPS: Bump[] = (
  [
    // amp 는 SMOOTH*ln(개수) ≈ 0.35 만큼 깎여 나온다 (log-sum-exp 의 바닥 보정)
    { x: -2.3, z: -2.0, sigma: 1.4, amp: 3.5, k: 4 }, // 본섬 (수면 위 ≈ 0.35)
    { x: -1.0, z: -2.7, sigma: 0.9, amp: 3.35, k: 4 }, // 옆 모래톱
    { x: -3.3, z: -0.8, sigma: 0.8, amp: 3.3, k: 4 }, // 작은 곶
    { x: -2.0, z: -1.8, sigma: 2.4, amp: 2.8, k: 2 }, // 섬 둘레 얕은 여울
    { x: 2.6, z: 2.4, sigma: 1.4, amp: 1.55, k: 2 }, // 앞쪽 완만한 여울
    { x: 2.5, z: -2.2, sigma: 2.5, amp: 2.3, k: 2 }, // 리조트 아래 얕은 여울 (수심 ≈ 0.85)
  ] as Bump[]
).map((b) => ({ ...b, x: b.x * S, z: b.z * S, sigma: b.sigma * S }));

function bumpAt(b: Bump, x: number, z: number) {
  const dx = x - b.x;
  const dz = z - b.z;
  const q = (dx * dx + dz * dz) / (2 * b.sigma * b.sigma);
  return b.amp * Math.exp(-(b.k === 4 ? q * q : q));
}

const SMOOTH = 0.22; // 언덕끼리 부드럽게 합치는 폭 (log-sum-exp)

export function floorHeight(bottom: number, x: number, z: number) {
  let acc = 0;
  for (const b of BUMPS) acc += Math.exp(bumpAt(b, x, z) / SMOOTH);
  let h = SMOOTH * Math.log(acc) - SMOOTH * Math.log(BUMPS.length);
  // 작은 모래 굴곡
  h += (Math.sin((x * 1.7 + z * 0.9) / S) + Math.sin((x * 0.6 - z * 2.1) / S)) * 0.03;
  return bottom + h;
}

/** 산호 군락 자리 (Reef.tsx 가 심고, 큰 생물은 피한다). r 은 산호가 깔리는 반경, maxH 는 산호 최대 높이 */
export const REEF_SITES = (
  [
    { id: "sandbar", x: 2.27, z: 2.53, r: 1.15, maxH: 0.42, seed: 11 }, // 앞 모래톱 (수심 ≈ 1.7)
    { id: "shore", x: -0.6, z: 0.13, r: 0.85, maxH: 0.55, seed: 23 }, // 섬 앞 여울 (수심 ≈ 1.5)
    { id: "deep", x: -3.47, z: 2.13, r: 0.9, maxH: 0.42, seed: 37 }, // 왼쪽 앞 깊은 물 (수심 ≈ 2.5)
  ] as const
).map((r) => ({ ...r, x: r.x * S, z: r.z * S }));
export type ReefSite = (typeof REEF_SITES)[number];

/** 큰 생물이 피해야 할 영역: 섬(원) · 산호 군락(원) · 방갈로 구역(사각형) */
export const NO_GO = {
  island: { x: -2.2 * S, z: -1.9 * S, r: 2.6 * S },
  reefs: REEF_SITES.map((r) => ({ x: r.x, z: r.z, r: r.r + 0.15 })),
  resort: { x0: 0.2 * S, x1: 4.4 * S, z0: -3.6 * S, z1: -0.1 * S },
};
/** 원형 금지 구역 전부 (섬 + 산호) */
export const NO_GO_CIRCLES = [NO_GO.island, ...NO_GO.reefs];

export const floorHeightGLSL = /* glsl */ `
uniform float uBottom;
float floorHeight(vec2 p) {
  float acc = 0.0;
  float q;
${BUMPS.map((b) => {
  const c = `vec2(${b.x.toFixed(3)}, ${b.z.toFixed(3)})`;
  return `  q = dot(p - ${c}, p - ${c}) / ${(2 * b.sigma * b.sigma).toFixed(4)}; acc += exp(${b.amp.toFixed(3)} * exp(-${b.k === 4 ? "q * q" : "q"}) / ${SMOOTH});`;
}).join("\n")}
  float h = ${SMOOTH} * log(acc) - ${(SMOOTH * Math.log(BUMPS.length)).toFixed(5)};
  h += (sin((p.x * 1.7 + p.y * 0.9) / ${S}) + sin((p.x * 0.6 - p.y * 2.1) / ${S})) * 0.03;
  return uBottom + h;
}
`;
