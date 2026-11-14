// 사진(P 키·Snapshot 버튼) 점검: 다운로드된 PNG 가 비어 있지 않은지(가운데 픽셀이 종이색만이 아닌지) 확인한다.
// usage: node snapcheck.mjs [baseUrl] [out.png]
import fs from "node:fs";
import { BASE, closeAndExit, collectConsoleErrors, contextOptions, launch } from "./browser.mjs";
const base = process.argv[2] ?? BASE;
const out = process.argv[3] ?? "snap.png";
const browser = await launch();
const ctx = await browser.newContext({ ...contextOptions(), acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
collectConsoleErrors(page, errs);
await page.goto(base + "/lagoon", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Snapshot" }).click()]);
await dl.saveAs(out);
const size = fs.statSync(out).size;
console.log(JSON.stringify({ file: dl.suggestedFilename(), size, errs }));
await closeAndExit(browser, size > 50_000 && errs.length === 0 ? 0 : 1);
