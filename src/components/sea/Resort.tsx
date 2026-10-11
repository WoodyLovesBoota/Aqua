"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ENV } from "@/components/three/sceneEnv";
import { floorHeight } from "./lagoonHeight";
import { PALMS } from "./Palms";
import { bridgeStart, BUNGALOWS, BUSHES, DECK_Y, HAMMOCK, HUT, PLANK_W, SPINE, STATIC_BOATS, SUNBEDS, TORCHES, UMBRELLAS } from "./resortLayout";

export { BUNGALOWS, TORCHES };

/**
 * 리조트 소품 — 수상 방갈로·데크·파라솔·선베드·보트.
 * 방갈로는 한 변 1 기준으로 정밀하게 만들고 HUT 배율로 줄인다.
 * 전부 정적이라 재질별로 한 지오메트리에 합쳐 드로우콜 7개로 그린다.
 * 방갈로·보도의 난간·창틀 같은 세부는 검게 튀지 않도록 나무보다 살짝만 어두운 trim 으로 그린다.
 */

// 리조트 팔레트: 햇볕에 바랜 연한 유목(流木) 톤. 방갈로는 주인공이 아니므로 물·모래에 녹아들게 채도·명도를 낮게 튀지 않는 쪽으로 맞춘다
const MATS = {
  wood: new THREE.MeshStandardMaterial({ color: "#dccbaa", roughness: 0.9, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: "#a08a6c", roughness: 0.9 }),
  trim: new THREE.MeshStandardMaterial({ color: "#c7b391", roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ color: "#f8f3e8", roughness: 0.85 }),
  thatch: new THREE.MeshStandardMaterial({ color: "#e4d3a6", roughness: 1, flatShading: true }),
  coral: new THREE.MeshStandardMaterial({ color: "#ef8a78", roughness: 0.8, side: THREE.DoubleSide }),
  white: new THREE.MeshStandardMaterial({ color: "#fbfbf7", roughness: 0.6, side: THREE.DoubleSide }),
  bush: new THREE.MeshStandardMaterial({ color: "#4e9a4f", roughness: 0.9, flatShading: true }),
  // 밤 조명: 창·문(낮엔 짙은 유리)과 전구(낮엔 크림색). 발광 세기는 하루 주기(ENV.uLamp)를 따른다
  glass: new THREE.MeshStandardMaterial({ color: "#7d6f5c", roughness: 0.4, emissive: "#ff9a3d", emissiveIntensity: 0 }),
  bulb: new THREE.MeshStandardMaterial({ color: "#fff4dc", roughness: 0.5, emissive: "#ffc874", emissiveIntensity: 0 }),
};
type Bucket = keyof typeof MATS;

interface GlowPoint {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  flicker: number;
}


/**
 * 밤 조명 후광: 점 스프라이트 하나(가산 혼합, 1 드로우). 크기는 월드 단위 → 화면 픽셀로 바꾼다.
 * 횃불(aFlick 1)은 일렁이고, 전구는 아주 살짝 숨쉰다. 세기는 ENV.uLamp.
 */
const haloVert = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aFlick;
uniform float uPx;      // 투영 배율: 화면 높이(px) × 0.5 × projectionMatrix[1][1]
uniform float uTime;
uniform float uLamp;
varying vec3 vColor;
varying float vK;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float seed = position.x * 7.1 + position.z * 3.7;
  float flick = mix(0.94 + 0.06 * sin(uTime * 1.3 + seed), 0.8 + 0.12 * sin(uTime * 9.0 + seed) + 0.08 * sin(uTime * 23.0 + seed * 2.0), aFlick);
  vColor = aColor;
  vK = uLamp * flick;
  gl_PointSize = aSize * uPx / -mv.z * (0.85 + 0.15 * flick) * step(0.001, uLamp);
  gl_Position = projectionMatrix * mv;
}
`;
const haloFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vK;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float core = exp(-r2 * 18.0);
  float glow = exp(-r2 * 4.0) * (1.0 - r2);
  vec3 col = (vColor * glow * 0.75 + vec3(1.0, 0.97, 0.9) * core * 0.6) * vK;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
const HALO_MAT = new THREE.ShaderMaterial({
  vertexShader: haloVert,
  fragmentShader: haloFrag,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uPx: { value: 1 }, uTime: { value: 0 }, uLamp: ENV.uLamp },
});


const NO_UV = (g: THREE.BufferGeometry) => {
  g.deleteAttribute("uv");
  return g;
};

class Builder {
  parts: Record<Bucket, THREE.BufferGeometry[]> = { wood: [], dark: [], trim: [], wall: [], thatch: [], coral: [], white: [], bush: [], glass: [], bulb: [] };
  /** 밤에 후광이 생기는 자리 (월드) — 크기는 후광 반지름, flicker 는 횃불 일렁임 */
  lights: GlowPoint[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  constructor(private bottom: number) {}

  /** 세계 좌표에 지오메트리를 놓는다 */
  add(bucket: Bucket, g: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0) {
    this.e.set(pitch, yaw, roll);
    this.m.compose(new THREE.Vector3(x, y, z), this.q.setFromEuler(this.e), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.parts[bucket].push(NO_UV(g));
  }

  /** 로컬 프레임(원점 x,z · yaw · 배율) 안에 놓는다 — 정밀 모델을 만들고 줄일 때 */
  local(bucket: Bucket, g: THREE.BufferGeometry, frame: THREE.Matrix4, lx: number, ly: number, lz: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0) {
    this.e.set(pitch, yaw, roll);
    this.m.compose(new THREE.Vector3(lx, ly, lz), this.q.setFromEuler(this.e), new THREE.Vector3(sx, sy, sz)).premultiply(frame);
    g.applyMatrix4(this.m);
    this.parts[bucket].push(NO_UV(g));
  }

  /** 정점을 법선 방향으로 조금씩 흔들어 짚·돌 질감을 낸다 (결정적 해시) */
  jitter(g: THREE.BufferGeometry, amp: number) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const h = Math.sin(i * 12.9898 + pos.getX(i) * 78.233 + pos.getZ(i) * 37.719) * 43758.5453;
      const k = (h - Math.floor(h) - 0.5) * 2 * amp;
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * k, pos.getY(i) + nor.getY(i) * k * 0.3, pos.getZ(i) + nor.getZ(i) * k);
    }
    g.computeVertexNormals();
  }

  /** 보도 가로등: 나무 기둥 + 전구 */
  lamp(x: number, z: number) {
    this.add("trim", new THREE.CylinderGeometry(0.012, 0.016, 0.3, 5), x, DECK_Y + 0.15, z);
    this.add("bulb", new THREE.SphereGeometry(0.035, 8, 6), x, DECK_Y + 0.32, z);
    this.lights.push({ x, y: DECK_Y + 0.32, z, size: 0.32, color: "#ffd08a", flicker: 0 });
  }

  /** 섬 횃불: 대나무 기둥 + 머리 통. 불꽃은 밤에만 보이는 후광으로 (낮엔 꺼진 횃불) */
  torch(x: number, z: number) {
    const y = floorHeight(this.bottom, x, z);
    this.add("dark", new THREE.CylinderGeometry(0.014, 0.02, 0.5, 5), x, y + 0.25, z);
    this.add("trim", new THREE.CylinderGeometry(0.045, 0.03, 0.08, 7), x, y + 0.52, z);
    this.lights.push({ x, y: y + 0.6, z, size: 0.42, color: "#ff9a3c", flicker: 1 });
  }

  /** 꼬마전구 줄: 두 점 사이 처진 줄에 전구를 0.16 간격으로 */
  stringLights(ax: number, az: number, ay: number, bx: number, bz: number, by: number) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / 0.16));
    const colors = ["#ffe08a", "#ffb3c7", "#bfe3ff", "#c8f5a8"];
    let px = ax, py = ay, pz = az;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const y = ay + (by - ay) * t - 0.18 * Math.sin(Math.PI * t);
      // 전선
      const sl = Math.hypot(x - px, y - py, z - pz);
      this.add("dark", new THREE.BoxGeometry(sl, 0.006, 0.006), (x + px) / 2, (y + py) / 2, (z + pz) / 2, Math.atan2(-(z - pz), x - px), 1, 1, 1, 0, Math.atan2(y - py, Math.hypot(x - px, z - pz)));
      if (i < n) {
        this.add("bulb", new THREE.SphereGeometry(0.022, 6, 5).scale(1, 1.25, 1), x, y - 0.025, z);
        this.lights.push({ x, y: y - 0.025, z, size: 0.13, color: colors[i % colors.length], flicker: 0 });
      }
      px = x;
      py = y;
      pz = z;
    }
  }

  /** 덤불: 납작한 다면체 3개 묶음 */
  bush(x: number, z: number, s = 1) {
    const y = floorHeight(this.bottom, x, z);
    for (const [ox, oz, r] of [
      [0, 0, 0.16],
      [0.13, 0.05, 0.12],
      [-0.09, 0.1, 0.11],
    ]) {
      this.add("bush", new THREE.IcosahedronGeometry(r * s, 1), x + ox * s, y + r * s * 0.7, z + oz * s, 0, 1, 0.75, 1);
    }
  }

  /** 해먹: 두 야자수 사이 처진 줄 */
  hammock(ax: number, az: number, bx: number, bz: number, y: number) {
    const N = 9;
    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      const sag = (t: number) => y - HAMMOCK.sag * Math.sin(Math.PI * t);
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const len = Math.hypot(x1 - x0, z1 - z0, sag(t1) - sag(t0));
      const yaw = Math.atan2(-(z1 - z0), x1 - x0);
      const pitch = Math.atan2(sag(t1) - sag(t0), Math.hypot(x1 - x0, z1 - z0));
      const w = i === 0 || i === N - 1 ? 0.03 : 0.22;
      this.add("white", new THREE.BoxGeometry(len * 1.02, 0.015, w), (x0 + x1) / 2, (sag(t0) + sag(t1)) / 2, (z0 + z1) / 2, yaw, 1, 1, 1, 0, pitch);
    }
  }

  /** 바닥에서 top 까지 올라오는 기둥 (물속 부분은 어둡게) */
  post(x: number, z: number, top: number, r = 0.03) {
    const base = floorHeight(this.bottom, x, z) - 0.05;
    const h = top - base;
    this.add("wood", new THREE.CylinderGeometry(r, r * 1.15, h, 6), x, base + h / 2, z);
  }

  /** 두 점을 잇는 널판 보도: 판자 하나하나 + 양옆 기둥 + 가장자리 난간 줄 */
  plank(ax: number, az: number, bx: number, bz: number, w = PLANK_W, rail = true) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dz, dx);
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    // 받침 가로대 2줄
    for (const side of [-1, 1]) {
      const ox = Math.sin(yaw) * side * (w / 2 - 0.03);
      const oz = Math.cos(yaw) * side * (w / 2 - 0.03);
      this.add("trim", new THREE.BoxGeometry(len, 0.03, 0.035), cx + ox, DECK_Y - 0.03, cz + oz, yaw);
    }
    // 판자: 0.11 간격, 0.09 폭
    const n = Math.max(1, Math.floor(len / 0.11));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      this.add("wood", new THREE.BoxGeometry(0.09, 0.025, w), ax + dx * t, DECK_Y, az + dz * t, yaw);
    }
    const np = Math.max(1, Math.round(len / 0.9));
    for (let i = 0; i <= np; i++) {
      const t = i / np;
      const px = ax + dx * t;
      const pz = az + dz * t;
      const ox = Math.sin(yaw) * (w / 2 - 0.03);
      const oz = Math.cos(yaw) * (w / 2 - 0.03);
      this.post(px + ox, pz + oz, DECK_Y, 0.024);
      this.post(px - ox, pz - oz, DECK_Y, 0.024);
      if (rail) {
        // 난간 기둥
        this.add("trim", new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), px + ox, DECK_Y + 0.09, pz + oz);
        this.add("trim", new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), px - ox, DECK_Y + 0.09, pz - oz);
      }
    }
    if (rail) {
      for (const side of [-1, 1]) {
        const ox = Math.sin(yaw) * side * (w / 2 - 0.03);
        const oz = Math.cos(yaw) * side * (w / 2 - 0.03);
        this.add("trim", new THREE.BoxGeometry(len, 0.018, 0.018), cx + ox, DECK_Y + 0.17, cz + oz, yaw);
      }
    }
  }

  /** 수상 방갈로 — 한 변 1 기준 정밀 모델 → HUT 배율 */
  bungalow(x: number, z: number, yaw: number) {
    const F = new THREE.Matrix4().compose(new THREE.Vector3(x, DECK_Y + 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(HUT, HUT, HUT));
    const L = (lx: number, lz: number) => new THREE.Vector3(lx, 0, lz).applyMatrix4(F); // 로컬 → 세계
    // 기둥 6개 (발판 모서리 4 + 테라스 2)
    for (const [cx, cz] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [0.45, 0.45],
      [-0.45, 0.45],
      [-0.45, 0.85],
      [0.45, 0.85],
    ]) {
      const p = L(cx, cz);
      this.post(p.x, p.z, DECK_Y + 0.02, 0.03);
    }
    // 발판: 판자 10장 + 앞쪽 테라스
    for (let i = 0; i < 14; i++) {
      const lz = -0.5 + (i + 0.5) * (1.5 / 14);
      this.local("wood", new THREE.BoxGeometry(1.0, 0.04, 0.09), F, 0, 0, lz);
    }
    // 테라스 난간 (3면)
    const railY = 0.2;
    for (const [lx, lz, len, ryaw] of [
      [0, 1.0, 1.0, 0],
      [-0.5, 0.75, 0.5, Math.PI / 2],
      [0.5, 0.75, 0.5, Math.PI / 2],
    ] as [number, number, number, number][]) {
      this.local("trim", new THREE.BoxGeometry(len, 0.03, 0.03), F, lx, railY, lz, ryaw);
      const n = Math.round(len / 0.17);
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (len * i) / n;
        const px = lx + Math.cos(ryaw) * t;
        const pz = lz - Math.sin(ryaw) * t;
        this.local("trim", new THREE.CylinderGeometry(0.014, 0.014, railY, 4), F, px, railY / 2, pz);
      }
    }
    // 집 몸체 0.8 × 0.55 × 0.8, 벽 아래 띠, 창문 2 + 문
    const hh = 0.55;
    this.local("wall", new THREE.BoxGeometry(0.8, hh, 0.8), F, 0, hh / 2 + 0.04, -0.05);
    this.local("trim", new THREE.BoxGeometry(0.82, 0.06, 0.82), F, 0, 0.07, -0.05); // 하단 띠
    this.local("glass", new THREE.BoxGeometry(0.2, 0.3, 0.02), F, 0, 0.21, 0.355); // 문 (밤엔 불빛)
    this.local("glass", new THREE.BoxGeometry(0.16, 0.14, 0.02), F, -0.26, 0.36, 0.355); // 창
    this.local("glass", new THREE.BoxGeometry(0.16, 0.14, 0.02), F, 0.26, 0.36, 0.355);
    this.local("glass", new THREE.BoxGeometry(0.02, 0.14, 0.18), F, 0.405, 0.36, -0.05); // 옆창
    this.local("glass", new THREE.BoxGeometry(0.02, 0.14, 0.18), F, -0.405, 0.36, -0.05);
    // 창 앞 후광 + 테라스 등
    const front = new THREE.Vector3(0, 0.3, 0.45).applyMatrix4(F);
    this.lights.push({ x: front.x, y: front.y, z: front.z, size: 0.55, color: "#ffbe70", flicker: 0 });
    // 지붕: 처마 넓은 4각 뿔 2단 (초가 층) + 꼭대기 매듭
    const roofY = hh + 0.04;
    for (let i = 0; i < 4; i++) {
      const rb = 0.82 - 0.19 * i;
      const rt = rb - 0.16;
      const layer = new THREE.CylinderGeometry(Math.max(rt, 0.05), rb, 0.15, 4, 1);
      this.jitter(layer, 0.018);
      this.local("thatch", layer, F, 0, roofY + 0.075 + i * 0.135, -0.05, Math.PI / 4);
    }
    this.local("trim", new THREE.CylinderGeometry(0.03, 0.045, 0.1, 6), F, 0, roofY + 0.6, -0.05);
    // 테라스 가구: 데크체어 2 + 둥근 탁자 + 수건
    for (const lx of [-0.26, 0.26]) {
      this.local("white", new THREE.BoxGeometry(0.16, 0.025, 0.36), F, lx, 0.07, 0.68);
      this.local("white", new THREE.BoxGeometry(0.16, 0.025, 0.16), F, lx, 0.13, 0.52, 0, 1, 1, 1, -0.9);
    }
    this.local("trim", new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8), F, 0, 0.15, 0.7);
    this.local("trim", new THREE.CylinderGeometry(0.015, 0.015, 0.14, 4), F, 0, 0.08, 0.7);
    this.local("coral", new THREE.BoxGeometry(0.12, 0.012, 0.2), F, 0.26, 0.085, 0.72);
    // 처마 밑 서까래 4개
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      this.local("trim", new THREE.BoxGeometry(0.02, 0.02, 0.5), F, Math.cos(a) * 0.4, roofY + 0.02, -0.05 + Math.sin(a) * 0.4, -a + Math.PI / 2, 1, 1, 1, 0.5);
    }
    // 물로 내려가는 사다리 (뒤쪽)
    for (let i = 0; i < 4; i++) this.local("trim", new THREE.BoxGeometry(0.18, 0.02, 0.02), F, 0, -0.06 - i * 0.1, -0.52);
    this.local("trim", new THREE.BoxGeometry(0.02, 0.5, 0.02), F, -0.09, -0.2, -0.52);
    this.local("trim", new THREE.BoxGeometry(0.02, 0.5, 0.02), F, 0.09, -0.2, -0.52);
  }

  umbrella(x: number, z: number, lean = 0) {
    const y = floorHeight(this.bottom, x, z);
    this.add("dark", new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5), x, y + 0.31, z, 0, 1, 1, 1, lean * 0.2);
    // 캐노피: 코랄 8각 + 흰 띠 (살짝 작은 흰 원뿔을 겹친다)
    this.add("coral", new THREE.ConeGeometry(0.34, 0.14, 8, 1, true), x, y + 0.62, z, lean);
    this.add("white", new THREE.ConeGeometry(0.345, 0.14, 8, 1, true), x, y + 0.615, z, lean + Math.PI / 8, 1, 1, 1);
    this.add("dark", new THREE.SphereGeometry(0.02, 6, 5), x, y + 0.7, z);
  }

  sunbed(x: number, z: number, yaw: number) {
    const y = floorHeight(this.bottom, x, z);
    const F = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    this.local("white", new THREE.BoxGeometry(0.46, 0.035, 0.2), F, 0, 0.08, 0);
    this.local("white", new THREE.BoxGeometry(0.17, 0.035, 0.2), F, -0.28, 0.14, 0, 0, 1, 1, 1, 0, 0.9); // 등받이
    for (const [lx, lz] of [
      [-0.2, -0.08],
      [0.2, -0.08],
      [-0.2, 0.08],
      [0.2, 0.08],
    ])
      this.local("dark", new THREE.CylinderGeometry(0.01, 0.01, 0.07, 4), F, lx, 0.035, lz);
  }

  boat(x: number, z: number, yaw: number) {
    const F = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    this.local("white", new THREE.SphereGeometry(1, 12, 7), F, 0, 0, 0, 0, 0.5, 0.12, 0.2); // 선체
    this.local("coral", new THREE.TorusGeometry(1, 0.06, 5, 16), F, 0, 0.1, 0, 0, 0.5, 0.2, 1, Math.PI / 2); // 뱃전 띠
    this.local("wood", new THREE.BoxGeometry(0.06, 0.02, 0.34), F, -0.1, 0.11, 0);
    this.local("wood", new THREE.BoxGeometry(0.06, 0.02, 0.34), F, 0.2, 0.11, 0);
    this.local("dark", new THREE.BoxGeometry(0.06, 0.12, 0.05), F, -0.5, 0.1, 0); // 선외기
  }

  build() {
    const out: { bucket: Bucket; geo: THREE.BufferGeometry }[] = [];
    for (const k of Object.keys(this.parts) as Bucket[]) {
      const list = this.parts[k];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      out.push({ bucket: k, geo: merged });
    }
    return out;
  }
}

export function Resort({ bottom }: { bottom: number }) {
  const haloPts = useRef<THREE.Points>(null!);
  const { meshes, halo } = useMemo(() => {
    const b = new Builder(bottom);
    for (let i = 0; i < SPINE.length - 1; i++) b.plank(...SPINE[i], ...SPINE[i + 1]);
    for (const h of BUNGALOWS) {
      // 척추선에서 가장 가까운 점으로 다리를 놓는다
      const best = bridgeStart(h);
      b.plank(best[0], best[1], h.x, h.z, 0.18, false);
      b.bungalow(h.x, h.z, h.yaw);
    }
    for (const u of UMBRELLAS) b.umbrella(u.x, u.z, u.lean);
    for (const sb of SUNBEDS) b.sunbed(sb.x, sb.z, sb.yaw);
    for (const bt of STATIC_BOATS) b.boat(bt.x, bt.z, bt.yaw);
    // 보도 가로등 (척추선 따라 1.6 간격)
    for (let i = 0; i < SPINE.length - 1; i++) {
      const [ax, az] = SPINE[i];
      const [bx, bz] = SPINE[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.6));
      const yaw = Math.atan2(-(bz - az), bx - ax);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        b.lamp(ax + (bx - ax) * t + Math.sin(yaw) * (PLANK_W / 2 + 0.03), az + (bz - az) * t + Math.cos(yaw) * (PLANK_W / 2 + 0.03));
      }
    }
    // 섬 덤불
    for (const bu of BUSHES) b.bush(bu.x, bu.z, bu.s);
    // 해먹: 두 야자수 사이
    {
      const pa = PALMS[HAMMOCK.a], pb = PALMS[HAMMOCK.b];
      b.hammock(pa.x + 0.1, pa.z, pb.x - 0.1, pb.z, floorHeight(bottom, (pa.x + pb.x) / 2, (pa.z + pb.z) / 2) + HAMMOCK.h);
    }
    // 섬 횃불 + 야자수 사이 꼬마전구 줄 (밤 조명)
    for (const [x, z] of TORCHES) b.torch(x, z);
    for (const [i, j] of [
      [2, 5],
      [5, 3],
      [6, 2],
    ]) {
      const a = PALMS[i], c = PALMS[j];
      b.stringLights(a.x, a.z, floorHeight(bottom, a.x, a.z) + 0.85, c.x, c.z, floorHeight(bottom, c.x, c.z) + 0.85);
    }
    // 후광 점들
    const n = b.lights.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), flick = new Float32Array(n);
    const c = new THREE.Color();
    b.lights.forEach((l, i) => {
      pos.set([l.x, l.y, l.z], i * 3);
      c.set(l.color).toArray(col, i * 3);
      size[i] = l.size;
      flick[i] = l.flicker;
    });
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    haloGeo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    haloGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    haloGeo.setAttribute("aFlick", new THREE.BufferAttribute(flick, 1));
    return { meshes: b.build(), halo: haloGeo };
  }, [bottom]);
  useEffect(
    () => () => {
      meshes.forEach((m) => m.geo.dispose());
      halo.dispose();
    },
    [meshes, halo],
  );

  // 밤 조명: 창·전구 발광은 하루 주기를 따른다 (켜짐 0 → 1 은 dayCycle 키프레임이 40분 넘게 페이드)
  useFrame((state) => {
    const lamp = ENV.uLamp.value;
    MATS.glass.emissiveIntensity = lamp * 1.5;
    MATS.bulb.emissiveIntensity = lamp * 2.2;
    haloPts.current.visible = lamp > 0.001; // 낮엔 후광 드로우를 뺀다 (두 패스 모두)
    const u = HALO_MAT.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uPx.value = state.size.height * state.viewport.dpr * 0.5 * state.camera.projectionMatrix.elements[5];
  });

  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.bucket} geometry={m.geo} material={MATS[m.bucket]} />
      ))}
      <points ref={haloPts} geometry={halo} material={HALO_MAT} frustumCulled={false} renderOrder={5} />
    </>
  );
}
