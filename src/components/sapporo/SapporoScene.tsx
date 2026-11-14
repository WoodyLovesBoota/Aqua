"use client";

import * as THREE from "three";
import { DioramaScene, type DioramaSpec } from "@/components/diorama/DioramaScene";
import { buildAkarenga, buildClockTower, buildOdori, buildTower } from "./landmarks";
import { BLOCK, inPool, WATER_Y } from "./layout";
import { buildMountain } from "./mountain";
import { buildOnsen } from "./onsen";
import { makeParts, trimShadows } from "./parts";
import { buildSky } from "./sky";
import { buildStreet } from "./street";

/** 전시 03 — 삿포로: 눈 오는 노천 온천 + 모이와산·오도리 눈축제·TV 타워·시계탑·아카렌가·노면전차 */
const SPEC: DioramaSpec = {
  id: "sapporo",
  seed: 23,
  block: BLOCK,
  look: [0.4, 1.0, -0.4],
  // ?focus=<랜드마크> — 근접 확인용 (목업 target-mockup.html 과 같은 자리·거리)
  foci: {
    yatai: [1.4, 0.5, 6.0, 6], tram: [0.9, 0.4, 0.95, 7], rink: [2.4, 0.3, 3.3, 6], tower: [6.8, 2.6, -3.6, 13], clock: [-0.7, 1.3, 2.5, 9],
    onsen: [-6.2, 0.6, 3.4, 9], akarenga: [6.3, 0.8, 4.0, 9], odori: [1.4, 0.9, -2.6, 11], mountain: [-5.9, 2.0, -3.0, 13],
  },
  // 낮: 흐린 겨울 오후의 차가운 흰빛 / 밤: 푸른 달빛 (따뜻한 빛은 창·등불 발광이 맡는다)
  light: {
    hemiSky: ["#eef4ff", "#8ea2e0"], hemiGround: ["#c9d2de", "#3c4566"], hemiI: [1.6, 1.2],
    sun: ["#fff6ea", "#a9b8ff"], sunI: [2.3, 0.55], sunPos: [[9, 18, 9], [-12, 14, -6]],
  },
  bloom: { strength: 0.75, radius: 0.36 },
  build(kit) {
    const P = makeParts(kit);
    const root = new THREE.Group();
    const onsen = buildOnsen(kit, P);
    root.add(onsen.root);
    buildMountain(kit, P, root);
    const tower = buildTower(kit, P, root);
    buildOdori(kit, P, root);
    buildClockTower(kit, P, root);
    buildAkarenga(kit, P, root);
    const street = buildStreet(kit, P, root);
    const sky = buildSky(kit);
    trimShadows(root);
    return {
      roots: [root, sky.root],
      bakeGroups: [street.tram, street.skaters, sky.clouds],
      ticks: [onsen.tick, tower.tick, street.tick, sky.tick],
      water: { material: onsen.water.material as THREE.MeshStandardMaterial, y: WATER_Y, contains: inPool },
    };
  },
  ariaLabel:
    "A jelly-block diorama of snowy Sapporo: a steaming open-air onsen beside a wooden ryokan, Mt. Moiwa with its ropeway, the Odori Park snow festival with a snow castle and ice sculptures, the orange TV Tower, the Clock Tower, the red-brick Akarenga, a streetcar, a skating rink and a ramen stall, with snow falling inside the lid.",
};

export function SapporoScene({ onReady }: { onReady?: () => void }) {
  return <DioramaScene spec={SPEC} onReady={onReady} />;
}
