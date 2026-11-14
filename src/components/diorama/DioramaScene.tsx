/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { dayHour, nightOf } from "@/lib/lagoonClock";
import { Precompile } from "@/components/three/precompile";
import { GlBoundary } from "@/components/ui/GlBoundary";
import { bakeStatic, Kit, radialTex } from "./kit";
import { attachRipples } from "./ripples";

/**
 * 디오라마 전시 공용 셸 (마리나베이·삿포로…): 둥근 블록 하나를 라군과 같은 각도로 내려다보는 장면.
 * 전시마다 다른 것은 `DioramaSpec` 으로 받는다 — 모델 짓기, 근접 시점, 낮/밤 조명, 블룸 세기, 누르면 파문이 이는 물.
 * 공통: 하루 주기(`nightOf(dayHour())` → Kit.setNight), 정적 메시 병합, 낮엔 바로 그리기·밤엔 블룸 컴포저, 블록 잡고 흔들기(푸딩).
 */

type V3 = [number, number, number];
export interface DioramaBuild {
  /** 블록과 함께 흔들리는 것 전부 (bakeStatic 이 정적 메시를 병합한다) */
  roots: THREE.Object3D[];
  /** 따로 병합할 움직이는 그룹 (돌아가는 바퀴처럼 통째로 움직이는 것) */
  bakeGroups?: THREE.Object3D[];
  /** 프레임마다 (경과 초, 밤 정도 k) */
  ticks: ((t: number, k: number) => void)[];
  /** 누르면 파문이 이는 물: 재질(파문 셰이더를 끼운다)·수면 높이·안쪽 판정 */
  water?: { material: THREE.MeshStandardMaterial; y: number; contains: (x: number, z: number) => boolean };
}
export interface DioramaSpec {
  /** 디버그 키(`__aquaDebug.<id>`) */
  id: string;
  seed: number;
  build: (kit: Kit) => DioramaBuild;
  block: { W: number; D: number; TOP: number; LAND_H: number; STRATA: number };
  look: V3;
  /** ?focus=<키> → [x, y, z, 거리] */
  foci: Record<string, [number, number, number, number]>;
  /** 낮/밤 조명 [낮, 밤] */
  light: { hemiSky: [string, string]; hemiGround: [string, string]; hemiI: [number, number]; sun: [string, string]; sunI: [number, number]; sunPos: [V3, V3] };
  bloom: { strength: number; radius: number };
  ariaLabel: string;
}

// 카메라: 라군과 같은 디오라마 각도 (방위 35°, 앙각 27°)
const CAM = { az: 35, el: 27, r: 47, fov: 26 };
const AZ = THREE.MathUtils.degToRad(CAM.az), EL = THREE.MathUtils.degToRad(CAM.el);
// 점검용 A/B: ?ao=1 (앰비언트 오클루전 켬 — 전체 해상도라 GPU 를 크게 먹어 기본은 끔) · ?bloom=0 · ?shadow=0
const AO_ON = captureParam("ao") === "1";
const BLOOM_ON = captureParam("bloom") !== "0";
const SHADOW_ON = captureParam("shadow") !== "0";
// 종이 배경: 컴포저 경로(OutputPass)에선 배경도 톤매핑되므로 밝게 잡고, 바로 그리는 낮 경로에선 종이색 그대로
const PAPER_POST = new THREE.Color("#fbf7ef");
const PAPER_DIRECT = new THREE.Color("#ebe7e0");
// 블록 흔들기(라군과 같은 푸딩 모델, 블록이 높아 전단 상한은 낮게): 손 1px 당 전단 · 상한 · 전단 스프링 · 바닥이 손을 따라가는 비율 · 전단²에 비례한 눌림
const JELLY = { shearPerPx: 0.0012, max: 0.12, omega: 2 * Math.PI * 1.8, zeta: 0.09, basePerPx: 0.003, baseMax: 0.45, squash: 1.5 };
const CAM_RIGHT = { x: Math.cos(AZ), z: -Math.sin(AZ) }; // 화면 오른쪽
const CAM_BACK = { x: Math.sin(AZ), z: Math.cos(AZ) }; // 화면 아래(카메라 쪽)

function Scene({ spec, onReady }: { spec: DioramaSpec; onReady?: () => void }) {
  const { gl, scene, camera, size } = useThree();
  const { block: B } = spec;
  const built = useMemo(() => {
    const kit = new Kit(spec.seed);
    const block = new THREE.Group();
    block.matrixAutoUpdate = false; // 흔들기 행렬을 직접 쓴다
    const b = spec.build(kit);
    block.add(...b.roots);
    // 종이 위 블록 그림자 (블록 밖)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshBasicMaterial({ map: radialTex("rgba(60,50,40,.35)", "rgba(60,50,40,0)"), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1.5, B.TOP - B.LAND_H - B.STRATA - 0.6, 1.5);
    // 정적 메시는 재질별로 합친다. 통째로 움직이는 그룹은 그 안에서 따로 합친다
    bakeStatic(block);
    for (const g of b.bakeGroups ?? []) bakeStatic(g);
    const ripples = b.water ? attachRipples(b.water.material) : null;
    const waterPlane = b.water ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.water.y) : null;
    return { kit, block, shadow, ticks: b.ticks, water: b.water, ripples, waterPlane };
  }, [spec, B]);

  const L = spec.light;
  const day = useMemo(
    () => ({
      hemiSky: L.hemiSky.map((c) => new THREE.Color(c)),
      hemiGround: L.hemiGround.map((c) => new THREE.Color(c)),
      sun: L.sun.map((c) => new THREE.Color(c)),
      sunPos: L.sunPos.map((p) => new THREE.Vector3(...p)),
      last: -1,
    }),
    [L],
  );
  // 조명: 반구광 + 그림자 방향광 (낮/밤 보간)
  const lights = useMemo(() => {
    const hemi = new THREE.HemisphereLight(L.hemiSky[0], L.hemiGround[0], L.hemiI[0]);
    const sun = new THREE.DirectionalLight(L.sun[0], L.sunI[0]);
    sun.castShadow = SHADOW_ON;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    return { hemi, sun };
  }, [L]);

  useEffect(() => {
    scene.background = PAPER_DIRECT.clone();
    return () => {
      scene.background = null;
    };
  }, [scene]);

  // 후처리: 앰비언트 오클루전(그림자 고임) + 밤 블룸
  const post = useMemo(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 1, 1);
    ao.blendIntensity = 0.7;
    ao.enabled = AO_ON;
    composer.addPass(ao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), spec.bloom.strength, spec.bloom.radius, 1.0);
    // 블룸은 번짐이라 1/4 해상도로 충분하다 (전체 해상도 블룸이 밤 GPU 시간의 절반을 먹었다)
    const bloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w: number, h: number) => bloomSize(Math.ceil(w / 4), Math.ceil(h / 4));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom };
  }, [gl, scene, camera, spec]);
  useEffect(() => {
    post.composer.setPixelRatio(gl.getPixelRatio());
    post.composer.setSize(size.width, size.height);
  }, [post, gl, size]);
  useEffect(() => () => post.composer.dispose(), [post]);

  const focus = useMemo(() => spec.foci[captureParam("focus") ?? ""] ?? null, [spec]);
  const look = useMemo(() => (focus ? new THREE.Vector3(focus[0], focus[1], focus[2]) : new THREE.Vector3(...spec.look)), [focus, spec]);

  // ── 조작: 물을 누르거나 끌면 파문, 땅·지층을 잡고 끌면 푸딩 흔들림 ──
  const jelly = useRef({ grabbing: false, x0: 0, y0: 0, tx: 0, tz: 0, sx: 0, sz: 0, vx: 0, vz: 0, btx: 0, btz: 0, bx: 0, bz: 0 });
  const drag = useRef<{ mode: "none" | "water" | "grab"; lx: number; lz: number }>({ mode: "none", lx: 0, lz: 0 });
  const hitWater = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!built.waterPlane || !built.water) return null;
      const p = e.ray.intersectPlane(built.waterPlane, new THREE.Vector3());
      return p && built.water.contains(p.x, p.z) ? p : null;
    },
    [built],
  );
  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      const p = e.object.userData.side ? null : hitWater(e);
      if (p && built.ripples) {
        built.ripples.push(p.x, p.z, 1.2);
        drag.current = { mode: "water", lx: p.x, lz: p.z };
      } else {
        drag.current.mode = "grab";
        Object.assign(jelly.current, { grabbing: true, x0: e.clientX, y0: e.clientY });
      }
    },
    [built, hitWater],
  );
  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current;
      if (d.mode === "water") {
        const p = hitWater(e);
        if (p && built.ripples && Math.hypot(p.x - d.lx, p.z - d.lz) > 0.35) {
          built.ripples.push(p.x, p.z, 0.7);
          d.lx = p.x;
          d.lz = p.z;
        }
      } else if (d.mode === "grab") {
        const j = jelly.current, dx = e.clientX - j.x0, dy = e.clientY - j.y0;
        const wx = dx * CAM_RIGHT.x + dy * CAM_BACK.x, wz = dx * CAM_RIGHT.z + dy * CAM_BACK.z;
        const c = THREE.MathUtils.clamp;
        j.tx = c(wx * JELLY.shearPerPx, -JELLY.max, JELLY.max);
        j.tz = c(wz * JELLY.shearPerPx, -JELLY.max, JELLY.max);
        j.btx = c(wx * JELLY.basePerPx, -JELLY.baseMax, JELLY.baseMax);
        j.btz = c(wz * JELLY.basePerPx, -JELLY.baseMax, JELLY.baseMax);
      }
    },
    [built, hitWater],
  );
  const onUp = useCallback(() => {
    drag.current.mode = "none";
    Object.assign(jelly.current, { grabbing: false, tx: 0, tz: 0, btx: 0, btz: 0 });
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    built.ripples?.update(t);
    // 푸딩 흔들림: 전단 스프링(감쇠) + 바닥 따라가기 → 블록 행렬
    const j = jelly.current, w = JELLY.omega, h = Math.min(dt, 1 / 30) / 4;
    for (let i = 0; i < 4; i++) {
      j.vx += (-w * w * (j.sx - j.tx) - 2 * JELLY.zeta * w * j.vx) * h;
      j.vz += (-w * w * (j.sz - j.tz) - 2 * JELLY.zeta * w * j.vz) * h;
      j.sx += j.vx * h;
      j.sz += j.vz * h;
    }
    const f = 1 - Math.exp(-dt * 8);
    j.bx += (j.btx - j.bx) * f;
    j.bz += (j.btz - j.bz) * f;
    const sy = 1 - JELLY.squash * (j.sx * j.sx + j.sz * j.sz), y0 = B.TOP - B.LAND_H - B.STRATA;
    built.block.matrix.set(1, j.sx, 0, j.bx - j.sx * y0, 0, sy, 0, y0 - sy * y0, 0, j.sz, 1, j.bz - j.sz * y0, 0, 0, 0, 1);
    built.block.matrixWorldNeedsUpdate = true;
    if (DEBUG_ON) publishDebug(spec.id, { mode: drag.current.mode, sx: j.sx, sz: j.sz, tx: j.tx, tz: j.tz, night: day.last });
    // 하루 주기
    const k = nightOf(dayHour());
    if (Math.abs(k - day.last) > 1e-3) {
      day.last = k;
      built.kit.setNight(k);
      lights.hemi.color.copy(day.hemiSky[0]).lerp(day.hemiSky[1], k);
      lights.hemi.groundColor.copy(day.hemiGround[0]).lerp(day.hemiGround[1], k);
      lights.hemi.intensity = THREE.MathUtils.lerp(L.hemiI[0], L.hemiI[1], k);
      lights.sun.color.copy(day.sun[0]).lerp(day.sun[1], k);
      lights.sun.intensity = THREE.MathUtils.lerp(L.sunI[0], L.sunI[1], k);
      lights.sun.position.copy(day.sunPos[0]).lerp(day.sunPos[1], k);
      post.bloom.strength = spec.bloom.strength * k;
      post.bloom.enabled = BLOOM_ON && k > 0.02;
    }
    for (const tick of built.ticks) tick(t, day.last);
    // 카메라: 화면비에 맞춰 거리만 바꾼다
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const r = focus ? focus[3] : CAM.r * (aspect < 1 ? 1.4 / aspect : aspect < 1.6 ? 1.6 / aspect : 1);
    cam.position.set(look.x + Math.sin(AZ) * Math.cos(EL) * r, look.y + Math.sin(EL) * r, look.z + Math.cos(AZ) * Math.cos(EL) * r);
    cam.lookAt(look);
    // 후처리가 필요할 때만 컴포저 (낮엔 캔버스에 바로 — MSAA 도 살고 GPU 도 아낀다)
    if (post.bloom.enabled || AO_ON) {
      (scene.background as THREE.Color).copy(PAPER_POST);
      post.composer.render();
    } else {
      (scene.background as THREE.Color).copy(PAPER_DIRECT);
      state.gl.render(scene, cam);
    }
  }, 1);

  const sideH = B.LAND_H + B.STRATA + 0.55; // 옆면 히트 상자 높이 (아래 지층 띠·둥근 모서리까지)
  return (
    <>
      <primitive object={lights.hemi} />
      <primitive object={lights.sun} />
      <primitive object={built.block} />
      <primitive object={built.shadow} />
      {/* 포인터 히트: 윗면 평면(물이면 파문, 땅이면 잡기) + 옆면 상자(지층 잡기). 보이지 않는 단순 도형만 레이캐스트한다 */}
      <mesh visible={false} position={[0, B.TOP, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <planeGeometry args={[B.W, B.D]} />
      </mesh>
      <mesh visible={false} userData={{ side: true }} position={[0, B.TOP - sideH / 2 - 0.02, 0]} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <boxGeometry args={[B.W + 0.3, sideH, B.D + 0.3]} />
      </mesh>
      <Precompile onReady={onReady} />
    </>
  );
}

export function DioramaScene({ spec, onReady }: { spec: DioramaSpec; onReady?: () => void }) {
  return (
    <GlBoundary onFail={onReady}>
      <Canvas
        frameloop="never" // 셰이더 워밍업(Precompile)이 끝나면 always
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.8]}
        camera={{ fov: CAM.fov, position: [20, 20, 30], near: 0.5, far: 300 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ touchAction: "none" }}
        role="img"
        aria-label={spec.ariaLabel}
      >
        <Scene spec={spec} onReady={onReady} />
      </Canvas>
    </GlBoundary>
  );
}
