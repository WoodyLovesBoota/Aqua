import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * 리조트 손님 인형 — 키 1.1 기준으로 만들고 GUEST_SCALE 로 줄인다 (앞 = +x, 위 = +y).
 * 한 사람 = 정점 색 지오메트리 1개. 부위(aPart: 몸 0 · 머리 1 · 왼팔 2 · 오른팔 3 · 왼다리 4 · 오른다리 5)는
 * 정점 셰이더가 부위 피벗을 축으로 회전시킨다 (머리·팔은 몸 회전을 같이 받는다). 그래서 사람당 1 드로우.
 * 얼굴은 생물과 같은 규칙 — 구슬 눈 + 볼터치, 입 없음.
 */

export const GUEST_SCALE = 0.29; // 키 ≈ 0.33 (방갈로 0.45 · 선베드 0.46 · 보트 1.0 에 맞춘 토이 비율)
export const GUEST_HEIGHT = 1.15 * GUEST_SCALE;

export const PART = { body: 0, head: 1, armL: 2, armR: 3, legL: 4, legR: 5 } as const;
/** 부위 피벗 (기준 단위): 몸은 골반, 머리는 목, 팔은 어깨, 다리는 고관절 */
export const PIVOTS: [number, number, number][] = [
  [0, 0.42, 0],
  [0, 0.83, 0],
  [0, 0.78, 0.19],
  [0, 0.78, -0.19],
  [0, 0.42, 0.085],
  [0, 0.42, -0.085],
];
const HIP_Y = 0.42;

export interface GuestLook {
  skin: string;
  hair: string;
  suit: string; // 수영복/반바지
  /** 반바지만(윗몸은 맨살) — 아니면 원피스 수영복 */
  trunks: boolean;
  hat: boolean;
  bun: boolean;
}
export const LOOKS: GuestLook[] = [
  { skin: "#f6cfa8", hair: "#4a2c1e", suit: "#8fe3d4", trunks: false, hat: true, bun: true }, // 밀짚모자 · 민트 수영복
  { skin: "#e0a97b", hair: "#2b1d16", suit: "#ef8a78", trunks: true, hat: false, bun: false }, // 코랄 반바지
];

const COL = {
  eye: "#1b1b1f",
  blush: "#f5a3a0",
  straw: "#ead9a2",
  ribbon: "#ef8a78",
  sandal: "#a08a6c",
};

/** 지오메트리를 색·부위로 칠하고 (인덱스 없는) 삼각형 목록으로 바꾼다. tint(y) 로 높이별 색을 줄 수 있다 */
function paint(g: THREE.BufferGeometry, part: number, color: string | ((x: number, y: number, z: number) => string)) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute("uv");
  const pos = geo.getAttribute("position");
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const parts = new Float32Array(n).fill(part);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    c.set(typeof color === "string" ? color : color(pos.getX(i), pos.getY(i), pos.getZ(i)));
    c.toArray(col, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPart", new THREE.BufferAttribute(parts, 1));
  return geo;
}

const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return g.applyMatrix4(m);
};

/** 손님 인형 지오메트리 (기준 키 1.1 — 부위 회전은 셰이더가, 전체 배율은 그룹이) */
export function makeGuestGeometry(look: GuestLook, who = 0) {
  const parts: THREE.BufferGeometry[] = [];
  // 다리 2 (고관절 0.42 에서 아래로) + 샌들
  for (const [side, part] of [
    [1, PART.legL],
    [-1, PART.legR],
  ] as const) {
    const z = 0.085 * side;
    parts.push(paint(place(new THREE.CapsuleGeometry(0.075, 0.3, 3, 8), 0, 0.225, z), part, (_x, y) => (look.trunks && y > 0.33 ? look.suit : look.skin)));
    parts.push(paint(place(new THREE.SphereGeometry(0.07, 8, 6), 0.035, 0.03, z, 1.3, 0.5, 1), part, COL.sandal));
  }
  // 몸통: 캡슐을 납작·넓게 (플러시 토르소). 반바지면 윗몸 맨살 + 아래 수영복
  parts.push(
    paint(place(new THREE.CapsuleGeometry(0.16, 0.2, 4, 12), 0, 0.6, 0, 0.72, 1, 1.1), PART.body, (_x, y) => (look.trunks ? (y < 0.52 ? look.suit : look.skin) : look.suit)),
  );
  // 팔 2 (어깨 0.78 에서 아래로)
  for (const [side, part] of [
    [1, PART.armL],
    [-1, PART.armR],
  ] as const) {
    parts.push(paint(place(new THREE.CapsuleGeometry(0.055, 0.26, 3, 8), 0, 0.59, 0.19 * side), part, look.skin));
  }
  // 머리 + 머리카락(뒤통수 반구) + 눈 + 볼터치
  parts.push(paint(place(new THREE.SphereGeometry(0.17, 14, 11), 0, 0.98, 0), PART.head, look.skin));
  parts.push(paint(place(new THREE.SphereGeometry(0.178, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), -0.03, 0.975, 0, 1, 1, 1, 0, 0, 0.35), PART.head, look.hair));
  if (look.bun) parts.push(paint(place(new THREE.SphereGeometry(0.07, 8, 6), -0.14, 1.09, 0), PART.head, look.hair));
  for (const side of [1, -1]) {
    parts.push(paint(place(new THREE.SphereGeometry(0.028, 8, 6), 0.152, 1.0, 0.065 * side), PART.head, COL.eye));
    parts.push(paint(place(new THREE.SphereGeometry(0.036, 8, 6), 0.142, 0.945, 0.105 * side, 0.35, 0.8, 1), PART.head, COL.blush));
  }
  if (look.hat) {
    // 밀짚모자: 넓은 챙 + 둥근 크라운 + 코랄 리본
    parts.push(paint(place(new THREE.CylinderGeometry(0.33, 0.33, 0.022, 18), 0.0, 1.09, 0, 1, 1, 1, 0, 0, 0.1), PART.head, COL.straw));
    parts.push(paint(place(new THREE.SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0.0, 1.085, 0, 1, 0.85, 1, 0, 0, 0.1), PART.head, COL.straw));
    parts.push(paint(place(new THREE.TorusGeometry(0.165, 0.016, 5, 20), 0.0, 1.11, 0, 1, 1, 1, Math.PI / 2, 0, 0.1), PART.head, COL.ribbon));
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  const ap = merged.getAttribute("aPart") as THREE.BufferAttribute;
  for (let i = 0; i < ap.count; i++) ap.setX(i, ap.getX(i) + who * 6);
  merged.computeBoundingSphere();
  return merged;
}

/** 두 사람을 한 지오메트리로 (aPart 에 사람 오프셋) */
export function makeGuestsGeometry() {
  const list = LOOKS.map((l, i) => makeGuestGeometry(l, i));
  const g = mergeGeometries(list, false)!;
  list.forEach((x) => x.dispose());
  return g;
}

/** 두 사람 한 메시: 부위 회전 mat3 12개(사람 i 의 부위 p = i*6+p) + 사람별 전체 변환(자리·yaw·기울임·배율, 안 보이면 0 배율) */
export const PEOPLE = 2;
export interface GuestUniforms {
  uRot: { value: THREE.Matrix3[] };
  uBody: { value: THREE.Matrix4[] };
}

const partGLSL = /* glsl */ `
attribute float aPart;
uniform mat3 uRot[${PEOPLE * 6}];
uniform mat4 uBody[${PEOPLE}];
const vec3 gPivot[6] = vec3[6](${PIVOTS.map((p) => `vec3(${p.map((v) => v.toFixed(3)).join(", ")})`).join(", ")});
`;

/** 손님 재질: 정점 색 + 부위 회전 + 사람별 전체 변환 — 두 사람이 1 드로우 */
export function makeGuestMaterial(): { mat: THREE.MeshStandardMaterial; u: GuestUniforms } {
  const u: GuestUniforms = {
    uRot: { value: Array.from({ length: PEOPLE * 6 }, () => new THREE.Matrix3()) },
    uBody: { value: Array.from({ length: PEOPLE }, () => new THREE.Matrix4()) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRot = u.uRot;
    shader.uniforms.uBody = u.uBody;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${partGLSL}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        int gp = int(aPart + 0.5);
        int gWho = gp / 6;
        int gPart = gp - gWho * 6;
        mat3 gR = uRot[gp];
        if (gPart >= 1 && gPart <= 3) gR = uRot[gWho * 6] * gR;
        objectNormal = mat3(uBody[gWho]) * (gR * objectNormal);`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 gPv = gPivot[gPart];
        transformed = gPv + uRot[gp] * (transformed - gPv);
        if (gPart >= 1 && gPart <= 3) transformed = gPivot[0] + uRot[gWho * 6] * (transformed - gPivot[0]);
        transformed = (uBody[gWho] * vec4(transformed, 1.0)).xyz;`,
      );
  };
  mat.customProgramCacheKey = () => "guest-parts";
  return { mat, u };
}

/** 한 사람의 포즈 (라디안). swing = 앞뒤(+앞), raise = 옆으로 벌림(+바깥), 몸 pitch = 앞으로 숙임(+) */
export interface Pose {
  body: { pitch: number; roll: number; yaw: number };
  head: { nod: number; turn: number; tilt: number };
  armL: { swing: number; raise: number };
  armR: { swing: number; raise: number };
  legL: { swing: number; spread: number };
  legR: { swing: number; spread: number };
}
export const makePose = (): Pose => ({
  body: { pitch: 0, roll: 0, yaw: 0 },
  head: { nod: 0, turn: 0, tilt: 0 },
  armL: { swing: 0, raise: 0 },
  armR: { swing: 0, raise: 0 },
  legL: { swing: 0, spread: 0 },
  legR: { swing: 0, spread: 0 },
});

const E = new THREE.Euler();
const M4 = new THREE.Matrix4();
const set = (out: THREE.Matrix3, x: number, y: number, z: number) => out.setFromMatrix4(M4.makeRotationFromEuler(E.set(x, y, z, "YZX")));
/** 포즈 → 유니폼 행렬. 앞(+x)을 향한 몸에서 z 축 회전이 앞뒤 스윙, x 축 회전이 옆으로 벌림 (왼쪽 +z 는 부호를 뒤집는다) */
export function applyPose(p: Pose, u: GuestUniforms, who: number) {
  const r = u.uRot.value;
  const o = who * 6;
  set(r[o + PART.body], p.body.roll, p.body.yaw, -p.body.pitch);
  set(r[o + PART.head], p.head.tilt, p.head.turn, -p.head.nod);
  set(r[o + PART.armL], -p.armL.raise, 0, p.armL.swing);
  set(r[o + PART.armR], p.armR.raise, 0, p.armR.swing);
  set(r[o + PART.legL], -p.legL.spread, 0, p.legL.swing);
  set(r[o + PART.legR], p.legR.spread, 0, p.legR.swing);
}

export { HIP_Y };
