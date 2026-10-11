/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";
import { dayHour, ENV, makeDayState, resetEnv, sampleDay } from "./dayCycle";
import { TANK } from "./lagoonNav";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DomeMaterial, makeCloud, ORB_EXTENT, OrbMaterial, StarFieldMaterial, ToyMaterial } from "./skyToys";
import { BLOCK_CORNER, roundedPlate, roundedSlab, slabProfile } from "./tankGeometry";

const LIGHT_R = 8; // 방향광 위치 반지름 (방향만 의미 있다)
const FILL_DAY = new THREE.Vector3(-4, 2, -3).normalize(); // 낮 보조광 방향 (기준선)
/** 하늘 장난감은 이 레이어에만 — 굴절 패스(수면 아래 장면)는 이 레이어를 끄고 그린다 */
export const SKY_LAYER = 1;
const SKY_OFF = captureParam("sky") === "0"; // ?sky=0 — 하늘 장난감 끄기 (성능 A/B 점검용)

// 카메라 방위각 35° 기준 화면 오른쪽 / 카메라 쪽(화면 아래) 수평 축 (SeaScene CAM 과 같은 값)
const AZ = THREE.MathUtils.degToRad(35);
const RIGHT = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ));
const BACK = new THREE.Vector3(Math.sin(AZ), 0, Math.cos(AZ));
// 젤리 하늘 돔 = 큐브 뚜껑: 블록 바깥 벽(반폭·모서리 반지름)을 그대로 위로 잇는다.
// 수면 높이(TOP)에서 곧게 올라가 윗모서리만 둥글린다 (물 옆면과 맞닿는 선이 깜빡이지 않게 둘레를 아주 살짝 키움)
const LID_EPS = 0.004;
const DOME = { hx: TANK.W / 2 + LID_EPS, hz: TANK.D / 2 + LID_EPS, corner: BLOCK_CORNER + LID_EPS, base: TANK.TOP, h: 4.0, bevel: 0.6 };
// 해·달의 호: 돔 안, 블록 뒤쪽 절반 위에서 화면 왼쪽 끝 → 섬 위 → 오른쪽 끝. 지평선 근처에선 젤리 속으로 잦아든다
// 호 중심은 섬(왼쪽 뒤) 오른쪽 — 남중한 해·달이 야자수 뒤에 숨지 않고 섬과 방갈로 사이 하늘에 뜬다
const ARC = { r: 6.2, h: 2.2, lift: 0.9, back: 1.2, right: 1.8 };
const ARC_C = new THREE.Vector3(0, TANK.TOP + ARC.lift, 0).addScaledVector(BACK, -ARC.back).addScaledVector(RIGHT, ARC.right);
const SUN_R = 0.72;
const MOON_R = 0.62;

/** 결정적 난수 (새로고침해도 별자리가 같다) */
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}
/** 별빛: 돔 안 둥근 사각형 발자국 · 높이는 위쪽으로 쏠리게. 큰 별 10개는 십자 광채 */
function makeStarField() {
  const N = 72;
  const r = rng(7);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N), th = new Float32Array(N);
  const palette = ["#ffffff", "#ffffff", "#d6e4ff", "#fff1cc", "#e8dcff"].map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const big = i < 10;
    pos[i * 3] = (r() * 2 - 1) * (DOME.hx - 1.4);
    pos[i * 3 + 2] = (r() * 2 - 1) * (DOME.hz - 1.4) - (big ? 1.5 : 0); // 큰 별은 뒤쪽(하늘 쪽)에
    pos[i * 3 + 1] = TANK.TOP + 1.1 + (DOME.h - 1.7) * Math.sqrt(r());
    palette[Math.floor(r() * palette.length)].toArray(col, i * 3);
    size[i] = big ? 0.42 + r() * 0.25 : 0.08 + r() * 0.08;
    seed[i] = r();
    th[i] = big ? r() * 0.4 : r() * 0.85;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aTh", new THREE.BufferAttribute(th, 1));
  return g;
}
// 솜 구름 (낮): 돔 안 높이·앞뒤 자리·크기·흐르는 속도(월드/초)·시작 자리 — 돔 끝에서 줄어들었다 반대편에서 부푼다
const CLOUDS = [
  { y: 3.2, back: -1.5, s: 0.6, sp: 0.16, x0: -2 },
  { y: 2.3, back: 1.5, s: 0.45, sp: 0.22, x0: 3 },
  { y: 3.5, back: -3.0, s: 0.5, sp: 0.12, x0: 5 },
];
const CLOUD_SPAN = 5.2;

/** 호 진행도 a → 돔 안 월드 자리 + 보이는 정도(지평선에서 0) */
function arcPos(a: number, out: THREE.Vector3) {
  const s = Math.sin(Math.PI * a);
  out.copy(ARC_C).addScaledVector(RIGHT, -Math.cos(Math.PI * a) * ARC.r);
  out.y += Math.max(s, 0) * ARC.h;
  return a < 0 || a > 1 ? 0 : THREE.MathUtils.smoothstep(s, 0.0, 0.22);
}

/**
 * 라군의 하루: 매 프레임 시각을 읽어 씬 조명(반구광·주광·보조광), 공용 셰이더 유니폼(ENV),
 * 젤리 하늘 돔(해·달·별빛·낮 구름)을 갱신한다. 화면 배경은 건드리지 않는다.
 * 라이트 개수는 고정이고 색·세기·방향만 바꾼다 (개수가 바뀌면 모든 재질이 다시 컴파일된다).
 */
interface Props {
  /** 젤리 블록 그룹 — 주면 하늘 돔(뚜껑)·해·달·별·구름을 이 안에 넣어 블록을 흔들 때 뚜껑도 같이 전단·기울임을 받는다 (조명은 바깥에 남는다) */
  jelly?: THREE.Object3D;
}

export function LagoonDay({ jelly }: Props) {
  const { camera } = useThree();
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  const fill = useRef<THREE.DirectionalLight>(null!);
  const sky = useRef<THREE.Group>(null!);
  const sun = useRef<THREE.Mesh>(null!);
  const moon = useRef<THREE.Mesh>(null!);
  const clouds = useRef<THREE.InstancedMesh>(null!);
  const starPts = useRef<THREE.Points>(null!);
  const day = useMemo(() => makeDayState(), []);
  const res = useMemo(() => {
    // 돔: 둥근 옆면(윗모서리 크게 둥글림) + 윗판
    const side = roundedSlab(DOME.hx, DOME.hz, DOME.corner, slabProfile(DOME.base, TANK.TOP + DOME.h, DOME.bevel, 0, 8), 8);
    const cap = roundedPlate(DOME.hx - DOME.bevel, DOME.hz - DOME.bevel, DOME.corner - DOME.bevel).translate(0, TANK.TOP + DOME.h, 0);
    cap.deleteAttribute("uv");
    const domeGeo = mergeGeometries([side, cap], false)!;
    side.dispose();
    cap.dispose();
    return {
      domeGeo,
      domeBack: new DomeMaterial(true, TANK.TOP, DOME.h),
      domeFront: new DomeMaterial(false, TANK.TOP, DOME.h),
      orbGeo: new THREE.PlaneGeometry(2 * ORB_EXTENT, 2 * ORB_EXTENT),
      sunMat: new OrbMaterial(false),
      moonMat: new OrbMaterial(true),
      starGeo: makeStarField(),
      starMat: new StarFieldMaterial(),
      cloudGeo: makeCloud(),
      cloudMat: new ToyMaterial(),
    };
  }, []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), s: new THREE.Vector3(), m: new THREE.Matrix4(), c: new THREE.Color() }), []);

  useEffect(() => {
    camera.layers.enable(SKY_LAYER);
    sky.current.traverse((o) => o.layers.set(SKY_LAYER));
    return () => {
      camera.layers.disable(SKY_LAYER);
      resetEnv(); // 수조를 떠나면(스튜디오) 한낮 값으로
      Object.values(res).forEach((r) => r.dispose());
    };
  }, [camera, res]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const d = sampleDay(dayHour(), day);
    hemi.current.color.copy(d.hemiSky);
    hemi.current.groundColor.copy(d.hemiGround);
    hemi.current.intensity = d.hemiI;
    // 주광: 해가 떠 있으면 해, 지면 달 (세기는 키프레임이 정한다)
    const sunUp = THREE.MathUtils.smoothstep(d.sunElev, -0.05, 0.12);
    const dir = tmp.v.copy(d.moonDir).lerp(d.sunDir, sunUp);
    if (dir.y < 0.15) dir.y = 0.15; // 지평선 아래에서 비추지 않게
    dir.normalize();
    key.current.position.copy(dir).multiplyScalar(LIGHT_R);
    key.current.color.copy(d.sun);
    key.current.intensity = d.sunI;
    fill.current.position.copy(FILL_DAY).multiplyScalar(LIGHT_R);
    fill.current.color.copy(d.fill);
    fill.current.intensity = d.fillI;

    ENV.uEnvLight.value.copy(d.env);
    ENV.uKeyDir.value.copy(dir);
    ENV.uKeyCol.value.copy(d.sun).multiplyScalar(d.sunI / 1.5);
    ENV.uSkyCol.value.copy(d.skyBot).lerp(d.skyTop, 0.35);
    ENV.uSunUp.value = sunUp;
    ENV.uLamp.value = d.lamp;

    const lum = Math.max(d.env.x, d.env.y, d.env.z);
    // 젤리 돔: 먼 벽은 하늘(밤일수록 짙게), 앞 유리는 주광 하이라이트
    for (const mat of [res.domeBack, res.domeFront]) {
      const u = mat.uniforms;
      u.uSkyTop.value.copy(d.skyTop);
      u.uSkyBot.value.copy(d.skyBot);
      u.uDensity.value = THREE.MathUtils.lerp(0.92, 0.3, THREE.MathUtils.smoothstep(lum, 0.3, 0.95));
      u.uCamPos.value.copy(camera.position);
      u.uKeyDir.value.copy(dir);
      u.uKeyCol.value.copy(ENV.uKeyCol.value);
    }
    // 해: 호를 따라 움직이는 빛 원반 + 코로나. 낮은 해는 주황빛
    {
      const m = sun.current;
      const show = arcPos(d.sunArc, m.position);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(SUN_R);
      m.visible = show > 0.001;
      const u = res.sunMat.uniforms;
      // 한낮엔 따뜻한 흰 노랑, 낮을수록 주광 색(주황)을 받는다
      u.uColor.value.setRGB(1, 0.62, 0.12).lerp(d.sun, 0.25); // 선형 값 — 화면에선 진한 금빛
      u.uGlow.value.setRGB(1, 0.78, 0.4).lerp(d.sun, 0.5).multiplyScalar(0.75);
      u.uAlpha.value = show;
    }
    // 달: 해와 반대 호, 위상 음영 + 크레이터 + 달무리
    {
      const m = moon.current;
      const show = arcPos(d.moonArc, m.position);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(MOON_R);
      m.visible = show > 0.001;
      const u = res.moonMat.uniforms;
      u.uGlow.value.setRGB(0.62, 0.72, 1.0).multiplyScalar(0.85);
      u.uAlpha.value = show;
    }
    // 별빛: 별 양이 차례값을 넘으면 하나씩 켜지고 저마다 반짝인다
    {
      const u = res.starMat.uniforms;
      u.uStars.value = d.stars;
      starPts.current.visible = d.stars > 0.001; // 낮엔 드로우 자체를 뺀다
      u.uTime.value = t;
      u.uPx.value = state.size.height * state.viewport.dpr * 0.5 * camera.projectionMatrix.elements[5];
    }
    // 솜 구름 (낮): 돔 안에서 천천히 흐르고 끝에서 줄어들었다 반대편에서 부푼다. 노을엔 하늘색을 받아 분홍·주황, 밤엔 잦아든다
    {
      const inst = clouds.current;
      const dayK = THREE.MathUtils.smoothstep(lum, 0.3, 0.6);
      CLOUDS.forEach((c, i) => {
        const span = CLOUD_SPAN * 2;
        const x = ((((c.x0 + t * c.sp + CLOUD_SPAN) % span) + span) % span) - CLOUD_SPAN;
        const edge = THREE.MathUtils.smoothstep(CLOUD_SPAN - Math.abs(x), 0, 2.0);
        tmp.s.set(0, TANK.TOP + c.y + Math.sin(t * 0.5 + i) * 0.08, 0).addScaledVector(RIGHT, x).addScaledVector(BACK, c.back);
        const r = c.s * edge * dayK;
        tmp.m.compose(tmp.s, camera.quaternion, tmp.v.set(r, r, r));
        inst.setMatrixAt(i, tmp.m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.visible = dayK > 0.001;
      res.cloudMat.uniforms.uTint.value.copy(d.skyBot).lerp(tmp.c.setRGB(1, 1, 1), 0.55).multiplyScalar(0.45 + 0.55 * lum);
    }

    if (DEBUG_ON) publishDebug("day", { hour: +d.hour.toFixed(4), sunElev: +d.sunElev.toFixed(3), moonElev: +d.moonElev.toFixed(3), lamp: +d.lamp.toFixed(3), stars: +d.stars.toFixed(3) });
  });

  // 젤리 하늘 돔과 그 안의 해·달·별빛·구름 (레이어 1 — 굴절 패스에선 빠진다). 먼 벽 → 해·달 → 별 → 앞 유리 순
  // 해·달·구름 빌보드는 카메라 쿼터니언을 로컬로 받으니 블록이 전단되면 살짝 같이 찌그러진다 — 젤리 속 장난감이라 그게 맞다
  const skyNode = (
    <group ref={sky} visible={!SKY_OFF}>
      <mesh geometry={res.domeGeo} material={res.domeBack} renderOrder={2} />
      <instancedMesh ref={clouds} args={[res.cloudGeo, res.cloudMat, CLOUDS.length]} frustumCulled={false} />
      <mesh ref={sun} geometry={res.orbGeo} material={res.sunMat} renderOrder={3} frustumCulled={false} />
      <mesh ref={moon} geometry={res.orbGeo} material={res.moonMat} renderOrder={3} frustumCulled={false} />
      <points ref={starPts} geometry={res.starGeo} material={res.starMat} renderOrder={4} frustumCulled={false} />
      <mesh geometry={res.domeGeo} material={res.domeFront} renderOrder={20} />
    </group>
  );
  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffffff", "#8fa5b8", 1.0]} />
      <directionalLight ref={key} position={[3, 6, 2]} intensity={1.5} />
      <directionalLight ref={fill} position={[-4, 2, -3]} intensity={0.35} color="#cfe6ff" />
      {jelly ? createPortal(skyNode, jelly) : skyNode}
    </>
  );
}
