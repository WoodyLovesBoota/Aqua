/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { ENV } from "@/components/three/sceneEnv";
import { floorHeight } from "./lagoonHeight";
import { TANK } from "./lagoonNav";
import { REEFS } from "./Reef";

/**
 * 열대어 — 산호 군락 둘레를 배회하는 작은 물고기 10마리 (4종).
 * 몸통(납작 타원) + 꼬리·등·배 지느러미를 한 지오메트리로 만들고 InstancedMesh 하나(1 드로우)로 그린다.
 * 무늬·구슬 눈은 프래그먼트에서 로컬 좌표로 그리고(종 번호는 인스턴스 속성), 꼬리 파동은 정점 셰이더가 인스턴스별 위상으로 흔든다.
 * 큰 생물이 다가오면 산호 쪽으로 내려가 숨는다.
 */

const { TOP, BOTTOM } = TANK;

/** 0 흰동가리 · 1 블루탱 · 2 옐로탱 · 3 나비고기 */
type Kind = 0 | 1 | 2 | 3;
interface FishDef {
  reef: number;
  kind: Kind;
  /** 몸길이 (꼬리 제외 ≈ 이 값, 꼬리 포함 1.3배) */
  len: number;
}
export const FISH: FishDef[] = [
  { reef: 0, kind: 0, len: 0.3 },
  { reef: 0, kind: 0, len: 0.26 },
  { reef: 0, kind: 2, len: 0.36 },
  { reef: 0, kind: 2, len: 0.32 },
  { reef: 0, kind: 1, len: 0.38 },
  { reef: 1, kind: 0, len: 0.3 },
  { reef: 1, kind: 3, len: 0.36 },
  { reef: 1, kind: 3, len: 0.32 },
  { reef: 1, kind: 2, len: 0.34 },
  { reef: 2, kind: 1, len: 0.4 },
];
/** 종별 몸 비율 [높이, 두께] (길이 1 기준) */
const SHAPE: Record<Kind, [number, number]> = { 0: [0.5, 0.26], 1: [0.56, 0.2], 2: [0.62, 0.2], 3: [0.66, 0.18] };

const CRUISE = { speed: 0.32, dart: 1.1 };
const FLEE_DIST = 1.15;

/** 몸통 + 지느러미 (aFin: 0 몸 · 1 지느러미) — 머리 +x, 길이 1, 높이 0.5, 두께 0.26 */
function makeFishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 16, 11);
  body.scale(1, 0.5, 0.26);
  // 머리 쪽을 둥글고 꼬리 쪽을 가늘게
  const bp = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const t = (x + 0.5) / 1; // 0 꼬리 ~ 1 머리
    const k = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    bp.setY(i, bp.getY(i) * (0.35 + 0.65 * k));
    bp.setZ(i, bp.getZ(i) * (0.4 + 0.6 * k));
  }
  body.computeVertexNormals();
  body.deleteAttribute("uv");
  const fin = (w: number, h: number, x: number, y: number, rootH: number, tipH: number, dir: 1 | -1) => {
    // xy 평면의 얇은 판. x 방향으로 뻗고 뿌리→끝으로 높이가 변한다 (꼬리: 뿌리 좁고 끝 넓음)
    const g = new THREE.PlaneGeometry(w, h, 3, 3);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) + w / 2) / w; // 0 → 1 along +x
      const hk = THREE.MathUtils.lerp(dir === -1 ? tipH : rootH, dir === -1 ? rootH : tipH, t);
      p.setY(i, p.getY(i) * hk);
      p.setX(i, p.getX(i) + x);
      p.setY(i, p.getY(i) + y);
    }
    g.deleteAttribute("uv");
    return g;
  };
  const tail = fin(0.32, 0.5, -0.66, 0, 0.25, 1.0, -1);
  // 꼬리 끝 가운데가 파인 V 자
  const tp = tail.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const t = (-0.5 - tp.getX(i)) / 0.32; // 0 뿌리 → 1 끝
    const y = tp.getY(i);
    if (t > 0.3) tp.setX(i, tp.getX(i) + (1 - Math.abs(y) / 0.25) * 0.1 * (t - 0.3));
  }
  const dorsal = fin(0.55, 0.3, -0.05, 0.25, 0.55, 0.9, 1);
  const dp = dorsal.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < dp.count; i++) if (dp.getY(i) < 0.25) dp.setY(i, 0.2); // 아랫변은 몸 안에
  const anal = fin(0.3, 0.16, -0.15, -0.25, 0.9, 0.6, 1);
  const ap = anal.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < ap.count; i++) if (ap.getY(i) > -0.25) ap.setY(i, -0.2);
  const fins = [tail, dorsal, anal].map((g) => g.toNonIndexed());
  const bodyFlat = body.toNonIndexed();
  const all = [bodyFlat, ...fins];
  all.forEach((g, k) => g.setAttribute("aFin", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k === 0 ? 0 : 1), 1)));
  fins.forEach((g) => g.computeVertexNormals());
  const merged = mergeGeometries(all, false)!;
  [body, tail, dorsal, anal, ...all].forEach((g) => g.dispose());
  return merged;
}

const vert = /* glsl */ `
  attribute float aFin;
  attribute float aKind;
  attribute float aTail;
  attribute float aWag;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vKind;
  varying float vFin;
  void main() {
    vec3 p = position;
    // 꼬리로 갈수록 크게 좌우로 흔든다 (파동은 머리→꼬리로 흐른다)
    float tailK = smoothstep(0.15, -0.85, p.x);
    float wave = sin(aTail - p.x * 4.0);
    p.z += wave * aWag * (0.09 * tailK * tailK + 0.015 * tailK) + wave * aFin * 0.02 * (0.5 + tailK);
    vLocal = position;
    vKind = aKind;
    vFin = aFin;
    mat4 mi = modelMatrix * instanceMatrix;
    vec4 wp = mi * vec4(p, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(mi) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const frag = /* glsl */ `
  precision highp float;
  uniform vec3 uCamPos;
  uniform vec3 uEnvLight;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vKind;
  varying float vFin;
  float band(float x, float c, float w) { return 1.0 - smoothstep(w - 0.012, w + 0.004, abs(x - c)); }
  void main() {
    float x = vLocal.x, y = vLocal.y;
    vec3 col;
    vec3 ORANGE = vec3(1.0, 0.30, 0.03), WHITE = vec3(0.95, 0.95, 0.92), INK = vec3(0.03, 0.03, 0.04);
    vec3 BLUE = vec3(0.06, 0.22, 0.95), YELLOW = vec3(1.0, 0.68, 0.05), CREAM = vec3(0.95, 0.90, 0.72), GOLD = vec3(1.0, 0.5, 0.08);
    int kind = int(vKind + 0.5);
    if (kind == 0) {
      // 흰동가리: 주황 + 흰 띠 3 (머리 뒤 · 가운데(아래로 넓어짐) · 꼬리 밑동), 띠 테두리 검정
      float b = max(max(band(x, 0.2, 0.05), band(x, -0.1, 0.07 + 0.03 * smoothstep(0.0, 0.25, abs(y)))), band(x, -0.42, 0.045));
      float edge = max(max(band(x, 0.2, 0.065), band(x, -0.1, 0.085 + 0.03 * smoothstep(0.0, 0.25, abs(y)))), band(x, -0.42, 0.06)) - b;
      col = mix(ORANGE, WHITE, b);
      col = mix(col, INK, clamp(edge, 0.0, 1.0) * 0.85);
      if (vFin > 0.5) col = mix(ORANGE, INK, smoothstep(0.7, 0.95, abs(y) / 0.25 + (x < -0.5 ? smoothstep(-0.6, -0.8, x) : 0.0)) * 0.8);
    } else if (kind == 1) {
      // 블루탱: 파랑 + 등 쪽 검정 팔레트 + 노란 꼬리
      // 검정 팔레트: 등 쪽 타원에서 파란 타원을 뺀 모양
      float palette = 1.0 - smoothstep(0.9, 1.0, length(vec2((x + 0.09) / 0.36, (y - 0.08) / 0.19)));
      float blueOval = 1.0 - smoothstep(0.85, 1.0, length(vec2((x + 0.12) / 0.24, (y - 0.06) / 0.075)));
      col = mix(BLUE, INK, clamp(palette - blueOval, 0.0, 1.0) * 0.9);
      if (x < -0.46) col = YELLOW;
      if (vFin > 0.5) col = x < -0.5 ? YELLOW : mix(INK, BLUE, smoothstep(0.75, 1.0, abs(y) / 0.33));
    } else if (kind == 2) {
      // 옐로탱: 온통 노랑, 옆구리에 옅은 줄
      col = YELLOW * (1.0 + 0.08 * smoothstep(0.02, 0.0, abs(y - 0.02)));
      if (vFin > 0.5) col = YELLOW * 0.92;
    } else {
      // 나비고기: 크림 바탕 + 세로 주황 줄 4 + 눈 띠 + 꼬리 쪽 눈점
      float s = sin((x + 0.5) * 6.2831 * 2.4 + 0.6);
      float stripes = smoothstep(0.45, 0.75, s);
      col = mix(CREAM, GOLD, stripes);
      col = mix(col, INK, band(x, 0.27, 0.025) * 0.8);
      float spot = 1.0 - smoothstep(0.035, 0.05, length(vec2(x + 0.32, y - 0.1)));
      float ring = (1.0 - smoothstep(0.055, 0.07, length(vec2(x + 0.32, y - 0.1)))) - spot;
      col = mix(col, INK, spot);
      col = mix(col, WHITE, clamp(ring, 0.0, 1.0));
      if (vFin > 0.5) col = x < -0.5 ? mix(CREAM, GOLD, smoothstep(-0.6, -0.8, x)) : GOLD;
    }
    // 구슬 눈 (양 옆) + 하이라이트
    if (vFin < 0.5) {
      vec2 e = vec2(x - 0.32, y - 0.06);
      float eye = 1.0 - smoothstep(0.038, 0.05, length(e));
      float hl = 1.0 - smoothstep(0.008, 0.016, length(e - vec2(-0.012, 0.013)));
      col = mix(col, INK, eye);
      col = mix(col, vec3(1.0), hl * eye);
    }
    // 조명: 반구 + 방향광 + 벨벳 림 (플러시 느낌)
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 L = normalize(vec3(0.43, 0.86, 0.29));
    vec3 V = normalize(uCamPos - vWorld);
    float sky = n.y * 0.5 + 0.5;
    vec3 hemi = mix(vec3(0.55, 0.62, 0.72), vec3(1.0, 1.0, 1.0), sky);
    float diff = 0.45 + 0.55 * max(dot(n, L), 0.0);
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.22;
    vec3 outCol = (col * hemi * diff + rim * vec3(0.9, 0.95, 1.0) + col * 0.08) * uEnvLight; // 하루 주기 환경광
    gl_FragColor = vec4(outCol, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface FishState {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  target: THREE.Vector3;
  retarget: number;
  turnRate: number;
  tail: number;
  dart: number; // > 0 이면 질주 중
  nextDart: number;
  flee: number;
  phase: number;
}

const rand = THREE.MathUtils.randFloat;

interface Props {
  /** 큰 생물 위치 (숨기 판정) */
  others: readonly THREE.Vector3[];
}

export function ReefFish({ others }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => {
    const g = makeFishGeometry();
    const n = FISH.length;
    g.setAttribute("aKind", new THREE.InstancedBufferAttribute(new Float32Array(FISH.map((f) => f.kind)), 1));
    g.setAttribute("aTail", new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aWag", new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uCamPos: { value: new THREE.Vector3() }, uEnvLight: ENV.uEnvLight }, side: THREE.DoubleSide }),
    [],
  );
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), fwd: new THREE.Vector3(), e: new THREE.Euler(), q: new THREE.Quaternion(), s: new THREE.Vector3(), m: new THREE.Matrix4() }), []);
  const states = useMemo<FishState[]>(
    () =>
      FISH.map((f, i) => {
        const reef = REEFS[f.reef];
        const a = i * 1.7;
        const d = reef.r * 0.5;
        const x = reef.x + Math.cos(a) * d, z = reef.z + Math.sin(a) * d;
        const y = floorHeight(BOTTOM, x, z) + 0.45 + (i % 3) * 0.12;
        return {
          pos: new THREE.Vector3(x, y, z),
          yaw: a,
          pitch: 0,
          roll: 0,
          speed: CRUISE.speed,
          target: new THREE.Vector3(x, y, z),
          retarget: 0,
          turnRate: 0,
          tail: i * 2.1,
          dart: 0,
          nextDart: 4 + i * 1.3,
          flee: 0,
          phase: i * 0.9,
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  /** 군락 안 새 목표: 산호 위 0.3~0.9, 반경 안 */
  const pickTarget = (s: FishState, f: FishDef, low = false) => {
    const reef = REEFS[f.reef];
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const d = reef.r * (low ? 0.35 : 0.95) * Math.sqrt(Math.random());
      const x = reef.x + Math.cos(a) * d, z = reef.z + Math.sin(a) * d;
      const fy = floorHeight(BOTTOM, x, z);
      const y = low ? fy + rand(0.2, 0.32) : rand(fy + 0.32, Math.max(fy + 0.4, Math.min(fy + 0.95, TOP - 0.4)));
      s.target.set(x, y, z);
      if (s.target.distanceTo(s.pos) > 0.3 || i === 5) break;
    }
    s.retarget = rand(2, 5);
  };

  useFrame((frame, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = frame.clock.elapsedTime;
    mat.uniforms.uCamPos.value.copy(frame.camera.position);
    const inst = mesh.current;
    const tailAttr = geo.getAttribute("aTail") as THREE.InstancedBufferAttribute;
    const wagAttr = geo.getAttribute("aWag") as THREE.InstancedBufferAttribute;
    for (let i = 0; i < FISH.length; i++) {
      const f = FISH[i];
      const s = states[i];
      const reef = REEFS[f.reef];
      // 큰 생물이 가까우면 산호 사이로 숨는다
      if (s.flee > 0) s.flee -= dt;
      else {
        for (const o of others) {
          if (Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < FLEE_DIST && Math.abs(o.y - s.pos.y) < 1.0) {
            s.flee = rand(1.5, 2.5);
            pickTarget(s, f, true);
            break;
          }
        }
      }
      // 질주: 가끔 짧게 빨라진다
      s.nextDart -= dt;
      if (s.dart > 0) s.dart -= dt;
      else if (s.nextDart <= 0) {
        s.dart = rand(0.4, 0.8);
        s.nextDart = rand(6, 12);
        pickTarget(s, f);
      }
      s.retarget -= dt;
      if (s.retarget <= 0 || s.target.distanceTo(s.pos) < 0.12) pickTarget(s, f, s.flee > 0);

      const to = tmp.v.copy(s.target).sub(s.pos);
      // 서로 비키기
      for (let j = 0; j < FISH.length; j++) {
        if (j === i) continue;
        const o = states[j].pos;
        const dx = s.pos.x - o.x, dy = s.pos.y - o.y, dz = s.pos.z - o.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 0.22) {
          const k = (0.22 - d) * 6;
          to.x += (dx / Math.max(d, 0.02)) * k;
          to.y += (dy / Math.max(d, 0.02)) * k;
          to.z += (dz / Math.max(d, 0.02)) * k;
        }
      }
      const wantYaw = Math.atan2(-to.z, to.x);
      const wantPitch = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.6, 0.6);
      let dy = Math.atan2(Math.sin(wantYaw - s.yaw), Math.cos(wantYaw - s.yaw));
      const maxTurn = (s.flee > 0 ? 6 : 3.5) * dt;
      dy = THREE.MathUtils.clamp(dy, -maxTurn, maxTurn);
      s.yaw += dy;
      s.turnRate += (dy / dt - s.turnRate) * Math.min(1, dt * 6);
      s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 4);
      const targetSpeed = s.flee > 0 ? 1.3 : s.dart > 0 ? CRUISE.dart : CRUISE.speed * (0.8 + 0.4 * Math.sin(t * 0.7 + s.phase));
      s.speed += (targetSpeed - s.speed) * Math.min(1, dt * (s.flee > 0 ? 6 : 2.5));
      const fwd = tmp.fwd.set(Math.cos(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.sin(s.yaw) * Math.cos(s.pitch));
      s.pos.addScaledVector(fwd, s.speed * dt);
      // 군락 밖으로 벗어나면 안으로 — 바닥·수면 여유
      const dr = Math.hypot(s.pos.x - reef.x, s.pos.z - reef.z);
      if (dr > reef.r * 1.15) {
        s.pos.x = reef.x + ((s.pos.x - reef.x) / dr) * reef.r * 1.15;
        s.pos.z = reef.z + ((s.pos.z - reef.z) / dr) * reef.r * 1.15;
        s.retarget = 0;
      }
      const fy = floorHeight(BOTTOM, s.pos.x, s.pos.z);
      s.pos.y = THREE.MathUtils.clamp(s.pos.y, fy + 0.16, TOP - 0.32);
      const bank = THREE.MathUtils.clamp(-s.turnRate * 0.25, -0.5, 0.5);
      s.roll += (bank - s.roll) * Math.min(1, dt * 5);
      // 꼬리: 빠를수록 빨리 작게, 느릴수록 천천히 크게
      s.tail += dt * (6 + s.speed * 14);
      tailAttr.setX(i, s.tail);
      wagAttr.setX(i, THREE.MathUtils.clamp(0.9 - s.speed * 0.25, 0.5, 1));

      const [hk, wk] = SHAPE[f.kind];
      tmp.e.set(s.roll, s.yaw, s.pitch, "YZX");
      tmp.q.setFromEuler(tmp.e);
      tmp.s.set(f.len, f.len * hk * 2, f.len * wk * (1 / 0.26));
      const bob = Math.sin(t * 2.2 + s.phase) * 0.01;
      tmp.m.compose(tmp.v.set(s.pos.x, s.pos.y + bob, s.pos.z), tmp.q, tmp.s);
      inst.setMatrixAt(i, tmp.m);
    }
    inst.instanceMatrix.needsUpdate = true;
    tailAttr.needsUpdate = true;
    wagAttr.needsUpdate = true;
    if (DEBUG_ON)
      publishDebug(
        "reefFish",
        states.map((s, i) => {
          const r = REEFS[FISH[i].reef];
          return { reef: FISH[i].reef, home: [r.x, r.z, r.r], pos: s.pos.toArray().map((v) => +v.toFixed(3)), speed: +s.speed.toFixed(2), flee: s.flee > 0, dart: s.dart > 0 };
        }),
      );
  });

  return <instancedMesh ref={mesh} args={[geo, mat, FISH.length]} frustumCulled={false} />;
}
