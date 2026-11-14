"use client";

import * as THREE from "three";
import { DioramaScene, type DioramaSpec } from "@/components/diorama/DioramaScene";
import { trimShadows } from "@/components/diorama/fx";
import { buildGround } from "./ground";
import { buildBridge, buildCathedral, buildGate, buildGyeonggi, buildHanbyeok, buildOmokdae } from "./landmarks";
import { BLOCK, inStream, WATER_Y } from "./layout";
import { makeParts } from "./parts";
import { buildSky } from "./sky";
import { buildTown } from "./town";

/** 전시 04 — 전주: 가을 전주천·경기전·풍남문·전동성당·오목대/자만 벽화마을·남부시장 야시장·영화의 거리 */
const SPEC: DioramaSpec = {
  id: "jeonju",
  seed: 31,
  block: BLOCK,
  look: [0.4, 1.0, -0.4],
  // ?focus=<랜드마크> — 근접 확인용 (목업 target-mockup.html 과 같은 자리·거리)
  foci: {
    market: [6.2, 0.6, 4.4, 9], jaman: [-5.4, 1.2, -3.4, 8], gyeonggi: [0.8, 0.7, -0.6, 10], gate: [0.2, 1.0, -4.4, 9],
    cathedral: [6.6, 1.6, -3.6, 11], bridge: [-5.4, 0.5, 4.0, 8], hanbyeok: [-7.6, 0.6, 3.6, 6], cinema: [1.6, 0.6, 5.4, 7],
  },
  // 낮: 맑은 가을 오후의 따뜻한 빛 / 밤: 보름달 푸른빛 (따뜻한 빛은 창·초롱 발광이 맡는다)
  light: {
    hemiSky: ["#fff6e8", "#9aa0e6"], hemiGround: ["#cdbf9f", "#4d4466"], hemiI: [1.55, 1.45],
    sun: ["#ffe9c8", "#b9c2ff"], sunI: [2.5, 0.6], sunPos: [[10, 17, 8], [-12, 14, -6]],
  },
  bloom: { strength: 0.75, radius: 0.36 },
  build(kit) {
    const P = makeParts(kit);
    const root = new THREE.Group();
    const ground = buildGround(kit, P);
    root.add(ground.root);
    buildBridge(kit, P, root);
    buildHanbyeok(kit, P, root);
    buildOmokdae(kit, P, root);
    buildGate(kit, P, root);
    buildCathedral(kit, P, root);
    buildGyeonggi(kit, P, root);
    const town = buildTown(kit, P, root);
    const sky = buildSky(kit);
    trimShadows(root);
    return {
      roots: [root, sky.root],
      bakeGroups: [sky.clouds],
      ticks: [ground.tick, town.tick, sky.tick],
      water: { material: ground.water.material as THREE.MeshStandardMaterial, y: WATER_Y, contains: inStream },
    };
  },
  ariaLabel:
    "A jelly-block diorama of Jeonju in autumn: the Jeonju stream with Namcheongyo bridge and its pavilion, Hanbyeokdang on the rocks, Gyeonggijeon shrine with its red Hongsalmun gate and bamboo, Pungnammun gate, the brick Jeondong Cathedral, Omokdae hill with the Jaman mural village, two hanok, Nambu Market with its night-market stalls, the Street of Film cinema and a giant folding-fan sculpture, under ginkgo and maple trees.",
};

export function JeonjuScene({ onReady }: { onReady?: () => void }) {
  return <DioramaScene spec={SPEC} onReady={onReady} />;
}
