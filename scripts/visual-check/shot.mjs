// 한 장 캡처: node shot.mjs <out.png>  (URL=/경로 기본 /sea, DPR, VW/VH 뷰포트, WAIT=ms 대기,
// CLICK=x,y 클릭 뒤 / DRAG=x1,y1,x2,y2[,x3,y3…] 끌기 뒤 / HOLD=x,y,ms 누른 채 / HOVER=x1,y1,x2,y2 지나간 뒤 캡처. AFTER=ms 는 조작 뒤 대기. 콘솔 에러·경고 출력)
import { closeAndExit, collectConsoleErrors, contextOptions, dragPath, launch, parsePoints, BASE } from "./browser.mjs";
const out = process.argv[2];
const AFTER = Number(process.env.AFTER ?? 150);
const browser = await launch();
const ctx = await browser.newContext(contextOptions());
const page = await ctx.newPage();
const errs = [];
collectConsoleErrors(page, errs, 400);
await page.goto(BASE + (process.env.URL ?? "/sea"), { waitUntil: "networkidle" });
await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
if (process.env.CLICK) {
  const [x, y] = parsePoints(process.env.CLICK);
  await page.mouse.click(x, y);
  await page.waitForTimeout(AFTER);
}
if (process.env.HOLD) {
  const [x, y, ms] = parsePoints(process.env.HOLD);
  await dragPath(page, [x, y], { release: false });
  await page.waitForTimeout(ms);
}
if (process.env.HOVER) {
  const [x1, y1, x2, y2] = parsePoints(process.env.HOVER);
  await page.mouse.move(x1, y1);
  await page.mouse.move(x2, y2, { steps: 25 });
  await page.waitForTimeout(AFTER);
}
if (process.env.DRAG) {
  await dragPath(page, parsePoints(process.env.DRAG));
  await page.waitForTimeout(AFTER);
}
await page.screenshot({ path: out });
console.log(errs.join("\n"));
await closeAndExit(browser);
