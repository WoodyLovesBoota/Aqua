import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ENV } from "@/components/three/sceneEnv";

/**
 * 수상기 모델 — 정점 색 한 메시(1 드로우). 기수 +x, 위 +y, 원점은 플로트 바닥(수면). 길이 ≈ 1.15 · 날개폭 ≈ 1.5.
 * 부위 속성 aPart: 0 몸 · 1 프로펠러(정점 셰이더가 허브 x축으로 돌린다) · 2 좌 항법등(빨강) · 3 우 항법등(초록) · 4 꼬리등(흰색) — 밤에 발광.
 */
export const PROP_HUB = new THREE.Vector3(0.645, 0.36, 0);

const COL = {
  body: "#f7f6f0",
  accent: "#3fbfb2", // 청록 포인트 (영상의 기수·날개 끝·꼬리·플로트)
  dark: "#2a3340", // 창·프로펠러
  float: "#f2f1ea",
  strut: "#d9d6cc",
};

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));

function paint(g: THREE.BufferGeometry, hex: string, part = 0) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute("uv");
  const n = geo.getAttribute("position").count;
  const c = new THREE.Color(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  return geo;
}

/** 플로트 바닥(y=0) 기준 치수 */
const BODY_Y = 0.36; // 동체 축 높이
const FLOAT_Z = 0.26;
const WING_Y = BODY_Y + 0.13;
const SPAN = 1.5;

/** 2D 윤곽(x, y)을 z 두께로 뽑는다 (꼬리 날개) */
function slab(pts: [number, number][], depth: number) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** 동체 윤곽 (x, r) — 기수 +x */
const PROFILE: [number, number][] = [
  [0.62, 0.0],
  [0.6, 0.055],
  [0.53, 0.095],
  [0.42, 0.12],
  [0.25, 0.128],
  [0.05, 0.12],
  [-0.15, 0.1],
  [-0.35, 0.07],
  [-0.52, 0.04],
  [-0.6, 0.02],
  [-0.62, 0.0],
];
/** x 에서의 동체 반지름 (선형 보간) */
function radiusAt(x: number) {
  for (let i = 0; i + 1 < PROFILE.length; i++) {
    const [x0, r0] = PROFILE[i], [x1, r1] = PROFILE[i + 1];
    if (x <= x0 && x >= x1) return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0);
  }
  return 0;
}
/**
 * x 축 회전체 띠: x0..x1 구간을 반지름 r(x)+pad 로, 둘레 각 phi0..phi0+len 만. LatheGeometry 는 y 축 회전체라
 * (r, x) 로 넣고 z 축 −90° 회전 → 새 y = −r·sin(phi), 새 z = r·cos(phi): 꼭대기는 phi = 3π/2
 */
function lathe(x0: number, x1: number, pad: number, segs: number, phi0 = 0, len = Math.PI * 2) {
  // 점은 lathe 의 y(= 동체 x)가 커지는 순서로 — 반대로 넣으면 면이 안쪽을 보고(겉면이 컬링돼) 창 띠가 동체 속에 숨는다
  const pts: THREE.Vector2[] = [];
  const n = Math.max(2, Math.round((x0 - x1) / 0.045)); // 두 패스 합 tris +6k 예산 — 0.025·24 세그먼트는 동체만 2.4k
  for (let k = n; k >= 0; k--) {
    const x = x0 + ((x1 - x0) * k) / n;
    pts.push(new THREE.Vector2(radiusAt(x) + pad, x));
  }
  const g = new THREE.LatheGeometry(pts, segs, phi0, len);
  g.rotateZ(-Math.PI / 2);
  g.scale(1, 1, 0.92); // 옆이 살짝 납작
  return g;
}
const TOP_PHI = Math.PI * 1.5;
/** 두 점을 잇는 지지대 (얇은 상자) */
function strut(a: [number, number, number], b: [number, number, number], w = 0.024, hex = COL.strut) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(w, len, w);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().lerp(vb, 0.5), q, new THREE.Vector3(1, 1, 1)));
  return paint(g, hex);
}

export function makeSeaplaneGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // 동체 + 조종석 창(앞 띠) + 옆 창
  parts.push(paint(at(lathe(0.62, -0.62, 0, 18), 0, BODY_Y, 0), COL.body));
  // 창: 앞 유리는 꼭대기 둘레로 감긴 띠, 옆 창은 양옆에만 (동체보다 살짝 큰 반지름의 띠 — 또렷한 경계)
  parts.push(paint(at(lathe(0.41, 0.28, 0.005, 12, TOP_PHI - 1.25, 2.5), 0, BODY_Y, 0), COL.dark));
  for (const sgn of [-1, 1]) {
    const phi0 = sgn < 0 ? TOP_PHI - 1.15 : TOP_PHI + 0.35;
    parts.push(paint(at(lathe(0.2, 0.09, 0.005, 4, phi0, 0.8), 0, BODY_Y, 0), COL.dark));
    parts.push(paint(at(lathe(0.02, -0.08, 0.005, 4, phi0, 0.8), 0, BODY_Y, 0), COL.dark));
  }
  // 엔진 카울(청록) + 스피너 + 프로펠러(aPart 1)
  parts.push(paint(at(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 14), 0.57, BODY_Y, 0, 1, 1, 1, 0, 0, -Math.PI / 2), COL.accent));
  parts.push(paint(at(new THREE.ConeGeometry(0.035, 0.06, 10), PROP_HUB.x + 0.02, PROP_HUB.y, 0, 1, 1, 1, 0, 0, -Math.PI / 2), COL.body));
  parts.push(paint(at(new THREE.BoxGeometry(0.012, 0.46, 0.05), PROP_HUB.x, PROP_HUB.y, 0), COL.dark, 1));
  parts.push(paint(at(new THREE.BoxGeometry(0.012, 0.46, 0.05), PROP_HUB.x, PROP_HUB.y, 0, 1, 1, 1, Math.PI / 2), COL.dark, 1));
  // 고익 날개(흰) + 청록 날개 끝 + 지지대 2
  parts.push(paint(at(new THREE.BoxGeometry(0.32, 0.035, SPAN - 0.24), 0.17, WING_Y, 0), COL.body));
  for (const sgn of [-1, 1]) {
    parts.push(paint(at(new THREE.BoxGeometry(0.3, 0.037, 0.12), 0.17, WING_Y, sgn * (SPAN / 2 - 0.06)), COL.accent));
    parts.push(strut([0.2, BODY_Y - 0.06, sgn * 0.1], [0.2, WING_Y - 0.02, sgn * 0.5]));
  }
  // 꼬리: 수직 꼬리날개(청록, 뒤로 쓸림) + 수평 안정판(흰, 끝 청록)
  parts.push(paint(at(slab([[-0.36, BODY_Y + 0.04], [-0.5, BODY_Y + 0.3], [-0.6, BODY_Y + 0.3], [-0.62, BODY_Y + 0.02]], 0.03), 0, 0, 0), COL.accent));
  parts.push(paint(at(new THREE.BoxGeometry(0.16, 0.025, 0.42), -0.5, BODY_Y + 0.06, 0), COL.body));
  for (const sgn of [-1, 1]) parts.push(paint(at(new THREE.BoxGeometry(0.15, 0.027, 0.07), -0.5, BODY_Y + 0.06, sgn * 0.245), COL.accent));
  // 플로트 2 (x 축 캡슐, 윗면 청록 줄) + 지지대 4 + 가로대
  for (const sgn of [-1, 1]) {
    const z = sgn * FLOAT_Z;
    parts.push(paint(at(new THREE.CapsuleGeometry(0.05, 0.82, 3, 8), 0.1, 0.05, z, 1, 1, 0.9, 0, 0, Math.PI / 2), COL.float));
    parts.push(paint(at(new THREE.BoxGeometry(0.7, 0.012, 0.05), 0.08, 0.1, z), COL.accent));
    parts.push(strut([0.38, 0.09, z], [0.3, BODY_Y - 0.1, sgn * 0.09]));
    parts.push(strut([-0.12, 0.09, z], [-0.08, BODY_Y - 0.08, sgn * 0.08]));
  }
  parts.push(paint(at(new THREE.BoxGeometry(0.024, 0.024, FLOAT_Z * 2), 0.38, 0.09, 0), COL.strut));
  parts.push(paint(at(new THREE.BoxGeometry(0.024, 0.024, FLOAT_Z * 2), -0.12, 0.09, 0), COL.strut));
  // 항법등: 좌(−z) 빨강 · 우(+z) 초록 · 꼬리 흰색 (밤에 발광)
  parts.push(paint(at(new THREE.SphereGeometry(0.026, 8, 6), 0.17, WING_Y, -SPAN / 2 - 0.01), "#9a2a22", 2));
  parts.push(paint(at(new THREE.SphereGeometry(0.026, 8, 6), 0.17, WING_Y, SPAN / 2 + 0.01), "#1f7a3a", 3));
  parts.push(paint(at(new THREE.SphereGeometry(0.022, 8, 6), -0.55, BODY_Y + 0.315, 0), "#e8e2d2", 4));
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

/** 정점 색 재질 + 프로펠러 회전·항법등 발광 (onBeforeCompile) */
export function makeSeaplaneMaterial() {
  const u = { uProp: { value: 0 }, uHub: { value: PROP_HUB.clone() }, uLamp: ENV.uLamp };
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.72, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aPart;
        uniform float uProp; uniform vec3 uHub;
        varying float vPart;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vPart = aPart;
        float pc = cos(uProp), ps = sin(uProp);
        mat3 propRot = mat3(1.0, 0.0, 0.0, 0.0, pc, ps, 0.0, -ps, pc);
        if (aPart > 0.5 && aPart < 1.5) objectNormal = propRot * objectNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        if (aPart > 0.5 && aPart < 1.5) transformed = uHub + propRot * (transformed - uHub);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uLamp;
        varying float vPart;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (vPart > 1.5) {
          vec3 lampCol = vPart < 2.5 ? vec3(1.0, 0.08, 0.05) : vPart < 3.5 ? vec3(0.1, 1.0, 0.3) : vec3(1.0, 0.95, 0.85);
          totalEmissiveRadiance += lampCol * uLamp * 2.2;
        }`,
      );
  };
  mat.customProgramCacheKey = () => "seaplane";
  return { mat, u };
}
