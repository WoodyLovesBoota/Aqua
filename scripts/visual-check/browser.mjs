// 점검 스크립트 공용: 실제 GPU 로 그리는 헤드리스 Chrome
import { chromium } from "playwright";

export const BASE = process.env.BASE ?? "http://localhost:3000";

export const launch = () =>
  chromium.launch({ channel: "chrome", headless: true, args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"] });

/** 브라우저 종료가 가끔 멈춰 wait 가 안 끝난다 → 5초 넘으면 그냥 끝낸다 */
export async function closeAndExit(browser, code = 0) {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(code);
}

/** 뷰포트·배율: 모든 스크립트가 같은 환경변수(VW/VH/DPR)를 받는다 */
export const contextOptions = () => ({
  viewport: { width: Number(process.env.VW ?? 1440), height: Number(process.env.VH ?? 900) },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
});

/** 콘솔 에러·경고를 out 에 모은다 (three 의 Clock 폐기 경고는 뺀다) */
export function collectConsoleErrors(page, out, max = 300) {
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !m.text().includes("THREE.Clock")) out.push(m.text().slice(0, max));
  });
}

export const parsePoints = (s) => s.split(",").map(Number);

/** 점들을 이어 끈다: [x1,y1,x2,y2,…]. release=false 면 누른 채 둔다 (누름 유지 캡처) */
export async function dragPath(page, pts, { steps = 25, release = true } = {}) {
  await page.mouse.move(pts[0], pts[1]);
  await page.mouse.down();
  for (let i = 2; i < pts.length; i += 2) await page.mouse.move(pts[i], pts[i + 1], { steps });
  if (release) await page.mouse.up();
}
