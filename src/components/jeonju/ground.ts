import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, keepDynamic, type Kit, radialTex, roundRect } from "@/components/diorama/kit";
import { BLOCK, STREAM, STREAM_PTS, streamShape, TOP, WATER_Y } from "./layout";
import type { Parts } from "./parts";

/**
 * 블록(흙빛 윗면·지층·잔디 조각) + 전주천(맑은 청록 물·바닥·둑 돌·억새·징검다리) + 밤에 물길을 따라 흐르는 유등.
 * 반환: 루트, 수면 메시(파문), 유등 흐름.
 */
export function buildGround(k: Kit, P: Parts) {
  const root = new THREE.Group();
  const { W, D, CORNER, LAND_H, STRATA } = BLOCK;

  const groundTex = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#e9dcc0";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = k.rnd() < 0.5 ? "rgba(150,120,80,.08)" : "rgba(255,250,235,.25)";
        g.beginPath();
        g.arc(k.rnd() * w, k.rnd() * h, 1 + k.rnd() * 4, 0, 6.3);
        g.fill();
      }
    },
    { repeat: [0.2, 0.2] },
  );
  const land = roundRect(W, D, CORNER);
  land.holes.push(streamShape());
  const ext = { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 5, curveSegments: 32 };
  const geo = new THREE.ExtrudeGeometry(land, ext);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, TOP - LAND_H - ext.bevelThickness, 0); // 윗면 = TOP (낮은 소품이 묻히지 않게)
  add(root, geo, k.std({ color: dn("#ffffff", "#b9b2c8"), map: groundTex, roughness: 0.95 })).castShadow = false;
  const st = new THREE.ExtrudeGeometry(roundRect(W, D, CORNER), { ...ext, depth: STRATA });
  st.rotateX(-Math.PI / 2);
  st.translate(0, TOP - LAND_H - STRATA - 0.02, 0);
  add(root, st, P.mat({ color: dn("#b59a7e", "#7d6a72"), roughness: 1 })).castShadow = false;
  const st2 = st.clone();
  st2.scale(1.003, 0.25, 1.003);
  st2.translate(0, -0.85, 0);
  add(root, st2, P.mat({ color: dn("#8f7660", "#5b4c58"), roughness: 1 })).castShadow = false;

  // 잔디 조각 (가을 풀빛)
  const grass = P.mat({ color: dn("#a8ad62", "#59613f"), roughness: 1 });
  for (const [x, z, w, d] of [[-6.6, -0.6, 3.6, 1.6], [-8.4, 5.4, 2.4, 1.8], [4.8, -0.7, 2.4, 1.4], [8.4, 1.3, 2.0, 1.4], [-3.0, -2.6, 2.0, 1.6]]) add(root, new RoundedBoxGeometry(w, 0.04, d, 2, 0.02), grass, x, TOP + 0.01, z).castShadow = false;

  // 전주천: 맑은 청록 물 + 바닥
  const wg = new THREE.ShapeGeometry(streamShape(), 1);
  wg.rotateX(-Math.PI / 2);
  const waterMat = k.phys({ color: dn("#7cc4c6", "#3d5f8a"), roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.9, glow: ["#22385f", 0.4] });
  const water = keepDynamic(new THREE.Mesh(wg, waterMat));
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  root.add(water);
  add(root, wg.clone(), P.mat({ color: "#8a8172" }), 0, TOP - 0.6, 0).castShadow = false;
  // 둑 돌 · 억새
  const rockM = P.mat({ color: dn("#a39d92", "#7c7a88"), roughness: 0.95, flatShading: true });
  for (let i = 0; i < STREAM_PTS.length; i += 3) {
    const p = STREAM_PTS[i], r = 0.1 + k.rnd() * 0.1, g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1.3, 0.6, 1.1);
    add(root, g, rockM, p.x, TOP + r * 0.15, p.y).rotation.set(k.rnd(), k.rnd() * 6, k.rnd());
  }
  const reed = P.mat({ color: dn("#e6dcc4", "#a59f9a") }), reedTip = P.mat({ color: dn("#f6efe2", "#c7bfb8") });
  for (let i = 1; i < STREAM_PTS.length; i += 4) {
    const p = STREAM_PTS[i];
    if (k.rnd() < 0.35) continue;
    for (let j = 0; j < 6; j++) {
      const x = p.x + (k.rnd() - 0.5) * 0.25, z = p.y + (k.rnd() - 0.5) * 0.25;
      const s = add(root, new THREE.ConeGeometry(0.012, 0.42 + k.rnd() * 0.2, 4), reed, x, TOP + 0.22, z);
      s.rotation.set((k.rnd() - 0.5) * 0.5, 0, (k.rnd() - 0.5) * 0.5);
      s.castShadow = false;
      add(root, new THREE.SphereGeometry(0.035, 6, 4).scale(0.6, 1.6, 0.6), reedTip, x, TOP + 0.44, z).castShadow = false;
    }
  }
  // 징검다리 (하류)
  {
    const c = STREAM.getPoint(0.86), tg = STREAM.getTangent(0.86), n = new THREE.Vector2(-tg.y, tg.x);
    for (let j = -2; j <= 2; j++) add(root, new THREE.CylinderGeometry(0.13, 0.15, 0.12, 9), P.M.STONE, c.x + n.x * j * 0.32, TOP - 0.18, c.y + n.y * j * 0.32);
  }

  // 유등: 밤에만 떠서 물길을 따라 천천히 흐른다 (등 9 + 물빛 9 = 인스턴스 두 드로우)
  const N = 9;
  const lamps = keepDynamic(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 6), k.nightOnly(k.std({ color: "#ffd6a0", glow: ["#ffb060", 3] })), N));
  const glowMat = P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,180,100,.55)", "rgba(255,180,100,0)"), transparent: true }));
  const halo = new THREE.PlaneGeometry(0.6, 0.6);
  halo.rotateX(-Math.PI / 2);
  const glows = keepDynamic(new THREE.InstancedMesh(halo, glowMat, N));
  glows.renderOrder = 3;
  lamps.frustumCulled = glows.frustumCulled = false;
  root.add(lamps, glows);
  const seeds = Array.from({ length: N }, (_, i) => ({ t0: i / N, off: (k.rnd() - 0.5) * 0.7, sp: 0.8 + k.rnd() * 0.4 }));
  const m4 = new THREE.Matrix4();
  const tick = (t: number, night: number) => {
    if (night < 0.01) return;
    seeds.forEach(({ t0, off, sp }, i) => {
      const u = 0.06 + ((t0 + (t / 120) * sp) % 1) * 0.88; // 상류 → 하류, 약 2분에 한 번
      const c = STREAM.getPoint(u), tg = STREAM.getTangent(u);
      const x = c.x - tg.y * off, z = c.y + tg.x * off, bob = Math.sin(t * 1.3 + i) * 0.01;
      lamps.setMatrixAt(i, m4.makeTranslation(x, WATER_Y + 0.05 + bob, z));
      glows.setMatrixAt(i, m4.makeTranslation(x, WATER_Y + 0.02, z));
    });
    lamps.instanceMatrix.needsUpdate = glows.instanceMatrix.needsUpdate = true;
  };
  tick(0, 1);
  return { root, water, tick };
}
