"use client";

import type * as THREE from "three";
import { DioramaScene, type DioramaSpec } from "@/components/diorama/DioramaScene";
import { buildEsplanade } from "./esplanade";
import { buildFlyer } from "./flyer";
import { buildGardens } from "./gardens";
import { buildGround } from "./ground";
import { buildHelix } from "./helix";
import { BLOCK, inBay, WATER_Y } from "./layout";
import { buildLotus } from "./lotus";
import { buildMerlion } from "./merlion";
import { buildSands } from "./sands";
import { buildSky } from "./sky";

/** 전시 02 — 마리나베이: 공용 디오라마 셸 위에 랜드마크를 얹는다 */
const SPEC: DioramaSpec = {
  id: "marina",
  seed: 11,
  block: BLOCK,
  look: [0.6, 1.0, -0.4],
  // ?focus=<랜드마크> — 근접 확인용 (목업 target-mockup.html 과 같은 자리·거리)
  foci: {
    mbs: [1.4, 3.2, -4.6, 15], lotus: [-3.4, 1.0, -3.9, 9], flyer: [-6.8, 2.2, -4.6, 11], gardens: [7.8, 1.4, -3.4, 12],
    esplanade: [-2.0, 0.6, 4.8, 9], merlion: [-6.3, 0.8, 0.8, 6], helix: [6.4, 0.4, 2.5, 7],
  },
  light: {
    hemiSky: ["#f4f1ff", "#9aa6e8"], hemiGround: ["#cbbfa6", "#4a4560"], hemiI: [1.5, 1.25],
    sun: ["#fff4e0", "#ffb48e"], sunI: [2.6, 0.7], sunPos: [[10, 20, 8], [-14, 8, -10]],
  },
  // 1/4 해상도 블룸은 번짐이 옅어 목업(전체 해상도 0.55)보다 세게
  bloom: { strength: 0.72, radius: 0.32 },
  build(kit) {
    const ground = buildGround(kit);
    const flyer = buildFlyer(kit);
    const merlion = buildMerlion(kit);
    const sky = buildSky(kit);
    return {
      roots: [ground.root, buildSands(kit), buildLotus(kit), flyer.root, buildHelix(kit), buildEsplanade(kit), merlion.root, buildGardens(kit), sky.root],
      bakeGroups: [flyer.wheel], // 돌아가는 바퀴 안쪽도 따로 합친다 (돌아가는 그룹 하나 = 몇 드로우)
      ticks: [flyer.tick, merlion.tick, sky.tick],
      water: { material: ground.water.material as THREE.MeshStandardMaterial, y: WATER_Y, contains: inBay },
    };
  },
  ariaLabel:
    "A jelly-block diorama of Singapore's Marina Bay: Marina Bay Sands with its glowing SkyPark, the ArtScience Museum lotus, the Singapore Flyer, Helix Bridge, Esplanade durian domes, the Merlion and the Supertrees of Gardens by the Bay.",
};

export function MarinaScene({ onReady }: { onReady?: () => void }) {
  return <DioramaScene spec={SPEC} onReady={onReady} />;
}
