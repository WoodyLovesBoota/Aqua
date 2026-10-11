import { floorHeight, NO_GO } from "./lagoonHeight";
import { blocked, BOUNDS, pushAway, TANK } from "./lagoonNav";
import { GUEST_HEIGHT, GUEST_SCALE } from "./guestModel";
import type { PoseName } from "./guestPoses";
import { type Ground, groundY, HUT_BRIDGE, inObstacle, onSand, type Place, planPath, randomSandSpot, sandHeight, SPINE_LEN, spineAt, spineDir, type Waypoint } from "./guestNav";
import { BUNGALOWS, DECK_TOP, HAMMOCK, HUT, HUT_FLOOR, hutToWorld, PALMS, SUNBEDS, TORCHES } from "./resortLayout";
import * as THREE from "three";

/**
 * 손님 커플의 하루 — 활동(산책·선베드·해먹·수영·보트·방갈로·피어·횃불)을 시간대 가중치로 고르고,
 * 두 사람(a 가 앞장, b 는 손잡고 따라감)을 걷게 하고, 자리에 닿으면 포즈·자세를 바꾼다.
 * 렌더와 무관한 순수 상태 기계 — Guests.tsx 가 프레임마다 tick 하고 결과를 그린다.
 */
const { TOP, BOTTOM } = TANK;
const WALK = 0.55; // 걷는 속도 (월드/초)
const SWIM = 0.22;
const HIP = 0.42 * GUEST_SCALE; // 골반 높이 (앉을 때 엉덩이 = 자리 높이 − HIP)
const HAND_GAP = 0.22; // 손잡고 걸을 때 옆 간격
const rand = THREE.MathUtils.randFloat;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export type Activity = "stroll" | "sunbed" | "hammock" | "swim" | "boat" | "bungalow" | "pier" | "torch";
export const ACTIVITIES: Activity[] = ["stroll", "sunbed", "hammock", "swim", "boat", "bungalow", "pier", "torch"];

export interface Walker {
  x: number;
  y: number;
  z: number;
  yaw: number;
  ground: Ground;
  hut?: number;
  path: Waypoint[];
  /** 걷기 위상 (거리로 적분) */
  phase: number;
  pose: PoseName;
  tilt: number;
  lift: number;
  visible: boolean;
  hold: -1 | 0 | 1;
  /** 자리 고정(선베드·보트·해먹 등): 활동이 매 프레임 직접 놓는다 */
  pinned: boolean;
  /** b 가 a 를 손잡고 따라가는 중 */
  following: boolean;
}

export interface Boat {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  roll: number;
  pitch: number;
  tx: number;
  tz: number;
  /** 'moored' 정박 · 'out' 출항(리조트 구역 밖으로) · 'cruise' · 'home' 귀항 · 'dock' 접안 */
  mode: "moored" | "out" | "cruise" | "home" | "dock";
  cruiseT: number;
  wakeT: number;
  retarget: number;
}

export interface Couple {
  a: Walker;
  b: Walker;
  boat: Boat;
  activity: Activity;
  stage: string;
  timer: number;
  /** 바로 전 활동 둘 (같은 활동 연속 방지) */
  history: Activity[];
  t: number;
  /** 수영·보트가 수면에 남기는 파문 요청 */
  splash?: (x: number, z: number, strength: number) => void;
  /** 활동별 보조 상태 */
  mem: Record<string, number>;
  /** 점검용으로 활동을 고정 */
  force: Activity | null;
  hourOf: () => number;
  count: Record<Activity, number>;
}

// 피어 끝과 보트 정박 자세: 피어 끝에서 진행 방향으로 조금, 왼쪽(열린 물 쪽)으로 비켜 나란히
const PIER_END = spineAt(SPINE_LEN);
const PIER_DIR = spineDir(SPINE_LEN);
const PIER_LEFT: [number, number] = [-PIER_DIR[1], PIER_DIR[0]];
export const MOORING = { x: PIER_END[0] + PIER_DIR[0] * 0.1 + PIER_LEFT[0] * 0.38, z: PIER_END[1] + PIER_DIR[1] * 0.1 + PIER_LEFT[1] * 0.38, yaw: Math.atan2(-PIER_DIR[1], PIER_DIR[0]) };
/** 리조트 금지 사각형 밖 첫 목표 (출항·귀항 때 거쳐 간다) */
const HARBOUR_GATE: [number, number] = [Math.min(BOUNDS.x - 0.8, NO_GO.resort.x1 - 1.2), NO_GO.resort.z1 + 0.9];
/** 보트 좌석 (보트 로컬, 뱃머리 +x): 뒤 = 키잡이, 앞 = 손님. 좌석 윗면 0.12 */
const SEATS: [number, number][] = [
  [-0.12, 0],
  [0.22, 0],
];
const SEAT_Y = 0.02 + 0.12;
/** 손님이 쓰는 방갈로 (다리가 테라스 쪽으로 들어오는 집) */
const GUEST_HUTS = HUT_BRIDGE.map((b, i) => (b.front ? i : -1)).filter((i) => i >= 0);
/** 수영 구역: 선베드 앞 바다 (섬 금지 원 안, 수심 0.3~0.6) */
const SWIM_SPOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let x = -5.0; x <= -1.4; x += 0.25)
    for (let z = -2.4; z <= -0.4; z += 0.25) {
      const d = TOP - floorHeight(BOTTOM, x, z);
      if (d > 0.3 && d < 0.62 && Math.hypot(x - NO_GO.island.x, z - NO_GO.island.z) < NO_GO.island.r - 0.4) out.push([x, z]);
    }
  return out;
})();

function walker(x: number, z: number): Walker {
  return { x, y: floorHeight(BOTTOM, x, z), z, yaw: 0, ground: "sand", path: [], phase: 0, pose: "stand", tilt: 0, lift: 0, visible: true, hold: 0, pinned: false, following: false };
}

export function makeCouple(hourOf: () => number, force: Activity | null = null): Couple {
  // 시작 자리: 횃불 옆 모래 (선베드 앞은 물이다 — 소크에서 "물에서 시작해 걸어 나오는" 장면이 나왔다)
  const a = walker(TORCHES[0][0] + 0.25, TORCHES[0][1] - 0.3);
  const b = walker(TORCHES[0][0] + 0.25 + HAND_GAP * 0.7, TORCHES[0][1] - 0.3 - HAND_GAP * 0.7);
  const boat: Boat = { x: MOORING.x, z: MOORING.z, yaw: MOORING.yaw, speed: 0, roll: 0, pitch: 0, tx: 0, tz: 0, mode: "moored", cruiseT: 0, wakeT: 0, retarget: 0 };
  const c: Couple = { a, b, boat, activity: "stroll", stage: "go", timer: 0, history: [], t: 0, mem: {}, force, hourOf, count: Object.fromEntries(ACTIVITIES.map((k) => [k, 0])) as Record<Activity, number> };
  begin(c, force ?? "stroll");
  return c;
}

// ---------- 걷기 ----------
const setPath = (w: Walker, to: Place) => {
  w.path = planPath([w.x, w.z], w.ground, w.hut, to);
  w.pinned = false;
  w.following = false;
};
/** 경로를 따라 한 걸음. 도착하면 true */
function stepWalk(w: Walker, dt: number, speed = WALK) {
  if (!w.path.length) return true;
  let left = speed * dt;
  while (w.path.length && left > 0) {
    const n = w.path[0];
    const dx = n.x - w.x, dz = n.z - w.z;
    const d = Math.hypot(dx, dz);
    if (d <= left) {
      w.x = n.x;
      w.z = n.z;
      w.ground = n.ground;
      w.hut = n.hut;
      left -= d;
      w.path.shift();
    } else {
      w.x += (dx / d) * left;
      w.z += (dz / d) * left;
      const want = Math.atan2(-dz, dx);
      w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * Math.min(1, dt * 10);
      // 데크 ↔ 모래 경계 구간: 다음 점의 바닥 규칙을 미리 따른다 (데크 끝이 모래에 묻혀 있어 높이가 이어진다)
      w.ground = n.ground;
      w.hut = n.hut;
      left = 0;
    }
  }
  w.phase += speed * dt * 16;
  w.pose = "walk";
  w.y = groundY(w);
  return w.path.length === 0;
}
/** b 가 a 의 왼쪽 손 옆을 따라간다 (손잡기) */
function follow(b: Walker, a: Walker, dt: number) {
  const lx = Math.sin(a.yaw), lz = Math.cos(a.yaw);
  let tx = a.x + lx * HAND_GAP - Math.cos(a.yaw) * 0.04, tz = a.z + lz * HAND_GAP + Math.sin(a.yaw) * 0.04;
  // 손 옆자리가 장애물·물이면 a 쪽으로 붙는다 (좁은 길에선 바짝 붙어 지나간다)
  const o = inObstacle(tx, tz, 0.02);
  if (o || !onSand(tx, tz)) {
    tx = a.x + lx * 0.1 - Math.cos(a.yaw) * 0.12;
    tz = a.z + lz * 0.1 + Math.sin(a.yaw) * 0.12;
  }
  const dx = tx - b.x, dz = tz - b.z;
  const d = Math.hypot(dx, dz);
  const sp = Math.min(WALK * 1.35, d * 6);
  if (d > 0.005) {
    const k = Math.min(d, sp * dt) / d;
    b.x += dx * k;
    b.z += dz * k;
  }
  b.yaw += Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw)) * Math.min(1, dt * 10);
  b.ground = a.ground;
  b.hut = a.hut;
  b.phase += sp * dt * 16;
  b.pose = sp > 0.08 ? "walk" : "stand";
  b.y = groundY(b);
  b.following = true;
  a.hold = -1;
  b.hold = 1;
}
const face = (w: Walker, yaw: number) => (w.yaw = yaw);
const standAt = (w: Walker) => {
  w.pose = "stand";
  w.tilt = 0;
  w.lift = 0;
  w.hold = 0;
  w.pinned = false;
};

// ---------- 활동 선택 ----------
const WEIGHTS: Record<Activity, (h: number) => number> = {
  stroll: (h) => (h < 5 || h > 21 ? 0.8 : 2),
  sunbed: (h) => (h >= 8 && h <= 17 ? 3 : 0),
  hammock: (h) => (h >= 7 && h <= 18 ? 1.6 : 0.7),
  swim: (h) => (h >= 7.5 && h <= 17.5 ? 3 : 0),
  boat: (h) => (h >= 7 && h <= 18 ? 2.4 : h >= 19.5 || h < 4 ? 1.6 : 0.5),
  bungalow: (h) => (h >= 19 || h < 6 ? 3 : 1),
  pier: (h) => (h >= 16.5 && h <= 19.5 ? 4.5 : h < 7 ? 1.5 : 1.2),
  torch: (h) => (h >= 18.5 || h < 5.5 ? 3 : 0),
};
function chooseActivity(c: Couple): Activity {
  if (c.force) return c.force;
  const h = c.hourOf();
  // 바로 전 두 활동은 빼서 다양하게 (보트·방갈로만 번갈아 하던 밤 소크)
  const recent = c.history.slice(-2);
  const pool = ACTIVITIES.map((a) => ({ a, w: recent.includes(a) ? 0 : WEIGHTS[a](h) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) if ((r -= p.w) <= 0) return p.a;
  return "stroll";
}

function begin(c: Couple, act: Activity) {
  c.activity = act;
  c.stage = "go";
  c.timer = 0;
  c.mem = {};
  c.count[act]++;
  const { a, b } = c;
  for (const w of [a, b]) {
    w.pinned = false;
    w.visible = true;
    w.tilt = 0;
    w.lift = 0;
    w.hold = 0;
  }
  switch (act) {
    case "stroll":
      c.mem.legs = 2 + Math.floor(Math.random() * 2);
      setPath(a, { kind: "sand", ...xz(randomSandSpot(a.x, a.z, 2.5)) });
      break;
    case "sunbed":
      setPath(a, { kind: "sand", ...xz(bedFoot(0)) });
      break;
    case "hammock": {
      const [hx, hz] = hammockMid();
      // 해먹 옆 모래 (야자수 축에 수직으로 비킨 곳)
      const [px, pz] = hammockSide(0.55);
      c.mem.sx = px;
      c.mem.sz = pz;
      setPath(a, { kind: "sand", x: hx + (px - hx) * 0.6, z: hz + (pz - hz) * 0.6 });
      break;
    }
    case "swim": {
      const [ex, ez] = beachEntry();
      c.mem.ex = ex;
      c.mem.ez = ez;
      setPath(a, { kind: "sand", x: ex, z: ez });
      break;
    }
    case "boat":
      setPath(a, { kind: "deck", s: SPINE_LEN - 0.12 });
      break;
    case "bungalow": {
      const i = pick(GUEST_HUTS);
      c.mem.hut = i;
      setPath(a, { kind: "hut", i, lx: 0.26, lz: 0.78 });
      break;
    }
    case "pier":
      setPath(a, { kind: "deck", s: SPINE_LEN - 0.06 });
      break;
    case "torch": {
      const [tx, tz] = TORCHES[0];
      setPath(a, { kind: "sand", x: tx + 0.32, z: tz + 0.08 });
      break;
    }
  }
}
const xz = ([x, z]: [number, number]) => ({ x, z });
/** 선베드 i 의 발치 앞 모래 (걸어와서 눕기 시작하는 자리) */
function bedFoot(i: number): [number, number] {
  const s = SUNBEDS[i];
  return [s.x + Math.cos(s.yaw) * 0.45, s.z - Math.sin(s.yaw) * 0.45];
}
function hammockMid(): [number, number] {
  const pa = PALMS[HAMMOCK.a], pb = PALMS[HAMMOCK.b];
  return [(pa.x + pb.x) / 2, (pa.z + pb.z) / 2];
}
function hammockSide(d: number): [number, number] {
  const pa = PALMS[HAMMOCK.a], pb = PALMS[HAMMOCK.b];
  const dx = pb.x - pa.x, dz = pb.z - pa.z;
  const l = Math.hypot(dx, dz);
  const [mx, mz] = hammockMid();
  // 섬 안쪽(바다 반대)으로 비킨다 — 두 수직 중 섬 중심에 가까운 쪽
  const c1: [number, number] = [mx - (dz / l) * d, mz + (dx / l) * d];
  const c2: [number, number] = [mx + (dz / l) * d, mz - (dx / l) * d];
  const ok = (p: [number, number]) => onSand(p[0], p[1]) && !inObstacle(p[0], p[1]);
  if (ok(c1) && !ok(c2)) return c1;
  if (ok(c2) && !ok(c1)) return c2;
  return sandHeight(c1[0], c1[1]) > sandHeight(c2[0], c2[1]) ? c1 : c2;
}
/** 수영 입수 지점: 수영 지점에서 섬 중심 쪽으로 걸어 올라와 모래 높이 ≥ 0.07 이고 장애물(선베드 등) 밖인 첫 점 */
function beachEntry(): [number, number] {
  const [sx, sz] = pick(SWIM_SPOTS);
  const cx = NO_GO.island.x, cz = NO_GO.island.z;
  const len = Math.hypot(cx - sx, cz - sz);
  for (let d = 0; d < len; d += 0.05) {
    const x = sx + ((cx - sx) / len) * d, z = sz + ((cz - sz) / len) * d;
    if (sandHeight(x, z) >= 0.07 && !inObstacle(x, z, -0.05)) return [x, z];
  }
  return [TORCHES[0][0] + 0.25, TORCHES[0][1] - 0.3];
}

// ---------- 자리 놓기 ----------
function lieOnBed(w: Walker, i: number) {
  const s = SUNBEDS[i];
  const y = floorHeight(BOTTOM, s.x, s.z);
  w.pinned = true;
  w.x = s.x + Math.cos(s.yaw) * 0.1;
  w.z = s.z - Math.sin(s.yaw) * 0.1;
  w.y = y + 0.1;
  w.yaw = s.yaw;
  w.tilt = 1.2;
  w.lift = 0.03;
  w.pose = "lie";
  w.hold = 0;
}
function lieInHammock(w: Walker) {
  const pa = PALMS[HAMMOCK.a], pb = PALMS[HAMMOCK.b];
  const [mx, mz] = hammockMid();
  const y = floorHeight(BOTTOM, mx, mz) + HAMMOCK.h - HAMMOCK.sag;
  const yaw = Math.atan2(-(pb.z - pa.z), pb.x - pa.x);
  w.pinned = true;
  // 발 쪽 = pb 방향 (+x 로컬) 에서 몸 길이의 절반만큼 앞에 발
  w.x = mx + Math.cos(yaw) * 0.16;
  w.z = mz - Math.sin(yaw) * 0.16;
  w.y = y;
  w.yaw = yaw;
  w.tilt = 1.35;
  w.lift = 0.02;
  w.pose = "lie";
  w.hold = 0;
}
function sitOnGround(w: Walker, x: number, z: number, y: number, yaw: number) {
  w.pinned = true;
  w.x = x;
  w.z = z;
  w.y = y - HIP;
  w.yaw = yaw;
  w.tilt = 0;
  w.lift = 0;
  w.pose = "sit";
  w.hold = 0;
}
function sitInBoat(w: Walker, boat: Boat, seat: [number, number]) {
  const c = Math.cos(boat.yaw), s = Math.sin(boat.yaw);
  w.pinned = true;
  w.x = boat.x + c * seat[0] + s * seat[1];
  w.z = boat.z - s * seat[0] + c * seat[1];
  w.y = SEAT_Y - HIP + Math.sin(boat.roll) * seat[1] * 0.5;
  w.yaw = boat.yaw;
  w.tilt = 0;
  w.lift = 0;
  w.pose = "sit";
  w.ground = "deck";
}
/** 두 사람을 자리에서 보트로/보트에서 자리로 1초 동안 섞어 옮긴다 (ease) */
function glide(w: Walker, from: [number, number, number], to: [number, number, number], k: number) {
  const e = k * k * (3 - 2 * k);
  w.x = from[0] + (to[0] - from[0]) * e;
  w.y = from[1] + (to[1] - from[1]) * e + Math.sin(e * Math.PI) * 0.06;
  w.z = from[2] + (to[2] - from[2]) * e;
}

// ---------- 보트 ----------
const BOAT_TURN = 0.9;
const BOAT_SPEED = 0.95;
function boatTarget(b: Boat) {
  for (let i = 0; i < 30; i++) {
    const x = rand(-BOUNDS.x + 1.0, BOUNDS.x - 1.0), z = rand(-BOUNDS.z + 1.0, BOUNDS.z - 1.0);
    if (blocked(x, TOP - 0.3, z, 0.9, 0.6)) continue;
    if (Math.hypot(x - b.x, z - b.z) < 4) continue;
    b.tx = x;
    b.tz = z;
    b.retarget = rand(6, 10);
    return;
  }
  b.tx = 1.5;
  b.tz = 2.0;
  b.retarget = 6;
}
const TO = new THREE.Vector3();
function steerBoat(b: Boat, dt: number, speed: number, avoid: boolean) {
  TO.set(b.tx - b.x, 0, b.tz - b.z);
  if (avoid) {
    const fx = Math.cos(b.yaw), fz = -Math.sin(b.yaw);
    for (const ahead of [1.8, 0.9]) {
      const ax = b.x + fx * ahead, az = b.z + fz * ahead;
      if (blocked(ax, TOP - 0.3, az, 0.7, 0.6)) {
        pushAway(ax, az, TO, 2.2);
        break;
      }
    }
  }
  const want = Math.atan2(-TO.z, TO.x);
  const dy = Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw));
  const step = THREE.MathUtils.clamp(dy, -BOAT_TURN * dt, BOAT_TURN * dt);
  b.yaw += step;
  b.speed += (speed - b.speed) * Math.min(1, dt * 1.2);
  b.x += Math.cos(b.yaw) * b.speed * dt;
  b.z += -Math.sin(b.yaw) * b.speed * dt;
  b.x = THREE.MathUtils.clamp(b.x, -BOUNDS.x + 0.6, BOUNDS.x - 0.6);
  b.z = THREE.MathUtils.clamp(b.z, -BOUNDS.z + 0.6, BOUNDS.z - 0.6);
  // 회전·속도에 따라 살짝 기울고, 물결에 흔들린다
  b.roll += ((-step / dt) * 0.12 - b.roll) * Math.min(1, dt * 2);
}
function tickBoat(c: Couple, dt: number) {
  const b = c.boat;
  b.pitch = Math.sin(c.t * 1.3) * 0.015 + Math.sin(c.t * 2.1) * 0.01;
  if (b.mode === "moored") {
    b.roll += (Math.sin(c.t * 0.9) * 0.02 - b.roll) * Math.min(1, dt * 2);
    b.speed = 0;
    return;
  }
  if (b.mode === "out") {
    b.tx = HARBOUR_GATE[0];
    b.tz = HARBOUR_GATE[1];
    steerBoat(b, dt, 0.7, false);
    if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.8) {
      b.mode = "cruise";
      b.cruiseT = rand(30, 45);
      boatTarget(b);
    }
  } else if (b.mode === "cruise") {
    b.cruiseT -= dt;
    b.retarget -= dt;
    if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 1.0) boatTarget(b);
    steerBoat(b, dt, BOAT_SPEED, true);
    if (b.cruiseT <= 0) b.mode = "home";
  } else if (b.mode === "home") {
    b.tx = HARBOUR_GATE[0];
    b.tz = HARBOUR_GATE[1];
    steerBoat(b, dt, 0.8, true);
    if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.9) b.mode = "dock";
  } else if (b.mode === "dock") {
    // 정박 자세 뒤쪽 1.2 를 향해 들어오다 가까워지면 자세로 스르르
    const bx = MOORING.x - Math.cos(MOORING.yaw) * 1.2, bz = MOORING.z + Math.sin(MOORING.yaw) * 1.2;
    const d = Math.hypot(MOORING.x - b.x, MOORING.z - b.z);
    if (d > 1.4) {
      b.tx = bx;
      b.tz = bz;
      steerBoat(b, dt, 0.55, false);
    } else {
      const k = Math.min(1, dt * 1.5);
      b.x += (MOORING.x - b.x) * k;
      b.z += (MOORING.z - b.z) * k;
      b.yaw += Math.atan2(Math.sin(MOORING.yaw - b.yaw), Math.cos(MOORING.yaw - b.yaw)) * k;
      b.speed *= 1 - k;
      b.roll *= 1 - k;
      if (d < 0.03 && Math.abs(Math.atan2(Math.sin(MOORING.yaw - b.yaw), Math.cos(MOORING.yaw - b.yaw))) < 0.02) {
        b.x = MOORING.x;
        b.z = MOORING.z;
        b.yaw = MOORING.yaw;
        b.mode = "moored";
      }
    }
  }
  // 항적: 선미에서 작은 파임
  b.wakeT -= dt;
  if (b.speed > 0.25 && b.wakeT <= 0) {
    b.wakeT = 0.22;
    c.splash?.(b.x - Math.cos(b.yaw) * 0.45, b.z + Math.sin(b.yaw) * 0.45, 0.12 * b.speed);
  }
}

// ---------- 메인 틱 ----------
export function tickCouple(c: Couple, dt: number, t: number) {
  c.t = t;
  c.timer += dt;
  const { a, b } = c;
  tickBoat(c, dt);
  if (c.stage === "go") {
    // a 가 앞장서 걷고 b 는 손잡고 따라온다. a 가 닿으면 b 는 제 자리로 간다
    const arrived = stepWalk(a, dt);
    if (!arrived) follow(b, a, dt);
    else {
      a.pose = "stand";
      a.hold = 0;
      if (b.following || !b.path.length) {
        b.following = false;
        b.hold = 0;
        setPath(b, bSpot(c));
        c.stage = "go-b";
      }
    }
  } else if (c.stage === "go-b") {
    if (stepWalk(b, dt)) {
      b.pose = "stand";
      arriveBoth(c);
    } else a.pose = "stand";
  } else tickStage(c, dt);
  // 두 사람의 표준 자세 (고정 자리가 아닐 때): 바닥 높이
  for (const w of [a, b]) if (!w.pinned) w.y = groundY(w);
}

/** b 의 자리 (a 자리 옆) */
function bSpot(c: Couple): Place {
  const { a } = c;
  switch (c.activity) {
    case "sunbed":
      return { kind: "sand", ...xz(bedFoot(1)) };
    case "hammock":
      return { kind: "sand", x: c.mem.sx, z: c.mem.sz };
    case "boat":
      return { kind: "deck", s: SPINE_LEN - 0.42 };
    case "bungalow":
      return { kind: "hut", i: c.mem.hut, lx: -0.26, lz: 0.78 };
    case "pier":
      return { kind: "deck", s: SPINE_LEN - 0.06 - 0.0 };
    case "torch": {
      const [tx, tz] = TORCHES[0];
      return { kind: "sand", x: tx + 0.12, z: tz + 0.34 };
    }
    case "swim":
      return { kind: "sand", x: c.mem.ex + Math.sin(a.yaw) * HAND_GAP, z: c.mem.ez + Math.cos(a.yaw) * HAND_GAP };
    default:
      return { kind: "sand", x: a.x + Math.sin(a.yaw) * HAND_GAP, z: a.z + Math.cos(a.yaw) * HAND_GAP };
  }
}

/** 둘 다 자리에 닿았을 때: 활동의 본 단계로 */
function arriveBoth(c: Couple) {
  const { a, b } = c;
  c.timer = 0;
  switch (c.activity) {
    case "stroll":
      c.mem.legs -= 1;
      if (c.mem.legs > 0) {
        // 잠깐 서서 바다를 보고 다음 목표로
        c.stage = "pause";
        const toSea = Math.atan2(-(NO_GO.island.z - a.z), NO_GO.island.x - a.x) + Math.PI;
        face(a, toSea);
        face(b, toSea);
        a.pose = Math.random() < 0.5 ? "wave" : "stand";
        b.pose = "stand";
        c.mem.pauseT = rand(2, 4);
      } else finish(c);
      break;
    case "sunbed":
      lieOnBed(a, 0);
      lieOnBed(b, 1);
      c.stage = "stay";
      c.mem.stayT = rand(28, 45);
      break;
    case "hammock": {
      lieInHammock(a);
      const [mx, mz] = hammockMid();
      sitOnGround(b, c.mem.sx, c.mem.sz, floorHeight(BOTTOM, c.mem.sx, c.mem.sz), Math.atan2(-(mz - c.mem.sz), mx - c.mem.sx));
      c.stage = "stay";
      c.mem.stayT = rand(28, 42);
      break;
    }
    case "swim": {
      const [sx, sz] = pick(SWIM_SPOTS);
      c.mem.sx = sx;
      c.mem.sz = sz;
      c.stage = "wade";
      for (const w of [a, b]) {
        w.pinned = true;
        w.hold = 0;
      }
      c.mem.swimT = rand(38, 55);
      c.mem.driftT = 0;
      break;
    }
    case "boat": {
      c.stage = "board";
      c.mem.ax = a.x;
      c.mem.ay = a.y;
      c.mem.az = a.z;
      c.mem.bx = b.x;
      c.mem.by = b.y;
      c.mem.bz = b.z;
      a.pinned = b.pinned = true;
      break;
    }
    case "bungalow": {
      const h = BUNGALOWS[c.mem.hut];
      for (const [w, lx] of [
        [a, 0.26],
        [b, -0.26],
      ] as [Walker, number][]) {
        const [x, z] = hutToWorld(h, lx, 0.7);
        sitOnGround(w, x, z, HUT_FLOOR + 0.0825 * HUT, h.yaw);
      }
      c.stage = "stay";
      c.mem.stayT = rand(25, 40);
      c.mem.inside = c.hourOf() >= 19 || c.hourOf() < 6 ? 1 : 0;
      break;
    }
    case "pier": {
      // 피어 끝에 나란히 앉아 바다 쪽으로 다리를 내린다
      const yaw = MOORING.yaw;
      for (const [w, side] of [
        [a, -0.075],
        [b, 0.075],
      ] as [Walker, number][]) {
        sitOnGround(w, PIER_END[0] + PIER_LEFT[0] * side - PIER_DIR[0] * 0.02, PIER_END[1] + PIER_LEFT[1] * side - PIER_DIR[1] * 0.02, DECK_TOP, yaw);
      }
      c.stage = "stay";
      c.mem.stayT = rand(30, 45);
      break;
    }
    case "torch": {
      const [tx, tz] = TORCHES[0];
      const yaw = Math.atan2(-(NO_GO.island.z - tz), NO_GO.island.x - tx) + Math.PI; // 섬 중심 반대 = 바다 쪽
      sitOnGround(a, a.x, a.z, floorHeight(BOTTOM, a.x, a.z), yaw);
      sitOnGround(b, b.x, b.z, floorHeight(BOTTOM, b.x, b.z), yaw);
      c.stage = "stay";
      c.mem.stayT = rand(30, 48);
      break;
    }
  }
}

function finish(c: Couple) {
  c.history.push(c.activity);
  if (c.history.length > 3) c.history.shift();
  for (const w of [c.a, c.b]) standAt(w);
  begin(c, chooseActivity(c));
}

function tickStage(c: Couple, dt: number) {
  const { a, b, boat } = c;
  if (c.stage === "pause") {
    if (c.timer > c.mem.pauseT) {
      setPath(a, { kind: "sand", ...xz(randomSandSpot(a.x, a.z, 2.5)) });
      c.stage = "go";
    }
    return;
  }
  const act = c.activity;
  if (c.stage === "stay") {
    if (act === "bungalow" && c.mem.inside && c.timer > c.mem.stayT * 0.5) {
      // 밤: 안으로 들어간다 (문 앞에서 사라지고 창 불빛만)
      const h = BUNGALOWS[c.mem.hut];
      for (const w of [a, b]) standAt(w);
      setPath(a, { kind: "hut", i: c.mem.hut, lx: 0.0, lz: 0.42 });
      setPath(b, { kind: "hut", i: c.mem.hut, lx: -0.12, lz: 0.5 });
      c.stage = "door";
      c.timer = 0;
      c.mem.inside = 0;
      face(a, h.yaw + Math.PI);
      return;
    }
    if (c.timer > c.mem.stayT) {
      if (act === "pier" || act === "torch" || act === "hammock" || act === "bungalow") {
        // 일어나 제자리에 선다
        for (const w of [a, b]) {
          standAt(w);
          w.y = groundY(w);
        }
        if (act === "pier") {
          a.x -= PIER_DIR[0] * 0.08;
          a.z -= PIER_DIR[1] * 0.08;
          b.x -= PIER_DIR[0] * 0.3;
          b.z -= PIER_DIR[1] * 0.3;
        }
        if (act === "hammock") {
          const [sx, sz] = hammockSide(0.45);
          a.x = sx + 0.15;
          a.z = sz;
        }
        if (act === "bungalow") {
          const h = BUNGALOWS[c.mem.hut];
          for (const [w, lx] of [
            [a, 0.2],
            [b, -0.2],
          ] as [Walker, number][]) {
            const [x, z] = hutToWorld(h, lx, 0.88);
            w.x = x;
            w.z = z;
            w.ground = "hut";
            w.hut = c.mem.hut;
            w.y = groundY(w);
          }
        }
      } else if (act === "sunbed") {
        for (const [w, i] of [
          [a, 0],
          [b, 1],
        ] as [Walker, number][]) {
          standAt(w);
          const [x, z] = bedFoot(i);
          w.x = x;
          w.z = z;
          w.ground = "sand";
          w.y = groundY(w);
        }
      }
      finish(c);
    }
    return;
  }
  if (c.stage === "door") {
    const da = stepWalk(a, dt), db = stepWalk(b, dt);
    if (da) a.pose = "stand";
    if (da && db) {
      a.visible = b.visible = false;
      c.stage = "inside";
      c.timer = 0;
      c.mem.inT = rand(22, 40);
    }
    return;
  }
  if (c.stage === "inside") {
    if (c.timer > c.mem.inT) {
      a.visible = b.visible = true;
      const h = BUNGALOWS[c.mem.hut];
      for (const w of [a, b]) {
        standAt(w);
        face(w, h.yaw);
      }
      finish(c);
    }
    return;
  }
  // ----- 수영 -----
  if (c.stage === "wade" || c.stage === "float" || c.stage === "exit") {
    const outT = c.stage === "exit";
    const tx = outT ? c.mem.ex : c.mem.sx, tz = outT ? c.mem.ez : c.mem.sz;
    let allThere = true;
    for (const [w, side] of [
      [a, 0],
      [b, 1],
    ] as [Walker, number][]) {
      // 목표: 수영 지점(b 는 조금 옆) / 입수 지점
      const gx = tx + (side ? Math.sin(a.yaw) * 0.3 : 0), gz = tz + (side ? Math.cos(a.yaw) * 0.3 : 0);
      const dx = gx - w.x, dz = gz - w.z;
      const d = Math.hypot(dx, dz);
      const depth = TOP - floorHeight(BOTTOM, w.x, w.z);
      const swimming = depth > 0.26;
      const sp = swimming ? SWIM : WALK * Math.max(0.45, 1 - depth * 2.2);
      if (d > 0.03) {
        allThere = false;
        const k = Math.min(d, sp * dt) / d;
        w.x += dx * k;
        w.z += dz * k;
        const want = Math.atan2(-dz, dx);
        w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * Math.min(1, dt * 6);
        w.phase += sp * dt * (swimming ? 9 : 16);
        w.pose = swimming ? "swim" : "walk";
      } else if (c.stage === "float") {
        w.pose = "paddle";
        w.phase += dt * 2.5;
      } else w.pose = swimming ? "paddle" : "stand";
      w.ground = "sand";
      const floor = floorHeight(BOTTOM, w.x, w.z);
      if (w.pose === "swim") {
        w.tilt = -1.05;
        w.y = Math.max(floor + 0.05, TOP - 0.12);
      } else if (w.pose === "paddle") {
        w.tilt = -0.15;
        w.y = Math.max(floor, TOP - 0.27 + Math.sin(c.t * 1.7 + side) * 0.012);
      } else {
        w.tilt = 0;
        w.y = floor;
      }
      w.lift = 0;
      // 젓는 팔이 수면을 친다
      if (swimming && w.pose !== "stand") {
        c.mem[`sp${side}`] = (c.mem[`sp${side}`] ?? 0) - dt;
        if (c.mem[`sp${side}`] <= 0) {
          c.mem[`sp${side}`] = w.pose === "swim" ? 0.5 : 1.1;
          c.splash?.(w.x + Math.cos(w.yaw) * 0.12, w.z - Math.sin(w.yaw) * 0.12, w.pose === "swim" ? 0.1 : 0.05);
        }
      }
    }
    if (c.stage === "wade" && allThere) {
      c.stage = "float";
      c.timer = 0;
    } else if (c.stage === "float") {
      c.mem.driftT -= dt;
      if (c.mem.driftT <= 0) {
        // 근처 다른 수영 지점으로 천천히
        const near = SWIM_SPOTS.filter(([x, z]) => Math.hypot(x - c.mem.sx, z - c.mem.sz) < 1.6 && Math.hypot(x - c.mem.sx, z - c.mem.sz) > 0.5);
        const [sx, sz] = near.length ? pick(near) : pick(SWIM_SPOTS);
        c.mem.sx = sx;
        c.mem.sz = sz;
        c.mem.driftT = rand(6, 10);
      }
      if (c.timer > c.mem.swimT) c.stage = "exit";
    } else if (c.stage === "exit" && allThere) {
      for (const w of [a, b]) {
        standAt(w);
        w.ground = "sand";
        w.y = groundY(w);
      }
      finish(c);
    }
    return;
  }
  // ----- 보트 -----
  if (c.stage === "board") {
    const k = Math.min(1, c.timer / 1.2);
    const seatWorld = (seat: [number, number]): [number, number, number] => {
      const cs = Math.cos(boat.yaw), sn = Math.sin(boat.yaw);
      return [boat.x + cs * seat[0] + sn * seat[1], SEAT_Y - HIP, boat.z - sn * seat[0] + cs * seat[1]];
    };
    glide(a, [c.mem.ax, c.mem.ay, c.mem.az], seatWorld(SEATS[0]), k);
    glide(b, [c.mem.bx, c.mem.by, c.mem.bz], seatWorld(SEATS[1]), k);
    a.pose = b.pose = k > 0.5 ? "sit" : "walk";
    a.yaw = b.yaw = boat.yaw;
    if (k >= 1) {
      sitInBoat(a, boat, SEATS[0]);
      sitInBoat(b, boat, SEATS[1]);
      boat.mode = "out";
      c.stage = "cruise";
      c.timer = 0;
    }
    return;
  }
  if (c.stage === "cruise") {
    sitInBoat(a, boat, SEATS[0]);
    sitInBoat(b, boat, SEATS[1]);
    // 앞사람은 가끔 손을 흔든다
    b.pose = Math.sin(c.t * 0.35) > 0.8 ? "wave" : "sit";
    if (boat.mode === "moored") {
      c.stage = "unboard";
      c.timer = 0;
      c.mem.ax = a.x;
      c.mem.ay = a.y;
      c.mem.az = a.z;
      c.mem.bx = b.x;
      c.mem.by = b.y;
      c.mem.bz = b.z;
    }
    return;
  }
  if (c.stage === "unboard") {
    const k = Math.min(1, c.timer / 1.2);
    const [px, pz] = spineAt(SPINE_LEN - 0.12);
    const [qx, qz] = spineAt(SPINE_LEN - 0.42);
    glide(a, [c.mem.ax, c.mem.ay, c.mem.az], [px, DECK_TOP, pz], k);
    glide(b, [c.mem.bx, c.mem.by, c.mem.bz], [qx, DECK_TOP, qz], k);
    a.pose = b.pose = k > 0.4 ? "walk" : "sit";
    if (k >= 1) {
      for (const w of [a, b]) {
        standAt(w);
        w.ground = "deck";
        w.hut = undefined;
        w.y = groundY(w);
      }
      finish(c);
    }
    return;
  }
}

/** 점검용 요약 */
export function debugState(c: Couple) {
  const w = (p: Walker) => ({
    p: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
    yaw: +p.yaw.toFixed(2),
    ground: p.ground,
    pose: p.pose,
    vis: p.visible,
    pinned: p.pinned,
    path: p.path.length,
    sandH: +sandHeight(p.x, p.z).toFixed(3),
    obst: inObstacle(p.x, p.z, 0.2) != null,
  });
  return { activity: c.activity, stage: c.stage, timer: +c.timer.toFixed(1), a: w(c.a), b: w(c.b), boat: { x: +c.boat.x.toFixed(3), z: +c.boat.z.toFixed(3), yaw: +c.boat.yaw.toFixed(2), speed: +c.boat.speed.toFixed(2), mode: c.boat.mode }, count: c.count };
}

export { GUEST_HEIGHT, SEATS, SEAT_Y, SWIM_SPOTS };
