"use client";

import { useSyncExternalStore } from "react";
import { dayHour, nightOf, smoothstep } from "@/lib/lagoonClock";

// 라군 하루 = 실제 1시간이라 5초마다 보면 충분하다 (라군 2분)
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 5000);
  return () => clearInterval(id);
};

/** 사진 낮/밤 섞는 정도 (0 낮 · 1 밤). 어스름엔 두 장이 겹쳐 보이므로 가운데 구간을 좁힌다. 서버·하이드레이션 땐 0 */
export function useNight() {
  return useSyncExternalStore(
    subscribe,
    () => Math.round(smoothstep(nightOf(dayHour()), 0.3, 0.7) * 50) / 50,
    () => 0,
  );
}

/** 라군 시각 "HH:MM" (서버·하이드레이션 땐 빈 문자열) */
export function useLagoonClock() {
  return useSyncExternalStore(
    subscribe,
    () => {
      const h = dayHour();
      return `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, "0")}`;
    },
    () => "",
  );
}
