import type { ComponentType } from "react";
import type { CreatureConfig, SharkConfig, Species } from "@/store/species";
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
  /** 스튜디오 자율 유영: 배율·속도·회전 성격. 배율은 실제 크기 순서(고래상어 > 상어 ≈ 만타 > 돌고래 > 거북)만 지키고 전부 프레임 안에 들어오게 */
  studio: { scale: number; speed: number; turn: number };
}

const round = (s: number): [number, number, number] => [1, 0.84 + s * 0.32, 0.84 + s * 0.32];
const flat = (s: number): [number, number, number] => [1, 0.88 + s * 0.24, 1];

/** 종 레지스트리의 런타임 쪽. 데이터(팔레트·문구·고정 생김새)는 store/species.ts */
export const CREATURES: Record<Species, CreatureDefinition> = {
  hammerhead: {
    files: CREATURE_FILES.hammerhead,
    swim: "shark",
    // 상어 설정은 고정 생김새(눈·입·장식)까지 들어 있다
    Parts: SharkHeadParts as ComponentType<{ config: CreatureConfig }>,
    plump: round,
    studio: { scale: 0.8, speed: 1, turn: 1 },
  },
  manta: { files: CREATURE_FILES.manta, swim: "manta", Parts: MantaParts, plump: flat, studio: { scale: 0.72, speed: 0.8, turn: 0.75 } },
  turtle: { files: CREATURE_FILES.turtle, swim: "turtle", Parts: TurtleParts, plump: flat, studio: { scale: 0.6, speed: 0.6, turn: 0.7 } },
  dolphin: { files: CREATURE_FILES.dolphin, swim: "dolphin", Parts: DolphinParts, plump: round, studio: { scale: 0.7, speed: 1.15, turn: 1.1 } },
  whaleshark: { files: CREATURE_FILES.whaleshark, swim: "whaleshark", Parts: WhaleSharkParts, plump: round, studio: { scale: 0.78, speed: 0.55, turn: 0.55 } },
};

/** 상어 항목만 쓰는 타입 좁히기 */
export const asShark = (c: CreatureConfig) => c as SharkConfig;
