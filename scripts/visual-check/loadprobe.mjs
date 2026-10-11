// 첫 로딩이 끝나는지: 새 컨텍스트로 N 번 열어 로딩 문구가 사라질 때까지 걸린 ms 를 잰다 (HEADED=1 이면 창을 띄운다)
import { chromium } from "playwright";
import { BASE } from "./browser.mjs";
const N = Number(process.env.N ?? 6);
const URL = process.env.URL ?? "/";
const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED, args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => { if (!m.text().includes("THREE.Clock")) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
  const t0 = Date.now();
  await page.goto(BASE + URL, { waitUntil: "commit" });
  let ms = -1;
  try {
    await page.waitForFunction(() => !/채우는 중/.test(document.body?.innerText ?? "x") && document.querySelector("canvas"), null, { timeout: 15000, polling: 50 });
    ms = Date.now() - t0;
  } catch {}
  console.log(`#${i} ${ms < 0 ? "STUCK" : ms + "ms"}`, logs.join(" | "));
  await ctx.close();
}
await browser.close();
