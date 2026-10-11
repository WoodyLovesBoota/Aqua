// 열대어 소크: SECS(기본 30)초 동안 1초마다 `__aquaDebug.reefFish` 를 읽어 군락 반경 이탈·정지·숨기 횟수를 센다.
// usage: SECS=30 node scripts/visual-check/fishsoak.mjs [baseUrl]  → 문제가 있으면 종료 코드 1
import { BASE, closeAndExit, launch } from "./browser.mjs";

const base = process.argv[2] ?? BASE;
const secs = Number(process.env.SECS ?? 30);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(base + "/sea?debug", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const hist = [];
for (let t = 0; t < secs; t++) {
  const d = await page.evaluate(() => window.__aquaDebug?.reefFish ?? null);
  if (!d) {
    console.log("no reefFish debug state");
    await closeAndExit(browser, 1);
  }
  hist.push(d);
  await page.waitForTimeout(1000);
}
const n = hist[0].length;
const problems = [];
let flees = 0, darts = 0;
const rows = [];
for (let i = 0; i < n; i++) {
  const [hx, hz, hr] = hist[0][i].home;
  let maxR = 0, minY = 1e9, maxY = -1e9, moved = 0, minS = 1e9, maxS = 0;
  for (let k = 0; k < hist.length; k++) {
    const f = hist[k][i];
    const r = Math.hypot(f.pos[0] - hx, f.pos[2] - hz) / hr;
    maxR = Math.max(maxR, r);
    minY = Math.min(minY, f.pos[1]);
    maxY = Math.max(maxY, f.pos[1]);
    minS = Math.min(minS, f.speed);
    maxS = Math.max(maxS, f.speed);
    if (f.flee) flees++;
    if (f.dart) darts++;
    if (k) moved += Math.hypot(...f.pos.map((v, j) => v - hist[k - 1][i].pos[j]));
  }
  if (maxR > 1.25) problems.push(`fish ${i} left reef (max r/R ${maxR.toFixed(2)})`);
  if (moved < 1.5) problems.push(`fish ${i} barely moved (${moved.toFixed(2)} in ${secs}s)`);
  rows.push(`  fish ${String(i).padStart(2)} reef ${hist[0][i].reef} r/R max ${maxR.toFixed(2)}  y ${minY.toFixed(2)}..${maxY.toFixed(2)}  speed ${minS.toFixed(2)}..${maxS.toFixed(2)}  moved ${moved.toFixed(1)}`);
}
console.log(`fishsoak ${secs}s: fish ${n}, flee samples ${flees}, dart samples ${darts}, pageerrors ${errs.length}, problems ${problems.length}`);
for (const p of problems) console.log("  -", p);
console.log(rows.join("\n"));
await closeAndExit(browser, problems.length || errs.length ? 1 : 0);
