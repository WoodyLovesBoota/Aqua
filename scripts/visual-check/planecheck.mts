// 수상기 경로 단독 점검 (브라우저 없이): 경로가 젤리 뚜껑 안인지, 물 위 구간이 금지 구역 밖인지, 공중 경로가 야자수·방갈로와 만나지 않는지, 한 바퀴 시간·최대 요 각속도.
// usage: pnpm check:plane  = node --experimental-strip-types --no-warnings --import ./scripts/ts-alias.mjs scripts/visual-check/planecheck.mts
import * as THREE from "three";
import { blocked, TANK } from "@/components/sea/lagoonNav";
import { BUNGALOWS, PALMS } from "@/components/sea/resortLayout";
import { makeCircuit } from "@/components/sea/seaplanePath";

const c = makeCircuit();
const p = new THREE.Vector3(), t = new THREE.Vector3();
const problems: string[] = [];
let minWaterY = Infinity, maxWaterY = -Infinity, waterLen = 0, cycle = 0, maxYawRate = 0, prevYaw: number | null = null;
const STEP = 0.05;
for (let s = 0; s < c.length; s += STEP) {
  c.pointAt(s, p);
  c.tangentAt(s, t);
  const v = c.speedAt(s);
  cycle += STEP / v;
  const phase = c.phaseAt(s);
  const onWater = p.y < 0.05;
  if (onWater) {
    minWaterY = Math.min(minWaterY, p.y);
    maxWaterY = Math.max(maxWaterY, p.y);
    waterLen += STEP;
    // 플로트 폭 0.26 + 여유: 섬·산호·방갈로 금지 구역 0.3 밖, 바닥 여유 0.6
    if (blocked(p.x, TANK.TOP - 0.3, p.z, 0.3, 0.6)) problems.push(`water blocked at s=${s.toFixed(1)} ${p.x.toFixed(2)},${p.z.toFixed(2)} (${phase})`);
    if (Math.abs(p.x) > TANK.W / 2 - 1.0 || Math.abs(p.z) > TANK.D / 2 - 1.0) problems.push(`water too close to wall at s=${s.toFixed(1)} ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  } else {
    // 야자수 꼭대기(줄기 키 h + 잎 0.6) · 방갈로 지붕(수면 + 0.9) 과 1.2 안에서 더 낮으면 충돌
    for (const pm of PALMS) if (Math.hypot(p.x - pm.x, p.z - pm.z) < 1.2 && p.y < 0.35 + pm.h + 0.6) problems.push(`palm hit at s=${s.toFixed(1)} y ${p.y.toFixed(2)} palm h ${pm.h}`);
    for (const b of BUNGALOWS) if (Math.hypot(p.x - b.x, p.z - b.z) < 1.0 && p.y < 0.9 + 0.3) problems.push(`bungalow hit at s=${s.toFixed(1)} y ${p.y.toFixed(2)}`);
  }
  // 젤리 뚜껑(돔) 안: 날개 반폭 0.75 · 꼬리 높이 0.65 를 더해도 벽·천장(높이 4, 윗모서리 둥글림 0.6)에서 0.3 이상
  if (Math.abs(p.x) + 0.75 > TANK.W / 2 - 0.3 || Math.abs(p.z) + 0.75 > TANK.D / 2 - 0.3 || p.y + 0.65 > 4.0 - 0.6) problems.push(`outside jelly dome at s=${s.toFixed(1)} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
  const yaw = Math.atan2(-t.z, t.x);
  if (prevYaw != null) {
    const d = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw));
    maxYawRate = Math.max(maxYawRate, Math.abs(d) / (STEP / v));
  }
  prevYaw = yaw;
}
const phases = c.knotS.map((s, i) => `${i}:${c.phaseAt(s + 0.01)}@${s.toFixed(1)}`).join(" ");
console.log(`circuit length ${c.length.toFixed(1)} cycle ≈ ${cycle.toFixed(1)}s water ${waterLen.toFixed(1)} (y ${minWaterY.toFixed(3)}..${maxWaterY.toFixed(3)}) maxYawRate ${maxYawRate.toFixed(2)} rad/s`);
console.log("knots:", phases);
const uniq = [...new Set(problems.map((x) => x.replace(/ at s=[\d.]+/, "")))];
console.log(`problems ${problems.length} (${uniq.length} kinds)`);
for (const u of uniq.slice(0, 20)) console.log("  -", u);
process.exit(problems.length ? 1 : 0);
