"use client";

import * as THREE from "three";
import { DioramaScene, type DioramaSpec } from "@/components/diorama/DioramaScene";
import { trimShadows } from "@/components/diorama/fx";
import { buildGround } from "./ground";
import { buildArc, buildBridges, buildCarousel, buildConcorde, buildEiffel, buildLouvre, buildMoulinRouge, buildNotreDame, buildSacreCoeur } from "./landmarks";
import { BLOCK, inSeine, WATER_Y } from "./layout";
import { makeParts } from "./parts";
import { buildSky } from "./sky";
import { buildTown } from "./town";

/** 전시 05 — 파리: 봄 센강·시테섬 노트르담·에펠탑·몽마르트르 사크레쾨르·물랭루주·루브르·콩코르드·개선문 */
const SPEC: DioramaSpec = {
  id: "paris",
  seed: 47,
  block: BLOCK,
  look: [0.4, 1.3, -0.4],
  // ?focus=<랜드마크> — 근접 확인용 (목업 target-mockup.html 과 같은 자리·거리)
  foci: {
    eiffel: [-6.6, 2.6, -3.4, 15], sacrecoeur: [0.8, 1.6, -4.6, 9], louvre: [2.4, 0.4, -0.7, 8], notredame: [5.0, 0.5, 3.7, 7],
    arc: [6.3, 0.5, -3.65, 8], moulin: [-2.6, 0.7, -1.5, 6], cafe: [8.2, 0.7, 0.8, 7], bridge: [-2.8, 0.4, 3.0, 8],
  },
  // 낮: 맑은 봄 오후 / 밤: 푸른 달빛 (따뜻한 빛은 창·가로등·에펠 발광이 맡는다)
  light: {
    hemiSky: ["#fff8ee", "#98a2e8"], hemiGround: ["#d2c6aa", "#4a4466"], hemiI: [1.55, 1.4],
    sun: ["#fff0d6", "#b9c2ff"], sunI: [2.5, 0.6], sunPos: [[10, 17, 8], [-12, 14, -6]],
  },
  bloom: { strength: 0.7, radius: 0.38 },
  build(kit) {
    const P = makeParts(kit);
    const root = new THREE.Group();
    const bakeGroups: THREE.Object3D[] = [];
    const ground = buildGround(kit, P);
    root.add(ground.root);
    const eiffel = buildEiffel(kit, P, root);
    const carousel = buildCarousel(kit, P, root, bakeGroups);
    buildSacreCoeur(kit, P, root);
    const moulin = buildMoulinRouge(kit, P, root, bakeGroups);
    buildLouvre(kit, P, root);
    buildConcorde(kit, P, root);
    buildArc(kit, P, root);
    buildNotreDame(kit, P, root);
    buildBridges(kit, P, root);
    const town = buildTown(kit, P, root);
    town.decals(); // 빛 웅덩이는 모든 자리가 모인 뒤에
    const sky = buildSky(kit);
    trimShadows(root);
    return {
      roots: [root, sky.root],
      bakeGroups: [sky.clouds, ...bakeGroups],
      ticks: [ground.tick, eiffel, carousel, moulin, sky.tick],
      water: { material: ground.water.material as THREE.MeshStandardMaterial, y: WATER_Y, contains: inSeine },
    };
  },
  ariaLabel:
    "A jelly-block diorama of Paris in spring: the Seine curving past the Île de la Cité and Notre-Dame, the Pont Alexandre III with its gilded pillars, the Pont Neuf, two bateaux-mouches and green bouquinistes; the Eiffel Tower over the Champ de Mars with a carousel, Sacré-Cœur on the Montmartre hill, the red windmill of the Moulin Rouge, the Louvre with its glass pyramid, the Concorde obelisk and fountains, the Arc de Triomphe and the Champs-Élysées, two Haussmann buildings with a café terrace, a Guimard métro entrance and a Morris column, under cherry blossom and chestnut trees.",
};

export function ParisScene({ onReady }: { onReady?: () => void }) {
  return <DioramaScene spec={SPEC} onReady={onReady} />;
}
