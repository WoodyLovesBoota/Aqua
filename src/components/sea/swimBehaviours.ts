import * as THREE from "three";
import { captureParam, publishDebug } from "@/components/creature/debugProbe";
import type { Behaviour } from "./LagoonSwimmer";
import { blocked, BOUNDS, maybeRetarget, type NavAgent, type NavParams, pickFarTarget, randomTarget, TANK } from "./lagoonNav";

const { TOP, BOTTOM } = TANK;
const rand = THREE.MathUtils.randFloat;
const lerpTo = (cur: number, target: number, dt: number, rate: number) => cur + (target - cur) * Math.min(1, dt * rate);

function agent(pos: THREE.Vector3, spawn: [number, number, number], yaw: number, target: [number, number, number], retarget: number, speed: number): NavAgent {
  pos.set(...spawn);
  return { pos, yaw, pitch: 0, roll: 0, speed, target: new THREE.Vector3(...target), retarget, turnRate: 0 };
}

// ---------- 만타: 중간 수심에서 넓은 호를 그리며 활공, 가끔 수면을 스친다 ----------
const MANTA_CRUISE = { yMin: BOTTOM + 1.0, yMax: TOP - 0.9 };
const SKIM_Y = TOP - 0.55;
interface MantaState extends NavAgent {
  skim: number;
  nextSkim: number;
}
const mantaNav: NavParams = {
  margin: 1.2, // 날개가 넓고 수심이 높아 화면에서 섬과 겹쳐 보이지 않게 멀리
  clearance: 1.0,
  maxTurn: 0.9,
  pitchMin: -0.25,
  pitchMax: 0.25,
  pitchRate: 2,
  speedRate: 1.5,
  sepRadius: 2.6,
  sepK: 4,
  sepY: 0.4,
  lookahead: [2.0, 1.0], // 회전 반경(≈ 1)이 크므로 멀리 본다
  pushK: 2.5,
  bank: 0.7, // 가오리는 크게 기운다
  bankMax: 0.7,
  bankRate: 2,
  yFloor: MANTA_CRUISE.yMin - 0.2,
  minTargetDist: 5,
  otherDist: 4,
  retargetRange: [6, 10],
  arrive: 0.8,
  bob: [0.04, 0.8],
  inset: 0.4,
};
export const manta: Behaviour<MantaState> = {
  species: "manta",
  scale: 0.5, // 날개폭 ≈ 1.85 (실제 비율 압축: 돌고래 1 기준 만타 폭 1.6)
  nav: mantaNav,
  shadow: { size: [1.3, 1.7], grow: [0.6, 0.7] },
  init: (pos) => ({ ...agent(pos, [-4.5, -1.3, 3.0], 0.1, [4.5, -1.3, 3.5], 6, 0.8), skim: 0, nextSkim: 14 }),
  tick(s, dt, ctx) {
    s.nextSkim -= dt;
    if (s.skim > 0) s.skim -= dt;
    else if (s.nextSkim <= 0) {
      s.skim = rand(5, 8);
      s.nextSkim = rand(18, 30);
      s.retarget = 0;
    }
    const yMin = s.skim > 0 ? SKIM_Y - 0.25 : MANTA_CRUISE.yMin;
    const yMax = s.skim > 0 ? SKIM_Y : MANTA_CRUISE.yMax;
    maybeRetarget(s, dt, mantaNav, yMin, yMax, ctx.others);
    return { yMin, yMax, yCeil: SKIM_Y + 0.05, targetSpeed: s.skim > 0 ? 0.65 : 0.85, others: ctx.others };
  },
  motion(s, m, dt) {
    m.beat = lerpTo(m.beat, 0.75 + s.speed * 0.35, dt, 2);
    m.amp = 0.75 + Math.min(0.25, s.speed * 0.25);
    m.turn = lerpTo(m.turn, THREE.MathUtils.clamp(s.turnRate * 0.6, -1, 1), dt, 4);
  },
};

// ---------- 거북: 바닥 가까이 느리게, 25~40초마다 수면에서 숨쉬기 ----------
const TURTLE_CRUISE = { yMin: BOTTOM + 0.75, yMax: BOTTOM + 1.6 };
const BREATH_Y = TOP - 0.42;
interface TurtleState extends NavAgent {
  /** 0 = 평소, 1 = 올라가는 중, 2 = 수면에서 쉬는 중 */
  breath: 0 | 1 | 2;
  breathT: number;
  nextBreath: number;
}
const turtleNav: NavParams = {
  margin: 0.6,
  clearance: 0.6,
  maxTurn: 1.1,
  pitchMin: -0.4,
  pitchMax: 0.45,
  pitchRate: 2,
  speedRate: 1.5,
  sepRadius: 2.2,
  sepK: 3.5,
  sepY: -0.3, // 비킬 땐 아래로
  lookahead: [1.4, 0.7],
  pushK: 2.0,
  bank: 0.35,
  bankMax: 0.4,
  bankRate: 2,
  yFloor: TURTLE_CRUISE.yMin - 0.15,
  minTargetDist: 3.5,
  otherDist: 3.5,
  retargetRange: [7, 12],
  arrive: 0.7,
  bob: [0.03, 0.9],
};
export const turtle: Behaviour<TurtleState> = {
  species: "turtle",
  scale: 0.26, // 전체 길이 ≈ 0.8 (가장 작다 — 실제 1.1m)
  nav: turtleNav,
  shadow: { size: [1.2, 1.2], grow: [0.6, 0.6] },
  init: (pos) => ({ ...agent(pos, [3.5, BOTTOM + 1.0, 3.0], 2.4, [-3, BOTTOM + 1.0, 1], 8, 0.5), breath: 0, breathT: 0, nextBreath: 20 }),
  tick(s, dt, ctx) {
    if (s.breath === 0) {
      s.nextBreath -= dt;
      if (s.nextBreath <= 0) {
        s.breath = 1;
        s.target.set(s.pos.x + Math.cos(s.yaw) * 1.5, BREATH_Y, s.pos.z - Math.sin(s.yaw) * 1.5);
        if (blocked(s.target.x, s.target.y, s.target.z, turtleNav.margin, turtleNav.clearance)) randomTarget(s.target, turtleNav.margin, BREATH_Y - 0.05, BREATH_Y, turtleNav.clearance);
      }
    } else if (s.breath === 1) {
      if (s.pos.y > BREATH_Y - 0.2) {
        s.breath = 2;
        s.breathT = rand(2.5, 4);
      }
    } else {
      s.breathT -= dt;
      s.target.y = BREATH_Y;
      if (s.breathT <= 0) {
        s.breath = 0;
        s.nextBreath = rand(25, 40);
        s.retarget = 0;
      }
    }
    const yMin = s.breath ? BREATH_Y - 0.1 : TURTLE_CRUISE.yMin;
    const yMax = s.breath ? BREATH_Y : TURTLE_CRUISE.yMax;
    if (s.breath === 0) maybeRetarget(s, dt, turtleNav, yMin, yMax, ctx.others);
    const targetSpeed = s.breath === 2 ? 0.15 : s.breath === 1 ? 0.7 : 0.55;
    return { yMin, yMax, yCeil: BREATH_Y + 0.03, targetSpeed, others: ctx.others, wallRetarget: s.breath === 0 };
  },
  motion(s, m, dt) {
    // 수면에서 쉴 때는 거의 멈춘 채 살살 젓는다
    m.beat = lerpTo(m.beat, s.breath === 2 ? 0.5 : 0.8 + s.speed * 0.5, dt, 2);
    m.amp = s.breath === 2 ? 0.35 : 0.7 + Math.min(0.3, s.speed * 0.4);
    m.turn = lerpTo(m.turn, THREE.MathUtils.clamp(s.turnRate * 0.6, -1, 1), dt, 4);
  },
};

// ---------- 돌고래: 가장 빠르게 중상층을 돌다 가끔 수면 위로 점프 ----------
const DOLPHIN_CRUISE = { yMin: BOTTOM + 1.1, yMax: TOP - 0.7 };
const GRAVITY = 7.5;
// 캡처·점검용: ?jump=초 로 첫 점프 시각을 당길 수 있다
const FIRST_JUMP = Number(captureParam("jump")) || 16;
type DolphinPhase = "cruise" | "windup" | "air" | "dive";
interface DolphinState extends NavAgent {
  phase: DolphinPhase;
  nextJump: number;
  vy: number;
  windupT: number;
  nearJump: boolean;
}
const dolphinNav: NavParams = {
  margin: 0.6,
  clearance: 0.75,
  maxTurn: 2.0,
  pitchMin: -0.6,
  pitchMax: 0.5,
  pitchRate: 2.5,
  speedRate: 2,
  sepRadius: 2.4,
  sepK: 3.5,
  sepY: 0,
  lookahead: [1.8, 0.9],
  pushK: 2.5,
  bank: 0.4,
  bankMax: 0.6,
  bankRate: 3,
  yFloor: DOLPHIN_CRUISE.yMin - 0.3,
  minTargetDist: 4.5,
  otherDist: 3.5,
  retargetRange: [5, 9],
  arrive: 0.8,
  bob: [0.03, 1.3],
};
export const dolphin: Behaviour<DolphinState> = {
  species: "dolphin",
  scale: 0.33, // 몸길이 ≈ 1.15 (비율의 기준)
  nav: dolphinNav,
  shadow: { size: [1.6, 0.9], grow: [0.8, 0.5] },
  init: (pos) => ({ ...agent(pos, [4.5, -1.0, -3.5], Math.PI * 0.75, [-4, -1.0, 3.5], 6, 1.2), phase: "cruise", nextJump: FIRST_JUMP, vy: 0, windupT: 0, nearJump: false }),
  tick(s, dt, ctx) {
    const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
    s.nearJump = false;
    if (s.phase === "cruise") {
      s.nextJump -= dt;
      if (s.nextJump <= 0) {
        // 점프 지점: 앞쪽 2.5 가 열린 물이면 거기, 아니면 열린 물 아무 데나 골라 달려간다
        const ax = s.pos.x + fx * 2.5, az = s.pos.z + fz * 2.5;
        const open = !blocked(ax, TOP - 0.3, az, dolphinNav.margin, dolphinNav.clearance) && Math.abs(ax) < BOUNDS.x - 0.6 && Math.abs(az) < BOUNDS.z - 0.6;
        if (open) s.target.set(ax, TOP - 0.3, az);
        else randomTarget(s.target, dolphinNav.margin + 0.3, TOP - 0.35, TOP - 0.3, dolphinNav.clearance);
        s.phase = "windup";
        s.windupT = 0;
      } else maybeRetarget(s, dt, dolphinNav, DOLPHIN_CRUISE.yMin, DOLPHIN_CRUISE.yMax, ctx.others);
    } else if (s.phase === "windup") {
      // 8초 안에 못 뛰면(갇힘 등) 포기. 지점 반경은 회전 반경(속도/회전율 ≈ 1.3)보다 넓게 — 아니면 주위를 맴돈다
      s.windupT += dt;
      const dxz = Math.hypot(s.target.x - s.pos.x, s.target.z - s.pos.z);
      s.nearJump = dxz < 2.4;
      s.target.y = s.nearJump ? TOP + 0.4 : TOP - 0.3;
      if (s.windupT > 8) {
        s.phase = "cruise";
        s.nextJump = 4;
        pickFarTarget(s, dolphinNav, DOLPHIN_CRUISE.yMin, DOLPHIN_CRUISE.yMax, ctx.others);
      } else if (s.nearJump && s.pos.y >= TOP - 0.05) {
        s.phase = "air";
        s.vy = 2.9;
        ctx.splash?.(s.pos.x, s.pos.z, 1.6);
      }
    } else if (s.phase === "air") {
      // 포물선: 조향 없이 직접 움직인다
      s.vy -= GRAVITY * dt;
      s.pos.y += s.vy * dt;
      s.pos.x = THREE.MathUtils.clamp(s.pos.x + fx * s.speed * dt, -BOUNDS.x, BOUNDS.x);
      s.pos.z = THREE.MathUtils.clamp(s.pos.z + fz * s.speed * dt, -BOUNDS.z, BOUNDS.z);
      s.pitch = THREE.MathUtils.clamp(Math.atan2(s.vy, s.speed), -1.1, 1.1);
      if (s.pos.y <= TOP - 0.05 && s.vy < 0) {
        s.phase = "dive";
        ctx.splash?.(s.pos.x, s.pos.z, 2.0);
        pickFarTarget(s, dolphinNav, DOLPHIN_CRUISE.yMin, DOLPHIN_CRUISE.yMax, ctx.others);
        s.target.y = DOLPHIN_CRUISE.yMin + 0.2;
        s.nextJump = rand(18, 30);
      }
    } else if (s.pos.y < DOLPHIN_CRUISE.yMax - 0.3) s.phase = "cruise";

    const windup = s.phase === "windup";
    return {
      skipNav: s.phase === "air",
      yMin: DOLPHIN_CRUISE.yMin,
      yMax: DOLPHIN_CRUISE.yMax,
      // 점프 지점 근처에서만 수면 위로 올라갈 수 있다
      yCeil: windup ? (s.nearJump ? TOP + 0.05 : TOP - 0.25) : DOLPHIN_CRUISE.yMax + 0.1,
      targetSpeed: windup ? 2.6 : s.phase === "dive" ? 1.8 : 1.4,
      others: ctx.others,
      avoidOthers: !windup,
      pitchMax: windup ? 0.9 : undefined,
      wallRetarget: s.phase === "cruise",
    };
  },
  after(s, _dt, res, ctx) {
    if (res.shallowBlocked && s.phase === "windup") {
      // 여울에 막혔으면 점프를 접고 열린 물로 돌아간다
      s.phase = "cruise";
      s.nextJump = 3;
      pickFarTarget(s, dolphinNav, DOLPHIN_CRUISE.yMin, DOLPHIN_CRUISE.yMax, ctx.others);
    }
    publishDebug("dolphin", { phase: s.phase, y: s.pos.y, nextJump: s.nextJump, speed: s.speed, pos: s.pos.toArray(), target: s.target.toArray() });
  },
  motion(s, m, dt) {
    const air = s.phase === "air";
    m.beat = lerpTo(m.beat, air ? 0.6 : 0.8 + s.speed * 0.4, dt, 3);
    m.amp = air ? 0.3 : 0.6 + Math.min(0.4, s.speed * 0.25);
    m.turn = lerpTo(m.turn, THREE.MathUtils.clamp(s.turnRate * 0.5, -1, 1), dt, 5);
  },
  shadowOpacity: (s) => (s.phase === "air" ? 0.5 : 1),
};

// ---------- 고래상어: 가장 크고 느리게, 30~45초마다 수면 근처 여과 섭식 ----------
const WHALE_CRUISE = { yMin: BOTTOM + 1.0, yMax: TOP - 1.05 };
const FEED_Y = TOP - 0.7; // 섭식 때 등지느러미 끝(+0.81)이 수면을 살짝 가른다
interface WhaleState extends NavAgent {
  feed: number;
  nextFeed: number;
}
const whaleNav: NavParams = {
  margin: 1.2,
  clearance: 1.1,
  maxTurn: 0.5, // 아주 넓은 호
  pitchMin: -0.25,
  pitchMax: 0.25,
  pitchRate: 1.5,
  speedRate: 1.2,
  sepRadius: 3.2, // 큰 몸 (반 길이 1.3)
  sepK: 3,
  sepY: 0,
  lookahead: [3.2, 1.6],
  pushK: 2.5,
  bank: 0.3,
  bankMax: 0.3,
  bankRate: 2,
  yFloor: WHALE_CRUISE.yMin - 0.2,
  minTargetDist: 6,
  otherDist: 4,
  retargetRange: [10, 16],
  arrive: 1.0,
  bob: [0.03, 0.6],
  inset: 0.8,
};
export const whaleshark: Behaviour<WhaleState> = {
  species: "whaleshark",
  scale: 0.56, // 몸길이 ≈ 2.6 (가장 크다 — 돌고래의 2.3배, 실제 3.7배를 압축)
  nav: whaleNav,
  shadow: { size: [2.2, 1.1], grow: [0.8, 0.5] },
  init: (pos) => ({ ...agent(pos, [-4.0, -1.4, -0.5], -0.4, [4.5, -1.4, 3.0], 12, 0.4), feed: 0, nextFeed: 30 }),
  tick(s, dt, ctx) {
    s.nextFeed -= dt;
    if (s.feed > 0) s.feed -= dt;
    else if (s.nextFeed <= 0) {
      s.feed = rand(6, 8);
      s.nextFeed = rand(30, 45);
      s.retarget = 0;
    }
    const feeding = s.feed > 0;
    const yMin = feeding ? FEED_Y - 0.15 : WHALE_CRUISE.yMin;
    const yMax = feeding ? FEED_Y : WHALE_CRUISE.yMax;
    maybeRetarget(s, dt, whaleNav, yMin, yMax, ctx.others);
    return { yMin, yMax, yCeil: FEED_Y + 0.05, targetSpeed: feeding ? 0.22 : 0.45, others: ctx.others };
  },
  motion(s, m, dt) {
    const feeding = s.feed > 0;
    m.beat = lerpTo(m.beat, feeding ? 0.55 : 0.7 + s.speed * 0.4, dt, 2);
    m.amp = feeding ? 0.5 : 0.7 + Math.min(0.3, s.speed * 0.5);
    m.turn = lerpTo(m.turn, THREE.MathUtils.clamp(s.turnRate * 0.8, -1, 1), dt, 3);
  },
};

/** 수조에 사는 상어 외 생물 (상어 AI 는 먹이 추격 때문에 SeaScene 에 따로 있다) */
export const SWIMMERS = [manta, turtle, dolphin, whaleshark] as Behaviour[];
