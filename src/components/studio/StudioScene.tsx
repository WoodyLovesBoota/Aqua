/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CreatureConfig, Species } from "@/store/species";
import type { CreatureLod } from "@/components/creature/creatureMesh";
import { captureParam, publishDebug } from "@/components/creature/debugProbe";
import type { CreatureMotion } from "@/components/creature/motion";
import { PlushCreature } from "@/components/creature/PlushCreature";
import { CREATURES } from "@/components/creature/registry";
import { Precompile } from "@/components/three/precompile";
import { GlBoundary } from "@/components/ui/GlBoundary";
import { ContactShadow } from "./ContactShadow";

interface Props {
  species: Species;
  config: CreatureConfig;
  /** 셰이더 워밍업이 끝나 첫 프레임을 그릴 준비가 됐을 때 */
  onReady?: () => void;
}

// 카메라는 멀리서 본다. 상어는 화면 전체(글자 뒤까지)를 자유롭게 헤엄친다.
const CAM = { y: 2.4, z: 13, fov: 30 };
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2));
const FLOOR_Y = -2.7;
// 그림자는 저해상 프록시(4k tris)로만 만든다: 이 레이어는 그림자 카메라만 본다
const SHADOW_LAYER = 2;
// 캡처/점검용: ?pose=1 이면 상어를 가운데 고정 포즈로 둔다 (매트릭스 캡처가 결정적이도록)
// 스튜디오 지느러미·꼬리 박자 배수 — 수조(1)보다 2.5배 느긋하게 (2026-10-11 사용자: "선택 화면 모든 생물의 날갯짓이 너무 빠르다")
const STUDIO_BEAT = 0.4;
const POSED = captureParam("pose") !== null;
// ?view=top|side|front 로 고정 포즈 방향을 고른다 (형태 점검용). 기본은 비스듬한 3/4 뷰
const VIEW = captureParam("view") ?? "";
// ?lod=mid|lo 로 저해상 메시를 본체로 띄워 본다 (LOD 점검용)
const LOD_PARAM = captureParam("lod");
const LOD: CreatureLod = LOD_PARAM === "mid" || LOD_PARAM === "lo" ? LOD_PARAM : "hi";
// ?still=1 이면 고정 포즈에서 헤엄 변형도 멈춘다 (형태·LOD 비교가 결정적이도록)
const STILL = captureParam("still") !== null;
// OS "동작 줄이기" 설정이면 커서를 따라가는 카메라 패럴랙스를 끈다 (생물의 유영은 그대로)
const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const POSE_EULER: Record<string, [number, number, number]> = {
  "": [0.05, -1.0, 0.06],
  top: [0, -Math.PI / 2, -1.3],
  side: [0, 0, 0],
  front: [0, -Math.PI / 2, 0],
  back: [0, Math.PI / 2, 0],
  below: [0, -Math.PI / 2, 1.3],
};
// 헤엄칠 수 있는 범위: 화면 비율 좌표(nx, ny ∈ -1..1) + 깊이 z
const ROAM = { nx: 0.88, nyMin: -0.5, nyMax: 0.74, zMin: -4.5, zMax: 3.2 };
const LIMIT = { nx: 1.02, nyMin: -0.62, nyMax: 0.86, zMin: -5.2, zMax: 3.8 };
// 패널에 가려지는 자리는 목표로 고르지 않는다: 가로 화면은 오른쪽 패널(≈ 화면 폭 18%), 세로 화면은 아래 패널(42vh)
function roamBox(aspect: number) {
  const wide = aspect >= 1.25;
  // 목표는 생물 중심이라 몸 폭(화면의 ≈ 1/4)만큼 더 안쪽에서 고른다
  return { nxMin: -ROAM.nx, nxMax: wide ? 0.4 : ROAM.nx, nyMin: aspect < 0.9 ? -0.05 : ROAM.nyMin, nyMax: ROAM.nyMax };
}

interface Ai {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  turnRate: number;
  target: THREE.Vector3;
  retarget: number;
  /** 질주 남은 시간 */
  burst: number;
  /** 다음 질주까지 */
  nextBurst: number;
  /** 포인터를 누르고 있어 커서를 따라가는 중 */
  lead: boolean;
  /** 신이 나서 몸을 한 바퀴 굴리는 진행도 (0..1, 굴리지 않을 땐 -1) */
  twirl: number;
  /** 다음 구르기까지 */
  nextTwirl: number;
}

/** 화면 비율 좌표 + 깊이 → 월드 좌표 (카메라는 (0, CAM.y, CAM.z)에서 원점을 본다) */
function screenToWorld(nx: number, ny: number, z: number, aspect: number, out: THREE.Vector3) {
  const d = CAM.z - z;
  const halfH = d * TAN_HALF_FOV;
  const axisY = CAM.y * (z / CAM.z); // 시선 축이 이 깊이에서 지나는 높이
  return out.set(nx * halfH * aspect, axisY + ny * halfH, z);
}

function clampToView(p: THREE.Vector3, aspect: number) {
  p.z = THREE.MathUtils.clamp(p.z, LIMIT.zMin, LIMIT.zMax);
  const d = CAM.z - p.z;
  const halfH = d * TAN_HALF_FOV;
  const axisY = CAM.y * (p.z / CAM.z);
  const nx = p.x / (halfH * aspect);
  const ny = (p.y - axisY) / halfH;
  let hit = false;
  if (Math.abs(nx) > LIMIT.nx) {
    p.x = Math.sign(nx) * LIMIT.nx * halfH * aspect;
    hit = true;
  }
  if (ny < LIMIT.nyMin || ny > LIMIT.nyMax) {
    p.y = axisY + THREE.MathUtils.clamp(ny, LIMIT.nyMin, LIMIT.nyMax) * halfH;
    hit = true;
  }
  return hit;
}

function randomTarget(a: Ai, aspect: number, out: THREE.Vector3) {
  // 지금 위치에서 꽤 떨어진 곳을 골라 길게 가로지른다. 가끔은 카메라 앞까지 바짝 다가온다.
  const near = Math.random() < 0.3;
  const box = roamBox(aspect);
  for (let i = 0; i < 6; i++) {
    screenToWorld(
      THREE.MathUtils.randFloat(box.nxMin, box.nxMax),
      THREE.MathUtils.randFloat(box.nyMin, box.nyMax),
      near ? THREE.MathUtils.randFloat(1.2, ROAM.zMax) : THREE.MathUtils.randFloat(ROAM.zMin, 1.5),
      aspect,
      out,
    );
    if (out.distanceTo(a.pos) > 4.5) break;
  }
  return out;
}

function Scene({ species, config, onReady }: Props) {
  // 종별 크기·움직임 성격 (만타는 날개폭이 넓어 작게, 더 느긋하고 크게 돈다)
  const kind = CREATURES[species].studio;
  const root = useRef<THREE.Group>(null!);
  const motion = useRef<CreatureMotion>({ beat: 1, amp: 0.9, turn: 0 });
  const { gl, camera, pointer, raycaster } = useThree();
  const aspectRef = useRef(1.6);
  const ai = useRef<Ai>({
    pos: new THREE.Vector3(-4, 0.4, -1),
    yaw: 0.2,
    pitch: 0,
    roll: 0,
    speed: 1.6,
    turnRate: 0,
    target: new THREE.Vector3(1.5, 0.8, 0), // 첫 목표는 패널에 안 가리는 가운데 오른쪽
    retarget: 4,
    burst: 0,
    nextBurst: 2,
    lead: false,
    twirl: -1,
    nextTwirl: 7,
  });
  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    }),
    [],
  );

  // 포인터를 누르거나 끌면 그 자리로 상어가 헤엄쳐 온다
  useEffect(() => {
    const el = gl.domElement;
    const down = () => {
      ai.current.lead = true;
    };
    const up = () => {
      ai.current.lead = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const aspect = state.size.width / state.size.height;
    aspectRef.current = aspect;
    const a = ai.current;
    const m = motion.current;

    if (POSED) {
      root.current.position.set(0.3, 0.6, 4);
      tmp.e.set(...(POSE_EULER[VIEW] ?? POSE_EULER[""]), "YZX");
      root.current.quaternion.setFromEuler(tmp.e);
      m.beat = STUDIO_BEAT;
      m.amp = STILL ? 0 : 0.6;
      camera.position.set(0, CAM.y, CAM.z);
      camera.lookAt(0, 0, 0);
      return;
    }

    // 목표 고르기
    if (a.lead) {
      // 커서가 가리키는 곳(상어의 현재 깊이 평면)으로
      raycaster.setFromCamera(pointer, camera);
      tmp.plane.constant = -a.pos.z;
      if (raycaster.ray.intersectPlane(tmp.plane, tmp.v)) {
        clampToView(tmp.v, aspect);
        a.target.copy(tmp.v);
      }
      a.retarget = THREE.MathUtils.randFloat(2.5, 4);
    } else {
      a.retarget -= dt;
      if (a.retarget <= 0 || a.target.distanceTo(a.pos) < 0.9) {
        randomTarget(a, aspect, a.target);
        a.retarget = THREE.MathUtils.randFloat(2.2, 4.5);
      }
    }

    // 자주 꼬리를 세게 쳐 질주하고, 그 뒤엔 미끄러지듯 글라이드
    a.nextBurst -= dt;
    if (a.burst > 0) a.burst -= dt;
    else if (a.nextBurst <= 0) {
      a.burst = THREE.MathUtils.randFloat(0.8, 1.5);
      a.nextBurst = THREE.MathUtils.randFloat(1.8, 4.2);
      // 질주할 때 절반쯤은 방향을 확 바꿔 새 목표로 내달린다
      if (!a.lead && Math.random() < 0.5) {
        randomTarget(a, aspect, a.target);
        a.retarget = THREE.MathUtils.randFloat(2.2, 4.5);
      }
    }
    // 가끔 신이 나서 몸을 한 바퀴 굴린다 (커서를 따라갈 땐 안 한다)
    a.nextTwirl -= dt;
    if (a.twirl >= 0) {
      a.twirl += dt / 1.1;
      if (a.twirl >= 1) a.twirl = -1;
    } else if (a.nextTwirl <= 0 && !a.lead) {
      a.twirl = 0;
      a.burst = Math.max(a.burst, 1.1);
      a.nextTwirl = THREE.MathUtils.randFloat(8, 15);
    }
    const leadDist = a.lead ? a.target.distanceTo(a.pos) : Infinity;
    const targetSpeed = (a.lead ? (leadDist < 1.2 ? 1.0 : 2.8) : a.burst > 0 ? 3.6 : 1.7) * kind.speed;
    const targetBeat = (a.lead ? 1.25 : a.burst > 0 ? 1.45 : 1) * STUDIO_BEAT;

    // 조향: 최대 회전율 안에서 목표를 향해 몸을 튼다
    const to = tmp.v.copy(a.target).sub(a.pos);
    const wantYaw = Math.atan2(-to.z, to.x);
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.7, 0.7);
    let dy = wantYaw - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const maxTurn = (a.lead || a.burst > 0 ? 2.8 : 1.9) * kind.turn * dt;
    const step = THREE.MathUtils.clamp(dy, -maxTurn, maxTurn);
    a.yaw += step;
    a.turnRate += (step / dt - a.turnRate) * Math.min(1, dt * 5);
    a.pitch += (wantPitch - a.pitch) * Math.min(1, dt * 3);
    a.speed += (targetSpeed - a.speed) * Math.min(1, dt * 2.4);

    const fwd = tmp.fwd.set(Math.cos(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.sin(a.yaw) * Math.cos(a.pitch));
    a.pos.addScaledVector(fwd, a.speed * dt);
    // 화면 밖으로 나가려 하면 안쪽으로 새 목표
    if (clampToView(a.pos, aspect) && !a.lead) {
      screenToWorld(THREE.MathUtils.randFloat(-0.4, Math.min(0.4, roamBox(aspect).nxMax)), THREE.MathUtils.randFloat(-0.2, 0.5), THREE.MathUtils.randFloat(-3, 1), aspect, a.target);
      a.retarget = THREE.MathUtils.randFloat(3.5, 6);
    }

    // 점검용: 위치 + 화면 비율 좌표
    {
      const d = CAM.z - a.pos.z, halfH = d * TAN_HALF_FOV, axisY = CAM.y * (a.pos.z / CAM.z);
      publishDebug("studioNav", { pos: a.pos.toArray(), nx: a.pos.x / (halfH * aspect), ny: (a.pos.y - axisY) / halfH, lead: a.lead, speed: a.speed, cam: camera.position.toArray() });
    }
    // 회전할 때 몸을 기울인다 (뱅킹)
    const bankRoll = THREE.MathUtils.clamp(-a.turnRate * 0.6, -1.1, 1.1);
    a.roll += (bankRoll - a.roll) * Math.min(1, dt * 3);
    // 구르기: 시작·끝은 부드럽게 (smoothstep) 한 바퀴
    const spin = a.twirl >= 0 ? THREE.MathUtils.smoothstep(a.twirl, 0, 1) * Math.PI * 2 : 0;

    const g = root.current;
    g.position.copy(a.pos);
    // 물결 타듯 위아래로 출렁이고, 몸도 리듬 있게 흔든다
    g.position.y += Math.sin(t * 1.3) * 0.1 + Math.sin(t * 2.9) * 0.03;
    tmp.e.set(a.roll + spin + Math.sin(t * 1.1) * 0.08, a.yaw, a.pitch + Math.sin(t * 1.3 + 0.8) * 0.07, "YZX");
    tmp.q.setFromEuler(tmp.e);
    // 구르는 중엔 바로 따라가야 한 바퀴가 다 보인다 (slerp 는 짧은 쪽으로 질러간다)
    if (a.twirl >= 0) g.quaternion.copy(tmp.q);
    else g.quaternion.slerp(tmp.q, Math.min(1, dt * 10));

    // 박자는 속도를 따라 빨라지고, 진폭도 질주할 때 커진다
    m.beat += (targetBeat * (0.75 + a.speed * 0.12) - m.beat) * Math.min(1, dt * 3);
    m.amp = 0.6 + Math.min(0.38, a.speed * 0.11);
    m.turn += (THREE.MathUtils.clamp(a.turnRate * 0.55, -1, 1) - m.turn) * Math.min(1, dt * 5);

    // 커서를 살짝 따라가는 카메라 (패럴랙스)
    const back = aspect < 1.25 ? 1.25 / aspect : 1; // 세로 화면이면 뒤로
    const px = REDUCED_MOTION ? 0 : pointer.x, py = REDUCED_MOTION ? 0 : pointer.y;
    camera.position.x += (px * 0.4 - camera.position.x) * dt * 2;
    camera.position.y += (CAM.y + py * 0.3 - camera.position.y) * dt * 2;
    camera.position.z = CAM.z * back;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <hemisphereLight args={["#fffaf0", "#b8ad9c", 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#dfe8ff" />
      <group ref={root} scale={kind.scale}>
        <PlushCreature species={species} config={config} motion={motion} lod={LOD} shadowProxy={{ lod: "lo", layer: SHADOW_LAYER }} />
      </group>
      <ContactShadow position={[0, FLOOR_Y, 0]} size={[26, 16]} far={7.5} layer={SHADOW_LAYER} opacity={0.34} blur={2.4} color="#3b3328" />
      <Precompile onReady={onReady} />
    </>
  );
}

export function StudioScene(props: Props) {
  return (
    <GlBoundary onFail={props.onReady}>
      <Canvas
        frameloop="never" // 셰이더 워밍업(Precompile)이 끝나면 always 로 켠다
        dpr={[1, 1.8]}
        camera={{ fov: CAM.fov, position: [0, CAM.y, CAM.z], near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ touchAction: "none" }}
        role="img"
        aria-label="A swimming plush sea creature. Tap or drag and it follows you."
      >
        <Scene {...props} />
      </Canvas>
    </GlBoundary>
  );
}
