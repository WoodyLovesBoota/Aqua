import * as THREE from "three";
import { makePose, type Pose } from "./guestModel";

/**
 * 손님 포즈 프리셋 — 활동 상태가 고른 포즈 이름을 시간·위상에 따라 채우고, 현재 포즈는 그쪽으로 부드럽게 섞인다.
 * 그룹(전체) 변환 — 눕기 각도·높이 — 는 활동 쪽이 정하고, 여기선 부위 각도만 다룬다.
 */
export type PoseName = "stand" | "walk" | "sit" | "lie" | "swim" | "wave" | "paddle" | "hug";

export interface PoseCtx {
  t: number; // 초
  phase: number; // 걷기·젓기 위상 (라디안, 활동 쪽이 속도에 맞춰 적분한다)
  seed: number; // 사람마다 다른 위상 오프셋
  /** 손잡기: 이쪽 손을 상대 쪽으로 내린다 (−1 왼손, 1 오른손, 0 없음) */
  hold: -1 | 0 | 1;
}

const lerp = THREE.MathUtils.lerp;

/** 프리셋을 out 에 채운다 */
export function fillPose(name: PoseName, c: PoseCtx, out: Pose) {
  const { t, phase, seed } = c;
  const breathe = Math.sin(t * 1.6 + seed) * 0.03;
  // 기본: 서기
  out.body.pitch = 0;
  out.body.roll = 0;
  out.body.yaw = 0;
  out.head.nod = 0;
  out.head.turn = Math.sin(t * 0.5 + seed) * 0.18;
  out.head.tilt = 0;
  out.armL.swing = 0;
  out.armL.raise = 0.12 + breathe;
  out.armR.swing = 0;
  out.armR.raise = 0.12 + breathe;
  out.legL.swing = 0;
  out.legL.spread = 0.04;
  out.legR.swing = 0;
  out.legR.spread = 0.04;
  switch (name) {
    case "walk": {
      const s = Math.sin(phase);
      out.legL.swing = s * 0.55;
      out.legR.swing = -s * 0.55;
      out.armL.swing = -s * 0.35;
      out.armR.swing = s * 0.35;
      out.body.pitch = 0.06;
      out.head.turn = Math.sin(t * 0.7 + seed) * 0.12;
      out.head.nod = Math.abs(Math.cos(phase)) * 0.03;
      break;
    }
    case "sit": {
      out.legL.swing = 1.5;
      out.legR.swing = 1.5;
      out.legL.spread = 0.08;
      out.legR.spread = 0.08;
      out.armL.swing = 0.5;
      out.armR.swing = 0.5;
      out.armL.raise = 0.08 + breathe;
      out.armR.raise = 0.08 + breathe;
      out.body.pitch = -0.06;
      break;
    }
    case "lie": {
      // 등을 대고 누움 (그룹이 90° 눕힌다): 팔은 몸 옆, 다리는 쭉, 머리는 살짝 들어
      out.armL.swing = 0.15;
      out.armR.swing = 0.15;
      out.armL.raise = 0.2;
      out.armR.raise = 0.2;
      out.head.nod = 0.25;
      out.head.turn = Math.sin(t * 0.3 + seed) * 0.1;
      out.legL.spread = 0.06;
      out.legR.spread = 0.06;
      break;
    }
    case "swim": {
      // 그룹이 앞으로 60° 기울인다. 팔은 번갈아 크게 젓고(앞에서 아래로) 다리는 작게 찬다, 머리는 들어 수면 위
      const a = phase;
      out.armL.swing = 1.2 + Math.sin(a) * 1.1;
      out.armR.swing = 1.2 + Math.sin(a + Math.PI) * 1.1;
      out.armL.raise = 0.35 + Math.cos(a) * 0.2;
      out.armR.raise = 0.35 - Math.cos(a) * 0.2;
      out.legL.swing = Math.sin(a * 2) * 0.25;
      out.legR.swing = -Math.sin(a * 2) * 0.25;
      out.head.nod = -0.9;
      out.head.turn = 0;
      break;
    }
    case "paddle": {
      // 물에 서서 둥둥: 팔을 벌려 천천히 젓는다
      out.armL.swing = 0.5 + Math.sin(phase) * 0.3;
      out.armR.swing = 0.5 + Math.cos(phase) * 0.3;
      out.armL.raise = 0.9 + breathe;
      out.armR.raise = 0.9 + breathe;
      out.legL.swing = Math.sin(phase * 1.3) * 0.2;
      out.legR.swing = -Math.sin(phase * 1.3) * 0.2;
      out.head.nod = -0.2;
      break;
    }
    case "wave": {
      // 오른팔을 들어 흔든다
      out.armR.swing = 0.3;
      out.armR.raise = 2.6 + Math.sin(t * 7 + seed) * 0.35;
      out.head.tilt = 0.12;
      out.head.turn = 0;
      break;
    }
    case "hug": {
      out.armL.swing = 1.2;
      out.armR.swing = 1.2;
      out.armL.raise = 0.3;
      out.armR.raise = 0.3;
      out.head.nod = 0.15;
      break;
    }
    default:
      break;
  }
  if (c.hold === -1) {
    out.armL.swing = lerp(out.armL.swing, 0.1, 0.85);
    out.armL.raise = 0.55;
  } else if (c.hold === 1) {
    out.armR.swing = lerp(out.armR.swing, 0.1, 0.85);
    out.armR.raise = 0.55;
  }
}

const TMP = makePose();
/** cur 을 name 포즈 쪽으로 k 만큼 섞는다 (프레임마다 호출) */
export function blendPose(cur: Pose, name: PoseName, c: PoseCtx, k: number) {
  fillPose(name, c, TMP);
  for (const key of Object.keys(cur) as (keyof Pose)[]) {
    const a = cur[key] as Record<string, number>;
    const b = TMP[key] as Record<string, number>;
    for (const f of Object.keys(a)) a[f] = lerp(a[f], b[f], k);
  }
}
