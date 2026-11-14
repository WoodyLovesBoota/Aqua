// 전시 사진 찍기: pnpm posters [baseUrl] [slug…]  → public/posters/<slug>-day.webp · -night.webp (배경 투명, 2160×1350)
// 메인 목록과 전시 로딩 배경이 이 사진을 쓴다. 전시를 고치거나 새로 넣으면 다시 돌린다 (dev 서버가 떠 있어야 한다).
// 캡처 → 종이 배경을 가장자리부터 번져 지우고(바닥 그림자는 반투명 검정으로), 밤 컴포저 경로의 회색 배경은 종이색으로 맞춘다.
import fs from "node:fs";
import path from "node:path";
import { PLACES } from "../src/components/home/places.ts";
import { BASE, closeAndExit, launch } from "./visual-check/browser.mjs";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? BASE;
const only = args.filter((a) => !a.startsWith("http"));
const outDir = path.join(import.meta.dirname, "../public/posters");
fs.mkdirSync(outDir, { recursive: true });
const W = 1440, H = 900, DPR = 1.5;
const PAPER = [235, 231, 224]; // --paper
const TIMES = { day: 13, night: 21 };
// 종이로 볼 색 허용 폭. 넓히면 유리 돔 안 옅은 하늘까지 지워져 회색이 되므로 기본은 좁게, 바닥 그림자가 물든 라군만 넓게
const WIDE_TOL: Record<string, number> = { lagoon: 0.07 };

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const lab = await ctx.newPage(); // 픽셀 가공용 빈 페이지

for (const place of PLACES) {
  if (only.length && !only.includes(place.slug)) continue;
  for (const [name, hour] of Object.entries(TIMES)) {
    await page.goto(`${base}/${place.slug}?hour=${hour}`, { waitUntil: "networkidle" });
    // 안내 줄·로딩 배경·개발 오버레이는 사진에 넣지 않는다. 라군은 캔버스가 투명해 프레임 그라데이션이 비치므로 평평한 종이색으로 바꿔 찍는다
    await page.addStyleTag({ content: `[class*="topbar"],[class*="backdrop"],[class*="loading"],nextjs-portal{display:none!important}[class*="frame"]{background:#ebe7e0!important}` });
    await page.waitForTimeout(Number(process.env.WAIT ?? 6000));
    const png = (await page.screenshot()).toString("base64");
    const webp = await lab.evaluate(
      async ({ png, PAPER, TOL }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + png;
        await img.decode();
        const w = img.width, h = img.height;
        const cv = new OffscreenCanvas(w, h);
        const g = cv.getContext("2d")!;
        g.drawImage(img, 0, 0);
        const im = g.getImageData(0, 0, w, h), px = im.data;
        // 배경색 = 네 귀퉁이 평균 (낮은 종이색 그대로, 밤은 톤매핑된 회색)
        const bg = [0, 0, 0];
        for (const i of [0, w - 1, (h - 1) * w, h * w - 1]) for (let c = 0; c < 3; c++) bg[c] += px[i * 4 + c] / 4;
        // 종이 같은 픽셀: 배경색의 밝기만 줄인 것(그림자). f = 밝기 비, 채널마다 비가 같아야 한다
        const shade = (i: number) => {
          const r = px[i] / bg[0], gg = px[i + 1] / bg[1], b = px[i + 2] / bg[2], f = (r + gg + b) / 3;
          return f > 0.4 && f < 1.03 && Math.abs(r - f) < TOL && Math.abs(gg - f) < TOL && Math.abs(b - f) < TOL ? f : -1;
        };
        // 가장자리에서 번져 들어가며 지운다 (블록 안쪽의 종이색 면은 건드리지 않는다)
        const seen = new Uint8Array(w * h), stack: number[] = [];
        const push = (p: number) => {
          if (seen[p] || shade(p * 4) < 0) return;
          seen[p] = 1;
          stack.push(p);
        };
        for (let x = 0; x < w; x++) {
          push(x);
          push((h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
          push(y * w);
          push(y * w + w - 1);
        }
        while (stack.length) {
          const p = stack.pop()!, x = p % w;
          if (x > 0) push(p - 1);
          if (x < w - 1) push(p + 1);
          if (p >= w) push(p - w);
          if (p < w * (h - 1)) push(p + w);
        }
        for (let p = 0; p < w * h; p++) {
          const i = p * 4;
          if (seen[p]) {
            const f = Math.min(1, shade(i));
            px[i] = px[i + 1] = px[i + 2] = 0;
            px[i + 3] = Math.round((1 - f) * 255);
          } else for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, Math.round((px[i + c] * PAPER[c]) / bg[c]));
        }
        // 안 지워진 옅은 얼룩이 사진 테두리에서 뚝 끊기지 않게 가장자리 1.5% 는 투명으로 풀어 준다
        const fe = Math.round(w * 0.015);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const e = Math.min(x, y, w - 1 - x, h - 1 - y);
            if (e < fe) px[(y * w + x) * 4 + 3] *= e / fe;
          }
        g.putImageData(im, 0, 0);
        const blob = await cv.convertToBlob({ type: "image/webp", quality: 0.84 });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { b64: btoa(s), bg, cleared: seen.reduce((a, v) => a + v, 0) / (w * h) };
      },
      { png, PAPER, TOL: WIDE_TOL[place.slug] ?? 0.03 },
    );
    const file = path.join(outDir, `${place.slug}-${name}.webp`);
    fs.writeFileSync(file, Buffer.from(webp.b64, "base64"));
    console.log(`${place.slug}-${name}.webp  ${(fs.statSync(file).size / 1024).toFixed(0)}KB  bg ${webp.bg.map((v) => v.toFixed(0))}  cleared ${(webp.cleared * 100).toFixed(0)}%`);
  }
}
await closeAndExit(browser);
