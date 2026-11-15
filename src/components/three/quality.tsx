"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { captureParam, DEBUG_ON, publishDebug } from "@/components/creature/debugProbe";

/**
 * 렌더 예산 관리 — "가능한 한 선명하게, 단 끊기지 않게".
 * 해상도 배율(DPR)을 기기 배율(최대 2)까지 올리되 두 가지 한도를 둔다:
 *  1. 픽셀 예산: 그리는 픽셀 수가 PIXEL_BUDGET 을 넘지 않게 (4K·5K 화면에서 배율 2 를 그대로 쓰지 않는다)
 *  2. 프레임 예산: 프레임 간격이 SLOW_MS 를 넘는 상태가 이어지면 배율을 한 단계 내리고, 한동안 여유가 있으면 다시 올려 본다
 *     (올렸다가 또 느려지면 다음 시도까지 기다리는 시간을 두 배로 — 오르내림이 눈에 띄지 않게).
 * 배율을 내려도 빨라지지 않으면(저전력 모드의 30Hz 고정처럼 화면 주사율이 한도) 내리는 게 손해라 원래대로 돌리고 한동안 손대지 않는다.
 * 점검용: ?dpr=<값> 고정.
 */
const MAX_DPR = 2;
const PIXEL_BUDGET = 2880 * 1800 * 1.12; // 16인치 레티나 전체 화면까지는 배율 2 그대로
const FLOOR = 0.6; // 한도 배율 대비 최저 (그 밑은 흐려서 차라리 끊기는 게 낫다)
const STEP = 0.85;
const WINDOW_S = 1.5;
const SLOW_MS = 1000 / 48; // 60Hz 에서 프레임을 자주 놓치는 수준
const FAST_MS = 1000 / 57;
const FIXED = Number(captureParam("dpr")) || 0;

export function Quality() {
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);
  const s = useRef({ cap: 1, dpr: 0, acc: 0, n: 0, t: 0, calm: 0, wait: 8, before: 0, probing: false, raised: false, lockedFor: 0 });

  // 한도 배율: 기기 배율·MAX_DPR·픽셀 예산 중 가장 작은 값. 크기가 바뀌면 다시 잡는다
  useEffect(() => {
    const q = s.current;
    const device = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cap = FIXED || Math.max(1, Math.min(device, Math.sqrt(PIXEL_BUDGET / Math.max(1, size.width * size.height))));
    const ratio = q.dpr > 0 ? q.dpr / q.cap : 1; // 내려가 있었다면 그 비율을 유지
    q.cap = cap;
    q.dpr = cap * (FIXED ? 1 : ratio);
    setDpr(q.dpr);
  }, [size.width, size.height, setDpr]);

  useFrame((state, dt) => {
    const q = s.current;
    // Canvas 가 다시 그려지면 R3F 가 배율을 prop 값으로 되돌린다 → 다시 맞춘다
    if (Math.abs(state.viewport.dpr - q.dpr) > 1e-3) setDpr(q.dpr);
    if (FIXED || dt > 0.1) return; // 탭 전환·긴 작업 뒤 프레임은 재지 않는다
    q.acc += dt;
    q.n++;
    q.t += dt;
    if (q.t < WINDOW_S) return;
    const ms = (q.acc / q.n) * 1000;
    q.acc = q.n = q.t = 0;
    if (DEBUG_ON) publishDebug("quality", { dpr: q.dpr, cap: q.cap, ms, wait: q.wait, locked: q.lockedFor });
    const apply = (d: number) => setDpr((q.dpr = d));
    if (q.lockedFor > 0) {
      q.lockedFor -= WINDOW_S;
      return;
    }
    if (q.probing) {
      // 방금 내린 효과 확인: 8% 도 안 빨라졌으면 해상도 탓이 아니다 → 되돌리고 1분 쉰다
      q.probing = false;
      if (ms > q.before * 0.92) {
        apply(q.cap);
        q.lockedFor = 60;
        return;
      }
    }
    if (ms > SLOW_MS && q.dpr > q.cap * FLOOR + 1e-3) {
      if (q.raised) q.wait = Math.min(120, q.wait * 2); // 올려 본 뒤 또 느려졌다 → 다음엔 더 오래 기다린다
      q.raised = false;
      q.before = ms;
      q.probing = true;
      q.calm = 0;
      apply(Math.max(q.cap * FLOOR, q.dpr * STEP));
    } else if (ms < FAST_MS && q.dpr < q.cap - 1e-3) {
      q.calm += WINDOW_S;
      if (q.calm >= q.wait) {
        q.calm = 0;
        q.raised = true;
        apply(Math.min(q.cap, q.dpr / STEP));
      }
    } else q.calm = 0;
  });
  return null;
}
