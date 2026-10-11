// 소크 테스트: SECS(기본 60)초 동안 2초마다 `__aquaDebug.<이름>Nav` 를 읽어 "갇힘"(20초 이동량 < 0.6)·"범위 이탈"·fps 저하를 찾는다.
// usage: SECS=60 URL=/sea node soak.mjs [baseUrl]   (URL=/ 이면 스튜디오: 화면 비율 좌표 nx/ny 로 범위를 본다) → 문제가 있으면 종료 코드 1
import { BASE, closeAndExit, launch } from "./browser.mjs";

const base = process.argv[2] ?? BASE;
const secs = Number(process.env.SECS ?? 60);
const route = process.env.URL ?? "/sea";
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1440), height: Number(process.env.VH ?? 900) } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(base + route + (route.includes("?") ? "&" : "?") + "debug", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const TANK = { x: 15 / 2 - 1.2 + 0.3, z: 12 / 2 - 1.0 + 0.3, yMin: -2.8, yMax: 0.6 }; // lagoonNav.BOUNDS + 여유 (돌고래 점프는 수면 위)
const SCREEN = { nx: 1.08, nyMin: -0.7, nyMax: 0.95 }; // StudioScene.LIMIT + 여유
const hist = {};
const problems = [];
let frames = 0;
for (let t = 0; t < secs; t += 2) {
  const d = await page.evaluate(async () => {
    const d0 = performance.now();
    let n = 0;
    await new Promise((r) => { const tick = () => { n++; if (performance.now() - d0 < 1000) requestAnimationFrame(tick); else r(); }; requestAnimationFrame(tick); });
    const nav = {};
    for (const k of Object.keys(window.__aquaDebug ?? {})) if (k.endsWith("Nav")) nav[k.replace("Nav", "")] = window.__aquaDebug[k];
    return { fps: n, nav };
  });
  frames += d.fps;
  if (d.fps < 50) problems.push(`t=${t}s fps ${d.fps}`);
  if (!Object.keys(d.nav).length) problems.push(`t=${t}s no *Nav debug state`);
  for (const [name, st] of Object.entries(d.nav)) {
    const p = st.pos;
    (hist[name] ??= []).push(p);
    const fmt = p.map((v) => v.toFixed(2)).join(",");
    if (st.nx !== undefined) {
      if (Math.abs(st.nx) > SCREEN.nx || st.ny < SCREEN.nyMin || st.ny > SCREEN.nyMax) problems.push(`t=${t}s ${name} off screen nx ${st.nx.toFixed(2)} ny ${st.ny.toFixed(2)}`);
    } else if (Math.abs(p[0]) > TANK.x || Math.abs(p[2]) > TANK.z || p[1] < TANK.yMin || p[1] > TANK.yMax) problems.push(`t=${t}s ${name} out of bounds ${fmt}`);
    const h = hist[name];
    if (h.length >= 11) {
      let maxD = 0;
      for (const q of h.slice(-11)) maxD = Math.max(maxD, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
      if (maxD < 0.6) problems.push(`t=${t}s ${name} stuck (20s 이동 ${maxD.toFixed(2)}) at ${fmt}`);
    }
  }
  await page.waitForTimeout(1000);
}
const uniq = [...new Set(problems)];
console.log(`soak ${route} ${secs}s: avg fps ${(frames / (secs / 2)).toFixed(1)}, pageerrors ${errs.length}, problems ${uniq.length}`);
for (const p of uniq.slice(0, 30)) console.log("  -", p);
for (const [name, h] of Object.entries(hist)) {
  const r = (i) => `${Math.min(...h.map((p) => p[i])).toFixed(1)}..${Math.max(...h.map((p) => p[i])).toFixed(1)}`;
  console.log(`  ${name.padEnd(10)} x ${r(0)}  y ${r(1)}  z ${r(2)}`);
}
await closeAndExit(browser, uniq.length || errs.length ? 1 : 0);
