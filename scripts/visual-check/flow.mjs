// 조작 흐름 점검: 바다(/lagoon) → 수면 클릭 파임 / 드래그 / 블록 흔들기 (패널 없음 — 화면에 선택 UI 가 없어야 한다).
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

await page.goto(base + "/lagoon", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await shot("sea");
const noPanel = (await page.getByRole("complementary").count()) === 0; // 개발 오버레이(nextjs-portal) 버튼은 세지 않는다
await page.mouse.click(650, 470); await page.waitForTimeout(350);
await shot("sea-click");
await dragPath(page, [500, 520, 900, 620]); await page.waitForTimeout(250);
await shot("sea-drag");
// 블록 아래 지층을 잡고 흔든다 → 젤리처럼 기울었다 되튄다 (놓은 직후 캡처)
await dragPath(page, [620, 750, 740, 750, 520, 750, 740, 750, 520, 750, 740, 750, 520, 750], { steps: 5 }); await page.waitForTimeout(150);
await shot("sea-shake");
const result = { noPanel, errs };
fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
const ok = noPanel && errs.length === 0;
console.log(ok ? "FLOW OK" : "FLOW FAILED");
await closeAndExit(browser, ok ? 0 : 1);
