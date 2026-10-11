import type { Species } from "@/store/species";
import { DOLPHIN_FILES } from "@/components/dolphin/dolphinManifest";
import { MANTA_FILES } from "@/components/manta/mantaManifest";
import { SHARK_FILES } from "@/components/shark/sharkManifest";
import { TURTLE_FILES } from "@/components/turtle/turtleManifest";
import { WHALESHARK_FILES } from "@/components/whaleshark/whalesharkManifest";
import type { CreatureFiles } from "./creatureFormat";

/** 종별 베이크 메시 파일 (매니페스트만 모은 가벼운 모듈 — preload 가 초기 청크에서 쓴다) */
export const CREATURE_FILES: Record<Species, CreatureFiles> = {
  hammerhead: SHARK_FILES,
  manta: MANTA_FILES,
  turtle: TURTLE_FILES,
  dolphin: DOLPHIN_FILES,
  whaleshark: WHALESHARK_FILES,
};
