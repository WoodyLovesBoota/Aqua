import * as THREE from "three";
import { type CreatureDef } from "@/components/creature/creatureFormat";
import { type Fin, makeFin, sdEllipsoid, sdFin, sdRoundCone, makeSurface, smin } from "@/components/creature/sdf";

/**
 * 바다거북 좌표계: +x = 머리(앞), +y = 위, +z = 오른쪽. 등딱지 길이 ≈ 2.0 (x: 0.9 ~ -1.1), 폭 ≈ 1.6, 머리 끝 x ≈ 1.75, 앞지느러미 끝 z ≈ ±1.35
 * 높은 돔 등딱지(챙처럼 넓은 테두리) + 그 아래 납작한 배딱지·몸 + 굵은 목에 큰 둥근 머리 + 등딱지 **아래**에서 나와 살짝 처진 좁은 노 지느러미 4 + 꼬리.
 * 2026-10-11 재모델: 이전 버전은 등딱지가 납작·넓고 앞지느러미가 같은 평면에서 날개처럼 뻗어 가오리로 읽혔다.
 * 메시는 scripts/bake-creature.mts turtle 이 굽고, 런타임은 눈·볼 앵커 계산에만 이 모듈을 쓴다.
 */

export const EYE_GUESS = { x: 1.46, y: 0.2, z: 0.27, r: 0.1 };
export const SHELL = { cx: -0.1, cy: 0.08, len: 1.0, halfW: 0.8, top: 0.64, bottom: 0.22, rim: 0.09 };

/** 등딱지(갑): 위는 높은 돔, 아래 가장자리는 챙처럼 바깥으로 넓게 벌어진 테두리 */
export function sdCarapace(px: number, py: number, pz: number) {
  const x = px - SHELL.cx;
  const y = py - SHELL.cy;
  // 뒤로 갈수록 조금 좁아진다 (앞 폭 > 뒤 폭)
  const w = SHELL.halfW * (1 - 0.08 * Math.max(0, -x) / SHELL.len);
  // 돔: 위 반지름 크고 아래는 얕게 (y 부호로 나눔). 아래쪽은 테두리 띠가 마감한다
  const ry = y > 0 ? SHELL.top : SHELL.bottom;
  let d = sdEllipsoid(x, y, pz, SHELL.len, ry, w);
  // 테두리 띠: 돔보다 넓은 납작 타원 — 플러시 인형의 둘레 솔기처럼 챙이 돌출한다
  const rim = sdEllipsoid(x, y + 0.02, pz, SHELL.len + SHELL.rim, 0.1, w + SHELL.rim);
  d = smin(d, rim, 0.08);
  return d;
}

/** 배딱지 + 몸통: 등딱지 아래 살짝 안쪽으로 들어간 납작한 덩어리. 테두리와 단차가 생겨 등딱지가 "얹힌" 느낌 */
export function sdPlastron(px: number, py: number, pz: number) {
  const x = px - SHELL.cx;
  return sdEllipsoid(x, py - SHELL.cy + 0.08, pz, SHELL.len - 0.1, 0.3, SHELL.halfW - 0.12);
}

export function sdHead(px: number, py: number, pz: number) {
  // 굵은 목(등딱지 아래 앞에서 나와 살짝 위로) → 큰 둥근 머리 → 짧은 부리
  let d = sdRoundCone(px, py, pz, 0.7, -0.02, 0, 1.18, 0.08, 0, 0.27, 0.26);
  d = smin(d, sdEllipsoid(px - 1.4, py - 0.1, pz, 0.36, 0.32, 0.33), 0.1);
  d = smin(d, sdRoundCone(px, py, pz, 1.55, 0.03, 0, 1.72, -0.01, 0, 0.18, 0.12), 0.08);
  return d;
}

/** 오른쪽(+z) 지느러미만 정의하고, 왼쪽은 z 를 뒤집어 평가한다 (정확한 거울상) */
const FLIPPERS_R: Fin[] = [
  // 앞지느러미: 등딱지 테두리 아래 어깨에서 나오는 좁은 노. 로컬 +y 가 바깥쪽. 뿌리 폭 0.44, 끝은 둥글게
  makeFin(
    [
      [0.22, -0.05],
      [0.24, 0.3],
      [0.16, 0.66],
      [0.02, 0.94],
      [-0.14, 1.0],
      [-0.26, 0.8],
      [-0.26, 0.4],
      [-0.2, -0.05],
    ],
    0.12,
    0.07,
    new THREE.Vector3(0.45, -0.12, 0.6),
    // 판을 거의 수평으로 눕히되(x 축 +90° + 0.2 → 끝이 아래로 처짐), 뒤로 32° 만 쓸어 "팔"로 읽히게
    new THREE.Euler(Math.PI / 2 + 0.2, -0.56, -0.12, "YXZ"),
  ),
  // 뒷지느러미: 짧고 둥근 노, 뒤·바깥으로, 등딱지 뒤 테두리 아래에서
  makeFin(
    [
      [0.14, -0.05],
      [0.16, 0.16],
      [0.06, 0.4],
      [-0.1, 0.46],
      [-0.2, 0.3],
      [-0.16, -0.05],
    ],
    0.095,
    0.06,
    new THREE.Vector3(-0.78, -0.12, 0.52),
    new THREE.Euler(Math.PI / 2 + 0.15, -1.05, -0.1, "YXZ"),
  ),
];

export function sdFlippers(px: number, py: number, pz: number) {
  let d = Infinity;
  const z = Math.abs(pz);
  for (const f of FLIPPERS_R) d = Math.min(d, sdFin(px, py, z, f));
  return d;
}

export const sdTail = (px: number, py: number, pz: number) => sdRoundCone(px, py, pz, -1.0, -0.06, 0, -1.28, 0.0, 0, 0.11, 0.06);

/** 등딱지를 뺀 몸(배딱지·머리·지느러미·꼬리) — 등딱지와는 작은 smin 으로 붙여 테두리 아래 단차를 남긴다 */
export function sdBodyNoShell(px: number, py: number, pz: number) {
  let d = smin(sdPlastron(px, py, pz), sdHead(px, py, pz), 0.14);
  d = smin(d, sdFlippers(px, py, pz), 0.1);
  d = smin(d, sdTail(px, py, pz), 0.1);
  return d;
}

export function sdTurtle(px: number, py: number, pz: number) {
  return smin(sdCarapace(px, py, pz), sdBodyNoShell(px, py, pz), 0.06);
}

/** 표면 법선·투영·앵커 (부품 부착용) */
export const surface = makeSurface(sdTurtle);

/** 베이크 정의. 범위: x [-1.45, 1.85], y [-0.5, 0.8], z [-1.55, 1.55] */
export const TURTLE_DEF: CreatureDef = {
  name: "turtle",
  manifest: { path: "components/turtle/turtleManifest.ts", exportName: "TURTLE_FILES" },
  sdf: sdTurtle,
  // 지느러미·꼬리는 털 색 전용(플러시 팔은 양면이 같은 천). 등딱지·배딱지·머리는 아랫면이 배 색
  part: (x, y, z) => (Math.min(sdTail(x, y, z), sdFlippers(x, y, z)) + 0.03 < Math.min(sdCarapace(x, y, z), sdPlastron(x, y, z), sdHead(x, y, z)) ? 0 : 1),
  gridScale: [2 / 3.3, 2 / 1.3, 2 / 3.1],
  gridOffset: [0.2, 0.15, 0],
  resolution: 128,
};
