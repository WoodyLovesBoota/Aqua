/* eslint-disable react-hooks/immutability -- three.js 객체·상태는 프레임마다 직접 변경한다 */
"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { blobShadowTexture, TANK } from "./lagoonNav";
import { BLOCK_CORNER } from "./tankGeometry";
import { makeSeaplaneGeometry, makeSeaplaneMaterial, PROP_HUB } from "./seaplaneModel";
import { CIRCUIT, makeCircuit, PARK, type Phase } from "./seaplanePath";

/**
 * 해상 비행기 — 블록 바깥 상공에서 들어와 앞바다에 착수 → 활주 → 이륙 → 블록 바깥을 한 바퀴 선회를 반복한다 (aquamodel.mov 참고).
 * 경로는 닫힌 스플라인(seaplanePath), 모델은 정점 색 1 메시(seaplaneModel — 프로펠러·항법등은 정점 셰이더).
 * 물 위에선 블록 흔들림(전단·바닥 변위)을 따라가고 공중에선 따라가지 않는다.
 * ?plane=off 끄기 · ?plane=park 활주로 정지 · ?plane=<초> 경로 시작 위상 · ?focus=plane 근접 뷰 (점검용)
 */
const PLANE_PARAM = captureParam("plane") ?? "";
export const PLANE_OFF = PLANE_PARAM === "off";
const PARKED = PLANE_PARAM === "park";
const START_ADVANCE = Number(PLANE_PARAM) || 0;

/** 점검용 근접 뷰(`?focus=plane`)가 바라볼 자리·진행 방향 (SeaScene 이 읽는다) */
export const PLANE_FOCUS = { pos: new THREE.Vector3(PARK.x, TANK.TOP + 0.3, PARK.z), yaw: PARK.yaw };

const WAKE_EVERY = 0.2; // 활주 중 플로트 파임 간격 (초)
const FOLLOW_H = 0.8; // 이 고도까지 블록 흔들림을 따라간다 (0 에서 완전히, FOLLOW_H 에서 0)
const PITCH_K = 0.5; // 경로 기울기 → 자세 피치 비율 (장난감답게 완만히, 나머지는 플레어·회전 보정)
const BANK = { k: 0.45, max: 0.55, rate: 3 }; // 요 각속도 → 롤
// 그림자가 밀리는 방향 (높이 1당) — Shadows.tsx 의 블록 그림자와 같은 빛 방향
const SHADOW_OFF = { x: 0.5, z: 0.14 };
const HX = TANK.W / 2, HZ = TANK.D / 2;
/** 블록 발자국(둥근 사각형) 안인지 */
const inFootprint = (x: number, z: number) => {
  const dx = Math.max(Math.abs(x) - (HX - BLOCK_CORNER), 0), dz = Math.max(Math.abs(z) - (HZ - BLOCK_CORNER), 0);
  return Math.hypot(dx, dz) - BLOCK_CORNER < -0.1;
};

interface Props {
  /** 젤리 블록 그룹 — 물 위에 있을 때 이 행렬을 따라간다 */
  jelly: THREE.Object3D;
  /** 종이 바닥 높이 (블록 밑면) — 블록 밖 그림자가 떨어지는 곳 */
  groundY: number;
  /** 착수·이륙 물보라 */
  onSplash?: (x: number, z: number, strength: number) => void;
  /** 활주 항적 (수면 시뮬 임펄스) */
  onWake?: (x: number, z: number, radius: number, strength: number) => void;
}

export function Seaplane({ jelly, groundY, onSplash, onWake }: Props) {
  const root = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const res = useMemo(() => ({ geo: makeSeaplaneGeometry(), mat: makeSeaplaneMaterial(), circuit: makeCircuit(), shadowTex: blobShadowTexture() }), []);
  const st = useRef({
    s: 0, // 경로 위 호 길이 (0..L)
    phase: "approach" as Phase,
    yaw: PARK.yaw,
    pitch: 0,
    roll: 0,
    turnRate: 0,
    speed: 0,
    wakeT: 0,
    prop: 0,
    raw: new THREE.Vector3(),
    pos: new THREE.Vector3(),
  });
  const cb = useRef({ onSplash, onWake });
  useEffect(() => {
    cb.current = { onSplash, onWake };
  }, [onSplash, onWake]);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), t: new THREE.Vector3(), e: new THREE.Euler(), q: new THREE.Quaternion() }), []);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.mat.dispose();
    },
    [res],
  );
  // 시작 위상: 경로 시작(진입 상공)에서 START_ADVANCE 초만큼 미리 가 있는다 (점검용 — 착수 직전 등을 바로 본다)
  useEffect(() => {
    const c = res.circuit;
    const a = st.current;
    a.s = 0;
    for (let t = 0; t < START_ADVANCE; t += 1 / 60) a.s = (a.s + c.speedAt(a.s) / 60) % c.length;
  }, [res]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const a = st.current;
    const c = res.circuit;
    if (PARKED) {
      a.raw.set(PARK.x, 0, PARK.z);
      a.yaw = PARK.yaw;
      a.pitch = a.roll = 0;
      a.speed = 0;
    } else {
      const prev = a.phase;
      a.speed = c.speedAt(a.s);
      a.s = (a.s + a.speed * dt) % c.length;
      c.pointAt(a.s, a.raw);
      c.tangentAt(a.s, tmp.t);
      // 활주 구간: 스플라인이 수면 아래로 살짝 처지는 것을 막고 자세도 수평으로
      if (a.raw.y < 0) {
        a.raw.y = 0;
        tmp.t.y = 0;
        tmp.t.normalize();
      }
      a.phase = c.phaseAt(a.s);
      const wantYaw = Math.atan2(-tmp.t.z, tmp.t.x);
      const dy = Math.atan2(Math.sin(wantYaw - a.yaw), Math.cos(wantYaw - a.yaw));
      a.yaw += dy;
      a.turnRate += (dy / dt - a.turnRate) * Math.min(1, dt * 6);
      a.pitch = Math.asin(THREE.MathUtils.clamp(tmp.t.y, -1, 1)) * PITCH_K + c.pitchBiasAt(a.s);
      // 선회 → 뱅킹 (물 위에선 거의 수평)
      const bank = a.raw.y < 0.05 ? 0 : THREE.MathUtils.clamp(-a.turnRate * BANK.k, -BANK.max, BANK.max);
      a.roll += (bank - a.roll) * Math.min(1, dt * BANK.rate);
      // 착수·이륙 사건
      if (prev !== a.phase) {
        if (a.phase === "taxi") cb.current.onSplash?.(a.raw.x, a.raw.z, 0.9);
        if (a.phase === "climb") cb.current.onSplash?.(a.raw.x, a.raw.z, 0.3);
      }
    }
    const alt = a.raw.y; // 수면 기준 고도 (경로 y 는 TOP 기준)
    const onWater = alt < 0.03;
    // 활주 항적: 플로트 뒤 자리에 작은 파임
    if (onWater && a.speed > 0.3) {
      a.wakeT -= dt;
      if (a.wakeT <= 0) {
        a.wakeT = WAKE_EVERY;
        const cs = Math.cos(a.yaw), sn = Math.sin(a.yaw);
        for (const side of [-0.26, 0.26]) {
          const bx = a.raw.x - cs * 0.3 + sn * side, bz = a.raw.z + sn * 0.3 + cs * side;
          cb.current.onWake?.(bx, bz, 0.32, -0.09 * a.speed);
        }
      }
    }
    // 물 위에선 블록 행렬을 따라간다 (고도 0 → FOLLOW_H 로 블렌드)
    tmp.v.set(a.raw.x, TANK.TOP + a.raw.y, a.raw.z);
    const k = THREE.MathUtils.clamp(1 - alt / FOLLOW_H, 0, 1);
    a.pos.copy(tmp.v);
    if (k > 0) a.pos.lerp(tmp.v.applyMatrix4(jelly.matrix), k);
    const g = root.current;
    g.position.copy(a.pos);
    if (onWater) g.position.y += Math.sin(t * 1.4) * 0.006;
    g.quaternion.setFromEuler(tmp.e.set(a.roll, a.yaw, a.pitch, "YZX"));
    // 프로펠러
    a.prop += dt * (a.speed > 0.2 ? 40 : 12);
    res.mat.u.uProp.value = a.prop;
    res.mat.u.uHub.value.copy(PROP_HUB);
    // 그림자: 빛 반대쪽으로 고도만큼 밀린 자리가 블록 발자국 안이면 수면 위(블록 행렬 따라감), 밖이면 종이 바닥 위
    {
      const sh = shadow.current;
      // 동체는 플로트보다 0.45 위에 있다 — 물 위에서도 그림자가 몸 옆으로 살짝 비켜 보이게
      let h = alt + 0.45;
      let sx = a.raw.x + SHADOW_OFF.x * h, sz = a.raw.z + SHADOW_OFF.z * h;
      const onBlock = inFootprint(sx, sz);
      if (!onBlock) {
        h = alt + (TANK.TOP - groundY);
        sx = a.raw.x + SHADOW_OFF.x * h;
        sz = a.raw.z + SHADOW_OFF.z * h;
      }
      tmp.v.set(sx, onBlock ? TANK.TOP + 0.012 : groundY + 0.004, sz);
      if (onBlock) tmp.v.applyMatrix4(jelly.matrix);
      sh.position.copy(tmp.v);
      sh.rotation.set(-Math.PI / 2, 0, -a.yaw, "XYZ"); // 공유 Euler 는 매번 순서를 명시한다
      const grow = 1 + Math.min(h, 6) * 0.14;
      sh.scale.set(1.5 * grow, 1.1 * grow, 1);
      (sh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(1.0, 0.3, Math.min(1, h / 6));
    }
    PLANE_FOCUS.pos.copy(a.pos);
    PLANE_FOCUS.yaw = a.yaw;
    if (DEBUG_ON)
      publishDebug("plane", {
        phase: a.phase,
        s: +a.s.toFixed(2),
        len: +c.length.toFixed(1),
        pos: a.raw.toArray().map((v) => +v.toFixed(3)),
        alt: +alt.toFixed(3),
        yaw: +a.yaw.toFixed(3),
        pitch: +a.pitch.toFixed(3),
        roll: +a.roll.toFixed(3),
        speed: +a.speed.toFixed(2),
        render: a.pos.toArray().map((v) => +v.toFixed(3)),
      });
  });

  return (
    <>
      <group ref={root}>
        <mesh geometry={res.geo} material={res.mat.mat} frustumCulled={false} />
      </group>
      {/* 블롭 그림자 (수면 또는 종이 위, 블록 그림자 뒤에 그린다) */}
      <mesh ref={shadow} renderOrder={1} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={res.shadowTex} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

export { CIRCUIT };
