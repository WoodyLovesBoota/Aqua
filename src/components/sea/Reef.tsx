"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { floorHeight, REEF_SITES, type ReefSite } from "./lagoonHeight";

/**
 * 산호초 — 군락 3곳(앞 모래톱 · 섬 앞 여울 · 왼쪽 앞 깊은 물)에 산호 6종을 심는다.
 * 전부 정점 색이라 재질 하나(1 드로우) + 부채 산호(알파 격자 평면, 1 드로우). 배치는 시드 난수라 캡처가 재현된다.
 * 산호 꼭대기는 큰 생물의 유영 하한(바닥 + clearance·0.8 ≈ 0.5) 아래에 둔다 — 섬 앞 여울은 금지 구역 안이라 더 높아도 된다.
 */

export type ReefDef = ReefSite;
export const REEFS: readonly ReefDef[] = REEF_SITES;

/** 정점 색은 선형 공간 — 눈으로 고른 sRGB 를 변환 */
const rgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex); // Color 는 이미 선형으로 변환해 준다
  return [c.r, c.g, c.b];
};

/** 결정적 난수 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 흔들림 시각 (두 재질이 공유) */
const swayTime = { value: 0 };
/** 정점 속성 aSway(0~1) 만큼 물결에 느리게 흔들린다 — 말미잘 촉수·부채 끝. 나머지 정점은 0 이라 정적 */
function withSway(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = swayTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "attribute float aSway;\nuniform float uSwayTime;\n#include <common>")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float swayA = sin(uSwayTime * 1.4 + position.x * 2.3 + position.z * 1.7) * 0.5 + sin(uSwayTime * 2.3 + position.z * 3.1) * 0.25;
        float swayB = cos(uSwayTime * 1.1 + position.z * 2.0 + position.x * 1.3);
        transformed.x += swayA * aSway * 0.035;
        transformed.z += swayB * aSway * 0.028;`,
      );
  };
  mat.customProgramCacheKey = () => "reef-sway";
  return mat;
}
const reefMat = withSway(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, vertexColors: true }));
let fanMatShared: THREE.MeshStandardMaterial | null = null;
const fanMaterial = () => (fanMatShared ??= withSway(new THREE.MeshStandardMaterial({ color: "#ffffff", alphaMap: fanTexture(), alphaTest: 0.5, roughness: 0.9, vertexColors: true })));

class ReefBuilder {
  parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private bottom: number) {}

  floor(x: number, z: number) {
    return floorHeight(this.bottom, x, z);
  }

  /**
   * 지오메트리를 세계 좌표에 놓고 정점 색을 칠한다. 색은 밑동이 짙고 끝(높이 h 기준)으로 갈수록 밝아진다.
   * tip 을 주면 끝 색으로 섞는다 (손가락 산호의 밝은 끝 등)
   */
  add(
    g: THREE.BufferGeometry,
    color: [number, number, number],
    x: number,
    y: number,
    z: number,
    yaw = 0,
    sx = 1,
    sy = sx,
    sz = sx,
    pitch = 0,
    roll = 0,
    tip?: [number, number, number],
    y0 = 0,
    y1 = 1,
    /** 로컬 좌표로 추가 명암 (뇌 산호 고랑 등) */
    shade?: (lx: number, ly: number, lz: number) => number,
    /** 로컬 y → 흔들림 가중(0 정적 ~ 1). 말미잘 촉수·부채만 준다 */
    sway?: (ly: number) => number,
  ) {
    this.e.set(pitch, yaw, roll);
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e), this.s.set(sx, sy, sz));
    g.deleteAttribute("uv");
    // Icosahedron(Polyhedron) 은 인덱스가 없고 Cylinder·Capsule 은 있다 — 섞어서 합치면 mergeGeometries 가 null 을 돌려준다
    if (g.index) {
      const flat = g.toNonIndexed();
      g.dispose();
      g = flat;
    }
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / Math.max(1e-4, y1 - y0), 0, 1);
      const k = (0.72 + 0.4 * t) * (shade ? shade(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1);
      const mixT = tip ? THREE.MathUtils.smoothstep(t, 0.72, 1) : 0;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = THREE.MathUtils.clamp(THREE.MathUtils.lerp(color[c] * k, tip ? tip[c] : 0, mixT), 0, 1);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const sw = new Float32Array(pos.count);
    if (sway) for (let i = 0; i < pos.count; i++) sw[i] = sway(pos.getY(i));
    g.setAttribute("aSway", new THREE.BufferAttribute(sw, 1));
    g.applyMatrix4(this.m);
    this.parts.push(g);
    return g;
  }

  /** 정점을 법선 방향으로 흔들어 울퉁불퉁하게 (결정적) */
  jitter(g: THREE.BufferGeometry, amp: number, freq = 1) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * freq, y = pos.getY(i) * freq, z = pos.getZ(i) * freq;
      const k = (Math.sin(x * 5.1 + y * 3.7) + Math.sin(z * 4.3 - y * 2.9) + Math.sin((x + z) * 6.1)) / 3;
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * k * amp, pos.getY(i) + nor.getY(i) * k * amp, pos.getZ(i) + nor.getZ(i) * k * amp);
    }
    g.computeVertexNormals();
  }

  /** 덩어리 산호: 눌린 구를 울퉁불퉁하게. brain 이면 고랑(어두운 띠)을 정점 색으로 */
  boulder(x: number, z: number, r: number, color: [number, number, number], brain = false, yaw = 0, detail = brain ? 3 : 2) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    this.jitter(g, brain ? 0.05 : 0.16, brain ? 1.1 : 0.9);
    const y = this.floor(x, z) - r * 0.25;
    // 뇌 산호 고랑: 단위 구 표면을 따라 구불구불한 띠를 어둡게
    const grooves = brain
      ? (px: number, py: number, pz: number) => {
          const w = Math.sin(px * 13 + Math.sin(pz * 9 + py * 4) * 2.2 + py * 5) * 0.5 + 0.5;
          return 1 - 0.55 * THREE.MathUtils.smoothstep(w, 0.5, 0.78);
        }
      : undefined;
    this.add(g, color, x, y, z, yaw, r, r * 0.68, r, 0, 0, undefined, -1, 1, grooves);
  }

  /** 손가락(관) 산호: 캡슐 5~9개가 바깥으로 벌어진 묶음, 끝이 밝다 */
  fingers(x: number, z: number, h: number, color: [number, number, number], tip: [number, number, number], rnd: () => number) {
    const n = 7 + Math.floor(rnd() * 5);
    const y = this.floor(x, z) - 0.04;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
      const ring = i === 0 ? 0 : i <= 4 ? 1 : 2;
      const d = ring * (0.07 + rnd() * 0.04);
      const len = h * (0.55 + rnd() * 0.45) * (1 - ring * 0.15);
      const r = 0.045 + rnd() * 0.02;
      const g = new THREE.CapsuleGeometry(r, len, 2, 6);
      g.translate(0, len / 2 + r, 0);
      const tilt = ring * (0.18 + rnd() * 0.22);
      this.add(g, color, x + Math.cos(a) * d, y, z + Math.sin(a) * d, -a, 1, 1, 1, 0, -tilt, tip, 0, len + r * 2);
    }
  }

  /** 가지(사슴뿔) 산호: 재귀 분기 튜브(열린 원통 + 마디 구), 끝은 둥글고 밝다 */
  branching(x: number, z: number, h: number, color: [number, number, number], tip: [number, number, number], rnd: () => number) {
    const y = this.floor(x, z) - 0.03;
    const base = new THREE.Vector3(x, y, z);
    const up = new THREE.Vector3(0, 1, 0);
    const grow = (p: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
      const end = p.clone().addScaledVector(dir, len);
      const g = new THREE.CylinderGeometry(r * 0.8, r, len, 6, 1, true);
      g.translate(0, len / 2, 0);
      const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
      // 가지는 전체 높이 기준으로 밝아진다 (y0/y1 은 로컬 y 기준이라 뿌리 높이를 뺀다)
      this.add(g, color, p.x, p.y, p.z, e.y, 1, 1, 1, e.x, e.z, tip, y - p.y, y + h - p.y);
      if (depth === 0) {
        // 끝만 둥근 구슬 (마디 구슬은 tris 낭비 — 자식 밑반지름을 부모 윗반지름에 맞춰 이음새를 감춘다)
        this.add(new THREE.SphereGeometry(r * 0.95, 5, 4), tip, end.x, end.y, end.z, 0, 1, 1, 1, 0, 0, undefined, -1, 1);
        return;
      }
      const kids = depth === 3 ? 3 : 2;
      const spin = rnd() * Math.PI * 2;
      for (let i = 0; i < kids; i++) {
        const a = spin + (i / kids) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
        const spread = 0.5 + rnd() * 0.4;
        const nd = new THREE.Vector3(Math.cos(a) * Math.sin(spread), Math.cos(spread), Math.sin(a) * Math.sin(spread));
        nd.lerp(dir, 0.3).normalize();
        grow(end, nd, len * (0.78 + rnd() * 0.12), r * 0.8, depth - 1);
      }
    };
    const trunkDir = new THREE.Vector3((rnd() - 0.5) * 0.3, 1, (rnd() - 0.5) * 0.3).normalize();
    grow(base, trunkDir, h * 0.42, 0.075, 3);
  }

  /** 테이블 산호: 짧은 기둥 + 울퉁불퉁한 넓은 판, 윗면에 작은 혹들 */
  table(x: number, z: number, R: number, color: [number, number, number], nub: [number, number, number], rnd: () => number) {
    const y = this.floor(x, z) - 0.03;
    const stemH = R * 0.5;
    this.add(new THREE.CylinderGeometry(R * 0.16, R * 0.24, stemH, 7, 1, true).translate(0, stemH / 2, 0), color, x, y, z, 0, 1, 1, 1, 0, 0, undefined, 0, stemH);
    const plate = new THREE.CylinderGeometry(R, R * 0.8, R * 0.16, 18, 1);
    this.jitter(plate, R * 0.08, 2.2);
    // 판은 가운데가 살짝 솟는다
    const pp = plate.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const d = Math.hypot(pp.getX(i), pp.getZ(i)) / R;
      if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) + (1 - d * d) * R * 0.12);
    }
    plate.computeVertexNormals();
    const tilt = (rnd() - 0.5) * 0.3;
    this.add(plate, color, x, y + stemH, z, rnd() * 6, 1, 1, 1, tilt, tilt * 0.7, undefined, -R * 0.1, R * 0.2);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * R * 0.8;
      const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
      const ly = stemH + R * 0.1 + (1 - (d / R) ** 2) * R * 0.12;
      this.add(new THREE.SphereGeometry(R * (0.06 + rnd() * 0.04), 5, 4), nub, x + lx, y + ly, z + lz, 0, 1, 1, 1, 0, 0, undefined, -1, 1);
    }
  }

  /** 말미잘: 눌린 구 몸통 + 촉수 2겹(캡슐). 촉수는 흔들림 가중을 가진다 */
  anemone(x: number, z: number, r: number, body: [number, number, number], tent: [number, number, number], tipCol: [number, number, number], rnd: () => number) {
    const y = this.floor(x, z) - 0.02;
    const base = new THREE.SphereGeometry(1, 8, 6);
    this.jitter(base, 0.05, 1.5);
    this.add(base, body, x, y + r * 0.45, z, 0, r, r * 0.62, r, 0, 0, undefined, -1, 1);
    const topY = y + r * 0.45 + r * 0.5;
    for (const [ring, n, rad, tiltK] of [
      [0, 8, 0.3, 0.25],
      [1, 12, 0.65, 0.55],
      [2, 16, 0.95, 0.9],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.3 + rnd() * 0.2;
        const len = r * (1.1 - ring * 0.18) * (0.85 + rnd() * 0.3);
        const tr = r * 0.11;
        const g = new THREE.CapsuleGeometry(tr, len, 1, 5);
        g.translate(0, len / 2 + tr, 0);
        const tilt = tiltK + rnd() * 0.25;
        this.add(g, tent, x + Math.cos(a) * rad * r * 0.9, topY - ring * r * 0.08, z + Math.sin(a) * rad * r * 0.9, -a, 1, 1, 1, 0, -tilt, tipCol, 0, len + tr * 2, undefined, (ly) => THREE.MathUtils.clamp(ly / (len + tr * 2), 0, 1));
      }
    }
  }
}

/**
 * 부채 산호 알파 텍스처: 밑동에서 부채꼴로 갈라지는 가지 + 가로로 잇는 그물.
 * 투명 배경 map 으로 쓰면 투명 픽셀의 RGB(검정)가 밉맵에서 선 색에 번져 멀리서 검게 보인다 → 검정 배경에 흰 선을 그려 alphaMap 으로만 쓴다
 */
let fanTex: THREE.CanvasTexture | null = null;
function fanTexture() {
  if (fanTex) return fanTex;
  const SZ = 256;
  const c = document.createElement("canvas");
  c.width = c.height = SZ;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, SZ, SZ);
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  const rnd = rng(7);
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    const nx = x + Math.cos(ang) * len, ny = y - Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    if (depth === 0 || ny < 8) return;
    const kids = depth > 3 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const da = (i - (kids - 1) / 2) * (0.55 + rnd() * 0.2) + (rnd() - 0.5) * 0.25;
      // 부채꼴: 위로 향하되 바깥쪽으로 벌어진다
      const na = THREE.MathUtils.lerp(ang + da, Math.PI / 2 + (nx - SZ / 2) / SZ * 1.6, 0.25);
      branch(nx, ny, na, len * (0.72 + rnd() * 0.1), Math.max(3, w * 0.72), depth - 1);
    }
  };
  branch(SZ / 2, SZ - 4, Math.PI / 2, 52, 12, 6);
  // 그물: 가지 사이를 잇는 가는 가로줄 (동심 호)
  ctx.lineWidth = 2.2;
  for (let k = 1; k <= 7; k++) {
    const rad = (k / 7.5) * SZ * 0.9;
    ctx.beginPath();
    for (let a = 0; a <= 1; a += 0.02) {
      // 가지가 벌어진 범위(≈ ±50°) 안에서만 — 밖으로 나가면 레이더처럼 보인다
      const ang = Math.PI * (0.22 + 0.56 * a) + Math.sin(a * 20 + k) * 0.015;
      const px = SZ / 2 + Math.cos(ang) * rad, py = SZ - 4 - Math.sin(ang) * rad;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  fanTex = new THREE.CanvasTexture(c);
  return fanTex;
}

/** 부채 산호 한 장: 세로 평면(아래 가운데가 뿌리), 정점 색으로 색을 입히고 위로 갈수록 흔들린다 */
function fanGeometry(x: number, y: number, z: number, w: number, h: number, yaw: number, color: [number, number, number]) {
  // 앞·뒤 두 장을 겹쳐 FrontSide 로 그린다 (DoubleSide 는 뒷면 법선을 뒤집어 아래를 보게 해서 검게 나온다)
  const front = new THREE.PlaneGeometry(w, h, 1, 4);
  const back = new THREE.PlaneGeometry(w, h, 1, 4).rotateY(Math.PI);
  const g = mergeGeometries([front, back], false)!;
  front.dispose();
  back.dispose();
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const sw = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    const k = 0.75 + 0.35 * t;
    col[i * 3] = color[0] * k;
    col[i * 3 + 1] = color[1] * k;
    col[i * 3 + 2] = color[2] * k;
    sw[i] = t * t;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSway", new THREE.BufferAttribute(sw, 1));
  // 세로 평면은 위에서 오는 빛을 못 받아 검게 나온다 — 격자는 얇은 가지 다발이라 법선을 위로 세워 윗면처럼 밝게
  const nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 0.9, 0.44);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

export function Reef({ bottom }: { bottom: number }) {
  const { geo, fanGeo } = useMemo(() => {
    const b = new ReefBuilder(bottom);
    const fans: THREE.BufferGeometry[] = [];
    const PALETTE = {
      // 물속에서는 색유리처럼 채도가 깎이므로 눈으로 고른 것보다 한 단계 진하게
      pink: rgb("#ff7fb0"),
      coral: rgb("#ff8a5c"),
      purple: rgb("#a86ff2"),
      yellow: rgb("#ffd84a"),
      lime: rgb("#a8ee5a"),
      cream: rgb("#fff1d6"),
      rose: rgb("#f0548e"),
      lavender: rgb("#d2b0ff"),
      brain: rgb("#f7c46a"),
      tan: rgb("#f3b48c"),
      peach: rgb("#ffb08a"),
      blush: rgb("#ffc4dc"),
      hotpink: rgb("#ff6fa8"),
      olive: rgb("#9c8f5a"),
    };
    for (const reef of REEFS) {
      const rnd = rng(reef.seed);
      // 해바라기 나선(황금각)으로 가운데부터 촘촘히 — 조각끼리 닿아 둔덕 하나로 읽히게. 바깥일수록 작다
      const slot = (k: number, n: number) => {
        const a = k * 2.39996 + reef.seed;
        const d = reef.r * Math.sqrt((k + 0.5) / n) * 0.95;
        return { x: reef.x + Math.cos(a) * d, z: reef.z + Math.sin(a) * d, d: d / reef.r };
      };
      const H = reef.maxH;
      const K = H / 0.42; // 군락 높이 배율
      // 종류 순서: 가운데 덩어리·뇌 → 가지 → 손가락 (2·3단계에서 테이블·부채·말미잘이 끼어든다)
      const kinds = ["brain", "table", "branch", "anemone", "boulder", "finger", "branch", "fan", "boulder", "finger", "fan", "anemone", "boulder", "finger", "branch", "fan"] as const;
      kinds.forEach((kind, k) => {
        const p = slot(k, kinds.length);
        const size = 1 - p.d * 0.35;
        if (kind === "brain") b.boulder(p.x, p.z, 0.34 * K * size, PALETTE.brain, true, rnd() * 6);
        else if (kind === "table") b.table(p.x, p.z, 0.3 * K * size, PALETTE.tan, PALETTE.cream, rnd);
        else if (kind === "anemone") b.anemone(p.x, p.z, 0.14 * K, PALETTE.olive, rnd() < 0.5 ? PALETTE.peach : PALETTE.hotpink, PALETTE.blush, rnd);
        else if (kind === "fan") {
          const fy = b.floor(p.x, p.z) - 0.02;
          const fw = (0.5 + rnd() * 0.12) * K, fh = (0.46 + rnd() * 0.1) * K * (1 - p.d * 0.2);
          fans.push(fanGeometry(p.x, fy, p.z, fw, fh, rnd() * Math.PI, [PALETTE.lavender, PALETTE.blush, PALETTE.peach][k % 3]));
        }
        else if (kind === "boulder") b.boulder(p.x, p.z, (0.2 + rnd() * 0.12) * K * size, rnd() < 0.5 ? PALETTE.purple : PALETTE.rose, false, rnd() * 6);
        else if (kind === "branch") b.branching(p.x, p.z, H * (0.95 - p.d * 0.25), rnd() < 0.5 ? PALETTE.pink : PALETTE.coral, PALETTE.blush, rnd);
        else b.fingers(p.x, p.z, H * (0.7 - p.d * 0.25), rnd() < 0.5 ? PALETTE.yellow : PALETTE.lime, PALETTE.cream, rnd);
      });
      // 잔돌·잔가지(rubble): 군락 가장자리에 작은 덩어리
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2;
        const d = reef.r * (0.6 + rnd() * 0.55);
        b.boulder(reef.x + Math.cos(a) * d, reef.z + Math.sin(a) * d, (0.05 + rnd() * 0.06) * K, rnd() < 0.5 ? PALETTE.lavender : PALETTE.cream, false, rnd() * 6, 1);
      }
    }
    const merged = mergeGeometries(b.parts, false)!;
    b.parts.forEach((g) => g.dispose());
    merged.computeVertexNormals();
    const fanGeo = mergeGeometries(fans, false)!;
    fans.forEach((g) => g.dispose());
    return { geo: merged, fanGeo };
  }, [bottom]);
  const fanMat = useMemo(() => fanMaterial(), []);

  useEffect(
    () => () => {
      geo.dispose();
      fanGeo.dispose();
    },
    [geo, fanGeo],
  );

  useFrame((state) => {
    swayTime.value = state.clock.elapsedTime;
  });

  return (
    <>
      <mesh geometry={geo} material={reefMat} />
      <mesh geometry={fanGeo} material={fanMat} />
    </>
  );
}
