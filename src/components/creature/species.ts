/**
 * 종 레지스트리의 데이터 쪽: 종 목록과 각 종의 고정 생김새(색·솜·꼬리 박자).
 * 꾸미기 기능은 없다 — 전시용이라 모든 생물이 이 기본값 그대로 바다에 들어간다.
 * 컴포넌트·메시 같은 런타임 쪽은 registry.tsx 에 있다. 새 종은 두 파일에 한 항목씩 추가한다.
 */

export const SPECIES_IDS = ["hammerhead", "manta", "turtle", "dolphin", "whaleshark"] as const;
export type Species = (typeof SPECIES_IDS)[number];

/** 모든 종이 공유하는 생김새 */
export interface CreatureConfig {
  furColor: string;
  bellyColor: string;
  pile: number; // fur length 0 ~ 1
  stuffing: number; // plumpness 0 ~ 1
  tailBeat: number; // 0.4 ~ 2
}

export type EyeStyle = "bead" | "button" | "sleepy" | "sparkle";
export type HeadAccessory = "none" | "tophat" | "party" | "flower" | "crown";
export type NeckAccessory = "none" | "bowtie" | "scarf";
export type FaceAccessory = "none" | "glasses" | "blush";

/** 상어는 눈·장식 항목이 더 있다 */
export interface SharkConfig extends CreatureConfig {
  eyeStyle: EyeStyle;
  eyeSize: number; // 0.6 ~ 1.4
  head: HeadAccessory;
  neck: NeckAccessory;
  face: FaceAccessory;
  accentColor: string;
}

// 구슬 눈(살짝 크게), 볼터치, 장식 없음 (입은 없다 — 플러시 얼굴)
const HAMMERHEAD: SharkConfig = {
  furColor: "#3aa4ad",
  bellyColor: "#eaf6f3",
  pile: 0.5,
  stuffing: 0.62,
  tailBeat: 0.9,
  eyeStyle: "bead",
  eyeSize: 1.1,
  head: "none",
  neck: "none",
  face: "blush",
  accentColor: "#c8323a",
};

export const CREATURE_CONFIGS: Record<Species, CreatureConfig> = {
  hammerhead: HAMMERHEAD,
  manta: { furColor: "#35405a", bellyColor: "#e6ebf3", pile: 0.4, stuffing: 0.5, tailBeat: 0.8 },
  turtle: { furColor: "#4f8a5b", bellyColor: "#f1e9cf", pile: 0.5, stuffing: 0.6, tailBeat: 0.7 },
  dolphin: { furColor: "#4a7fb5", bellyColor: "#eef4fa", pile: 0.4, stuffing: 0.6, tailBeat: 1.1 },
  whaleshark: { furColor: "#5b7a92", bellyColor: "#f1ebdd", pile: 0.45, stuffing: 0.7, tailBeat: 0.6 },
};
