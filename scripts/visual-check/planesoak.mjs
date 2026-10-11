// 수상기 소크: SECS 초 동안 0.1초마다 __aquaDebug.plane 을 읽어 phase 순서·한 바퀴 시간·자세 튐(yaw/pitch/roll 샘플 간 변화)·물 위 고도를 본다.
// usage: SECS=60 node planesoak.mjs [baseUrl]  → 문제가 있으면 exit 1. OUT=파일 로 샘플 JSON 저장. URL=/sea?plane=20 로 시작 위상
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
const wrapPi = (d) => Math.atan2(Math.sin(d), Math.cos(d));
let prev = null;
const transitions = [];
let maxD = { yaw: 0, pitch: 0, roll: 0 };
while (Date.now() - t0 < secs * 1000) {
  const p = await page.evaluate(() => window.__aquaDebug?.plane ?? null);
  if (!p) {
    problems.push("no plane debug state");
    break;
  }
  const ts = +((Date.now() - t0) / 1000).toFixed(2);
  samples.push({ ts, ...p });
  if (prev) {
    const dtS = ts - prev.ts;
    if (prev.phase !== p.phase) transitions.push({ ts, from: prev.phase, to: p.phase });
    // 샘플 간 자세 변화 (0.1초 ≈ 6프레임) — 프레임당 0.08rad 면 샘플당 ≈ 0.5rad
    const d = { yaw: Math.abs(wrapPi(p.yaw - prev.yaw)), pitch: Math.abs(p.pitch - prev.pitch), roll: Math.abs(p.roll - prev.roll) };
    for (const k of Object.keys(d)) {
      maxD[k] = Math.max(maxD[k], d[k] / Math.max(dtS, 0.05) / 60); // 프레임당 환산
      if (d[k] / Math.max(dtS, 0.05) / 60 > 0.08) problems.push(`t=${ts} ${k} jump ${d[k].toFixed(3)} in ${dtS.toFixed(2)}s (${prev.phase}→${p.phase})`);
    }
  }
  if (p.phase === "taxi" && p.alt > 0.05) problems.push(`t=${ts} taxi but alt ${p.alt}`);
  if (p.alt < -0.03) problems.push(`t=${ts} below water alt ${p.alt} (${p.phase})`);
  prev = { ts, ...p };
  await page.waitForTimeout(100);
}
// 한 바퀴 시간: approach 진입 간격
const approaches = transitions.filter((t) => t.to === "approach").map((t) => t.ts);
const cycles = approaches.slice(1).map((t, i) => +(t - approaches[i]).toFixed(1));
const order = transitions.map((t) => t.to).join(">");
const uniq = [...new Set(problems.map((p) => p.replace(/^t=[\d.]+ /, "")))];
const phaseStats = {};
for (const s of samples) {
  const st = (phaseStats[s.phase] ??= { n: 0, minAlt: Infinity, maxAlt: -Infinity, maxRoll: 0, minPitch: Infinity, maxPitch: -Infinity });
  st.n++;
  st.minAlt = Math.min(st.minAlt, s.alt);
  st.maxAlt = Math.max(st.maxAlt, s.alt);
  st.maxRoll = Math.max(st.maxRoll, Math.abs(s.roll));
  st.minPitch = Math.min(st.minPitch, s.pitch);
  st.maxPitch = Math.max(st.maxPitch, s.pitch);
}
console.log(`plane soak ${route} ${secs}s: samples ${samples.length}, pageerrors ${errs.length}, problems ${problems.length} (${uniq.length} kinds)`);
for (const p of uniq.slice(0, 20)) console.log("  -", p);
console.log("  order:", order);
console.log("  cycles(s):", cycles.join(" "), " len:", samples[0]?.len);
console.log("  max per-frame delta:", JSON.stringify(Object.fromEntries(Object.entries(maxD).map(([k, v]) => [k, +v.toFixed(4)]))));
for (const [k, v] of Object.entries(phaseStats)) console.log(`  ${k}: n ${v.n} alt ${v.minAlt.toFixed(2)}..${v.maxAlt.toFixed(2)} |roll|max ${v.maxRoll.toFixed(2)} pitch ${v.minPitch.toFixed(2)}..${v.maxPitch.toFixed(2)}`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(samples));
await closeAndExit(browser, problems.length || errs.length ? 1 : 0);
