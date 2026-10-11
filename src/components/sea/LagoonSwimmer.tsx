"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CreatureConfig, Species } from "@/store/species";
import { publishDebug } from "@/components/creature/debugProbe";
import type { CreatureMotion } from "@/components/creature/motion";
import { PlushCreature } from "@/components/creature/PlushCreature";
import { floorHeight } from "./lagoonHeight";
import { blobShadowTexture, type NavAgent, type NavParams, type NavStepOpts, navStep, type NavTemps, TANK, updateBlobShadow } from "./lagoonNav";

/** 한 종의 수조 행동. 조향·이동·제약은 navStep 이 공유하고, 여기엔 "언제 어디로 얼마나 빨리" 만 적는다 */
export interface Behaviour<S extends NavAgent = NavAgent> {
  species: Species;
  scale: number;
  nav: NavParams;
  /** 블롭 그림자 기준 크기 [앞뒤, 좌우] 와 수면 가까울 때 더해지는 크기 */
  shadow: { size: [number, number]; grow: [number, number] };
  /** 공유 위치 벡터를 받아 시작 상태를 만든다 (pos 는 그 벡터를 그대로 쓴다) */
  init(pos: THREE.Vector3): S;
  /** 프레임 시작: 상태 기계를 돌리고 이번 프레임의 조향 옵션을 돌려준다. skipNav 면 직접 움직인 것 */
  tick(s: S, dt: number, ctx: TickContext): NavStepOpts & { skipNav?: boolean };
  /** navStep 뒤 (여울에 막혔는지 등) */
  after?(s: S, dt: number, res: { floorY: number; shallowBlocked: boolean }, ctx: TickContext): void;
  motion(s: S, m: CreatureMotion, dt: number): void;
  shadowOpacity?(s: S): number;
}

export interface TickContext {
  t: number;
  others: readonly THREE.Vector3[];
  splash?: (x: number, z: number, strength: number) => void;
}

interface Props {
  behaviour: Behaviour;
  config: CreatureConfig;
  /** 씬이 소유한 위치 벡터 — 다른 생물의 회피 목록에도 같은 벡터가 들어간다 */
  pos: THREE.Vector3;
  others: readonly THREE.Vector3[];
  onSplash?: (x: number, z: number, strength: number) => void;
}

export const LagoonSwimmer = memo(function LagoonSwimmer({ behaviour, config, pos, others, onSplash }: Props) {
  const root = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const motion = useRef<CreatureMotion>({ beat: 1, amp: 0.9, turn: 0 });
  const state = useRef<NavAgent | null>(null);
  if (state.current == null) state.current = behaviour.init(pos);
  const tmp = useMemo<NavTemps & { e: THREE.Euler }>(() => ({ v: new THREE.Vector3(), fwd: new THREE.Vector3(), e: new THREE.Euler() }), []);
  const shadowTex = useMemo(() => blobShadowTexture(), []);

  useFrame((frame, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = frame.clock.elapsedTime;
    const s = state.current!;
    const ctx: TickContext = { t, others, splash: onSplash };
    const opts = behaviour.tick(s, dt, ctx);
    const res = opts.skipNav ? { floorY: floorHeight(TANK.BOTTOM, s.pos.x, s.pos.z), shallowBlocked: false } : navStep(s, dt, behaviour.nav, opts, tmp);
    behaviour.after?.(s, dt, res, ctx);
    publishDebug(`${behaviour.species}Nav`, { pos: s.pos.toArray(), target: s.target.toArray(), speed: s.speed, retarget: s.retarget, shallowBlocked: res.shallowBlocked });

    const g = root.current;
    g.position.copy(s.pos);
    g.position.y += Math.sin(t * behaviour.nav.bob[1]) * behaviour.nav.bob[0];
    tmp.e.set(s.roll, s.yaw, s.pitch, "YZX");
    g.quaternion.setFromEuler(tmp.e);

    const m = motion.current;
    behaviour.motion(s, m, dt);
    updateBlobShadow(shadow.current, s.pos, s.yaw, res.floorY, behaviour.shadow.size, behaviour.shadow.grow, behaviour.scale, behaviour.shadowOpacity?.(s) ?? 1);
  });

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.9, 1.1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <group ref={root} scale={behaviour.scale}>
        <PlushCreature species={behaviour.species} config={config} motion={motion} wet lod="mid" />
      </group>
    </>
  );
});
