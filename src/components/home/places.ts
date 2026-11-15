/**
 * 전시 목록 — 메인 화면(넘겨 보는 목록)·전시 로딩 배경·사진 찍는 스크립트(`pnpm posters`)가 같이 쓰는 순수 데이터.
 * 새 전시 = 라우트 하나 + 여기 한 줄 + `pnpm posters`.
 */
export interface Place {
  /** 라우트(`/<slug>`)이자 사진 파일 이름(`/posters/<slug>-day.webp`, `-night.webp`) */
  slug: string;
  name: string;
}

export const PLACES: Place[] = [
  { slug: "lagoon", name: "Maldives" },
  { slug: "marina-bay", name: "Singapore" },
  { slug: "sapporo", name: "Sapporo" },
  { slug: "jeonju", name: "Jeonju" },
  { slug: "paris", name: "Paris" },
];

/** 사진 원본 화면비 (1440×900 캡처) — 전시 카메라가 이 비율 이상에선 높이 고정, 미만에선 폭 고정이다 */
export const POSTER_ASPECT = 1.6;
/** 세로 화면에서 전시 카메라가 블록을 더 크게 잡는 배율 (1.6 / 1.4) */
export const PORTRAIT_ZOOM = 1.6 / 1.4;
