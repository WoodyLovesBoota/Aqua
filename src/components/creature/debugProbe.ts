/**
 * 점검 스크립트용 훅. URL 에 ?debug 또는 ?jump= 가 있을 때만 켜지고, 상태를 window.__aquaDebug 에 공개한다.
 * (scripts/visual-check/probe.mjs 가 조건부 캡처에 읽는다)
 */
declare global {
  interface Window {
    __aquaDebug?: Record<string, unknown>;
  }
}

const QUERY = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

/** 캡처용 URL 파라미터 (서버에서는 null) */
export const captureParam = (name: string) => QUERY?.get(name) ?? null;

const DEBUG = QUERY?.has("debug") || QUERY?.has("jump") || false;
/** 프레임마다 디버그 객체를 만드는 호출은 이걸로 감싼다 (꺼져 있으면 할당 자체를 피한다) */
export const DEBUG_ON = DEBUG;

/** DEBUG 일 때만 상태를 공개한다 (프레임마다 불러도 싸다) */
export function publishDebug(key: string, state: unknown) {
  if (!DEBUG) return;
  (window.__aquaDebug ??= {})[key] = state;
}
