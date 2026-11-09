/**
 * 종 레지스트리의 데이터 쪽: 종 목록, 설정 타입, 팔레트, 고정 생김새, 스튜디오 문구.
 * 컴포넌트·메시 같은 런타임 쪽은 components/creature/registry.tsx 에 있다. 새 종은 두 파일에 한 항목씩 추가한다.
 */

export const SPECIES_IDS = ["hammerhead", "manta", "turtle", "dolphin", "whaleshark"] as const;
export type Species = (typeof SPECIES_IDS)[number];
export const isSpecies = (x: unknown): x is Species => typeof x === "string" && (SPECIES_IDS as readonly string[]).includes(x);

/** 모든 종이 공유하는 설정 */
export interface CreatureConfig {
  name: string;
  furColor: string;
  bellyColor: string;
  pile: number; // fur length 0 ~ 1
  stuffing: number; // plumpness 0 ~ 1
  tailBeat: number; // 0.4 ~ 2
}
/** 사용자가 고르는 값: 이름과 털 색만 */
export type UserFields = Pick<CreatureConfig, "name" | "furColor" | "bellyColor">;

export type EyeStyle = "bead" | "button" | "sleepy" | "sparkle";
export type HeadAccessory = "none" | "tophat" | "party" | "flower" | "crown";
export type NeckAccessory = "none" | "bowtie" | "scarf";
export type FaceAccessory = "none" | "glasses" | "blush";

/** 상어는 눈·입·장식 옵션이 더 있다 (지금은 전부 고정) */
export interface SharkConfig extends CreatureConfig {
  eyeStyle: EyeStyle;
  eyeSize: number; // 0.6 ~ 1.4
  head: HeadAccessory;
  neck: NeckAccessory;
  face: FaceAccessory;
  accentColor: string;
}

export interface Palette {
  id: string;
  label: string;
  fur: string;
  belly: string;
}

/** 스튜디오 문구 */
export interface SpeciesCopy {
  no: string;
  placeholder: string;
  fallback: string;
}

export interface SpeciesData {
  label: string;
  palette: Palette[];
  /** 기본 색 (팔레트 인덱스) */
  defaultSwatch: number;
  defaultName: string;
  /** 사용자가 못 바꾸는 생김새 — 저장값이 있어도 항상 덮어쓴다 */
  fixed: Omit<CreatureConfig, keyof UserFields> & Partial<Omit<SharkConfig, keyof CreatureConfig>>;
  copy: SpeciesCopy;
}

const PASTEL = {
  blush: { id: "blush", label: "Blush", fur: "#e99bb1", belly: "#fff1f4" },
  lavender: { id: "lavender", label: "Lavender", fur: "#9d8fd1", belly: "#f3f0fb" },
  mint: { id: "mint", label: "Mint", fur: "#86cfa6", belly: "#eefaf2" },
  butter: { id: "butter", label: "Butter", fur: "#efd36b", belly: "#fffbe8" },
} as const;

export const SPECIES_DATA: Record<Species, SpeciesData> = {
  hammerhead: {
    label: "Hammerhead",
    palette: [
      { id: "bronze", label: "Bronze", fur: "#8c8168", belly: "#f2ece0" },
      { id: "lagoon", label: "Lagoon", fur: "#3aa4ad", belly: "#eaf6f3" },
      { id: "sunset", label: "Sunset", fur: "#e2673a", belly: "#fbeadf" },
      PASTEL.blush,
      PASTEL.lavender,
      PASTEL.mint,
      { id: "midnight", label: "Midnight", fur: "#35405a", belly: "#dfe3ec" },
      PASTEL.butter,
    ],
    defaultSwatch: 1,
    defaultName: "Hammer",
    // 구슬 눈(살짝 크게), 볼터치, 장식 없음, 통통한 솜, 느긋한 꼬리 (입은 없다 — 플러시 얼굴)
    fixed: { eyeStyle: "bead", eyeSize: 1.1, head: "none", neck: "none", face: "blush", accentColor: "#c8323a", pile: 0.5, stuffing: 0.62, tailBeat: 0.9 },
    copy: {
      no: "01",
      placeholder: "Hammerhead name",
      fallback: "Hammerhead",
    },
  },
  manta: {
    label: "Manta",
    palette: [
      { id: "midnight", label: "Midnight", fur: "#35405a", belly: "#e6ebf3" },
      { id: "reef", label: "Reef", fur: "#2d8a99", belly: "#eaf6f3" },
      { id: "ink", label: "Ink", fur: "#2e2c33", belly: "#f1efe9" },
      { id: "dusk", label: "Dusk", fur: "#6f6aa8", belly: "#f0eefa" },
      { id: "coral", label: "Coral", fur: "#e07a5f", belly: "#fbeee6" },
      { id: "slate", label: "Slate", fur: "#6b7f8a", belly: "#eef2f4" },
      PASTEL.blush,
      PASTEL.butter,
    ],
    defaultSwatch: 0,
    defaultName: "Manta",
    fixed: { pile: 0.4, stuffing: 0.5, tailBeat: 0.8 },
    copy: {
      no: "02",
      placeholder: "Manta name",
      fallback: "Manta",
    },
  },
  turtle: {
    label: "Turtle",
    palette: [
      { id: "seagrass", label: "Seagrass", fur: "#4f8a5b", belly: "#f1e9cf" },
      { id: "olive", label: "Olive", fur: "#7f8a46", belly: "#f3efd8" },
      { id: "moss", label: "Moss", fur: "#5b6b3a", belly: "#ede6cc" },
      { id: "teal", label: "Teal", fur: "#3a8f8a", belly: "#e9f5f1" },
      { id: "sand", label: "Sand", fur: "#c9a86a", belly: "#fbf4e3" },
      PASTEL.blush,
      PASTEL.lavender,
      PASTEL.butter,
    ],
    defaultSwatch: 0,
    defaultName: "Turtle",
    fixed: { pile: 0.5, stuffing: 0.6, tailBeat: 0.7 },
    copy: {
      no: "03",
      placeholder: "Turtle name",
      fallback: "Turtle",
    },
  },
  dolphin: {
    label: "Dolphin",
    palette: [
      { id: "ocean", label: "Ocean", fur: "#4a7fb5", belly: "#eef4fa" },
      { id: "steel", label: "Steel", fur: "#64748a", belly: "#eef1f4" },
      { id: "lagoon", label: "Lagoon", fur: "#3aa4ad", belly: "#eaf6f3" },
      { id: "navy", label: "Navy", fur: "#2f4a6e", belly: "#e3eaf3" },
      PASTEL.blush,
      PASTEL.lavender,
      PASTEL.mint,
      PASTEL.butter,
    ],
    defaultSwatch: 0,
    defaultName: "Dolphin",
    fixed: { pile: 0.4, stuffing: 0.6, tailBeat: 1.1 },
    copy: {
      no: "04",
      placeholder: "Dolphin name",
      fallback: "Dolphin",
    },
  },
  whaleshark: {
    label: "Whale",
    palette: [
      { id: "slate", label: "Slate", fur: "#5b7a92", belly: "#f1ebdd" },
      { id: "navy", label: "Navy", fur: "#34507a", belly: "#e6ecf4" },
      { id: "steel", label: "Steel", fur: "#64748a", belly: "#eef1f4" },
      { id: "teal", label: "Teal", fur: "#3a8f8a", belly: "#e9f5f1" },
      { id: "moss", label: "Moss", fur: "#5b6b3a", belly: "#ede6cc" },
      PASTEL.blush,
      PASTEL.lavender,
      PASTEL.butter,
    ],
    defaultSwatch: 0,
    defaultName: "Whale Shark",
    fixed: { pile: 0.45, stuffing: 0.7, tailBeat: 0.6 },
    copy: {
      no: "05",
      placeholder: "Whale shark name",
      fallback: "Whale shark",
    },
  },
};

export function defaultConfig(species: Species): CreatureConfig {
  const d = SPECIES_DATA[species];
  const sw = d.palette[d.defaultSwatch];
  return { ...d.fixed, name: d.defaultName, furColor: sw.fur, bellyColor: sw.belly };
}
