import { floorHeight } from "./lagoonHeight";
import { TANK } from "./lagoonNav";
import { bridgeStart, BUNGALOWS, BUSHES, DECK_TOP, HAMMOCK, HUT_FLOOR, hutToLocal, hutToWorld, ISLAND_ROCKS, PALMS, SPINE, SUNBEDS, TORCHES, UMBRELLAS } from "./resortLayout";

/**
 * 손님 길찾기 — 섬 모래는 격자 A*(0.15) + 직선 당기기, 데크는 척추선·다리 그래프. 둘은 척추선 시작점(모래톱)에서 만난다.
 * 물 위는 걷지 않는다 (모래 높이 ≥ 수면 + SAND_MIN). 야자수·덤불·파라솔 기둥·횃불·바위·선베드·해먹은 장애물 (사람 둘이 나란히 지나갈 여유 포함).
 */
const { TOP, BOTTOM } = TANK;
export const SAND_MIN = 0.06; // 걷는 모래의 최소 높이 (수면 기준)
const CELL = 0.1;
const GRID = { x0: -6.6, z0: -6.0, x1: -0.4, z1: -0.3 };
const NX = Math.ceil((GRID.x1 - GRID.x0) / CELL);
const NZ = Math.ceil((GRID.z1 - GRID.z0) / CELL);

export interface Circle {
  x: number;
  z: number;
  r: number;
}
/** 장애물 원 (반지름에 사람 둘의 여유 ≈ 0.2 포함) */
export const OBSTACLES: Circle[] = (() => {
  const out: Circle[] = [];
  // 실제 반지름 + 한 사람 여유 0.12 (더 넉넉히 잡으면 0.1 격자에서 섬이 여러 조각으로 끊긴다)
  for (const p of PALMS) out.push({ x: p.x, z: p.z, r: 0.11 * p.h + 0.12 });
  for (const b of BUSHES) out.push({ x: b.x, z: b.z, r: 0.25 * b.s + 0.1 });
  for (const u of UMBRELLAS) out.push({ x: u.x, z: u.z, r: 0.1 }); // 캐노피는 머리 위
  for (const [x, z] of TORCHES) out.push({ x, z, r: 0.1 });
  for (const r of ISLAND_ROCKS) out.push({ x: r.x, z: r.z, r: r.r + 0.1 });
  for (const s of SUNBEDS) out.push({ x: s.x, z: s.z, r: 0.3 });
  const a = PALMS[HAMMOCK.a], b = PALMS[HAMMOCK.b];
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, r: 0.22 });
  }
  return out;
})();

export const sandHeight = (x: number, z: number) => floorHeight(BOTTOM, x, z) - TOP;
export const onSand = (x: number, z: number) => sandHeight(x, z) >= SAND_MIN;
export function inObstacle(x: number, z: number, slack = 0) {
  for (const c of OBSTACLES) if (Math.hypot(x - c.x, z - c.z) < c.r - slack) return c;
  return null;
}
const walkableXZ = (x: number, z: number) => onSand(x, z) && !inObstacle(x, z);

// 격자 (모듈 로드 때 한 번): 1 = 걸을 수 있음
const cells = new Uint8Array(NX * NZ);
for (let iz = 0; iz < NZ; iz++)
  for (let ix = 0; ix < NX; ix++) {
    const x = GRID.x0 + (ix + 0.5) * CELL, z = GRID.z0 + (iz + 0.5) * CELL;
    cells[iz * NX + ix] = walkableXZ(x, z) ? 1 : 0;
  }
// 연결 성분: 산책 목표는 가장 큰 조각(본섬)에서만 고른다 (장애물로 끊긴 곶 조각으로는 못 간다)
const comp = new Int32Array(NX * NZ).fill(-1);
const compSize: number[] = [];
for (let i = 0; i < NX * NZ; i++) {
  if (!cells[i] || comp[i] >= 0) continue;
  const id = compSize.length;
  compSize.push(0);
  const stack = [i];
  comp[i] = id;
  while (stack.length) {
    const c = stack.pop()!;
    compSize[id]++;
    const cx = c % NX, cz = Math.floor(c / NX);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const n = nz * NX + nx;
      if (cells[n] && comp[n] < 0) {
        comp[n] = id;
        stack.push(n);
      }
    }
  }
}
const MAIN = compSize.indexOf(Math.max(...compSize));
const cellOf = (x: number, z: number) => [Math.floor((x - GRID.x0) / CELL), Math.floor((z - GRID.z0) / CELL)] as [number, number];
const centerOf = (ix: number, iz: number) => [GRID.x0 + (ix + 0.5) * CELL, GRID.z0 + (iz + 0.5) * CELL] as [number, number];
const inGrid = (ix: number, iz: number) => ix >= 0 && iz >= 0 && ix < NX && iz < NZ;

/** 두 점 사이가 쭉 걸을 수 있는지 (0.08 간격 샘플). 끝점이 들어 있는 장애물(선베드 같은 목표)만 무시한다 */
function clearLine(ax: number, az: number, bx: number, bz: number, endSlack = 0) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.08));
  const skipA = endSlack > 0 ? inObstacle(ax, az) : null;
  const skipB = endSlack > 0 ? inObstacle(bx, bz) : null;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (!onSand(x, z)) return false;
    const o = inObstacle(x, z);
    if (o && o !== skipA && o !== skipB) return false;
  }
  return true;
}

/** 가장 가까운 걸을 수 있는 칸 (목표가 장애물 안이면 그 둘레에서) */
function nearestCell(x: number, z: number): [number, number] | null {
  const [cx, cz] = cellOf(x, z);
  for (let r = 0; r < 8; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let iz = cz - r; iz <= cz + r; iz++)
      for (let ix = cx - r; ix <= cx + r; ix++) {
        if (!inGrid(ix, iz) || !cells[iz * NX + ix]) continue;
        const [px, pz] = centerOf(ix, iz);
        const d = Math.hypot(px - x, pz - z);
        if (d < bd) {
          bd = d;
          best = [ix, iz];
        }
      }
    if (best) return best;
  }
  return null;
}

/** 모래 위 A* (8방향, 모서리 끼어 지나가기 금지) → 직선 당기기. 시작·끝은 격자에 없어도 된다 */
export function sandPath(ax: number, az: number, bx: number, bz: number): [number, number][] {
  if (clearLine(ax, az, bx, bz, 0.5)) return [[bx, bz]];
  const s = nearestCell(ax, az), g = nearestCell(bx, bz);
  if (!s || !g) return [[bx, bz]];
  const sId = s[1] * NX + s[0], gId = g[1] * NX + g[0];
  const gScore = new Float32Array(NX * NZ).fill(Infinity);
  const from = new Int32Array(NX * NZ).fill(-1);
  const closed = new Uint8Array(NX * NZ);
  const open: number[] = [sId];
  const fScore = new Float32Array(NX * NZ).fill(Infinity);
  const h = (id: number) => Math.hypot((id % NX) - g[0], Math.floor(id / NX) - g[1]);
  gScore[sId] = 0;
  fScore[sId] = h(sId);
  let found = false;
  let bestId = sId, bestH = h(sId);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === gId) {
      found = true;
      break;
    }
    closed[cur] = 1;
    if (h(cur) < bestH) {
      bestH = h(cur);
      bestId = cur;
    }
    const cx = cur % NX, cz = Math.floor(cur / NX);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!inGrid(nx, nz)) continue;
        const nid = nz * NX + nx;
        if (!cells[nid] || closed[nid]) continue;
        if (dx && dz && (!cells[cz * NX + nx] || !cells[nz * NX + cx])) continue; // 모서리 끼기 금지
        const ng = gScore[cur] + Math.hypot(dx, dz);
        if (ng < gScore[nid]) {
          gScore[nid] = ng;
          fScore[nid] = ng + h(nid);
          from[nid] = cur;
          if (!open.includes(nid)) open.push(nid);
        }
      }
  }
  // 못 닿으면(끊긴 조각) 닿을 수 있는 칸 중 목표에 가장 가까운 곳까지만 — 물이나 장애물을 가로지르지 않는다
  const pts: [number, number][] = [];
  for (let id = found ? gId : bestId; id !== -1; id = from[id]) pts.push(centerOf(id % NX, Math.floor(id / NX)));
  pts.reverse();
  if (found && onSand(bx, bz)) pts.push([bx, bz]); // 목표 자체가 물이면 가장 가까운 칸에서 멈춘다
  // 직선 당기기: 현재 점에서 보이는 가장 먼 점으로 건너뛴다
  const out: [number, number][] = [];
  let cur: [number, number] = [ax, az];
  let i = 0;
  while (i < pts.length) {
    let far = i;
    for (let j = pts.length - 1; j > i; j--) {
      if (clearLine(cur[0], cur[1], pts[j][0], pts[j][1], j === pts.length - 1 ? 0.5 : 0)) {
        far = j;
        break;
      }
    }
    cur = pts[far];
    out.push(cur);
    i = far + 1;
  }
  return out;
}

// ---------- 데크 그래프 ----------
/** 척추선 누적 길이 */
const SPINE_S: number[] = [0];
for (let i = 1; i < SPINE.length; i++) SPINE_S.push(SPINE_S[i - 1] + Math.hypot(SPINE[i][0] - SPINE[i - 1][0], SPINE[i][1] - SPINE[i - 1][1]));
export const SPINE_LEN = SPINE_S[SPINE_S.length - 1];
/** 척추선 위 s 의 자리 */
export function spineAt(s: number): [number, number] {
  const t = Math.max(0, Math.min(SPINE_LEN, s));
  let i = 0;
  while (i < SPINE.length - 2 && SPINE_S[i + 1] < t) i++;
  const k = (t - SPINE_S[i]) / (SPINE_S[i + 1] - SPINE_S[i]);
  return [SPINE[i][0] + (SPINE[i + 1][0] - SPINE[i][0]) * k, SPINE[i][1] + (SPINE[i + 1][1] - SPINE[i][1]) * k];
}
/** 척추선 진행 방향 (단위) */
export function spineDir(s: number): [number, number] {
  let i = 0;
  while (i < SPINE.length - 2 && SPINE_S[i + 1] < s) i++;
  const dx = SPINE[i + 1][0] - SPINE[i][0], dz = SPINE[i + 1][1] - SPINE[i][1];
  const l = Math.hypot(dx, dz);
  return [dx / l, dz / l];
}
function spineParam(x: number, z: number) {
  let bs = 0, bd = Infinity;
  for (let i = 0; i < SPINE.length - 1; i++) {
    const [ax, az] = SPINE[i], [bx, bz] = SPINE[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < bd) {
      bd = d;
      bs = SPINE_S[i] + t * Math.hypot(vx, vz);
    }
  }
  return bs;
}
/** 방갈로 i 의 다리: 척추선 s, 테라스 입구(로컬, 앞 난간 lz = 1.0 선 위) */
export const HUT_BRIDGE = BUNGALOWS.map((h) => {
  const [bx, bz] = bridgeStart(h);
  const [lx, lz] = hutToLocal(h, bx, bz);
  // 다리 직선(중심 → 다리 시작)이 lz = 1.0 을 지나는 점
  const k = 1.0 / lz;
  return { s: spineParam(bx, bz), start: [bx, bz] as [number, number], entry: [lx * k, 1.0] as [number, number], front: lz > 0.5 };
});

export type Ground = "sand" | "deck" | "hut";
export interface Waypoint {
  x: number;
  z: number;
  ground: Ground;
  hut?: number;
}
export type Place = { kind: "sand"; x: number; z: number } | { kind: "deck"; s: number } | { kind: "hut"; i: number; lx: number; lz: number };

/** 자리의 월드 xz */
export function placeXZ(p: Place): [number, number] {
  if (p.kind === "sand") return [p.x, p.z];
  if (p.kind === "deck") return spineAt(p.s);
  return hutToWorld(BUNGALOWS[p.i], p.lx, p.lz);
}
/** 바닥 높이: 모래는 높이맵, 데크는 판자 윗면(모래에 묻힌 첫 구간은 모래), 방갈로는 발판 */
export function groundY(w: Waypoint | { x: number; z: number; ground: Ground }) {
  const sand = floorHeight(BOTTOM, w.x, w.z);
  if (w.ground === "sand") return sand;
  if (w.ground === "deck") return Math.max(DECK_TOP, sand);
  return HUT_FLOOR;
}

function spineWalk(s0: number, s1: number, out: Waypoint[]) {
  // 사이 꺾임점을 순서대로
  const dir = s1 >= s0 ? 1 : -1;
  for (let i = 0; i < SPINE.length; i++) {
    const idx = dir > 0 ? i : SPINE.length - 1 - i;
    const s = SPINE_S[idx];
    if ((dir > 0 && s > s0 + 0.01 && s < s1 - 0.01) || (dir < 0 && s < s0 - 0.01 && s > s1 + 0.01)) out.push({ x: SPINE[idx][0], z: SPINE[idx][1], ground: "deck" });
  }
  const [x, z] = spineAt(s1);
  out.push({ x, z, ground: "deck" });
}
function hutIn(i: number, lx: number, lz: number, out: Waypoint[]) {
  const b = HUT_BRIDGE[i];
  out.push({ x: b.start[0], z: b.start[1], ground: "deck" });
  const [ex, ez] = hutToWorld(BUNGALOWS[i], b.entry[0], b.entry[1]);
  out.push({ x: ex, z: ez, ground: "hut", hut: i });
  const [tx, tz] = hutToWorld(BUNGALOWS[i], lx, lz);
  out.push({ x: tx, z: tz, ground: "hut", hut: i });
}
function hutOut(i: number, out: Waypoint[]) {
  const b = HUT_BRIDGE[i];
  const [ex, ez] = hutToWorld(BUNGALOWS[i], b.entry[0], b.entry[1]);
  out.push({ x: ex, z: ez, ground: "hut", hut: i });
  out.push({ x: b.start[0], z: b.start[1], ground: "deck" });
}

/** 지금 자리(월드 xz + 어디 위인지)에서 목적지까지의 경로점 */
export function planPath(fromXZ: [number, number], fromGround: Ground, fromHut: number | undefined, to: Place): Waypoint[] {
  const out: Waypoint[] = [];
  // 1. 출발을 척추선 위 s 로 정규화 (모래면 S0 까지 모래 길)
  let s: number;
  if (fromGround === "sand") {
    if (to.kind === "sand") {
      for (const [x, z] of sandPath(fromXZ[0], fromXZ[1], to.x, to.z)) out.push({ x, z, ground: "sand" });
      return out;
    }
    for (const [x, z] of sandPath(fromXZ[0], fromXZ[1], SPINE[0][0], SPINE[0][1])) out.push({ x, z, ground: "sand" });
    s = 0;
  } else if (fromGround === "hut") {
    hutOut(fromHut!, out);
    s = HUT_BRIDGE[fromHut!].s;
  } else s = spineParam(fromXZ[0], fromXZ[1]);
  // 2. 척추선을 따라 목적지로
  if (to.kind === "sand") {
    spineWalk(s, 0, out);
    for (const [x, z] of sandPath(SPINE[0][0], SPINE[0][1], to.x, to.z)) out.push({ x, z, ground: "sand" });
  } else if (to.kind === "deck") spineWalk(s, to.s, out);
  else {
    spineWalk(s, HUT_BRIDGE[to.i].s, out);
    hutIn(to.i, to.lx, to.lz, out);
  }
  return out;
}

/** 무작위 모래 산책 목표 (장애물·물가에서 떨어진 칸) */
export function randomSandSpot(nearX?: number, nearZ?: number, minDist = 1.5): [number, number] {
  for (let i = 0; i < 120; i++) {
    const ix = Math.floor(Math.random() * NX), iz = Math.floor(Math.random() * NZ);
    if (!cells[iz * NX + ix] || comp[iz * NX + ix] !== MAIN) continue;
    const [x, z] = centerOf(ix, iz);
    if (sandHeight(x, z) < SAND_MIN + 0.03 || inObstacle(x, z, -0.15)) continue;
    if (nearX != null && Math.hypot(x - nearX, z - (nearZ ?? 0)) < minDist) continue;
    return [x, z];
  }
  return [TORCHES[0][0] + 0.25, TORCHES[0][1] - 0.3]; // 횃불 옆 모래 (항상 뭍)
}

/** 점검용: 걸을 수 있는 칸 수 */
export const WALKABLE_CELLS = cells.reduce((a, b) => a + b, 0);
