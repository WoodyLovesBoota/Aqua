// 블록 흔들기 점검: 지층을 잡고 끈 뒤(DRAG=x1,y1,x2,y2… 기본 620,750,760,750) 전단·바닥 변위·스쿼시(__aquaDebug.jelly)를 50ms 간격으로 MS 동안 찍는다.
// usage: node jelly.mjs [baseUrl]  (되튐 횟수·멈추는 시각을 수치로 본다. VW/VH/DPR 적용)
import { closeAndExit, contextOptions, dragPath, launch, parsePoints, BASE } from "./browser.mjs";
const browser = await launch();
const ctx = await browser.newContext(contextOptions());
const page = await ctx.newPage();
await page.goto((process.argv[2] ?? BASE) + "/sea?debug", { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
await dragPath(page, parsePoints(process.env.DRAG ?? "620,750,760,750"), { steps: 6, release: false });
const held = await page.evaluate(() => window.__aquaDebug?.jelly);
await page.mouse.up();
const out = [];
const t0 = Date.now();
while (Date.now() - t0 < Number(process.env.MS ?? 2500)) { out.push([Date.now() - t0, await page.evaluate(() => window.__aquaDebug?.jelly)]); await page.waitForTimeout(50); }
console.log("held", JSON.stringify(held));
for (const [t, j] of out) console.log(t, JSON.stringify(j));
await closeAndExit(browser);
