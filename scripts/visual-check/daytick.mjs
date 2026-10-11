// 하루 주기 점검: /sea?debug=1 에서 라군 시각이 실제 시간에 맞게 흐르는지 (1시간 = 24시간 → 15초 = 0.1시간),
// 그리고 해 광선 회전·별 반짝임을 0.5초 차 두 장으로 남긴다.  node scripts/visual-check/daytick.mjs <출력 폴더>
import { closeAndExit, collectConsoleErrors, contextOptions, launch, BASE } from "./browser.mjs";
const out = process.argv[2] ?? ".visual-check/daytick";
const browser = await launch();
const ctx = await browser.newContext(contextOptions());
const page = await ctx.newPage();
const errs = [];
collectConsoleErrors(page, errs, 400);
await page.goto(BASE + "/sea?debug=1", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
const read = () => page.evaluate(() => window.__aquaDebug?.day?.hour);
const h0 = await read();
const t0 = Date.now();
await page.waitForTimeout(15000);
const h1 = await read();
const dt = (Date.now() - t0) / 1000;
const dh = (((h1 - h0) % 24) + 24) % 24;
const clock = await page.evaluate(() => document.querySelector("aside p b")?.textContent);
console.log(JSON.stringify({ h0, h1, realSec: +dt.toFixed(2), lagoonHours: +dh.toFixed(4), perHour150s: +((dh / dt) * 150).toFixed(4), panelClock: clock }));
for (const [h, name] of [
  [12, "noon"],
  [0, "night"],
]) {
  await page.goto(BASE + `/sea?hour=${h}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${name}-a.png` });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-b.png` });
}
console.log(errs.join("\n"));
await closeAndExit(browser);
