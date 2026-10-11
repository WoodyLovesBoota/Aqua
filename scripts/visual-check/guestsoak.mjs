// 손님 커플 소크: SECS 초 동안 0.5초마다 __aquaDebug.guests 를 읽어 물 위 걷기·장애물 침범·손잡기 간격·활동 등장을 센다.
// usage: SECS=60 URL='/sea?guest=stroll' node guestsoak.mjs [baseUrl]  → 문제가 있으면 exit 1. OUT=파일 로 샘플 JSON 저장
import { writeFileSync } from "node:fs";
import { BASE, closeAndExit, launch } from "./browser.mjs";

const base = process.argv[2] ?? BASE;
const secs = Number(process.env.SECS ?? 60);
const route = process.env.URL ?? "/sea";
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1440), height: Number(process.env.VH ?? 900) } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(base + route + (route.includes("?") ? "&" : "?") + "debug", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const samples = [];
const problems = [];
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  const g = await page.evaluate(() => window.__aquaDebug?.guests ?? null);
  if (!g) {
    problems.push("no guests debug state");
    break;
  }
  const ts = ((Date.now() - t0) / 1000).toFixed(1);
  samples.push({ ts: +ts, ...g });
  for (const [who, w] of [["a", g.a], ["b", g.b]]) {
    const walking = w.pose === "walk" || w.pose === "stand" || w.pose === "wave";
    if (w.ground === "sand" && walking && !w.pinned && w.sandH < 0.02) problems.push(`t=${ts} ${who} on water (sandH ${w.sandH}) ${g.activity}/${g.stage} at ${w.p}`);
    if (w.ground === "sand" && walking && !w.pinned && w.obst) problems.push(`t=${ts} ${who} inside obstacle ${g.activity}/${g.stage} at ${w.p}`);
  }
  if (g.stage === "go" && g.a.pose === "walk" && g.b.pose === "walk") {
    const d = Math.hypot(g.a.p[0] - g.b.p[0], g.a.p[2] - g.b.p[2]);
    if (d < 0.1 || d > 0.5) problems.push(`t=${ts} hand gap ${d.toFixed(2)} ${g.activity}`);
  }
  await page.waitForTimeout(500);
}
const uniq = [...new Set(problems.map((p) => p.replace(/^t=[\d.]+ /, "")))];
const acts = {};
for (const s of samples) acts[s.activity + "/" + s.stage] = (acts[s.activity + "/" + s.stage] ?? 0) + 1;
console.log(`guest soak ${route} ${secs}s: samples ${samples.length}, pageerrors ${errs.length}, problems ${problems.length} (${uniq.length} kinds)`);
for (const p of uniq.slice(0, 20)) console.log("  -", p);
console.log("  stages:", Object.entries(acts).map(([k, v]) => `${k}:${v}`).join(" "));
if (samples.length) console.log("  counts:", JSON.stringify(samples[samples.length - 1].count));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(samples));
await closeAndExit(browser, problems.length || errs.length ? 1 : 0);
