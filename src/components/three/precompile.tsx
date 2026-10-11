"use client";

import { useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect } from "react";
import type * as THREE from "three";

/**
 * 셰이더 워밍업. three 는 첫 렌더 때 머티리얼마다 동기로 컴파일·링크하는데, 수조처럼 프로그램이 20개쯤이면
 * 한 프레임에 100ms 를 훌쩍 넘는 긴 작업이 된다. 여기서는
 *  1. 물체 하나씩 `gl.compile`(JS 쪽 준비) 하되 시간 예산을 넘기면 다음 태스크로 양보하고
 *  2. 마지막에 GPU 링크가 끝날 때까지(KHR_parallel_shader_compile) 기다린다 (기한·컨텍스트 손실 시 포기).
 * 렌더타깃에 그릴 때는 출력 색공간이 달라 프로그램 변형이 하나 더 생기므로, 쓰는 렌더타깃마다 한 번씩 더 준비한다.
 */

type Target = THREE.WebGLRenderTarget | null;

/** 장면을 추가로 그리는 렌더타깃(굴절 패스 등). Precompile·PlushCreature 가 그 변형까지 미리 컴파일한다 */
export const ExtraTargets = createContext<readonly THREE.WebGLRenderTarget[]>([]);

export async function compileSpread(
  gl: THREE.WebGLRenderer,
  root: THREE.Object3D,
  camera: THREE.Camera,
  scene: THREE.Scene,
  isAlive: () => boolean,
  extra: readonly THREE.WebGLRenderTarget[] = [],
  budgetMs = 12,
  maxWaitMs = 4000,
) {
  const targets: Target[] = [null, ...extra];
  const objs: THREE.Object3D[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) objs.push(o);
  });
  const withTarget = <T,>(t: Target, fn: () => T): T => {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(t);
    try {
      return fn();
    } finally {
      gl.setRenderTarget(prev);
    }
  };
  const materials = new Set<THREE.Material>();
  let t0 = performance.now();
  for (const o of objs) {
    for (const t of targets) {
      if (!isAlive()) return;
      withTarget(t, () => gl.compile(o, camera, scene)).forEach((m) => materials.add(m));
      if (performance.now() - t0 > budgetMs) {
        await new Promise<void>((r) => setTimeout(r, 0));
        t0 = performance.now();
      }
    }
  }
  // GPU 링크 완료 폴링. gl.compileAsync 는 기한 없이 폴링해서, 컨텍스트가 끊기면(isReady 가 영원히 false)
  // 첫 로드가 무한 로딩에 걸린다. 여기서는 손실·기한 초과 시 그냥 넘어가고 첫 프레임이 동기로 마무리하게 둔다.
  const deadline = performance.now() + maxWaitMs;
  const ctx = gl.getContext();
  while (materials.size) {
    if (!isAlive() || ctx.isContextLost() || performance.now() > deadline) return;
    for (const m of materials) {
      // 렌더타깃마다 생긴 프로그램 변형까지 모두 확인한다 (three 내부 캐시)
      const { programs } = gl.properties.get(m) as { programs?: Map<string, { isReady(): boolean }> };
      if (!programs || [...programs.values()].every((p) => p.isReady())) materials.delete(m);
    }
    if (materials.size) await new Promise<void>((r) => setTimeout(r, 10));
  }
}

/**
 * Canvas 를 `frameloop="never"` 로 열고 이 컴포넌트를 씬의 마지막 자식으로 두면,
 * 마운트 시점에 있는 모든 물체의 셰이더를 워밍업한 뒤 렌더 루프를 켠다.
 */
export function Precompile({ onReady }: { onReady?: () => void } = {}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const extra = useContext(ExtraTargets);

  useEffect(() => {
    let alive = true;
    const start = () => {
      if (!alive) return;
      setFrameloop("always");
      invalidate();
      onReady?.();
    };
    compileSpread(gl, scene, camera, scene, () => alive, extra).then(start, start);
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, setFrameloop, invalidate, extra, onReady]);

  return null;
}
