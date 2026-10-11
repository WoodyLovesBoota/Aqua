import fs from "node:fs";
import path from "node:path";
import { BASE, closeAndExit, injectStore, launch } from "./browser.mjs";

const step = process.argv[2] ?? "m";
const base = process.argv[3] ?? BASE;
const outDir = path.join(import.meta.dirname, "../../.visual-check", `step${step}`, "matrix");
fs.mkdirSync(outDir, { recursive: true });

// 생김새는 고정(store/species.ts 의 fixed)이고 사용자가 바꾸는 건 이름·털 색뿐이다. 종마다 팔레트 몇 가지씩.
const sw = (species, id, fur, belly) => [`${species === "hammerhead" ? "" : species.replace("whaleshark", "whale") + "-"}${id}`, { species, creatures: { [species]: { name: species, furColor: fur, bellyColor: belly } } }];
const CASES = [
  sw("hammerhead", "bronze", "#8c8168", "#f2ece0"),
  sw("hammerhead", "lagoon", "#3aa4ad", "#eaf6f3"),
  sw("hammerhead", "sunset", "#e2673a", "#fbeadf"),
  sw("hammerhead", "blush", "#e99bb1", "#fff1f4"),
  sw("hammerhead", "lavender", "#9d8fd1", "#f3f0fb"),
  sw("hammerhead", "mint", "#86cfa6", "#eefaf2"),
  sw("hammerhead", "midnight", "#35405a", "#dfe3ec"),
  sw("hammerhead", "butter", "#efd36b", "#fffbe8"),
  // 예전 저장값에 생김새 옵션이 있어도 무시되는지
  ["old-save-ignored", { species: "hammerhead", creatures: { hammerhead: { name: "Hammer", furColor: "#8c8168", bellyColor: "#f2ece0", head: "tophat", neck: "scarf", eyeStyle: "sleepy", stuffing: 0 } } }],
  sw("manta", "midnight", "#35405a", "#e6ebf3"),
  sw("manta", "reef", "#2d8a99", "#eaf6f3"),
  sw("manta", "coral", "#e07a5f", "#fbeee6"),
  sw("manta", "butter", "#efd36b", "#fffbe8"),
  sw("turtle", "seagrass", "#4f8a5b", "#f1e9cf"),
  sw("turtle", "teal", "#3a8f8a", "#e9f5f1"),
  sw("turtle", "sand", "#c9a86a", "#fbf4e3"),
  sw("turtle", "blush", "#e99bb1", "#fff1f4"),
  sw("dolphin", "ocean", "#4a7fb5", "#eef4fa"),
  sw("dolphin", "steel", "#64748a", "#eef1f4"),
  sw("dolphin", "lavender", "#9d8fd1", "#f3f0fb"),
  sw("dolphin", "butter", "#efd36b", "#fffbe8"),
  sw("whaleshark", "slate", "#5b7a92", "#f1ebdd"),
  sw("whaleshark", "navy", "#34507a", "#e6ecf4"),
  sw("whaleshark", "teal", "#3a8f8a", "#e9f5f1"),
  sw("whaleshark", "butter", "#efd36b", "#fffbe8"),
];

const browser = await launch();
const files = [];
for (const [name, state] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  await injectStore(ctx, state);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?pose=1", { waitUntil: "networkidle" }); // 고정 포즈로 캡처
  await page.waitForSelector("canvas");
  await page.waitForTimeout(3500);
  const f = path.join(outDir, name + ".png");
  await page.screenshot({ path: f, clip: { x: 300, y: 120, width: 560, height: 520 } });
  files.push({ name, f, errors });
  await ctx.close();
}
// 시트 합성
const html = `<html><body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(3,560px);gap:4px">
${files.map((x) => `<div style="position:relative"><img src="file://${x.f}" width="560" height="520"><div style="position:absolute;left:6px;top:6px;font:14px monospace;background:#fff8;padding:2px 6px">${x.name}${x.errors.length ? " ⚠ " + x.errors.join(";") : ""}</div></div>`).join("")}
</body></html>`;
const sheet = path.join(outDir, "sheet.html");
fs.writeFileSync(sheet, html);
const page = await browser.newPage({ viewport: { width: 1692, height: 524 * Math.ceil(files.length / 3) + 4 } });
await page.goto("file://" + sheet);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, "sheet.png") });
console.log("sheet:", path.join(outDir, "sheet.png"), "errors:", files.filter((x) => x.errors.length).map((x) => x.name));
await closeAndExit(browser);
