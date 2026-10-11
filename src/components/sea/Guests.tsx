/* eslint-disable react-hooks/immutability -- three.js 객체·상태 기계는 프레임마다 직접 변경한다 */
"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { floorHeight, S } from "./lagoonHeight";
import { blobShadowTexture, TANK } from "./lagoonNav";
import { dayHour } from "./dayCycle";
import { ACTIVITIES, type Activity, debugState, makeCouple, tickCouple, type Walker } from "./guestBrain";
import { applyPose, GUEST_SCALE, LOOKS, makeGuestMaterial, makeGuestsGeometry, makePose, type Pose } from "./guestModel";
import { blendPose, type PoseCtx, type PoseName } from "./guestPoses";

/**
 * 리조트 손님 커플 — 섬·데크·방갈로·바다·보트에서 알아서 논다. 행동은 guestBrain(순수 상태 기계), 길은 guestNav.
 * 사람 둘(한 메시 1 드로우 — 부위·전체 변환은 정점 셰이더) + 보트(정점 색 1 드로우) + 발밑 블롭 그림자(인스턴스 1 드로우).
 * ?guest=<활동> 활동 고정 · ?guest=pose:<포즈> 포즈 시트 · ?focus=guests 근접 뷰 (점검용)
 */
const GUEST_PARAM = captureParam("guest") ?? "";
const DEBUG_POSE = (GUEST_PARAM.startsWith("pose:") ? GUEST_PARAM.slice(5) : null) as PoseName | null;
const FORCE_ACT = (ACTIVITIES as string[]).includes(GUEST_PARAM) ? (GUEST_PARAM as Activity) : null;
const FACE_CAM = -0.96; // 카메라 방위각 35° 를 마주 보는 yaw
const CAM_RIGHT = { x: Math.cos(THREE.MathUtils.degToRad(35)), z: -Math.sin(THREE.MathUtils.degToRad(35)) };

/** 점검용 근접 뷰(`?focus=guests`)가 바라볼 두 사람의 가운데 (SeaScene 이 읽는다) */
export const GUEST_FOCUS = new THREE.Vector3(-1.9 * S, TANK.TOP + 0.2, -1.25 * S);

/** 포즈별 전체 기울임·높이 (포즈 시트용 — 실제 활동은 brain 이 tilt/lift 를 정한다) */
const GROUP_OF: Record<PoseName, { tilt: number; lift: number }> = {
  stand: { tilt: 0, lift: 0 },
  walk: { tilt: 0, lift: 0 },
  sit: { tilt: 0, lift: 0 },
  lie: { tilt: 1.25, lift: 0.06 },
  swim: { tilt: -1.05, lift: 0 },
  paddle: { tilt: -0.15, lift: 0 },
  wave: { tilt: 0, lift: 0 },
  hug: { tilt: 0, lift: 0 },
};

/** 색·부위 없이 정점 색만 입힌다 (보트) */
function paint(g: THREE.BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute("uv");
  const n = geo.getAttribute("position").count;
  const c = new THREE.Color(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
/** 손님 보트 — Resort 의 정적 보트와 같은 모양을 정점 색 한 메시로 (뱃머리 +x, 원점은 수면) */
function makeBoat() {
  const parts = [
    paint(at(new THREE.SphereGeometry(1, 12, 7), 0, 0, 0, 0.5, 0.12, 0.2), "#fbfbf7"),
    paint(at(new THREE.TorusGeometry(1, 0.06, 5, 16), 0, 0.1, 0, 0.5, 0.2, 1, Math.PI / 2), "#ef8a78"),
    paint(at(new THREE.BoxGeometry(0.06, 0.02, 0.34), -0.12, 0.11, 0), "#dccbaa"),
    paint(at(new THREE.BoxGeometry(0.06, 0.02, 0.34), 0.22, 0.11, 0), "#dccbaa"),
    paint(at(new THREE.BoxGeometry(0.06, 0.12, 0.05), -0.5, 0.1, 0), "#a08a6c"),
  ];
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}
const boatMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75, vertexColors: true });

interface Figure {
  pose: Pose;
  ctx: PoseCtx;
  tilt: number;
  lift: number;
}

export function Guests({ bottom, onSplash }: { bottom: number; onSplash?: (x: number, z: number, strength: number) => void }) {
  const boatRef = useRef<THREE.Group>(null!);
  const shadows = useRef<THREE.InstancedMesh>(null!);
  const res = useMemo(() => ({ geo: makeGuestsGeometry(), mat: makeGuestMaterial(), boat: makeBoat(), shadowTex: blobShadowTexture() }), []);
  const couple = useMemo(() => makeCouple(dayHour, FORCE_ACT), []);
  const figures = useMemo<Figure[]>(() => LOOKS.map((_, i) => ({ pose: makePose(), ctx: { t: 0, phase: 0, seed: i * 2.1, hold: 0 }, tilt: 0, lift: 0 })), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  const splashRef = useRef(onSplash);
  useEffect(() => {
    splashRef.current = onSplash;
  }, [onSplash]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.mat.dispose();
      res.boat.dispose();
    },
    [res],
  );

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    couple.splash = splashRef.current;
    if (!DEBUG_POSE) tickCouple(couple, dt, t);
    const walkers: Walker[] = [couple.a, couple.b];
    walkers.forEach((w, i) => {
      const f = figures[i];
      let pose = w.pose;
      if (DEBUG_POSE) {
        pose = DEBUG_POSE;
        w.x = -1.95 * S + i * 0.5 * CAM_RIGHT.x;
        w.z = -1.3 * S + i * 0.5 * CAM_RIGHT.z;
        w.y = floorHeight(bottom, w.x, w.z);
        w.yaw = FACE_CAM + (DEBUG_POSE === "lie" ? Math.PI / 2 : 0);
        w.tilt = GROUP_OF[DEBUG_POSE].tilt;
        w.lift = GROUP_OF[DEBUG_POSE].lift;
        w.phase += dt * (pose === "walk" ? 9 : pose === "swim" ? 4 : 2.5);
      }
      f.ctx.t = t;
      f.ctx.phase = w.phase;
      f.ctx.hold = w.hold;
      blendPose(f.pose, pose, f.ctx, Math.min(1, dt * 8));
      f.tilt += (w.tilt - f.tilt) * Math.min(1, dt * 6);
      f.lift += (w.lift - f.lift) * Math.min(1, dt * 6);
      // 전체 변환(자리·yaw·기울임·배율)은 유니폼으로 — 안 보이면 0 배율
      const sc = w.visible ? GUEST_SCALE : 0;
      res.mat.u.uBody.value[i].compose(tmp.v.set(w.x, w.y + f.lift, w.z), tmp.q.setFromEuler(tmp.e.set(0, w.yaw, f.tilt, "YZX")), tmp.s.set(sc, sc, sc));
      applyPose(f.pose, res.mat.u, i);
      // 발밑 블롭 그림자 (모래·데크 위에서만, 물속·보트에선 숨김)
      const floor = floorHeight(bottom, w.x, w.z);
      const onGround = w.visible && w.y < floor + 0.25 && floor > TANK.TOP - 0.02;
      const sz = onGround ? (pose === "lie" ? 0.42 : 0.24) : 0;
      tmp.m.compose(tmp.v.set(w.x, floor + 0.012, w.z), tmp.q.setFromEuler(tmp.e.set(-Math.PI / 2, 0, -w.yaw, "XYZ")), tmp.s.set(sz, sz * (pose === "lie" ? 0.5 : 0.8), 1));
      shadows.current.setMatrixAt(i, tmp.m);
    });
    shadows.current.instanceMatrix.needsUpdate = true;
    // 보트
    const b = couple.boat;
    const bg = boatRef.current;
    bg.position.set(b.x, 0.02 + Math.sin(t * 1.3) * 0.008, b.z);
    bg.rotation.set(b.roll, b.yaw, b.pitch, "YZX");
    GUEST_FOCUS.set((couple.a.x + couple.b.x) / 2, (couple.a.y + couple.b.y) / 2 + 0.15, (couple.a.z + couple.b.z) / 2);
    if (DEBUG_ON) publishDebug("guests", debugState(couple));
  });

  return (
    <>
      <mesh geometry={res.geo} material={res.mat.mat} frustumCulled={false} />
      <group ref={boatRef}>
        <mesh geometry={res.boat} material={boatMat} />
      </group>
      <instancedMesh ref={shadows} args={[undefined, undefined, 2]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={res.shadowTex} transparent depthWrite={false} opacity={0.85} />
      </instancedMesh>
    </>
  );
}
