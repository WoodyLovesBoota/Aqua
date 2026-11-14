// 조건부 캡처: 페이지 안의 식이 참이 되는 순간 찍는다.
// usage: COND='window.__aquaDebug?.dolphin.phase==="air"' URL=/sea?jump=5 node probe.mjs out.png  (TIMEOUT=ms, AFTER=ms, EXPR=찍은 뒤 평가해 출력할 식)
import { BASE, closeAndExit, launch } from "./browser.mjs";
const out = process.argv[2];
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
const page = await ctx.newPage();
await page.goto(BASE + (process.env.URL ?? "/sea"), { waitUntil: "networkidle" });
try {
  await page.waitForFunction(process.env.COND ?? "true", null, { timeout: Number(process.env.TIMEOUT ?? 30000), polling: 16 });
  if (process.env.AFTER) await page.waitForTimeout(Number(process.env.AFTER));
  await page.screenshot({ path: out });
  console.log("captured", out, process.env.EXPR ? await page.evaluate(process.env.EXPR) : "");
} catch (e) {
  console.log("condition not met:", String(e).slice(0, 120), process.env.EXPR ? await page.evaluate(process.env.EXPR) : "");
}
await closeAndExit(browser);
