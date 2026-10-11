// 조작 흐름 점검: 스튜디오(종 전환 → 이름 입력 → 색 선택) → 바다로 → 수조 조작(클릭 파임 / 드래그 / 블록 흔들기 / 물 색) → 돌아오기.
// usage: node flow.mjs <라벨> [baseUrl]  → .visual-check/step<라벨>/flow/*.png + 상태 JSON. 콘솔 에러·pageerror 가 있으면 종료 코드 1.
import fs from "node:fs";
import path from "node:path";
import { BASE, closeAndExit, collectConsoleErrors, contextOptions, dragPath, launch } from "./browser.mjs";

const step = process.argv[2] ?? "flow";
const base = process.argv[3] ?? BASE;
const outDir = path.join(import.meta.dirname, "../../.visual-check", `step${step}`, "flow");
fs.mkdirSync(outDir, { recursive: true });
const shot = (name) => page.screenshot({ path: path.join(outDir, name + ".png") });

const browser = await launch();
const ctx = await browser.newContext(contextOptions());
const page = await ctx.newPage();
const errs = [];
collectConsoleErrors(page, errs);
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByRole("radio", { name: "Dolphin" }).click();
await page.waitForTimeout(300);
const h1 = await page.getByRole("heading", { level: 1 }).innerText();
await page.getByLabel("돌고래 이름").fill("Bobo");
await page.getByRole("button", { name: "Lavender" }).click();
await page.waitForTimeout(2500);
await shot("studio");
const primary = await page.getByRole("button", { name: /바다에 풀어주기/ }).innerText();
await page.getByRole("button", { name: /바다에 풀어주기/ }).click();
await page.waitForURL("**/sea");
await page.waitForTimeout(4000);
await shot("sea");
await page.mouse.click(650, 470); await page.waitForTimeout(350);
await shot("sea-click");
await dragPath(page, [500, 520, 900, 620]); await page.waitForTimeout(250);
await shot("sea-drag");
// 블록 아래 지층을 잡고 흔든다 → 젤리처럼 기울었다 되튄다 (놓은 직후 캡처)
await dragPath(page, [620, 750, 740, 750, 520, 750, 740, 750, 520, 750, 740, 750, 520, 750], { steps: 5 }); await page.waitForTimeout(150);
await shot("sea-shake");
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Sunset" }).click(); await page.waitForTimeout(500);
await shot("sea-sunset");
await page.getByRole("link", { name: "다시 꾸미기" }).click();
await page.waitForURL(base + "/"); await page.waitForTimeout(2500);
const h1b = await page.getByRole("heading", { level: 1 }).innerText();
const name = await page.getByLabel("돌고래 이름").inputValue();
await shot("back");
const result = { h1, primary, h1b, name, errs };
fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
const ok = h1.includes("Dolphin") && primary.startsWith("Bobo") && name === "Bobo" && errs.length === 0;
console.log(ok ? "FLOW OK" : "FLOW FAILED");
await closeAndExit(browser, ok ? 0 : 1);
