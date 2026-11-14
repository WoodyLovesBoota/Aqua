import * as THREE from "three";
import { add, canvasTex, dn, keepDynamic, type Kit, roundRect } from "@/components/diorama/kit";
import { BAY_CENTER, BAY_PTS, BLOCK, bayShape, inBay, SITES, TOP, WATER_Y } from "./layout";

/** 블록(포장 윗면·지층) + 만(수면·바닥·둑·난간·가로등·불빛 반사) + 잔디·레인트리 + 범보트. 반환: 루트와 수면 메시(조작용) */
export function buildGround(k: Kit) {
  const root = new THREE.Group();
  const { W, D, CORNER, LAND_H, STRATA } = BLOCK;

  // 블록 윗면: 포장 격자. 밤엔 색을 곱해 보랏빛으로 가라앉힌다
  const paving = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#ebe5d9";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(120,100,70,.10)";
      g.lineWidth = 2;
      for (let i = 0; i <= w; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
      }
    },
    { repeat: [0.25, 0.25] },
  );
  const land = roundRect(W, D, CORNER);
  land.holes.push(bayShape());
  const ext = { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 5, curveSegments: 32 };
  const landGeo = new THREE.ExtrudeGeometry(land, ext);
  landGeo.rotateX(-Math.PI / 2);
  landGeo.translate(0, TOP - LAND_H, 0);
  add(root, landGeo, k.std({ color: dn("#ffffff", "#d9d1e8"), map: paving, roughness: 0.95 }));
  const st = new THREE.ExtrudeGeometry(roundRect(W, D, CORNER), { ...ext, depth: STRATA });
  st.rotateX(-Math.PI / 2);
  st.translate(0, TOP - LAND_H - STRATA - 0.02, 0);
  add(root, st, k.std({ color: dn("#aeabc2", "#8e8cad"), roughness: 1 }));
  const st2 = st.clone();
  st2.scale(1.003, 0.25, 1.003);
  st2.translate(0, -0.85, 0);
  add(root, st2, k.std({ color: dn("#8f8da8", "#6d6b8c"), roughness: 1 }));

  // 수면: 반투명 청록 + 잔물결 노멀
  const ripple = canvasTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#8080ff";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = `rgba(${k.rnd() < 0.5 ? 255 : 0},${k.rnd() < 0.5 ? 255 : 0},255,.25)`;
        g.lineWidth = 1 + k.rnd() * 2;
        g.beginPath();
        g.ellipse(k.rnd() * w, k.rnd() * h, 6 + k.rnd() * 14, 2 + k.rnd() * 3, 0, 0, Math.PI * 2);
        g.stroke();
      }
    },
    { repeat: [3, 3], linear: true },
  );
  const wGeo = new THREE.ShapeGeometry(bayShape(), 1);
  wGeo.rotateX(-Math.PI / 2);
  const waterMat = k.phys({ color: dn("#4bbccb", "#2a5a8c"), glow: ["#0e2b55", 0.7], dayGlow: 0.25, roughness: 0.06, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: ripple, normalScale: new THREE.Vector2(0.25, 0.25) });
  const eDay = new THREE.Color("#0b4f60"), eNight = new THREE.Color("#0e2b55");
  k.onNight((n) => waterMat.emissive.copy(eDay).lerp(eNight, n));
  const water = keepDynamic(new THREE.Mesh(wGeo, waterMat)); // 조작(파문) 대상
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  root.add(water);
  const bed = new THREE.ShapeGeometry(bayShape(), 1);
  bed.rotateX(-Math.PI / 2);
  add(root, bed, k.std({ color: dn("#2f8a9c", "#1b3150") }), 0, TOP - LAND_H + 0.05, 0);

  // 둑(돌 테두리) + 난간 + 기둥 + 가로등
  const rim = BAY_PTS.map((p) => new THREE.Vector3(p.x, TOP + 0.03, p.y));
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 240, 0.08, 6, true), k.std({ color: dn("#f8f3ea", "#ebe5da") }));
  const rail = BAY_PTS.map((p) => {
    const d = p.clone().sub(BAY_CENTER).normalize().multiplyScalar(0.16);
    return new THREE.Vector3(p.x + d.x, TOP + 0.2, p.y + d.y);
  });
  const steel = k.std({ color: "#d8d6de", metalness: 0.6, roughness: 0.3 });
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail, true), 240, 0.012, 4, true), steel);
  const postG = new THREE.CylinderGeometry(0.01, 0.01, 0.18, 4);
  const postM = k.std({ color: "#cfcdd6" });
  for (let i = 0; i < rail.length; i += 3) add(root, postG, postM, rail[i].x, TOP + 0.11, rail[i].z);
  const lampM = k.std({ color: "#fff3d6", glow: ["#ffd48a", 3] });
  const poleM = k.std({ color: "#4a4858" });
  const poleG = new THREE.CylinderGeometry(0.012, 0.018, 0.42, 6), bulbG = new THREE.SphereGeometry(0.04, 10, 8);
  for (let i = 0; i < BAY_PTS.length; i += 10) {
    const p = BAY_PTS[i], d = p.clone().sub(BAY_CENTER).normalize().multiplyScalar(0.42);
    add(root, poleG, poleM, p.x + d.x, TOP + 0.21, p.y + d.y);
    add(root, bulbG, lampM, p.x + d.x, TOP + 0.44, p.y + d.y);
  }

  // 밤 불빛 반사: 빛나는 건물 앞 수면에 세로 줄
  const sources: [number, number, string, number][] = [[1.4, -2.8, "#bfe8ff", 3.0], [-3.4, -2.8, "#ffe7c4", 1.2], [-2.0, 2.6, "#ffcf8a", 1.6], [-6.0, -1.0, "#cfe6ff", 1.0], [4.6, -1.2, "#e8a0ff", 1.4]];
  const reflMats = new Map<string, THREE.MeshBasicMaterial>();
  const reflGeos: Record<string, THREE.BufferGeometry[]> = {};
  for (const [sx, sz, col, spread] of sources)
    for (let i = 0; i < 22; i++) {
      const x = sx + (k.rnd() - 0.5) * spread * 2, z = sz + (k.rnd() - 0.2) * 2.4 * (sz < 0 ? 1 : -1);
      if (!inBay(x, z)) continue;
      const g = new THREE.PlaneGeometry(0.04 + k.rnd() * 0.05, 0.3 + k.rnd() * 0.8);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-THREE.MathUtils.degToRad(35));
      g.translate(x, WATER_Y + 0.02, z);
      (reflGeos[col] ??= []).push(g);
      if (!reflMats.has(col)) reflMats.set(col, k.nightOnly(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
    }
  for (const [col, gs] of Object.entries(reflGeos)) {
    const merged = new THREE.Mesh(mergeAll(gs), reflMats.get(col)!);
    merged.renderOrder = 2;
    root.add(merged);
  }

  // 잔디 + 레인트리(납작한 우산 수관 4덩이)
  const lawnM = k.std({ color: dn("#9ccd8b", "#3c6648") });
  for (const [x, z, r] of SITES.lawns) {
    const l = new THREE.CircleGeometry(r, 36);
    l.rotateX(-Math.PI / 2);
    add(root, l, lawnM, x, TOP + 0.012, z);
  }
  const leafA = k.std({ color: dn("#5a9a5a", "#2f5a3c"), roughness: 0.9 });
  const leafB = k.std({ color: dn("#74ad66", "#3a6a44"), roughness: 0.9 });
  const bark = k.std({ color: "#7b5d47" });
  for (let i = 0; i < 46; i++) {
    const [x0, z0, r] = SITES.lawns[i % SITES.lawns.length];
    const a = k.rnd() * Math.PI * 2, d = Math.sqrt(k.rnd()) * r * 0.85;
    const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d, s = 0.85 + k.rnd() * 0.5;
    add(root, new THREE.CylinderGeometry(0.02 * s, 0.035 * s, 0.32 * s, 6), bark, x, TOP + 0.16 * s, z);
    for (let j = 0; j < 4; j++) {
      const c = new THREE.SphereGeometry(0.15 * s, 9, 6);
      c.scale(1.3, 0.6, 1.3);
      add(root, c, j % 2 ? leafA : leafB, x + (k.rnd() - 0.5) * 0.18 * s, TOP + (0.36 + k.rnd() * 0.08) * s, z + (k.rnd() - 0.5) * 0.18 * s);
    }
  }

  // 범보트: 지붕 달린 관광선 + 항적
  const deck = k.std({ color: "#f4ecd8" }), roof = k.std({ color: "#f6f2ea" }), pillar = k.std({ color: "#555555" });
  const boatLamp = k.nightOnly(new THREE.MeshBasicMaterial({ color: "#ffdf9e" }));
  const wakeTex = canvasTex(128, 32, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(1, "rgba(255,255,255,.55)");
    g.fillStyle = gr;
    g.fillRect(0, h * 0.3, w, h * 0.4);
  });
  const wakeM = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false });
  const boats: THREE.Group[] = [];
  for (const [x, z, ry, col] of SITES.boats) {
    const g = new THREE.Group();
    g.position.set(x, WATER_Y + 0.04, z);
    g.rotation.y = ry;
    root.add(g);
    const hull = new THREE.CapsuleGeometry(0.14, 0.6, 6, 12);
    hull.rotateZ(Math.PI / 2);
    hull.scale(1, 0.5, 1);
    add(g, hull, k.std({ color: col }), 0, 0.02, 0);
    add(g, new THREE.BoxGeometry(0.62, 0.03, 0.26), deck, 0, 0.08, 0);
    add(g, new THREE.BoxGeometry(0.46, 0.03, 0.27), roof, 0, 0.22, 0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.13, 4), pillar, s * 0.2, 0.15, t * 0.11);
    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), boatLamp);
      lamp.position.set(-0.2 + i * 0.1, 0.2, 0.135);
      g.add(lamp);
    }
    const wk = new THREE.PlaneGeometry(1.0, 0.24);
    wk.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(wk, wakeM);
    wm.position.set(-0.75, -0.02, 0);
    g.add(wm);
    boats.push(g);
  }
  return { root, water, boats };
}

/** 같은 속성 구성의 지오메트리 합치기 (인덱스 없는 평면용) */
function mergeAll(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], uv: number[] = [];
  for (const g of gs) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.attributes.position.array as Float32Array));
    uv.push(...(ng.attributes.uv.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
