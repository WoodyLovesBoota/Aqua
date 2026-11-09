// 조작 흐름 점검: 바다(메인) → 생물 꺼내기 → 추가(스튜디오: 이름·색) → 풀어주기 → 수조 조작(클릭 파임 / 드래그 / 블록 흔들기 / 물 색) → 패널 숨기기 → 주민 눌러 다시 꾸미기.
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
await page.waitForTimeout(4000);
await shot("sea");
// 돌고래를 바다에서 꺼낸 뒤 "+ Add a creature" → 스튜디오가 빠진 종(돌고래)으로 열린다
await page.getByRole("button", { name: /^Take .* out of the lagoon$/ }).nth(3).click();
const residentsAfterRemove = await page.locator("ul li").count();
await page.getByRole("button", { name: "+ Add a creature" }).click();
await page.waitForURL("**/studio");
await page.waitForTimeout(2500);
const h1 = await page.getByRole("heading", { level: 1 }).innerText();
await page.getByLabel("Dolphin name").fill("Bobo");
await page.getByRole("button", { name: "Lavender" }).click();
await page.waitForTimeout(1500);
await shot("studio");
const primary = await page.getByRole("button", { name: /into the lagoon/ }).innerText();
await page.getByRole("button", { name: /into the lagoon/ }).click();
await page.waitForURL(base + "/");
await page.waitForTimeout(3000);
await shot("sea-released");
const residents = await page.locator("ul li").allInnerTexts();
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
// H 로 패널 숨기기 → 다시 보이기
await page.keyboard.press("h"); await page.waitForTimeout(300);
await shot("sea-hidden");
const hiddenOk = (await page.getByRole("complementary").count()) === 0;
await page.getByRole("button", { name: /Show panel/ }).click(); await page.waitForTimeout(300);
// 주민 이름을 누르면 스튜디오에서 그 종을 고친다
await page.getByRole("button", { name: /^Edit Bobo/ }).click();
await page.waitForURL("**/studio"); await page.waitForTimeout(2500);
const h1b = await page.getByRole("heading", { level: 1 }).innerText();
const name = await page.getByLabel("Dolphin name").inputValue();
await shot("back");
const result = { residentsAfterRemove, h1, primary, residents, hiddenOk, h1b, name, errs };
fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
const ok =
  residentsAfterRemove === 4 && h1.includes("Dolphin") && primary.includes("Bobo") && residents.some((r) => r.includes("Bobo")) && residents.length === 5 && hiddenOk && h1b.includes("Dolphin") && name === "Bobo" && errs.length === 0;
console.log(ok ? "FLOW OK" : "FLOW FAILED");
await closeAndExit(browser, ok ? 0 : 1);
