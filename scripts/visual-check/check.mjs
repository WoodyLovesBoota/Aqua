// Aqua 루프 점검기: 각 페이지를 실제로 렌더링해 캡처하고 FPS / draw call / 긴 작업 / 콘솔 에러를 측정한다.
// usage: node check.mjs <step> [baseUrl]
import fs from "node:fs";
import path from "node:path";
import { BASE, closeAndExit, launch } from "./browser.mjs";

const step = process.argv[2] ?? "0";
const base = process.argv[3] ?? BASE;
const dpr = Number(process.env.DPR ?? 1);
const driftSec = Number(process.env.DRIFT ?? 0); // 0 이면 힙 드리프트 측정 생략
const outDir = path.join(import.meta.dirname, "../../.visual-check", `step${step}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await launch();
// VW/VH 로 뷰포트를 바꿀 수 있다 (모바일 점검: VW=390 VH=844)
const ctx = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1440), height: Number(process.env.VH ?? 900) }, deviceScaleFactor: dpr });


// draw call / triangle 카운터 + long task 수집 (앱 코드 수정 없이 주입)
await ctx.addInitScript(() => {
  const S = (window.__aqua = { draws: 0, tris: 0, frames: 0, long: [], errors: [] });
  const wrap = (proto) => {
    if (!proto) return;
    const orig = {
      drawArrays: proto.drawArrays,
      drawElements: proto.drawElements,
      drawArraysInstanced: proto.drawArraysInstanced,
      drawElementsInstanced: proto.drawElementsInstanced,
    };
    proto.drawArrays = function (mode, first, count) { S.draws++; if (mode === 4) S.tris += count / 3; return orig.drawArrays.call(this, mode, first, count); };
    proto.drawElements = function (mode, count, type, off) { S.draws++; if (mode === 4) S.tris += count / 3; return orig.drawElements.call(this, mode, count, type, off); };
    if (orig.drawArraysInstanced) proto.drawArraysInstanced = function (mode, first, count, n) { S.draws++; if (mode === 4) S.tris += (count / 3) * n; return orig.drawArraysInstanced.call(this, mode, first, count, n); };
    if (orig.drawElementsInstanced) proto.drawElementsInstanced = function (mode, count, type, off, n) { S.draws++; if (mode === 4) S.tris += (count / 3) * n; return orig.drawElementsInstanced.call(this, mode, count, type, off, n); };
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  // GPU 프레임 시간: 컨텍스트 생성 시 타이머 확장을 잡아두고, rAF 마다 쿼리를 감싼다
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const gl = origGet.call(this, type, ...rest);
    if (gl && !S.gl && (type === "webgl2" || type === "webgl")) {
      S.gl = gl;
      S.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      S.gpu = [];
      S.pendingQ = [];
      if (S.timer) {
        const tick = () => {
          const q = gl.createQuery();
          gl.beginQuery(S.timer.TIME_ELAPSED_EXT, q);
          requestAnimationFrame(() => {
            try { gl.endQuery(S.timer.TIME_ELAPSED_EXT); } catch {}
            S.pendingQ.push(q);
            for (const pq of S.pendingQ.slice()) {
              if (gl.getQueryParameter(pq, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(S.timer.GPU_DISJOINT_EXT)) {
                S.gpu.push(gl.getQueryParameter(pq, gl.QUERY_RESULT) / 1e6);
                S.pendingQ.splice(S.pendingQ.indexOf(pq), 1);
                gl.deleteQuery(pq); // 안 지우면 긴 DRIFT 측정에서 힙이 부풀어 보인다
              }
            }
            if (S.gpu.length > 400) S.gpu.splice(0, S.gpu.length - 400);
            tick();
          });
        };
        requestAnimationFrame(tick);
      }
    }
    return gl;
  };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => S.long.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] });
  } catch {}
  window.addEventListener("error", (e) => S.errors.push(String(e.message)));
});


const result = {};
const routes = (process.env.ROUTES ?? "/lagoon").split(",");
for (const route of routes) {
  const page = await ctx.newPage();
  const consoleErr = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleErr.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => consoleErr.push("pageerror: " + e.message));
  const t0 = Date.now();
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 30000 });
  const canvasAt = Date.now() - t0;
  // 첫 프레임이 그려질 때까지
  await page.waitForFunction(() => window.__aqua.draws > 0, null, { timeout: 60000 });
  const firstDrawAt = Date.now() - t0;
  await page.waitForTimeout(2500);
  // 2초 동안 FPS / draw call 측정
  const m = await page.evaluate(
    () =>
      new Promise((res) => {
        const S = window.__aqua;
        const dbg = (() => {
          const c = document.querySelector("canvas");
          const gl = c?.getContext("webgl2") || c?.getContext("webgl");
          const ext = gl?.getExtension("WEBGL_debug_renderer_info");
          return ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "?";
        })();
        const d0 = S.draws, tr0 = S.tris;
        let frames = 0;
        const start = performance.now();
        const worst = { dt: 0 };
        let last = start;
        const tick = (now) => {
          frames++;
          worst.dt = Math.max(worst.dt, now - last);
          last = now;
          if (now - start < 2000) requestAnimationFrame(tick);
          else {
            const sec = (now - start) / 1000;
            res({
              renderer: dbg,
              fps: +(frames / sec).toFixed(1),
              worstFrameMs: Math.round(worst.dt),
              drawsPerFrame: Math.round((S.draws - d0) / frames),
              trisPerFrame: Math.round((S.tris - tr0) / frames),
              longTasks: S.long.slice(),
              jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
              gpuMs: (() => { const g = S.gpu.slice(-120); if (!g.length) return null; g.sort((a, b) => a - b); return { median: +g[g.length >> 1].toFixed(2), p95: +g[Math.floor(g.length * 0.95)].toFixed(2) }; })(),
              errors: S.errors,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  let heapDrift = null;
  if (driftSec > 0) {
    const h0 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    await page.waitForTimeout(driftSec * 1000);
    const h1 = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    heapDrift = +((h1 - h0) / 1048576).toFixed(1);
  }
  await page.screenshot({ path: path.join(outDir, (route === "/lagoon" ? "sea" : route.replace(/\W+/g, "")) + ".png") });
  result[route] = { canvasAt, firstDrawAt, ...m, heapDriftMB: heapDrift, dpr, console: consoleErr.slice(0, 10) };
  await page.close();
}
fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await closeAndExit(browser);
