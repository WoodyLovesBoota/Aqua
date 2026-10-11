// 로딩 CPU 프로파일: 긴 작업(longtask) 구간마다 어떤 함수가 시간을 먹었는지 포함(inclusive) 시간으로 집계한다.
// usage: URL=/sea node profile.mjs [baseUrl]   (TOP=40 으로 줄 수 조절, ALL=1 이면 R3F/React 프레임도 포함)
import { BASE, closeAndExit, launch } from "./browser.mjs";

const route = process.env.URL ?? "/sea";
const base = process.argv[2] ?? BASE;
const top = Number(process.env.TOP ?? 30);
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.__long = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push({ start: e.startTime, dur: e.duration }))).observe({ entryTypes: ["longtask"] }); } catch {}
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
await cdp.send("Profiler.start");
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
const { profile } = await cdp.send("Profiler.stop");
const long = await page.evaluate(() => window.__long);
const now = await page.evaluate(() => performance.now());
// 프로파일 시각(µs, monotonic)을 페이지 시각(ms)으로: 프로파일 끝 = 지금
const toPage = (us) => now - (profile.endTime - us) / 1000;
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
let t = profile.startTime;
const samples = profile.samples.map((id, i) => { t += profile.timeDeltas[i]; return { id, at: toPage(t), dt: profile.timeDeltas[i] }; });
console.log(route, "longtasks:", long.length ? long.map((l) => `@${Math.round(l.start)}ms +${Math.round(l.dur)}ms`).join("  ") : "(none)");
for (const l of long) {
  const incl = new Map();
  for (const s of samples) {
    if (s.at < l.start || s.at > l.start + l.dur) continue;
    const seen = new Set();
    for (let id = s.id; id !== undefined; id = parent.get(id)) {
      const n = byId.get(id);
      const url = n.callFrame.url || "";
      const key = `${n.callFrame.functionName || "(anon)"} @ ${url.split("/").slice(-1)[0].slice(0, 30)}:${n.callFrame.lineNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!process.env.ALL && (!/src_|three_build|three_examples|\/src\/|three\//.test(url) || /react-three_fiber/.test(url))) continue;
      incl.set(key, (incl.get(key) ?? 0) + s.dt);
    }
  }
  console.log(`\n--- longtask @${Math.round(l.start)}ms +${Math.round(l.dur)}ms`);
  for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log((v / 1000).toFixed(1).padStart(7), "ms ", k);
}
await closeAndExit(browser);
