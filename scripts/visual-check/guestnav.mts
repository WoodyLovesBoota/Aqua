// 손님 길찾기 단독 점검 (브라우저 없이): 무작위 모래 목표 200쌍의 경로를 0.05 간격으로 샘플해
// 물 위(모래 높이 < SAND_MIN)·장애물 안을 지나는 점이 없는지, 모든 방갈로·피어로 가는 경로가 끊기지 않는지 본다. 문제가 있으면 exit 1.
import { inObstacle, onSand, planPath, randomSandSpot, sandHeight, sandPath, SPINE_LEN, WALKABLE_CELLS } from "@/components/sea/guestNav";
import { BUNGALOWS } from "@/components/sea/resortLayout";

let bad = 0, total = 0, straight = 0;
for (let k = 0; k < 200; k++) {
  const [ax, az] = randomSandSpot();
  const [bx, bz] = randomSandSpot(ax, az, 2.5);
  const path = sandPath(ax, az, bx, bz);
  if (path.length === 1) straight++;
  let px = ax, pz = az;
  for (const [x, z] of path) {
    const n = Math.ceil(Math.hypot(x - px, z - pz) / 0.05);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const sx = px + (x - px) * t, sz = pz + (z - pz) * t;
      total++;
      if (!onSand(sx, sz) || inObstacle(sx, sz, 0.2)) {
        bad++;
        if (bad <= 5) console.log(`  bad ${sx.toFixed(2)},${sz.toFixed(2)} sandH ${sandHeight(sx, sz).toFixed(3)} obst ${!!inObstacle(sx, sz, 0.2)} from ${ax.toFixed(2)},${az.toFixed(2)} path ${path.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" | ")}`);
      }
    }
    px = x;
    pz = z;
  }
}
// 데크·방갈로 경로: 모래 → 피어 끝, 모래 → 방갈로 i → 다른 방갈로 → 모래
let deckBad = 0;
const [sx, sz] = randomSandSpot();
const pier = planPath([sx, sz], "sand", undefined, { kind: "deck", s: SPINE_LEN - 0.1 });
if (!pier.length || pier[pier.length - 1].ground !== "deck") deckBad++;
for (let i = 0; i < BUNGALOWS.length; i++) {
  const p1 = planPath([sx, sz], "sand", undefined, { kind: "hut", i, lx: 0.26, lz: 0.78 });
  const last = p1[p1.length - 1];
  if (!p1.length || last.ground !== "hut" || last.hut !== i) deckBad++;
  const p2 = planPath([last.x, last.z], "hut", i, { kind: "sand", x: sx, z: sz });
  if (!p2.length || p2[p2.length - 1].ground !== "sand") deckBad++;
}
console.log(`guestnav: walkable cells ${WALKABLE_CELLS}, sand paths 200 (straight ${straight}) samples ${total} bad ${bad}, deck/hut paths bad ${deckBad}`);
process.exit(bad || deckBad ? 1 : 0);
