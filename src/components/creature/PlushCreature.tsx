/* eslint-disable react-hooks/immutability -- three.js 유니폼은 프레임마다 직접 갱신한다 */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CreatureConfig, Species } from "@/components/creature/species";
import { compileSpread, ExtraTargets } from "@/components/three/precompile";
import { loadCreatureGeometry, type CreatureLod } from "./creatureMesh";
import type { CreatureMotion } from "./motion";
import { PlushMaterial } from "./PlushMaterial";
import { CREATURES } from "./registry";

interface Props {
  species: Species;
  config: CreatureConfig;
  motion?: React.RefObject<CreatureMotion>;
  wet?: boolean;
  /** 메시 세밀도 (기본 hi) */
  lod?: CreatureLod;
  /**
   * 그림자 프록시: 지정한 레이어에만 보이는 저해상 메시를 같이 둔다.
   * ContactShadow 카메라를 그 레이어로 두면 본체(수만 tris) 대신 이 메시로 그림자를 만든다.
   */
  shadowProxy?: { lod: CreatureLod; layer: number };
}

/** 프록시는 아무것도 그리지 않는다 (그림자 패스는 overrideMaterial 로 대체되므로 상관없다) */
const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const DEFAULT_MOTION: CreatureMotion = { beat: 1, amp: 1, turn: 0 };

/** 화면에 올라가 있는 종 — 종을 바꿔도 새 메시가 준비될 때까지는 이전 종(메시·머티리얼·부품·설정)을 그대로 둔다 */
interface Shown {
  species: Species;
  config: CreatureConfig;
  material: PlushMaterial;
  geometry: THREE.BufferGeometry;
  proxy: THREE.BufferGeometry | null;
}

/**
 * 메시를 받고 그 머티리얼의 셰이더까지 비동기로 컴파일한 뒤에야 교체한다 (첫 프레임의 동기 컴파일 → 긴 작업 방지).
 * 중간 상태(옛 몸통 + 새 종의 셰이더·부품)가 보이지 않도록 종·설정·머티리얼·메시를 한 번에 바꾼다.
 */
function useShown(species: Species, config: CreatureConfig, lod: CreatureLod, proxyLod: CreatureLod | undefined) {
  const [shown, setShown] = useState<Shown | null>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const extra = useContext(ExtraTargets);
  const latestConfig = useRef(config);
  useEffect(() => {
    latestConfig.current = config;
  }, [config]);

  useEffect(() => {
    let alive = true;
    const { files, swim } = CREATURES[species];
    const material = new PlushMaterial(swim);
    Promise.all([loadCreatureGeometry(files, lod), proxyLod ? loadCreatureGeometry(files, proxyLod) : null])
      .then(async ([geometry, proxy]) => {
        if (!alive) return;
        const warm = new THREE.Group();
        warm.add(new THREE.Mesh(geometry, material));
        if (proxy) warm.add(new THREE.Mesh(proxy, proxyMat));
        await compileSpread(gl, warm, camera, scene, () => alive, extra).catch(() => {});
        if (alive) setShown({ species, config: latestConfig.current, material, geometry, proxy });
        else material.dispose();
      });
    return () => {
      alive = false;
    };
  }, [species, lod, proxyLod, gl, scene, camera, extra]);

  // 화면에서 내려간 머티리얼은 그때 버린다 (교체 전에 버리면 옛 몸통이 다시 동기 컴파일된다)
  useEffect(() => () => shown?.material.dispose(), [shown]);

  // 같은 종이면 설정(색·이름)은 즉시 반영
  return shown && shown.species === species ? { ...shown, config } : shown;
}

/** 베이크된 메시 + 플러시 머티리얼 + 종별 부품. 모든 종이 이 하나로 그려진다 */
export function PlushCreature({ species, config, motion, wet = false, lod = "hi", shadowProxy }: Props) {
  const shown = useShown(species, config, lod, shadowProxy?.lod);
  const proxyRef = useRef<THREE.Mesh>(null);
  const proxyLayer = shadowProxy?.layer;
  const material = shown?.material ?? null;
  const cfg = shown?.config ?? config;

  useEffect(() => {
    if (proxyRef.current && proxyLayer !== undefined) proxyRef.current.layers.set(proxyLayer);
  }, [shown, proxyLayer]);

  useEffect(() => {
    if (!material) return;
    material.uniforms.uFurColor.value.set(cfg.furColor);
    material.uniforms.uBellyColor.value.set(cfg.bellyColor);
    material.uniforms.uPile.value = 0.015 + cfg.pile * 0.05;
    material.uniforms.uWet.value = wet ? 1 : 0;
  }, [cfg.furColor, cfg.bellyColor, cfg.pile, wet, material]);

  useFrame((state) => {
    if (!material) return;
    const m = motion?.current ?? DEFAULT_MOTION;
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uBeat.value = cfg.tailBeat * m.beat;
    u.uSwimAmp.value = m.amp;
    u.uTurn.value = m.turn;
  });

  if (!shown) return null;
  const { Parts, plump } = CREATURES[shown.species];
  return (
    <group scale={plump(cfg.stuffing)}>
      <mesh geometry={shown.geometry} material={shown.material} frustumCulled={false} />
      {shown.proxy && <mesh ref={proxyRef} geometry={shown.proxy} material={proxyMat} frustumCulled={false} />}
      <Parts config={cfg} />
    </group>
  );
}
