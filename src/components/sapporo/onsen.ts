import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, keepDynamic, type Kit, radialTex, roundRect } from "@/components/diorama/kit";
import { BLOCK, POOL_C, POOL_PTS, poolShape, SITES, TOP, WATER_Y } from "./layout";
import { makePuffs, type Parts, place } from "./parts";

/**
 * 눈 덮인 블록(윗면·지층·눈 처마·고드름) + 노천 온천(유백색 물·바위 테·김) + 료칸 + 온천 소품(석등·대나무 울타리·물대롱·나무 통).
 * 반환: 루트, 수면 메시(파문), 김 애니메이션.
 */
export function buildOnsen(k: Kit, P: Parts) {
  const root = new THREE.Group();
  const { W, D, CORNER, LAND_H, STRATA } = BLOCK;

  // ── 블록: 눈 윗면(온천 구멍) + 지층 두 줄 ──
  const snowTex = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#f6f8fc";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = k.rnd() < 0.5 ? "rgba(170,190,225,.10)" : "rgba(255,255,255,.5)";
        g.beginPath();
        g.arc(k.rnd() * w, k.rnd() * h, 1 + k.rnd() * 5, 0, Math.PI * 2);
        g.fill();
      }
    },
    { repeat: [0.2, 0.2] },
  );
  const land = roundRect(W, D, CORNER);
  land.holes.push(poolShape());
  const ext = { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 6, curveSegments: 32 };
  const geo = new THREE.ExtrudeGeometry(land, ext);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, TOP - LAND_H - ext.bevelThickness, 0); // 베벨이 윗면을 올리므로 윗면 = TOP 이 되게 (낮은 소품이 묻히지 않게)
  add(root, geo, P.mat({ color: dn("#ffffff", "#dde4f8"), map: snowTex, roughness: 0.95 })).castShadow = false; // 블록 자체는 드리울 곳이 없다
  const st = new THREE.ExtrudeGeometry(roundRect(W, D, CORNER), { ...ext, depth: STRATA });
  st.rotateX(-Math.PI / 2);
  st.translate(0, TOP - LAND_H - STRATA - 0.02, 0);
  add(root, st, P.mat({ color: dn("#a7a9c4", "#7f83a8"), roughness: 1 })).castShadow = false;
  const st2 = st.clone();
  st2.scale(1.003, 0.25, 1.003);
  st2.translate(0, -0.85, 0);
  add(root, st2, P.mat({ color: dn("#8789a6", "#5e6188"), roughness: 1 })).castShadow = false;

  // 윗면 가장자리 눈 처마 (살짝 부푼 둥근 테) + 고드름
  const rim = roundRect(W + 0.12, D + 0.12, CORNER + 0.06).getSpacedPoints(220).map((p) => new THREE.Vector3(p.x, TOP + 0.02, -p.y));
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 300, 0.13, 8, true), P.SNOW).castShadow = false;
  const ice = P.mat({ color: "#e8f6ff", roughness: 0.05, transparent: true, opacity: 0.85, glow: ["#bfe6ff", 0.6] });
  for (let i = 0; i < 220; i += 3) {
    if (k.rnd() < 0.45) continue;
    const p = rim[i], len = 0.12 + k.rnd() * 0.32;
    const c = new THREE.ConeGeometry(0.025 + k.rnd() * 0.02, len, 6);
    c.rotateX(Math.PI);
    add(root, c, ice, p.x * 1.004, TOP - 0.1 - len / 2, p.z * 1.004).castShadow = false;
  }

  // ── 온천물: 유백색 청록 (유황) ──
  const wg = new THREE.ShapeGeometry(poolShape(), 1);
  wg.rotateX(-Math.PI / 2);
  const waterMat = k.phys({ color: dn("#9fd9d2", "#6fb6c0"), roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92, glow: ["#2f7f86", 0.55], dayGlow: 0.2 });
  const water = keepDynamic(new THREE.Mesh(wg, waterMat));
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  root.add(water);

  // 바위 테 (절반은 눈 모자)
  const rockM = P.mat({ color: dn("#8a8b92", "#6d6f7e"), roughness: 0.95, flatShading: true });
  for (let i = 0; i < POOL_PTS.length; i += 2) {
    const p = POOL_PTS[i], d = p.clone().sub(POOL_C).normalize();
    const r = 0.16 + k.rnd() * 0.13, g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1.3, 0.75, 1.1);
    const m = add(root, g, rockM, p.x + d.x * 0.08, TOP + r * 0.25, p.y + d.y * 0.08);
    m.rotation.set(k.rnd(), k.rnd() * 6, k.rnd());
    if (k.rnd() < 0.55) P.snowCap(root, r * 1.4, r * 1.1, m.position.x, m.position.y + r * 0.62, m.position.z, 0.05);
  }

  // 김: 탕 위로 천천히 오르며 옅어지는 입자 (점 하나 = 드로우 1)
  const steam = makePuffs(34, radialTex("rgba(255,255,255,.55)", "rgba(255,255,255,0)"));
  root.add(steam.points);
  const seeds = Array.from({ length: 34 }, () => {
    const a = k.rnd() * Math.PI * 2, r = Math.sqrt(k.rnd()) * 1.5;
    return { x: POOL_C.x + Math.cos(a) * r * 1.2, z: POOL_C.y + Math.sin(a) * r * 0.8, ph: k.rnd() };
  });

  buildRyokan(k, P, root);

  // ── 온천 소품 ──
  const stone = P.mat({ color: dn("#a6a7ac", "#8c8e99"), roughness: 0.95 });
  const lt = place(root, SITES.stoneLantern, TOP);
  add(lt, new THREE.CylinderGeometry(0.16, 0.2, 0.08, 6), stone, 0, 0.04, 0);
  add(lt, new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8), stone, 0, 0.25, 0);
  add(lt, new RoundedBoxGeometry(0.22, 0.04, 0.22, 2, 0.01), stone, 0, 0.44, 0);
  add(lt, new RoundedBoxGeometry(0.16, 0.16, 0.16, 2, 0.02), P.mat({ color: "#fff1cf", glow: ["#ffc86a", 3] }), 0, 0.54, 0);
  add(lt, new THREE.ConeGeometry(0.2, 0.14, 6), stone, 0, 0.69, 0);
  P.snowCap(lt, 0.24, 0.24, 0, 0.73, 0, 0.05);
  add(lt, new THREE.SphereGeometry(0.035, 8, 6), stone, 0, 0.79, 0);
  // 대나무 울타리 (탕 뒤쪽 호)
  const bamboo = P.mat({ color: dn("#a7b36a", "#7f8a52"), roughness: 0.6 });
  for (let i = 0; i < 34; i++) {
    const a = -0.2 + i * 0.075 + Math.PI * 1.05;
    add(root, new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), bamboo, POOL_C.x + Math.cos(a) * 2.5, TOP + 0.35, POOL_C.y + Math.sin(a) * 2.0);
  }
  // 대나무 물대롱 + 떨어지는 물줄기
  add(root, new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), bamboo, -8.1, TOP + 0.55, 1.9).rotation.z = 1.1;
  add(root, new THREE.CylinderGeometry(0.02, 0.03, 0.42, 8), P.mat({ color: "#e8fbff", transparent: true, opacity: 0.75, glow: ["#bff0ff", 1] }), -7.7, TOP + 0.12, 1.9).castShadow = false;
  // 나무 통
  add(root, new THREE.CylinderGeometry(0.11, 0.09, 0.14, 12), P.mat({ color: "#b88a5a" }), -4.9, TOP + 0.07, 4.4);

  const tick = (t: number, night: number) => {
    const op = THREE.MathUtils.lerp(0.8, 0.45, night);
    seeds.forEach(({ x, z, ph }, i) => {
      const u = (t * 0.07 + ph) % 1, y = 0.2 + u * 1.6; // 0.2 → 1.8 를 약 14초에 오른다
      steam.set(i, x + Math.sin(t * 0.3 + ph * 6) * 0.15 * u, TOP + y, z, 0.6 + y * 0.7, op * (1 - y / 2.2) * Math.min(1, u * 6));
    });
    steam.commit();
  };
  return { root, water, tick };
}

/** 료칸: 2층 목조 + 박공 지붕 눈 + 툇마루 + 장지문 불빛 + 노렌 + 붉은 초롱 */
function buildRyokan(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = place(parent, SITES.ryokan, TOP);
  const wood = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = "#6b4a33";
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      c.fillStyle = x % 16 ? "#5d3f2b" : "#74513a";
      c.fillRect(x, 0, 6, h);
    }
  });
  const woodM = P.mat({ color: "#ffffff", map: wood });
  const shoji = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = "#fff4dc";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#5d3f2b";
    c.lineWidth = 3;
    for (let i = 0; i <= w; i += 21) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, h);
      c.stroke();
    }
    for (let j = 0; j <= h; j += 32) {
      c.beginPath();
      c.moveTo(0, j);
      c.lineTo(w, j);
      c.stroke();
    }
  });
  const shojiM = P.mat({ color: "#ffffff", map: shoji, emissiveMap: shoji, roughness: 0.9, glow: ["#ffcf8a", 1.6] });
  const roofM = P.mat({ color: dn("#4c4f5e", "#3d3f52"), roughness: 0.7 });
  add(g, new THREE.BoxGeometry(2.6, 0.75, 1.4), woodM, 0, 0.375, 0);
  add(g, new THREE.BoxGeometry(2.2, 0.6, 1.2), woodM, -0.1, 1.05, -0.05);
  for (const [y, w, z] of [[0.38, 2.3, 0.71], [1.05, 1.9, 0.56]]) add(g, new THREE.BoxGeometry(w, 0.38, 0.02), shojiM, 0, y, z);
  add(g, new THREE.BoxGeometry(2.9, 0.06, 1.75), roofM, 0, 0.78, 0);
  P.snowCap(g, 2.8, 1.65, 0, 0.84, 0, 0.07);
  P.gable(g, 2.3, 1.3, 0.5, roofM, -0.1, 1.35, -0.05, 0.14);
  P.gableSnow(g, 2.3, 1.3, 0.5, -0.1, 1.35, -0.05, 0.14);
  // 툇마루 + 기둥
  add(g, new THREE.BoxGeometry(2.6, 0.06, 0.45), P.mat({ color: "#8a6a4c" }), 0, 0.12, 0.95);
  const post = P.mat({ color: "#4e3524" });
  for (let i = 0; i < 5; i++) add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), post, -1.25 + i * 0.62, 0.4, 1.12);
  // 노렌
  add(g, new THREE.BoxGeometry(0.5, 0.28, 0.01), P.mat({ color: "#2c3d6b", glow: ["#2c3d6b", 0.2] }), 1.0, 0.55, 0.73);
  // 처마에 매단 붉은 초롱 5
  const lampM = P.mat({ color: "#e8473a", roughness: 0.6, glow: ["#ff8a4a", 2.6] });
  const capM = P.mat({ color: "#222222" });
  for (let i = 0; i < 5; i++) {
    add(g, new THREE.CapsuleGeometry(0.06, 0.07, 6, 12), lampM, -1.1 + i * 0.55, 0.62, 1.12);
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), capM, -1.1 + i * 0.55, 0.7, 1.12);
  }
}
