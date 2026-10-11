/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CreatureConfig, Species } from "@/store/species";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import type { CreatureMotion } from "@/components/creature/motion";
import { PlushCreature } from "@/components/creature/PlushCreature";
import { asShark } from "@/components/creature/registry";
import { ExtraTargets, Precompile } from "@/components/three/precompile";
import { GlBoundary } from "@/components/ui/GlBoundary";
import {
  FLAVOURS,
  LightShaftMaterial,
  SandFloorMaterial,
  StrataMaterial,
  WaterSideMaterial,
  WaterSurfaceMaterial,
} from "./waterMaterials";
import { BLOCK_CORNER, roundedPlate, roundedSlab, slabProfile } from "./tankGeometry";
import { SimDebugMaterial, WaterSim } from "./waterSim";
import { floorHeight, S } from "./lagoonHeight";
import { blobShadowTexture, blocked, BOUNDS, pushAway, randomTarget, TANK, yawDelta } from "./lagoonNav";
import { LagoonSwimmer } from "./LagoonSwimmer";
import { SWIMMERS } from "./swimBehaviours";
import { LagoonDay, SKY_LAYER } from "./LagoonDay";
import { Palms } from "./Palms";
import { Reef, REEFS } from "./Reef";
import { ReefFish } from "./ReefFish";
import { BUNGALOWS, Resort, TORCHES } from "./Resort";
import { GUEST_FOCUS, Guests } from "./Guests";
import { Shadows } from "./Shadows";

interface Props {
  creatures: Record<Species, CreatureConfig>;
  /** 물 색 (waterMaterials.FLAVOURS 의 id) */
  flavour: string;
  /** 셰이더 워밍업이 끝나 첫 프레임을 그릴 준비가 됐을 때 */
  onReady?: () => void;
}

// 수조 치수(lagoonNav.TANK): 젤리 블록 같은 둥근 라군
const { W, D, TOP, BOTTOM } = TANK;
const STRATA_H = 1.35;
const CORNER = BLOCK_CORNER; // 둘레 모서리 반지름
const SHARK_SCALE = 0.42; // 몸길이 ≈ 1.4 (돌고래 1.15 의 1.2배)
const SHADOW_K = SHARK_SCALE / 0.66; // 그림자 크기는 0.66 기준으로 적어둔 값
// 카메라: 디오라마처럼 위에서 비스듬히 내려다본다 (방위각·앙각 고정)
const CAM = { az: 35, el: 34, r: 40, fov: 26, lookY: -1.3 }; // r 은 맵 17×13.6 + 뚜껑이 데스크톱 프레임에 들어오는 거리
const CAM_AZ = THREE.MathUtils.degToRad(CAM.az);
const CAM_EL = THREE.MathUtils.degToRad(CAM.el);
// 카메라 기준 xz 축: 화면 오른쪽 / 카메라 뒤쪽(= 화면 아래, 가까운 쪽)
const CAM_RIGHT = { x: Math.cos(CAM_AZ), z: -Math.sin(CAM_AZ) };
const CAM_BACK = { x: Math.sin(CAM_AZ), z: Math.cos(CAM_AZ) };
// 블록 흔들기(푸딩): 아래(지층·모래)를 잡고 끌면 바닥이 손을 조금 따라가고 윗부분은 전단으로 크게 휘청이며(물도 통째로), 놓으면 젤리처럼 출렁이다 멈춘다.
// 파도 물리는 무시한다 — 수면은 블록과 함께 움직일 뿐 쏠리지 않는다.
// shearPerPx: 손 1px 당 전단 목표(높이당 변위) · max: 전단 상한(윗면 변위 = max × 블록 높이 4.15) · omega/zeta: 전단 스프링 · base: 바닥이 손을 따라가는 비율(월드/px) · tilt: 전단에 딸린 작은 기울기 · squash: 전단²에 비례한 눌림
const JELLY = { shearPerPx: 0.0022, max: 0.26, omega: 2 * Math.PI * 2.0, zeta: 0.085, basePerPx: 0.004, baseMax: 0.6, tilt: 0.22, squash: 1.2 };
const BLOCK_BOTTOM = BOTTOM - STRATA_H;
const BLOCK_MID = (TOP + BOTTOM - STRATA_H) / 2; // 기울기 피벗 높이
// ?shear=x,z — 정적 전단 (캡처용)
const SHEAR_PARAM = (captureParam("shear") ?? "").split(",").map(Number);
const STATIC_SHEAR = SHEAR_PARAM.length === 2 && SHEAR_PARAM.every((v) => Number.isFinite(v)) ? { x: SHEAR_PARAM[0], z: SHEAR_PARAM[1] } : null;
// 굴절 텍스처 배율: 데스크톱 0.75, 좁은 화면(폰)은 GPU 가 약하고 화면도 작아 0.5. ?rt=0.5 로 강제(점검용)
const RT_OVERRIDE = Number(captureParam("rt")) || 0;
const refractScale = (cssWidth: number) => RT_OVERRIDE || (cssWidth < 800 ? 0.5 : 0.75);
const SIM_DEBUG = !!captureParam("simdebug");
// ?focus=<산호 군락 id> — 그 군락을 가까이서 본다 (점검용)
const FOCUS_REEF = REEFS.find((r) => r.id === captureParam("focus")) ?? null;
// ?focus=guests — 손님 커플을 따라가는 근접 뷰 (점검용)
const FOCUS_GUESTS = captureParam("focus") === "guests";
const GUESTS_OFF = captureParam("guests") === "0"; // ?guests=0 — 손님 끄기 (성능 A/B 점검용)
const CALM_PARAM = Number(captureParam("calm")) || 0; // ?calm= 감쇠 덮어쓰기 (점검용, 0 이면 시뮬 기본값)
// 포인터가 수면을 파는 세기 (시뮬 높이 단위 — uAmp 배율 전)
const PRESS = { down: -0.3, downR: 0.9, drag: -0.045, dragR: 0.85, holdDepth: -0.22, holdR: 0.9, hover: -0.025, hoverR: 0.5, spacing: 0.15 };

interface Ai {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  target: THREE.Vector3;
  retarget: number;
  turnRate: number;
}

const rockMat = new THREE.MeshStandardMaterial({ color: "#eadbb8", roughness: 0.95, flatShading: true });
const weedMat = new THREE.MeshStandardMaterial({ color: "#5fbf78", roughness: 0.9 });
const bubbleMat = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, roughness: 0.1 });
const snowMat = new THREE.PointsMaterial({ color: "#ffffff", size: 0.05, transparent: true, opacity: 0.18, depthWrite: false, sizeAttenuation: true });
const SHAFTS = [
  { x: 1.2, z: -1.4, w: 1.1, rot: 0.3 },
  { x: 2.6, z: 0.4, w: 1.4, rot: -0.4 },
  { x: 3.8, z: -2.0, w: 0.9, rot: 0.9 },
  { x: -2.6, z: 2.4, w: 1.0, rot: -1.1 },
  { x: 0.2, z: 1.6, w: 0.8, rot: 0.6 },
  { x: 1.0, z: 3.0, w: 1.2, rot: -0.2 },
].map((sh) => ({ ...sh, x: sh.x * S, z: sh.z * S }));

function Scene({ creatures, flavour, onReady }: Props) {
  const { camera, gl } = useThree();
  const sharkRoot = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  // 블록 전체 그룹(행렬은 useFrame 이 합성해 직접 쓴다) + 흔들림 상태
  const block = useRef<THREE.Group>(null!);
  // grabbing/px/py: 잡은 화면 좌표, tx/tz: 전단 목표, sx/sz: 전단(높이당 변위), vx/vz: 전단 속도, bx/bz: 바닥 변위(목표 btx/btz)
  const jelly = useRef({ grabbing: false, px: 0, py: 0, tx: 0, tz: 0, sx: 0, sz: 0, vx: 0, vz: 0, btx: 0, btz: 0, bx: 0, bz: 0 });
  const bubbles = useRef<THREE.InstancedMesh>(null!);
  const rocksRef = useRef<THREE.InstancedMesh>(null!);
  const stems = useRef<THREE.InstancedMesh>(null!);
  const leaves = useRef<THREE.InstancedMesh>(null!);
  const motion = useRef<CreatureMotion>({ beat: 1, amp: 1, turn: 0 });
  // 생물 위치 벡터는 씬이 소유하고 각 AI 가 제자리에서 갱신한다 — 서로 피할 때 같은 벡터를 본다
  const positions = useMemo(() => Object.fromEntries(SWIMMERS.map((b) => [b.species, new THREE.Vector3()])) as Record<string, THREE.Vector3>, []);
  const sharkPos = useMemo(() => new THREE.Vector3(1.5, -1.4, 1.5), []);
  const everyone = useMemo(() => [sharkPos, ...Object.values(positions)], [sharkPos, positions]);
  const sharkAvoid = useMemo(() => Object.values(positions), [positions]);
  const ai = useRef<Ai | null>(null);
  if (ai.current == null) {
    ai.current = {
      pos: sharkPos,
      yaw: 0.5,
      pitch: 0,
      roll: 0,
      speed: 0.9,
      target: randomTarget(new THREE.Vector3()),
      retarget: 0,
      turnRate: 0,
    };
  }
  // 포인터 상태: 마지막 수면 좌표(궤적 보간용)와 누름 여부(누른 채 멈춰 있으면 계속 판다)
  const pointer = useRef({ x: 0, z: 0, has: false, down: false });

  // 수면은 물 옆면 둘레와 같은 둥근 사각형으로 잘린다
  const surfaceMat = useMemo(() => new WaterSurfaceMaterial(W / 2, D / 2, CORNER, TOP, BOTTOM), []);
  const surfaceMesh = useRef<THREE.Mesh>(null!);
  // 수면 높이장 시뮬 (핑퐁 렌더타깃) — 파임·벽 반사·간섭
  const sim = useMemo(() => new WaterSim(W, D), []);
  const simDebugMat = useMemo(() => (SIM_DEBUG ? new SimDebugMaterial() : null), []);
  useEffect(() => sim.compile(gl), [sim, gl]); // 셰이더 워밍업 (첫 프레임 긴 작업 방지)
  // 수면 아래 장면: 수면만 숨기고 한 번 더 그려서 굴절 텍스처로 쓴다 (0.75 배 해상도)
  const below = useMemo(() => new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, samples: 0 }), []);
  const extraTargets = useMemo(() => [below], [below]);
  const clearTmp = useMemo(() => new THREE.Color(), []);
  const sideMat = useMemo(() => new WaterSideMaterial(TOP, BOTTOM), []);
  const floorMat = useMemo(() => new SandFloorMaterial(TOP, BOTTOM, W / 2, D / 2, CORNER), []);
  // 밤 빛 웅덩이 자리: 방갈로 수중등(수면) · 섬 횃불(모래)
  useEffect(() => {
    BUNGALOWS.forEach((b, i) => (surfaceMat.uniforms.uPools.value as THREE.Vector2[])[i].set(b.x, b.z));
    TORCHES.forEach(([x, z], i) => (floorMat.uniforms.uTorches.value as THREE.Vector2[])[i].set(x, z));
  }, [surfaceMat, floorMat]);
  const strataMat = useMemo(() => new StrataMaterial(BOTTOM), []);
  const shadowTex = useMemo(() => blobShadowTexture(), []);
  const shaftMat = useMemo(() => new LightShaftMaterial(), []);
  // 빛줄기 6장을 한 지오메트리로 (흔들림 위상은 정점 속성 aSeed)
  const shaftGeo = useMemo(() => {
    const m = new THREE.Matrix4();
    const geos = SHAFTS.map((sh, i) => {
      const g = new THREE.PlaneGeometry(sh.w, TOP - BOTTOM);
      m.compose(new THREE.Vector3(sh.x, (TOP + BOTTOM) / 2, sh.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sh.rot, 0)), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count).fill(i), 1));
      return g;
    });
    const merged = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    return merged;
  }, []);
  // 물 옆면: 둥근 둘레, 윗모서리는 곧게 (위는 수면이 덮고 젤리 큐브 뚜껑 벽이 이어진다)
  const sideGeo = useMemo(() => roundedSlab(W / 2, D / 2, CORNER, slabProfile(BOTTOM, TOP, 0, 0)), []);
  // 지층: 옆면 + 윗판 (모래가 솟은 자리 아래로 속이 비치지 않게 덮는다)
  const strataGeo = useMemo(() => {
    const side = roundedSlab(W / 2, D / 2, CORNER, slabProfile(BOTTOM - STRATA_H, BOTTOM, 0, 0.4));
    const cap = roundedPlate(W / 2, D / 2, CORNER).translate(0, BOTTOM - 0.002, 0);
    cap.deleteAttribute("uv"); // 옆면에는 uv 가 없어 합치려면 맞춰야 한다
    const merged = mergeGeometries([side, cap], false)!;
    side.dispose();
    cap.dispose();
    return merged;
  }, []);
  // 모래 바닥: 높이맵으로 섬을 올린 격자 (둥근 둘레 바깥은 셰이더에서 버린다)
  const floorGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, 120, 96);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, floorHeight(BOTTOM, pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  // 부유 입자 (마린 스노우)
  const snow = useMemo(() => {
    const n = 70;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(W * 0.9);
      arr[i * 3 + 1] = THREE.MathUtils.randFloat(BOTTOM + 0.1, TOP - 0.1);
      arr[i * 3 + 2] = THREE.MathUtils.randFloatSpread(D * 0.9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      e: new THREE.Euler(),
      m: new THREE.Matrix4(),
      m2: new THREE.Matrix4(),
      m3: new THREE.Matrix4(),
    }),
    [],
  );
  const bubbleState = useMemo(
    () =>
      Array.from({ length: 44 }, () => ({
        x: THREE.MathUtils.randFloatSpread(W * 0.8),
        z: THREE.MathUtils.randFloatSpread(D * 0.8),
        y: THREE.MathUtils.randFloat(BOTTOM, TOP),
        s: THREE.MathUtils.randFloat(0.3, 1),
        r: THREE.MathUtils.randFloat(0.012, 0.03),
      })),
    [],
  );
  const rocks = useMemo(
    () =>
      (
        [
          { x: 3.6, z: -2.4, s: 0.3, r: 2.1 },
          { x: 4.0, z: -2.0, s: 0.18, r: 0.7 },
          { x: 0.8, z: 3.0, s: 0.2, r: 1.9 },
          { x: -0.8, z: 1.5, s: 0.26, r: 0.4 },
          { x: 1.9, z: 0.4, s: 0.2, r: 1.5 },
          { x: -3.0, z: -0.9, s: 0.22, r: 2.6 }, // 섬 물가
          { x: -1.4, z: -1.4, s: 0.16, r: 1.2 },
        ] as { x: number; z: number; s: number; r: number }[]
      ).map((r) => ({ p: [r.x * S, floorHeight(BOTTOM, r.x * S, r.z * S) + r.s * 0.35, r.z * S] as [number, number, number], s: r.s, r: r.r })),
    [],
  );
  const weedList = useMemo(
    () =>
      (
        [
          { x: 3.3, z: 1.9, h: 1.0, ph: 0 },
          { x: 3.6, z: 1.5, h: 0.8, ph: 1.2 },
          { x: -3.6, z: 2.6, h: 1.1, ph: 2.1 },
          { x: -3.9, z: 2.2, h: 0.8, ph: 0.6 },
          { x: 0.9, z: -3.3, h: 0.9, ph: 1.9 },
          { x: 1.3, z: -3.1, h: 0.7, ph: 2.8 },
        ] as { x: number; z: number; h: number; ph: number }[]
      ).map((w) => ({ p: [w.x * S, w.z * S] as [number, number], y: floorHeight(BOTTOM, w.x * S, w.z * S) - 0.05, h: w.h, ph: w.ph })),
    [],
  );

  useEffect(
    () => () => {
      surfaceMat.dispose();
      sim.dispose();
      simDebugMat?.dispose();
      below.dispose();
      sideMat.dispose();
      floorMat.dispose();
      strataMat.dispose();
      shadowTex.dispose();
      shaftMat.dispose();
      shaftGeo.dispose();
      sideGeo.dispose();
      strataGeo.dispose();
      floorGeo.dispose();
      snow.dispose();
    },
    [surfaceMat, sim, simDebugMat, below, sideMat, floorMat, strataMat, shadowTex, shaftMat, shaftGeo, sideGeo, strataGeo, floorGeo, snow],
  );

  // 물 색
  useEffect(() => {
    const f = FLAVOURS.find((x) => x.id === flavour) ?? FLAVOURS[0];
    surfaceMat.uniforms.uShallow.value.set(f.shallow);
    surfaceMat.uniforms.uDeep.value.set(f.deep);
    sideMat.uniforms.uShallow.value.set(f.shallow);
    sideMat.uniforms.uDeep.value.set(f.deep);
    floorMat.uniforms.uTint.value.set(f.tint);
  }, [flavour, surfaceMat, sideMat, floorMat]);

  useEffect(() => {
    if (CALM_PARAM) sim.setCalm(CALM_PARAM);
  }, [sim]);

  /** 무언가 수면에 떨어지거나 뚫고 나올 때: strength 1 = 돌고래 점프 정도. 파였다가 되튄다 */
  const splash = useCallback((x: number, z: number, strength: number) => sim.push(x, z, 0.35 + 0.3 * strength, -0.25 * strength), [sim]);

  useEffect(() => {
    const inst = rocksRef.current;
    const m = new THREE.Matrix4();
    rocks.forEach((r, i) => {
      m.compose(new THREE.Vector3(...r.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.r, r.r * 1.7, 0)), new THREE.Vector3(r.s * 1.3, r.s, r.s));
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
  }, [rocks]);

  // 블록 잡기: 지층 히트 박스나 모래(섬)를 누르면 포인터를 캡처해 메시 밖·캔버스 밖에서도 move/up 을 받는다 (빠르게 흔들면 포인터가 메시를 벗어난다)
  const onBlockDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const j = jelly.current;
    j.grabbing = true;
    j.px = e.nativeEvent.clientX;
    j.py = e.nativeEvent.clientY;
  };
  const onBlockMove = (e: ThreeEvent<PointerEvent>) => {
    const j = jelly.current;
    if (!j.grabbing) return;
    const dx = e.nativeEvent.clientX - j.px, dy = e.nativeEvent.clientY - j.py;
    // 화면 가로 = 카메라 right(xz), 화면 아래 = 카메라 쪽 → 손 변위 d(월드 xz)
    const wx = CAM_RIGHT.x * dx + CAM_BACK.x * dy;
    const wz = CAM_RIGHT.z * dx + CAM_BACK.z * dy;
    // 전단 목표: 잡은 바닥이 d 로 움직이면 윗부분은 관성으로 뒤에 남는다 → 전단은 −d 방향
    j.tx = THREE.MathUtils.clamp(-wx * JELLY.shearPerPx, -JELLY.max, JELLY.max);
    j.tz = THREE.MathUtils.clamp(-wz * JELLY.shearPerPx, -JELLY.max, JELLY.max);
    j.btx = THREE.MathUtils.clamp(wx * JELLY.basePerPx, -JELLY.baseMax, JELLY.baseMax);
    j.btz = THREE.MathUtils.clamp(wz * JELLY.basePerPx, -JELLY.baseMax, JELLY.baseMax);
  };
  const onBlockUp = (e: ThreeEvent<PointerEvent>) => {
    const j = jelly.current;
    if (!j.grabbing) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    j.grabbing = false;
    j.tx = j.tz = j.btx = j.btz = 0;
  };
  const blockHandlers = { onPointerDown: onBlockDown, onPointerMove: onBlockMove, onPointerUp: onBlockUp, onPointerCancel: onBlockUp };

  // 수면 누름 = 깊게 파임, 끌기 = 지나간 자리가 한 줄의 골로 파임(직전 점과 보간), 그냥 지나가도 얕게 파인다
  const onSurfaceDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = pointer.current;
    p.x = e.point.x;
    p.z = e.point.z;
    p.has = true;
    p.down = true;
    sim.push(p.x, p.z, PRESS.downR, PRESS.down);
  };
  const onSurfaceUp = () => {
    pointer.current.down = false;
  };
  const onSurfaceMove = (e: ThreeEvent<PointerEvent>) => {
    if (jelly.current.grabbing) return; // 블록을 흔드는 중엔 수면을 파지 않는다
    const p = pointer.current;
    const down = e.buttons === 1 || (e.pointerType === "touch" && e.buttons > 0);
    const x = e.point.x, z = e.point.z;
    if (!p.has) {
      p.x = x;
      p.z = z;
      p.has = true;
    }
    const dx = x - p.x, dz = z - p.z;
    const dist = Math.hypot(dx, dz);
    if (!down && dist < 0.04) return; // 미동은 쌓아 두었다가 한 번에 (안 보이는 임펄스로 슬롯을 먹지 않게)
    // 궤적을 spacing 간격으로 잘라 넣는다 (빠르게 끌어도 골이 끊기지 않게)
    const n = Math.max(1, Math.min(6, Math.ceil(dist / PRESS.spacing)));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (down) sim.push(p.x + dx * k, p.z + dz * k, PRESS.dragR, PRESS.drag);
      else sim.push(p.x + dx * k, p.z + dz * k, PRESS.hoverR, PRESS.hover * Math.min(1, dist * 6));
    }
    p.x = x;
    p.z = z;
    p.down = down;
  };
  const onSurfaceLeave = () => {
    pointer.current.has = false;
    pointer.current.down = false;
  };

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    surfaceMat.uniforms.uTime.value = t;
    sideMat.uniforms.uTime.value = t;
    floorMat.uniforms.uTime.value = t;
    surfaceMat.uniforms.uCamPos.value.copy(camera.position);
    sideMat.uniforms.uCamPos.value.copy(camera.position);
    shaftMat.uniforms.uTime.value = t;

    // 푸딩 흔들림: 전단은 목표(손)를 향한 언더댐핑 스프링, 바닥은 손을 빠르게 따라간다. 놓으면 둘 다 0 으로 — 전단은 출렁이며 멈춘다
    {
      const j = jelly.current;
      if (STATIC_SHEAR) {
        j.sx = STATIC_SHEAR.x;
        j.sz = STATIC_SHEAR.z;
      } else {
        const k = JELLY.omega * JELLY.omega, c = 2 * JELLY.zeta * JELLY.omega;
        j.vx += (-k * (j.sx - j.tx) - c * j.vx) * dt;
        j.vz += (-k * (j.sz - j.tz) - c * j.vz) * dt;
        j.sx += j.vx * dt;
        j.sz += j.vz * dt;
        j.bx += (j.btx - j.bx) * Math.min(1, dt * 12);
        j.bz += (j.btz - j.bz) * Math.min(1, dt * 12);
      }
      // 블록 행렬 = 바닥 변위 · (BLOCK_MID 피벗의 작은 기울기) · (바닥 피벗의 스쿼시 · 전단)
      const q = Math.min(0.25, JELLY.squash * (j.sx * j.sx + j.sz * j.sz));
      const m = tmp.m.makeTranslation(j.bx, 0, j.bz);
      m.multiply(tmp.m2.makeTranslation(0, BLOCK_MID, 0));
      m.multiply(tmp.m2.makeRotationFromEuler(tmp.e.set(JELLY.tilt * j.sz, 0, -JELLY.tilt * j.sx)));
      m.multiply(tmp.m2.makeTranslation(0, BLOCK_BOTTOM - BLOCK_MID, 0));
      m.multiply(tmp.m2.makeScale(1 + q * 0.5, 1 - q, 1 + q * 0.5));
      m.multiply(tmp.m2.makeShear(j.sx, 0, 0, 0, 0, j.sz)); // x += sx·y, z += sz·y (y 는 바닥 기준)
      m.multiply(tmp.m2.makeTranslation(0, -BLOCK_BOTTOM, 0));
      block.current.matrix.copy(m);
      block.current.matrixWorldNeedsUpdate = true;
      if (DEBUG_ON) publishDebug("jelly", { sx: +j.sx.toFixed(4), sz: +j.sz.toFixed(4), bx: +j.bx.toFixed(3), bz: +j.bz.toFixed(3), q: +q.toFixed(4), grabbing: j.grabbing });
    }
    // 수면 시뮬: 누르고 있는 동안 그 자리를 손가락처럼 눌러 그릇을 유지한다 (떼면 되튀어 링이 퍼진다)
    if (pointer.current.down) sim.setPress(pointer.current.x, pointer.current.z, PRESS.holdR, PRESS.holdDepth);
    else sim.clearPress();
    sim.update(state.gl, dt);
    surfaceMat.uniforms.uHeight.value = sim.texture;
    if (simDebugMat) simDebugMat.uniforms.uTex.value = sim.texture;

    // 부유 입자: 천천히 떠다닌다
    const sp = snow.attributes.position as THREE.BufferAttribute;
    const sa = sp.array as Float32Array;
    for (let i = 0; i < sp.count; i++) {
      sa[i * 3 + 1] -= dt * 0.03;
      sa[i * 3] += Math.sin(t * 0.4 + i) * dt * 0.02;
      if (sa[i * 3 + 1] < BOTTOM + 0.05) sa[i * 3 + 1] = TOP - 0.1;
    }
    sp.needsUpdate = true;

    // 카메라
    const aspect = state.size.width / state.size.height;
    // 좁은 화면이면 뒤로 물러나 수조 폭을 다 담는다. 세로 화면은 대각선이 화면 폭의 ≈ 80% 가 되게 (0.46 이면 r ≈ 112 — far 는 이보다 커야 한다)
    const r = CAM.r * (aspect < 1 ? 1.4 / aspect : aspect < 1.6 ? 1.6 / aspect : 1);
    // 오른쪽 패널만큼 화면 오른쪽(카메라 right 벡터)으로 목표점을 옮겨 블록을 남은 영역 가운데에 둔다
    const sx = aspect < 1 ? 0 : 0.9;
    const tx = CAM_RIGHT.x * sx;
    const tz = CAM_RIGHT.z * sx;
    const back = Math.cos(CAM_EL) * r;
    tmp.v.set(tx + CAM_BACK.x * back, -1.2 + Math.sin(CAM_EL) * r, tz + CAM_BACK.z * back);
    if (FOCUS_REEF) {
      // 점검용 근접 뷰: 군락 중심을 바라보며 가까이
      const fy = floorHeight(BOTTOM, FOCUS_REEF.x, FOCUS_REEF.z) + 0.3;
      const fr = 6.5;
      tmp.v.set(FOCUS_REEF.x + CAM_BACK.x * Math.cos(CAM_EL) * fr, fy + Math.sin(CAM_EL) * fr, FOCUS_REEF.z + CAM_BACK.z * Math.cos(CAM_EL) * fr);
      camera.position.copy(tmp.v);
      camera.lookAt(FOCUS_REEF.x, fy, FOCUS_REEF.z);
    } else if (FOCUS_GUESTS) {
      // 야자수 잎은 Palms 가 숨긴다 (점검용)
      const fr = 6.0, fel = THREE.MathUtils.degToRad(50);
      const f = GUEST_FOCUS;
      tmp.v.set(f.x + CAM_BACK.x * Math.cos(fel) * fr, f.y + Math.sin(fel) * fr, f.z + CAM_BACK.z * Math.cos(fel) * fr);
      camera.position.lerp(tmp.v, Math.min(1, dt * 4));
      camera.lookAt(f.x, f.y, f.z);
    } else {
      camera.position.lerp(tmp.v, Math.min(1, dt * 3));
      camera.lookAt(tx, aspect < 1 ? -3.8 : CAM.lookY, tz); // 세로 화면은 아래 패널에 안 가리게 수조를 위로
    }

    // 상어 AI
    const a = ai.current!;
    const targetSpeed = 1.15;

    a.retarget -= dt;
    if (a.retarget <= 0 || a.target.distanceTo(a.pos) < 0.6) {
      // 만타·거북 근처(3 이내)는 피해서 고른다
      for (let i = 0; i < 4; i++) {
        randomTarget(a.target);
        if (sharkAvoid.every((o) => Math.hypot(a.target.x - o.x, a.target.z - o.z) > 3.5)) break;
      }
      a.retarget = THREE.MathUtils.randFloat(4, 8);
    }

    const to = tmp.v.copy(a.target).sub(a.pos);
    // 회피: 코앞(0.9 앞)이 막혀 있으면 구역 중심 반대쪽으로 밀어낸다
    {
      const ax = a.pos.x + Math.cos(a.yaw) * 0.9;
      const az = a.pos.z - Math.sin(a.yaw) * 0.9;
      if (blocked(ax, a.pos.y, az, 0.3)) {
        pushAway(ax, az, to); // 얕은 바닥이면 위로
        a.retarget = Math.min(a.retarget, 0.5);
      }
    }
    // 만타·거북과 겹치지 않게 가벼운 분리
    for (const o of sharkAvoid) {
      const dx = a.pos.x - o.x, dz = a.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.2) {
        const k = (2.2 - d) * 3;
        to.x += (dx / Math.max(d, 0.05)) * k;
        to.z += (dz / Math.max(d, 0.05)) * k;
      }
    }
    const wantYaw = Math.atan2(-to.z, to.x);
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.35, 0.35); // 인형답게 완만히
    const dy = yawDelta(wantYaw, a.yaw, a.turnRate);
    const maxTurn = 1.5 * dt;
    const step = THREE.MathUtils.clamp(dy, -maxTurn, maxTurn);
    a.yaw += step;
    a.turnRate += (step / dt - a.turnRate) * Math.min(1, dt * 5);
    a.pitch += (wantPitch - a.pitch) * Math.min(1, dt * 2.5);
    a.speed += (targetSpeed - a.speed) * Math.min(1, dt * 2);

    const fwd = tmp.v2.set(Math.cos(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.sin(a.yaw) * Math.cos(a.pitch));
    a.pos.addScaledVector(fwd, a.speed * dt);
    // 벽에 부드럽게 갇히기
    a.pos.x = THREE.MathUtils.clamp(a.pos.x, -BOUNDS.x - 0.2, BOUNDS.x + 0.2);
    a.pos.z = THREE.MathUtils.clamp(a.pos.z, -BOUNDS.z - 0.2, BOUNDS.z + 0.2);
    a.pos.y = THREE.MathUtils.clamp(a.pos.y, Math.max(BOUNDS.yMin - 0.1, floorHeight(BOTTOM, a.pos.x, a.pos.z) + 0.4), BOUNDS.yMax + 0.1);
    if (Math.abs(a.pos.x) > BOUNDS.x || Math.abs(a.pos.z) > BOUNDS.z) {
      // 벽에 닿았는데 목표도 바깥쪽이면 가운데 쪽 새 목표 (매 프레임 다시 뽑으면 조향이 수렴하지 못한다)
      if (Math.abs(a.target.x) > BOUNDS.x * 0.7 || Math.abs(a.target.z) > BOUNDS.z * 0.7) {
        randomTarget(a.target).multiplyScalar(0.5);
        a.retarget = THREE.MathUtils.randFloat(4, 8);
      }
    }

    const bankRoll = THREE.MathUtils.clamp(-a.turnRate * 0.35, -0.6, 0.6);
    a.roll += (bankRoll - a.roll) * Math.min(1, dt * 3);

    const g = sharkRoot.current;
    g.position.copy(a.pos);
    g.position.y += Math.sin(t * 1.1) * 0.03;
    tmp.e.set(a.roll, a.yaw, a.pitch, "YZX");
    g.quaternion.setFromEuler(tmp.e);

    const m = motion.current;
    m.beat += (0.7 + a.speed * 0.15 - m.beat) * Math.min(1, dt * 3);
    m.amp = 0.6 + Math.min(0.3, a.speed * 0.15);
    m.turn += (THREE.MathUtils.clamp(a.turnRate * 0.5, -1, 1) - m.turn) * Math.min(1, dt * 5);

    // 그림자
    shadow.current.position.set(a.pos.x, floorHeight(BOTTOM, a.pos.x, a.pos.z) + 0.015, a.pos.z);
    shadow.current.rotation.z = -a.yaw;
    const depthK = 1 - (a.pos.y - BOTTOM) / (TOP - BOTTOM);
    shadow.current.scale.set((1.6 + (1 - depthK) * 0.8) * SHADOW_K, (0.9 + (1 - depthK) * 0.5) * SHADOW_K, 1);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + depthK * 0.5;

    if (DEBUG_ON) publishDebug("hammerheadNav", { pos: a.pos.toArray(), target: a.target.toArray(), speed: a.speed, retarget: a.retarget });


    // 버블
    const inst = bubbles.current;
    for (let i = 0; i < bubbleState.length; i++) {
      const b = bubbleState[i];
      b.y += dt * (0.25 + b.s * 0.3);
      if (b.y > TOP - 0.03) {
        b.y = BOTTOM + 0.05;
        b.x = THREE.MathUtils.randFloatSpread(W * 0.85);
        b.z = THREE.MathUtils.randFloatSpread(D * 0.85);
      }
      tmp.m.makeScale(b.r, b.r, b.r).setPosition(b.x + Math.sin(t * 2 + i) * 0.03, b.y, b.z);
      inst.setMatrixAt(i, tmp.m);
    }
    inst.instanceMatrix.needsUpdate = true;

    // 수초 흔들림: 뿌리 기준 회전을 인스턴스 행렬로 (줄기·잎 각 1 드로우)
    for (let i = 0; i < weedList.length; i++) {
      const def = weedList[i];
      tmp.e.set(Math.cos(t * 0.9 + def.ph) * 0.1, 0, Math.sin(t * 1.3 + def.ph) * 0.12);
      tmp.q.setFromEuler(tmp.e);
      tmp.v.set(def.p[0], def.y, def.p[1]);
      tmp.m.compose(tmp.v, tmp.q, tmp.v2.set(1, 1, 1));
      // 줄기: 뿌리에서 h/2 위, 높이 h 로 늘린다 (기준 캡슐 높이 1)
      tmp.m2.compose(tmp.v.set(0, def.h / 2, 0), tmp.q2.identity(), tmp.v2.set(1, def.h, 1)).premultiply(tmp.m);
      stems.current.setMatrixAt(i, tmp.m2);
      // 잎: 살짝 비껴 기울어진 짧은 캡슐
      tmp.m2.compose(tmp.v.set(0.1, def.h * 0.28, 0.04), tmp.q2.setFromEuler(tmp.e.set(0, 0, -0.4)), tmp.v2.set(1, def.h, 1)).premultiply(tmp.m);
      leaves.current.setMatrixAt(i, tmp.m2);
    }
    stems.current.instanceMatrix.needsUpdate = true;
    leaves.current.instanceMatrix.needsUpdate = true;

    // 굴절용 패스: 수면을 숨기고 장면을 렌더타깃에 그린다
    {
      const { gl, scene } = state;
      const dpr = state.viewport.dpr;
      const k = refractScale(state.size.width);
      const rw = Math.max(2, Math.floor(state.size.width * dpr * k));
      const rh = Math.max(2, Math.floor(state.size.height * dpr * k));
      if (below.width !== rw || below.height !== rh) below.setSize(rw, rh);
      surfaceMesh.current.visible = false;
      gl.getClearColor(clearTmp);
      const ca = gl.getClearAlpha();
      gl.setClearColor(0xf1eee8, 1); // 블록 밖은 종이색 (하늘 장난감은 레이어 1 이라 이 패스에서 빠진다)
      camera.layers.disable(SKY_LAYER);
      gl.setRenderTarget(below);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      camera.layers.enable(SKY_LAYER);
      gl.setClearColor(clearTmp, ca);
      surfaceMesh.current.visible = true;
      surfaceMat.uniforms.uBelow.value = below.texture;
      surfaceMat.uniforms.uResolution.value.set(state.size.width * dpr, state.size.height * dpr);
    }
  });

  return (
    <ExtraTargets.Provider value={extraTargets}>
      {/* 하루 주기: 하늘·해·달·별·조명 (실제 1시간 = 24시간) */}
      <LagoonDay />

      {/* 블록 전체: 아래 지층·모래를 잡고 흔들면 푸딩처럼 전단·스쿼시로 출렁인다 (행렬은 useFrame 이 직접 쓴다) */}
      <group ref={block} matrixAutoUpdate={false}>
      {/* 지층 */}
      <mesh geometry={strataGeo} material={strataMat} />
      {/* 지층 잡기용 히트 박스 (레이캐스트는 박스 12 tri 만) */}
      <mesh visible={false} position={[0, (BLOCK_BOTTOM + BOTTOM) / 2, 0]} {...blockHandlers}>
        <boxGeometry args={[W, BOTTOM - BLOCK_BOTTOM, D]} />
      </mesh>
      {/* 모래 바닥 (섬도 잡을 수 있다) */}
      <mesh geometry={floorGeo} material={floorMat} position={[0, 0.001, 0]} {...blockHandlers} />

      {/* 바위 / 수초 (인스턴스) */}
      <instancedMesh ref={rocksRef} args={[undefined, undefined, rocks.length]} material={rockMat}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={stems} args={[undefined, undefined, weedList.length]} material={weedMat} frustumCulled={false}>
        <capsuleGeometry args={[0.06, 0.88, 4, 8]} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, weedList.length]} material={weedMat} frustumCulled={false}>
        <capsuleGeometry args={[0.045, 0.5, 4, 8]} />
      </instancedMesh>

      <Palms bottom={BOTTOM} />
      <Reef bottom={BOTTOM} />
      <Resort bottom={BOTTOM} />
      {!GUESTS_OFF && <Guests bottom={BOTTOM} onSplash={splash} />}
      <Shadows top={TOP} groundY={BOTTOM - STRATA_H} halfX={W / 2} halfZ={D / 2} corner={CORNER} />

      {/* 빛줄기 (6장 → 1 메시) */}
      <mesh geometry={shaftGeo} material={shaftMat} />
      <points geometry={snow} material={snowMat} />

      {/* 상어 그림자 */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.9, 1.1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>

      {/* 상어 (자율 유영 AI 는 위) */}
      <group ref={sharkRoot} scale={SHARK_SCALE}>
        <PlushCreature species="hammerhead" config={asShark(creatures.hammerhead)} motion={motion} wet lod="mid" />
      </group>
      {/* 나머지 생물: 공용 조향 + 종별 행동 (수면 스침·호흡·점프·섭식) */}
      {SWIMMERS.map((b) => (
        <LagoonSwimmer key={b.species} behaviour={b} config={creatures[b.species]} pos={positions[b.species]} others={everyone} onSplash={splash} />
      ))}
      {/* 산호 군락의 열대어 (1 드로우) */}
      <ReefFish others={everyone} />

      <instancedMesh ref={bubbles} args={[undefined, undefined, bubbleState.length]} material={bubbleMat}>
        <sphereGeometry args={[1, 8, 8]} />
      </instancedMesh>

      {/* 물: 옆면 + 수면 */}
      <mesh geometry={sideGeo} material={sideMat} />
      <mesh ref={surfaceMesh} material={surfaceMat} position={[0, TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D, 150, 120]} />
      </mesh>
      {/* 수면 포인터용 히트 평면 (레이캐스트는 2 tri 만 — 수면 메시 36k tri 를 매 이벤트 훑지 않는다) */}
      <mesh
        visible={false}
        position={[0, TOP, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onSurfaceDown}
        onPointerUp={onSurfaceUp}
        onPointerMove={onSurfaceMove}
        onPointerLeave={onSurfaceLeave}
      >
        <planeGeometry args={[W, D]} />
      </mesh>
      </group>
      {simDebugMat && (
        <mesh material={simDebugMat} frustumCulled={false} renderOrder={1000}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      )}
      <Precompile onReady={onReady} />
    </ExtraTargets.Provider>
  );
}

export function SeaScene(props: Props) {
  return (
    <GlBoundary onFail={props.onReady}>
      <Canvas
        frameloop="never" // 셰이더 워밍업(Precompile)이 끝나면 always 로 켠다
        dpr={[1, 1.8]}
        camera={{ fov: CAM.fov, position: [8, 7, 13], near: 1, far: 220 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ touchAction: "none" }}
        role="img"
        aria-label="인형 바다 생물들이 헤엄치는 리조트 라군. 수면을 누르거나 끌면 물이 파이며 출렁입니다"
      >
        <Scene {...props} />
      </Canvas>
    </GlBoundary>
  );
}
