import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { add, canvasTex, dn, keepDynamic, type Kit, roundRect } from "@/components/diorama/kit";
import { BLOCK, hwAt, ISLE, riverFrame, seineShape, SITES, T_ISLE, TOP, WATER_Y } from "./layout";
import { alongRiver, type Parts, tint } from "./parts";

/**
 * 블록(석회암 포장 윗면·지층) + 센강(녹청 물·바닥·돌 난간) + 시테섬 + 잔디·자갈·큰길 + 센강을 오가는 바토무슈 두 척.
 * 반환: 루트, 수면 메시(파문), 배 움직임.
 */
export function buildGround(k: Kit, P: Parts) {
  const root = new THREE.Group();
  const { W, D, CORNER, LAND_H, STRATA } = BLOCK;

  const paveTex = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#ece2cf";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(150,130,100,.12)";
      for (let y = 0; y < h; y += 16) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = k.rnd() < 0.5 ? "rgba(150,125,90,.07)" : "rgba(255,252,240,.25)";
        g.beginPath();
        g.arc(k.rnd() * w, k.rnd() * h, 1 + k.rnd() * 3, 0, 6.3);
        g.fill();
      }
    },
    { repeat: [0.25, 0.25] },
  );
  const land = roundRect(W, D, CORNER);
  land.holes.push(seineShape());
  const ext = { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 5, curveSegments: 32 };
  const geo = new THREE.ExtrudeGeometry(land, ext);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, TOP - LAND_H - ext.bevelThickness, 0); // 윗면 = TOP
  const paveM = k.std({ color: dn("#ffffff", "#b6b0c8"), map: paveTex, roughness: 0.95 });
  add(root, geo, paveM).castShadow = false;
  const st = new THREE.ExtrudeGeometry(roundRect(W, D, CORNER), { ...ext, depth: STRATA });
  st.rotateX(-Math.PI / 2);
  st.translate(0, TOP - LAND_H - STRATA - 0.02, 0);
  add(root, st, P.mat({ color: dn("#c2b39a", "#77707e"), roughness: 1 })).castShadow = false;
  const st2 = st.clone();
  st2.scale(1.003, 0.25, 1.003);
  st2.translate(0, -0.85, 0);
  add(root, st2, P.mat({ color: dn("#9a8a72", "#555064"), roughness: 1 })).castShadow = false;

  // 시테섬: 물 위 석축 섬 (같은 포장, 낮엔 조금 더 밝게)
  const isle = new THREE.Shape();
  isle.absellipse(0, 0, ISLE.a, ISLE.b, 0, Math.PI * 2, false, 0);
  const ig = new THREE.ExtrudeGeometry(isle, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 40 });
  ig.rotateX(-Math.PI / 2);
  ig.translate(0, TOP - 0.6, 0);
  const im = add(root, ig, k.std({ color: dn("#f4ecdc", "#b6b0c8"), map: paveTex, roughness: 0.95 }), ISLE.x, 0, ISLE.z);
  im.rotation.y = ISLE.ry;
  im.castShadow = false;

  // 센강: 녹청 물 + 바닥
  const wg = new THREE.ShapeGeometry(seineShape(), 1);
  wg.rotateX(-Math.PI / 2);
  const waterMat = k.phys({ color: dn("#6fa9a8", "#2f4f78"), roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.92, glow: ["#1d3258", 0.4] });
  const water = keepDynamic(new THREE.Mesh(wg, waterMat));
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  root.add(water);
  add(root, wg.clone(), P.mat({ color: "#6e6a60" }), 0, TOP - 0.62, 0).castShadow = false;

  // 강둑 돌 난간 (양쪽, 두 끝 둥근 곳은 비운다)
  const para = P.mat({ color: dn("#ddd2bb", "#a8a2b4") });
  for (const side of [1, -1])
    for (let i = 0; i < 90; i++) {
      const t0 = i / 90, t1 = (i + 1) / 90;
      if (t0 <= 0.02 || t1 >= 0.98) continue;
      const pt = (t: number) => {
        const { p, n } = riverFrame(t), w = hwAt(t) + 0.06;
        return new THREE.Vector3(p.x + n.x * side * w, 0, p.y + n.y * side * w);
      };
      const a = pt(t0), b = pt(t1);
      const m = add(root, new THREE.BoxGeometry(0.07, 0.12, a.distanceTo(b) + 0.02), para, (a.x + b.x) / 2, TOP + 0.06, (a.z + b.z) / 2);
      m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      m.castShadow = false;
    }

  // 잔디·자갈: 샹드마르스 · 튈르리 · 몽마르트르 자락
  const grass = P.mat({ color: dn("#93b35e", "#4c6042"), roughness: 1 });
  for (const [x, z, w, d] of [[-6.6, -0.9, 1.25, 2.6], [-5.0, -0.9, 0.95, 2.6], [-8.1, -0.9, 0.95, 2.6], [2.4, 1.3, 2.6, 0.9], [-1.0, -3.6, 1.8, 1.2]]) add(root, new RoundedBoxGeometry(w, 0.04, d, 2, 0.02), grass, x, TOP + 0.01, z).castShadow = false;
  add(root, new RoundedBoxGeometry(4.0, 0.03, 3.0, 2, 0.02), P.mat({ color: dn("#e6d6b2", "#a8a0a8"), roughness: 1 }), -6.6, TOP + 0.005, -0.9).castShadow = false;
  // 큰길: 샹젤리제 + 에투알 원형 교차로 + 방사 도로
  const road = P.mat({ color: dn("#b9b1a4", "#6f6a78"), roughness: 1 });
  add(root, new RoundedBoxGeometry(0.75, 0.025, 5.6, 2, 0.01), road, 6.55, TOP + 0.005, -0.3).castShadow = false;
  const ring = new THREE.RingGeometry(0.95, 1.5, 48);
  ring.rotateX(-Math.PI / 2);
  const [ax, az] = SITES.arc;
  add(root, ring, road, ax, TOP + 0.012, az).castShadow = false;
  for (const a of [0.5, 1.6, 4.7, 5.6]) add(root, new THREE.BoxGeometry(0.4, 0.02, 1.1), road, ax + Math.sin(a) * 1.9, TOP + 0.006, az + Math.cos(a) * 1.9).rotation.y = a;

  // ── 바토무슈 두 척: 선체·갑판·지붕(정점색 한 재질) + 유리 선실(밤에 불빛) — 인스턴스 두 드로우 ──
  const hullParts = [
    tint(new RoundedBoxGeometry(1.25, 0.12, 0.3, 3, 0.05).translate(0, 0.04, 0), "#2c3440"),
    tint(new RoundedBoxGeometry(1.15, 0.03, 0.3, 2, 0.01).translate(0, 0.11, 0), "#f7f3ea"),
    tint(new RoundedBoxGeometry(0.88, 0.02, 0.26, 2, 0.01).translate(-0.05, 0.25, 0), "#f7f3ea"),
  ];
  for (const g of hullParts) g.deleteAttribute("uv");
  const hullGeo = mergeGeometries(hullParts); // RoundedBoxGeometry 는 원래 비인덱스
  const cabinGeo = new RoundedBoxGeometry(0.85, 0.12, 0.24, 3, 0.04).translate(-0.05, 0.18, 0);
  const cabinM = k.phys({ color: dn("#a9c6d4", "#ffd99a"), roughness: 0.1, clearcoat: 1, glow: ["#ffc070", 1.8] });
  const hulls = keepDynamic(new THREE.InstancedMesh(hullGeo, P.VC, 2));
  const cabins = keepDynamic(new THREE.InstancedMesh(cabinGeo, cabinM, 2));
  for (const m of [hulls, cabins]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  // 두 척: 하나는 하류로, 하나는 상류로 (섬 부근은 북쪽 갈래로 비켜 간다)
  const boats = [
    { t0: 0.1, dir: 1, off: -0.25, sp: 1 / 140 },
    { t0: 0.55, dir: -1, off: 0.25, sp: 1 / 160 },
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const tick = (t: number) => {
    boats.forEach((b, i) => {
      // 0.06 ↔ 0.94 왕복 (끝에서 천천히 돌아선다)
      const ph = (b.t0 + t * b.sp) % 2, u = ph < 1 ? ph : 2 - ph, s = 0.06 + 0.88 * (0.5 - 0.5 * Math.cos(u * Math.PI));
      const forward = (ph < 1 ? 1 : -1) * b.dir;
      const tt = b.dir > 0 ? s : 1 - s;
      const { p, tg, n } = riverFrame(tt);
      // 섬 부근에선 북쪽(−n) 갈래로
      const isleK = Math.exp(-Math.pow((tt - T_ISLE) / 0.08, 2));
      const off = b.off * (1 - isleK) - 0.95 * isleK;
      pos.set(p.x + n.x * off, WATER_Y + Math.sin(t * 1.4 + i) * 0.006, p.y + n.y * off);
      q.setFromAxisAngle(up, alongRiver(tg) + (forward > 0 ? 0 : Math.PI));
      m4.compose(pos, q, one);
      hulls.setMatrixAt(i, m4);
      cabins.setMatrixAt(i, m4);
    });
    hulls.instanceMatrix.needsUpdate = cabins.instanceMatrix.needsUpdate = true;
  };
  tick(0);
  return { root, water, tick };
}
