/* eslint-disable react-hooks/immutability -- three.js 객체·상태는 프레임마다 직접 변경한다 */
"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { floorHeight } from "./lagoonHeight";
import { blobShadowTexture, TANK } from "./lagoonNav";
import { makeSeaplaneGeometry, makeSeaplaneMaterial, PROP_HUB } from "./seaplaneModel";
import { CIRCUIT, makeCircuit, PARK, type Phase } from "./seaplanePath";

/**
 * 해상 비행기 — 젤리 뚜껑(돔) 안에서 앞바다에 착수 → 활주 → 이륙 → 앞바다 위를 한 바퀴 선회를 반복한다 (aquamodel.mov 참고).
 * 경로는 닫힌 스플라인(seaplanePath), 모델은 정점 색 1 메시(seaplaneModel — 프로펠러·항법등은 정점 셰이더).
 * 블록 그룹 안에 있으므로 블록을 흔들면 뚜껑·수면과 함께 흔들린다.
 * ?plane=off 끄기 · ?plane=park 활주로 정지 · ?plane=<초> 경로 시작 위상 · ?focus=plane 근접 뷰 (점검용)
 */
const PLANE_PARAM = captureParam("plane") ?? "";
export const PLANE_OFF = PLANE_PARAM === "off";
const PARKED = PLANE_PARAM === "park";
const START_ADVANCE = Number(PLANE_PARAM) || 0;

/** 점검용 근접 뷰(`?focus=plane`)가 바라볼 자리·진행 방향 (SeaScene 이 읽는다) */
export const PLANE_FOCUS = { pos: new THREE.Vector3(PARK.x, TANK.TOP + 0.3, PARK.z), yaw: PARK.yaw };

const WAKE_EVERY = 0.2; // 활주 중 플로트 파임 간격 (초)
const PITCH_K = 0.5; // 경로 기울기 → 자세 피치 비율 (장난감답게 완만히, 나머지는 플레어·회전 보정)
const BANK = { k: 0.45, max: 0.55, rate: 3 }; // 요 각속도 → 롤
// 그림자가 밀리는 방향 (높이 1당) — Shadows.tsx 의 블록 그림자와 같은 빛 방향
const SHADOW_OFF = { x: 0.5, z: 0.14 };

interface Props {
  /** 착수·이륙 물보라 */
  onSplash?: (x: number, z: number, strength: number) => void;
  /** 활주 항적 (수면 시뮬 임펄스) */
  onWake?: (x: number, z: number, radius: number, strength: number) => void;
}

export function Seaplane({ onSplash, onWake }: Props) {
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
    a.pos.set(a.raw.x, TANK.TOP + a.raw.y, a.raw.z);
    const g = root.current;
    g.position.copy(a.pos);
    if (onWater) g.position.y += Math.sin(t * 1.4) * 0.006;
    g.quaternion.setFromEuler(tmp.e.set(a.roll, a.yaw, a.pitch, "YZX"));
    // 프로펠러
    a.prop += dt * (a.speed > 0.2 ? 40 : 12);
    res.mat.u.uProp.value = a.prop;
    res.mat.u.uHub.value.copy(PROP_HUB);
    // 그림자: 빛 반대쪽으로 고도만큼 밀린 수면(섬이면 모래) 위
    {
      const sh = shadow.current;
      // 동체는 플로트보다 0.45 위에 있다 — 물 위에서도 그림자가 몸 옆으로 살짝 비켜 보이게
      const h = alt + 0.45;
      // 벽 너머로 밀리면 수면 밖(옆면 속)에 얼룩처럼 보이니 수면 안쪽으로 묶는다
      const sx = THREE.MathUtils.clamp(a.raw.x + SHADOW_OFF.x * h, -TANK.W / 2 + 0.9, TANK.W / 2 - 0.9);
      const sz = THREE.MathUtils.clamp(a.raw.z + SHADOW_OFF.z * h, -TANK.D / 2 + 0.9, TANK.D / 2 - 0.9);
      sh.position.set(sx, Math.max(TANK.TOP, floorHeight(TANK.BOTTOM, sx, sz)) + 0.012, sz);
      sh.rotation.set(-Math.PI / 2, 0, -a.yaw, "XYZ"); // 공유 Euler 는 매번 순서를 명시한다
      const grow = 1 + Math.min(h, 6) * 0.14;
      sh.scale.set(1.5 * grow, 1.1 * grow, 1);
      (sh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.75, 0.2, Math.min(1, h / 3.5));
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
      });
  });

  return (
    <>
      <group ref={root}>
        <mesh geometry={res.geo} material={res.mat.mat} frustumCulled={false} />
      </group>
      {/* 블롭 그림자 (수면 또는 섬 모래 위) */}
      <mesh ref={shadow} renderOrder={1} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={res.shadowTex} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

export { CIRCUIT };
