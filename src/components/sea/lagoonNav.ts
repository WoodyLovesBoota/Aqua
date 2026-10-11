import * as THREE from "three";
import { floorHeight, NO_GO, NO_GO_CIRCLES } from "./lagoonHeight";

/** 수조(라군) 치수: 젤리 블록 같은 둥근 라군. 생물 AI·그림자·소품이 함께 쓴다 */
export const TANK = {
  W: 17, // = 10 × lagoonHeight.S
  D: 13.6, // = 8 × S

  TOP: 0,
  BOTTOM: -2.8,
} as const;

/** 생물이 돌아다닐 수 있는 범위 */
export const BOUNDS = { x: TANK.W / 2 - 1.2, z: TANK.D / 2 - 1.0, yMin: TANK.BOTTOM + 0.6, yMax: TANK.TOP - 0.85 };

const REEF_MARGIN = 0.6;
const REEF_CLEARANCE = 1.0;

/** 섬·산호·방갈로 구역 안이거나 바닥이 너무 가까우면(clearance 미만) true */
export function blocked(x: number, y: number, z: number, margin = 0, clearance = 0.45) {
  const { island, reefs, resort } = NO_GO;
  if (Math.hypot(x - island.x, z - island.z) < island.r + margin) return true;
  // 산호 원은 바닥 여유가 작은 종(상어·거북·돌고래)만 본다 — 고래상어·만타(clearance ≥ 1)는 얕은 바닥 판정으로 산호 위에 못 오고,
  // 그 큰 margin(1.2) 을 산호 원에 더하면 벽·리조트 띠와 겹쳐 빠져나올 수 없는 주머니가 생긴다
  if (clearance < REEF_CLEARANCE) {
    const rm = Math.min(margin, REEF_MARGIN);
    for (const c of reefs) if (Math.hypot(x - c.x, z - c.z) < c.r + rm) return true;
  }
  if (x > resort.x0 - margin && x < resort.x1 + margin && z > resort.z0 - margin && z < resort.z1 + margin) return true;
  return shallow(x, y, z, clearance);
}

/**
 * 막힌 곳을 피해 밀어낼 방향: 섬·리조트 중심의 반대쪽을 거리 가중(1/d²)으로 섞는다 (+ 위로).
 * 가까운 쪽 하나만 고르면 두 구역의 경계에서 프레임마다 방향이 뒤집혀 제자리에서 떤다.
 */
export function pushAway(x: number, z: number, to: THREE.Vector3, k = 1.5) {
  const { resort } = NO_GO;
  const rc = { x: (resort.x0 + resort.x1) / 2, z: (resort.z0 + resort.z1) / 2 };
  let px = 0, pz = 0, wsum = 0;
  for (const c of [...NO_GO_CIRCLES, rc]) {
    const dx = x - c.x, dz = z - c.z;
    const w = 1 / Math.max(dx * dx + dz * dz, 0.25);
    px += dx * w;
    pz += dz * w;
    wsum += w;
  }
  let ux = px / wsum, uz = pz / wsum;
  // 벽 쪽으로 미는 성분은 소용없다 — 벽 클램프 ↔ 금지원 되밀기가 상쇄돼 그 자리에서 조향만 프레임마다 뒤집힌다
  // (앞 모래톱 산호 원이 앞 벽과 겹치는 구석에서 돌고래가 20초 머물던 문제). 그 축을 빼고 벽을 따라 미끄러진다
  if (Math.abs(x) > BOUNDS.x - 0.6 && Math.sign(ux) === Math.sign(x)) ux = 0;
  if (Math.abs(z) > BOUNDS.z - 0.6 && Math.sign(uz) === Math.sign(z)) uz = 0;
  to.x += ux * k;
  to.z += uz * k;
  to.y += 0.6;
}

/**
 * 목표 요까지의 최단 회전각. 거의 정반대(±180°)면 최단 방향의 부호가 프레임마다 뒤집혀 제자리에서 떨 수 있으므로
 * 직전에 돌던 방향(turnRate 부호)을 유지한다.
 */
export function yawDelta(wantYaw: number, yaw: number, turnRate: number) {
  let dy = Math.atan2(Math.sin(wantYaw - yaw), Math.cos(wantYaw - yaw));
  if (Math.abs(dy) > Math.PI - 0.35 && Math.abs(turnRate) > 1e-3) dy = Math.sign(turnRate) * Math.abs(dy);
  return dy;
}

/** 열린 물 안의 무작위 목표. 벽에 붙지 않도록 가운데 쪽을 조금 더 자주 고르고, 금지 구역은 다시 뽑는다 */
export function randomTarget(out: THREE.Vector3, margin = 0.3, yMin = BOUNDS.yMin, yMax = BOUNDS.yMax, clearance = 0.45) {
  for (let i = 0; i < 24; i++) {
    out.set(THREE.MathUtils.randFloatSpread(BOUNDS.x * 1.7), THREE.MathUtils.randFloat(yMin, yMax), THREE.MathUtils.randFloatSpread(BOUNDS.z * 1.7));
    if (!blocked(out.x, out.y, out.z, margin, clearance)) return out;
  }
  return out.set(1.5, -1.5, 2.0); // 항상 열린 앞바다
}

let shadowTex: THREE.CanvasTexture | null = null;
/** 바닥 블롭 그림자 텍스처 (방사형 그라데이션). 모든 생물이 하나를 공유한다 */
export function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(10,30,60,0.45)");
  g.addColorStop(1, "rgba(10,30,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return (shadowTex = new THREE.CanvasTexture(c));
}

/**
 * 블롭 그림자 갱신: 바닥 높이에 놓고 진행 방향으로 돌리며, 깊을수록 작고 짙게.
 * size = 기준 크기 [앞뒤, 좌우], grow = 수면 가까이 올라갈수록 더해지는 크기
 */
export function updateBlobShadow(mesh: THREE.Mesh, pos: THREE.Vector3, yaw: number, floorY: number, size: [number, number], grow: [number, number], scale: number, opacityMul = 1) {
  mesh.position.set(pos.x, floorY + 0.015, pos.z);
  mesh.rotation.z = -yaw;
  const depthK = THREE.MathUtils.clamp(1 - (pos.y - TANK.BOTTOM) / (TANK.TOP - TANK.BOTTOM), 0, 1);
  mesh.scale.set((size[0] + (1 - depthK) * grow[0]) * scale * 2, (size[1] + (1 - depthK) * grow[1]) * scale * 2, 1);
  (mesh.material as THREE.MeshBasicMaterial).opacity = (0.3 + depthK * 0.45) * opacityMul;
}

/**
 * 금지 구역(섬·산호 원, 방갈로 사각형) 안으로 들어온 위치를 가장 가까운 경계 밖으로 되밀어낸다.
 * 회피 조향이 늦어 넘어갔을 때의 안전망. 밀어낸 거리를 돌려준다 (0 이면 그대로).
 */
function resolveNoGo(pos: THREE.Vector3, margin = 0, clearance = 0.45) {
  const { resort } = NO_GO;
  let moved = 0;
  for (const c of NO_GO_CIRCLES) {
    const isReef = c !== NO_GO.island;
    if (isReef && clearance >= REEF_CLEARANCE) continue;
    const r = c.r + (isReef ? Math.min(margin, REEF_MARGIN) : margin);
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < r) {
      const k = d < 1e-4 ? 0 : (r - d) / d;
      pos.x += dx * k;
      pos.z += dz * k;
      moved += r - d;
    }
  }
  const x0 = resort.x0 - margin, x1 = resort.x1 + margin, z0 = resort.z0 - margin, z1 = resort.z1 + margin;
  if (pos.x > x0 && pos.x < x1 && pos.z > z0 && pos.z < z1) {
    // 가장 얕게 들어온 변으로 나간다 — 단, 수조 벽 밖(활동 범위 밖)으로 내보내는 변은 건너뛴다
    // (방갈로 구역 뒤 벽과의 틈에서 벽 클램프 ↔ 되밀기가 번갈아 걸려 영원히 갇히던 문제)
    const cands = [
      { d: pos.x - x0, ax: "x", v: x0 },
      { d: x1 - pos.x, ax: "x", v: x1 },
      { d: pos.z - z0, ax: "z", v: z0 },
      { d: z1 - pos.z, ax: "z", v: z1 },
    ].sort((a, b) => a.d - b.d);
    const cand = cands.find((c) => (c.ax === "x" ? Math.abs(c.v) <= BOUNDS.x + 0.1 : Math.abs(c.v) <= BOUNDS.z + 0.1)) ?? cands[0];
    if (cand.ax === "x") pos.x = cand.v;
    else pos.z = cand.v;
    moved += cand.d;
  }
  return moved;
}

/** 그 자리의 바닥이 (y − clearance) 보다 높으면 true — 섬 물가·여울 */
export function shallow(x: number, y: number, z: number, clearance: number) {
  return floorHeight(TANK.BOTTOM, x, z) > y - clearance;
}

// ---------- 공용 유영 스텝 ----------

/** 종별 조향 성격. 수치만 다르고 절차는 navStep 이 공유한다 */
export interface NavParams {
  margin: number; // 금지 구역 여유
  clearance: number; // 바닥 여유 (얕은 물가 회피)
  maxTurn: number; // rad/s
  pitchMin: number;
  pitchMax: number;
  pitchRate: number;
  speedRate: number;
  sepRadius: number; // 다른 생물과의 분리 반경
  sepK: number;
  sepY: number; // 분리할 때 위/아래로 비키는 양
  lookahead: readonly number[]; // 전방 장애물 탐지 거리 (먼 것부터)
  pushK: number;
  bank: number; // 회전 → 기울기
  bankMax: number;
  bankRate: number;
  yFloor: number; // 절대 바닥 (수심 하한)
  minTargetDist: number; // 목표는 이보다 멀리
  otherDist: number; // 목표는 다른 생물에서 이보다 멀리
  retargetRange: [number, number];
  arrive: number; // 이 안에 들어오면 도착
  bob: [number, number]; // 제자리 출렁임 [진폭, 각속도]
  /** 벽에서 더 들어오는 여유 (몸이 긴 종은 중심이 활동 범위 끝에 가면 코·꼬리가 유리를 뚫는다). 기본 0 */
  inset?: number;
}

export interface NavAgent {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  target: THREE.Vector3;
  retarget: number;
  turnRate: number;
  /** 제자리에 갇힌 누적 시간(초) — navStep 이 관리한다 */
  stuck?: number;
  /** 안전망이 잡은 탈출 목표를 지키는 남은 시간(초) — 그동안은 전방 탐지·벽 접촉으로 목표를 갈아타지 않는다 (돌아서는 데 1~2초가 든다) */
  escape?: number;
}

export interface NavStepOpts {
  targetSpeed: number;
  yMin: number;
  yMax: number;
  /** 위치 y 상한 (수면 스침·호흡 등은 yMax 보다 조금 더 허용) */
  yCeil: number;
  others: readonly THREE.Vector3[];
  avoidOthers?: boolean;
  pitchMax?: number;
  /** 벽에 닿았을 때 가운데 쪽 새 목표를 고를지 (기본 true) */
  wallRetarget?: boolean;
}

export interface NavTemps {
  v: THREE.Vector3;
  fwd: THREE.Vector3;
}

const rand = (r: [number, number]) => THREE.MathUtils.randFloat(r[0], r[1]);

/** 지금 위치·다른 생물에서 멀리 떨어진 열린 물 목표 (넓은 호를 그리며 가로지르도록) */
export function pickFarTarget(a: NavAgent, p: NavParams, yMin: number, yMax: number, others: readonly THREE.Vector3[]) {
  for (let i = 0; i < 8; i++) {
    randomTarget(a.target, p.margin, yMin, yMax, p.clearance);
    const clear = others.every((o) => o === a.pos || Math.hypot(a.target.x - o.x, a.target.z - o.z) > p.otherDist);
    if (a.target.distanceTo(a.pos) > p.minTargetDist && clear) break;
  }
  a.retarget = rand(p.retargetRange);
}

/** 도착했거나 시간이 지났으면 새 목표 */
export function maybeRetarget(a: NavAgent, dt: number, p: NavParams, yMin: number, yMax: number, others: readonly THREE.Vector3[]) {
  a.retarget -= dt;
  if (a.retarget <= 0 || a.target.distanceTo(a.pos) < p.arrive) pickFarTarget(a, p, yMin, yMax, others);
}

/**
 * 한 프레임의 조향·이동·제약: 전방 장애물 회피 → 다른 생물과 분리 → 요/피치 제한 조향 → 전진(얕은 바닥이면 멈춤) →
 * 활동 범위·금지 구역·바닥 클램프 → 벽이면 새 목표 → 뱅킹. 바닥 높이를 돌려준다 (그림자에 재사용).
 */
export function navStep(a: NavAgent, dt: number, p: NavParams, o: NavStepOpts, tmp: NavTemps): { floorY: number; shallowBlocked: boolean } {
  const to = tmp.v.copy(a.target).sub(a.pos);
  const escaping = (a.escape ?? 0) > 0;
  if (escaping) a.escape! -= dt;
  const fx = Math.cos(a.yaw), fz = -Math.sin(a.yaw);
  const probeY = Math.min(a.pos.y, TANK.TOP - 0.3);
  // 탈출 중엔 전방 회피를 쉰다 — 탈출 목표가 이미 금지 원에서 멀어지는 쪽이고, 밀어내기는 돌아서는 조향을 매 프레임 되돌린다
  // (얕은 바닥 정지·금지 구역 되밀기 안전망은 그대로 작동한다)
  if (!escaping) {
    for (const ahead of p.lookahead) {
      const ax = a.pos.x + fx * ahead, az = a.pos.z + fz * ahead;
      if (blocked(ax, probeY, az, p.margin, p.clearance)) {
        pushAway(ax, az, to, p.pushK);
        a.retarget = Math.min(a.retarget, 0.5);
        break;
      }
    }
  }
  if (o.avoidOthers !== false) {
    for (const oth of o.others) {
      if (oth === a.pos) continue;
      const dx = a.pos.x - oth.x, dz = a.pos.z - oth.z;
      const d = Math.hypot(dx, dz);
      if (d < p.sepRadius) {
        const k = (p.sepRadius - d) * p.sepK;
        to.x += (dx / Math.max(d, 0.05)) * k;
        to.z += (dz / Math.max(d, 0.05)) * k;
        to.y += p.sepY;
      }
    }
  }

  const wantYaw = Math.atan2(-to.z, to.x);
  const wantPitch = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), p.pitchMin, o.pitchMax ?? p.pitchMax);
  const dy = yawDelta(wantYaw, a.yaw, a.turnRate);
  const step = THREE.MathUtils.clamp(dy, -p.maxTurn * dt, p.maxTurn * dt);
  a.yaw += step;
  a.turnRate += (step / dt - a.turnRate) * Math.min(1, dt * 4);
  a.pitch += (wantPitch - a.pitch) * Math.min(1, dt * p.pitchRate);
  a.speed += (o.targetSpeed - a.speed) * Math.min(1, dt * p.speedRate);

  // 전진 — 얕은 바닥(섬 물가)으로는 아예 가지 않는다 (회피 조향이 늦어도 뭍으로 기어오르지 않게)
  const fwd = tmp.fwd.set(Math.cos(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), -Math.sin(a.yaw) * Math.cos(a.pitch));
  tmp.v.copy(a.pos).addScaledVector(fwd, a.speed * dt);
  const shallowBlocked = shallow(tmp.v.x, Math.min(tmp.v.y, TANK.TOP - 0.3), tmp.v.z, p.clearance * 0.6);
  const px = a.pos.x, pz = a.pos.z;
  if (shallowBlocked) {
    a.retarget = 0;
    a.speed *= 0.5;
  } else a.pos.copy(tmp.v);

  const bx = BOUNDS.x - (p.inset ?? 0), bz = BOUNDS.z - (p.inset ?? 0);
  a.pos.x = THREE.MathUtils.clamp(a.pos.x, -bx - 0.1, bx + 0.1);
  a.pos.z = THREE.MathUtils.clamp(a.pos.z, -bz - 0.1, bz + 0.1);
  // 벽·금지 구역에 닿았을 때 목표를 매 프레임 다시 뽑으면 조향이 수렴하지 못해 모서리에 갇힌다 —
  // 지금 목표가 그 자체로 막힌 곳일 때만 새로 고른다
  const targetBlocked = () => blocked(a.target.x, a.target.y, a.target.z, p.margin, p.clearance);
  // 목표가 지금 닿은 벽 너머(같은 쪽 벽 근처)인지
  const targetBeyondWall = () =>
    (Math.abs(a.pos.x) >= bx && Math.sign(a.target.x) === Math.sign(a.pos.x) && Math.abs(a.target.x) > bx - 0.8) ||
    (Math.abs(a.pos.z) >= bz && Math.sign(a.target.z) === Math.sign(a.pos.z) && Math.abs(a.target.z) > bz - 0.8);
  if (resolveNoGo(a.pos, p.margin, p.clearance) > 0 && !escaping && targetBlocked()) a.retarget = 0;
  const floorY = floorHeight(TANK.BOTTOM, a.pos.x, a.pos.z);
  a.pos.y = THREE.MathUtils.clamp(a.pos.y, Math.max(p.yFloor, floorY + p.clearance * 0.8), o.yCeil);
  if (o.wallRetarget !== false && !escaping && (Math.abs(a.pos.x) >= bx || Math.abs(a.pos.z) >= bz) && (targetBlocked() || targetBeyondWall())) {
    randomTarget(a.target, p.margin, o.yMin, o.yMax, p.clearance).multiplyScalar(0.5);
    a.retarget = rand(p.retargetRange);
  }
  // 안전망: 가려는데 1.5초 넘게 제자리면(클램프·되밀기가 서로 상쇄) 빠져나올 목표를 잡는다.
  // 금지 원에 붙어 있으면 그 원에서 멀어지는 쪽으로(벽에 붙었으면 벽을 따라) — 원과 벽이 만나는 교점에선 그쪽이 유일한 출구다
  // (열린 앞바다 목표는 보통 원 너머라 되밀기와 상쇄돼 영영 못 나갔다). 원이 없으면 열린 앞바다.
  const moved = Math.hypot(a.pos.x - px, a.pos.z - pz);
  a.stuck = moved < a.speed * dt * 0.25 && a.speed > 0.05 ? (a.stuck ?? 0) + dt : 0;
  if (a.stuck > 1.5) {
    let ex = 0, ez = 0, best = 1.0;
    for (const c of NO_GO_CIRCLES) {
      // blocked/resolveNoGo 와 같은 규칙: 산호 원은 clearance < 1 종만 보고 여유는 REEF_MARGIN 까지
      // (고래상어가 자기와 무관한 산호 원을 '가장 가까운 원'으로 골라 섬 쪽으로 탈출하려다 더 박히던 문제)
      const isReef = c !== NO_GO.island;
      if (isReef && p.clearance >= REEF_CLEARANCE) continue;
      const dx = a.pos.x - c.x, dz = a.pos.z - c.z;
      const gap = Math.hypot(dx, dz) - c.r - (isReef ? Math.min(p.margin, REEF_MARGIN) : p.margin);
      if (gap < best) {
        best = gap;
        ex = dx;
        ez = dz;
      }
    }
    if (Math.abs(a.pos.x) >= bx - 0.2) ex = 0;
    if (Math.abs(a.pos.z) >= bz - 0.2) ez = 0;
    const n = Math.hypot(ex, ez);
    const y = THREE.MathUtils.clamp(a.target.y, o.yMin, o.yMax);
    if (n > 0.1) a.target.set(THREE.MathUtils.clamp(a.pos.x + (ex / n) * 4, -bx * 0.9, bx * 0.9), y, THREE.MathUtils.clamp(a.pos.z + (ez / n) * 4, -bz * 0.9, bz * 0.9));
    else a.target.set(THREE.MathUtils.randFloat(-1, 2.5), y, THREE.MathUtils.randFloat(1, 3.5));
    a.retarget = rand(p.retargetRange);
    a.escape = 1.5 + Math.PI / p.maxTurn; // 돌아서는 데 드는 시간 + 여유 (고래상어처럼 느리게 도는 종은 더 길게)
    a.stuck = 0;
  }

  const bankRoll = THREE.MathUtils.clamp(-a.turnRate * p.bank, -p.bankMax, p.bankMax);
  a.roll += (bankRoll - a.roll) * Math.min(1, dt * p.bankRate);
  return { floorY, shallowBlocked };
}
