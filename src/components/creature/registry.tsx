import type { ComponentType } from "react";
import type { CreatureConfig, SharkConfig, Species } from "@/components/creature/species";
import { DolphinParts } from "@/components/dolphin/DolphinParts";
import { MantaParts } from "@/components/manta/MantaParts";
import { SharkHeadParts } from "@/components/shark/SharkParts";
import { TurtleParts } from "@/components/turtle/TurtleParts";
import { WhaleSharkParts } from "@/components/whaleshark/WhaleSharkParts";
import type { CreatureFiles } from "./creatureFormat";
import { CREATURE_FILES } from "./files";
import type { PlushSwim } from "./PlushMaterial";

export interface CreatureDefinition {
  files: CreatureFiles;
  /** PlushMaterial 의 헤엄·배 마스크 스니펫 */
  swim: PlushSwim;
  Parts: ComponentType<{ config: CreatureConfig }>;
  /** 솜(stuffing 0..1) → 그룹 배율. 납작한 종은 두께만, 통통한 종은 단면 전체가 부푼다 */
  plump: (stuffing: number) => [number, number, number];
}

const round = (s: number): [number, number, number] => [1, 0.84 + s * 0.32, 0.84 + s * 0.32];
const flat = (s: number): [number, number, number] => [1, 0.88 + s * 0.24, 1];

/** 종 레지스트리의 런타임 쪽. 데이터(고정 생김새)는 species.ts */
export const CREATURES: Record<Species, CreatureDefinition> = {
  hammerhead: {
    files: CREATURE_FILES.hammerhead,
    swim: "shark",
    // 상어 설정은 눈·장식 항목까지 들어 있다
    Parts: SharkHeadParts as ComponentType<{ config: CreatureConfig }>,
    plump: round,
  },
  manta: { files: CREATURE_FILES.manta, swim: "manta", Parts: MantaParts, plump: flat },
  turtle: { files: CREATURE_FILES.turtle, swim: "turtle", Parts: TurtleParts, plump: flat },
  dolphin: { files: CREATURE_FILES.dolphin, swim: "dolphin", Parts: DolphinParts, plump: round },
  whaleshark: { files: CREATURE_FILES.whaleshark, swim: "whaleshark", Parts: WhaleSharkParts, plump: round },
};

/** 상어 항목만 쓰는 타입 좁히기 */
export const asShark = (c: CreatureConfig) => c as SharkConfig;
