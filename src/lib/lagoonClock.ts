import { captureParam } from "@/components/creature/debugProbe";

/**
 * 라군 시계 — 실제 1시간 = 라군 24시간 (매시 정각이 자정, 30분이 정오).
 * three.js 를 끌어오지 않는 순수 모듈이라 메인 목록(사진만 쓰는 화면)도 같은 시각을 쓴다.
 * ?hour=H 로 시각 고정, ?daylen=초 로 하루 길이 덮어쓰기 (점검용).
 */
const HOUR_PARAM = captureParam("hour");
const FIXED_HOUR = HOUR_PARAM != null && Number.isFinite(Number(HOUR_PARAM)) ? ((Number(HOUR_PARAM) % 24) + 24) % 24 : null;
const DAY_LEN = Number(captureParam("daylen")) || 3600; // 하루 길이(실제 초)

/** 지금 라군 시각 (0 ~ 24) — 벽시계 기준이라 새로고침·여러 탭에서도 같다 */
export function dayHour(nowMs = Date.now()) {
  if (FIXED_HOUR != null) return FIXED_HOUR;
  return (((nowMs / 1000) % DAY_LEN) / DAY_LEN) * 24;
}

export function smoothstep(x: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 라군 시각 → 밤 정도 (0 낮 · 1 밤). 해 질 녘 17:30~20:00, 동틀 녘 5:00~7:30 에 부드럽게 */
export function nightOf(h: number) {
  if (h >= 12) return smoothstep(h, 17.5, 20);
  return 1 - smoothstep(h, 5, 7.5);
}
