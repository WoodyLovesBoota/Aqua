import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makePuffs, place } from "@/components/diorama/fx";
import { add, canvasTex, dn, type Kit, radialTex, strut } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";
import { atlasUV, type Parts, tint } from "./parts";

/**
 * 거리: 태조로(박석)·야시장 골목·남천교 흙길 · 한옥 두 채(돌담·장독대·감나무) · 남부시장(아치 지붕·셔터·간판·옥상 청년몰) ·
 * 야시장 노점 5(줄무늬 차양·먹거리·김·골목 위 꼬마전구) · 영화의 거리 극장(전구 간판·포스터·필름 릴) · 합죽선 조형물 · 은행·단풍·소나무 · 청사초롱 · 밤 빛 웅덩이.
 */
export function buildTown(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const root = new THREE.Group();
  parent.add(root);

  // ── 길 ──
  const paveTex = canvasTex(
    256,
    64,
    (c, w, h) => {
      c.fillStyle = "#cfc2aa";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(120,100,70,.25)";
      c.lineWidth = 2;
      for (let x = 0; x < w; x += 22) {
        c.beginPath();
        c.moveTo(x + k.rnd() * 6, 0);
        c.lineTo(x + k.rnd() * 6, h);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();
    },
    { repeat: [10, 1] },
  );
  const pave = k.std({ color: dn("#ffffff", "#a9a3b6"), map: paveTex, roughness: 0.95 });
  add(root, new RoundedBoxGeometry(11.6, 0.03, 0.9, 2, 0.01), pave, 3.4, TOP + 0.01, 1.85).castShadow = false;
  add(root, new RoundedBoxGeometry(5.6, 0.03, 0.8, 2, 0.01), pave, 6.4, TOP + 0.012, 5.0).castShadow = false;
  add(root, new RoundedBoxGeometry(0.8, 0.03, 2.6, 2, 0.01), pave, 4.0, TOP + 0.011, 3.4).castShadow = false;
  const lane = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.4, 0, 1.9), new THREE.Vector3(-3.4, 0, 2.4), new THREE.Vector3(-4.4, 0, 3.0)]);
  add(root, new THREE.TubeGeometry(lane, 30, 0.32, 4).scale(1, 0.06, 1), P.mat({ color: dn("#d8c8a6", "#a59c9a") }), 0, TOP + 0.01, 0).castShadow = false;

  // ── 한옥 두 채 ──
  P.hanok(root, 2.3, 3.3, 0, 1.8, 1.05);
  P.hanok(root, -1.3, 4.1, 0.15, 1.5, 1.0);
  P.wall(root, [1.1, 2.6], [1.1, 4.9]);
  P.wall(root, [1.1, 4.9], [3.5, 4.9]);
  P.wall(root, [3.5, 2.6], [3.5, 4.9]);
  P.jangdok(root, 2.6, 4.4);
  P.tree(root, "persimmon", 1.6, 4.35, 0.75);
  P.jangdok(root, -1.4, 5.25, 5);

  // ── 남부시장 ──
  {
    const g = place(root, SITES.market, TOP);
    const shutter = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = "#e9e2d2";
      c.fillRect(0, 0, w, h);
      const cols = ["#d9472b", "#2f7fb8", "#f2c230", "#3f8a6a", "#e0e0e0", "#c84a6a"];
      for (let i = 0; i < 8; i++) {
        c.fillStyle = cols[i % cols.length];
        c.fillRect(6 + i * 31, 18, 25, 40);
        c.fillStyle = "rgba(0,0,0,.15)";
        for (let y = 22; y < 58; y += 5) c.fillRect(6 + i * 31, y, 25, 1);
      }
      c.fillStyle = "#7a6a58";
      c.fillRect(0, 0, w, 8);
    });
    const shopM = k.std({ color: "#ffffff", map: shutter, emissiveMap: shutter, glow: ["#ffcf90", 0.55] });
    const body = P.mat({ color: "#e9e2d2" });
    // 앞뒤만 가게 셔터, 나머지 면은 벽 — 재질 배열 대신 두 메시로 (병합이 재질 배열을 다루지 않는다)
    add(g, new THREE.BoxGeometry(3.4, 0.75, 1.5), body, 0, 0.375, 0);
    for (const s of [-1, 1]) {
      const f = add(g, new THREE.PlaneGeometry(3.4, 0.75), shopM, 0, 0.375, s * 0.752);
      f.rotation.y = s > 0 ? 0 : Math.PI;
      f.castShadow = false;
    }
    const vault = new THREE.CylinderGeometry(0.78, 0.78, 3.5, 28, 1, true, -Math.PI / 2, Math.PI);
    vault.rotateZ(Math.PI / 2);
    vault.scale(1, 0.5, 1);
    add(g, vault, P.mat({ color: dn("#d6ece2", "#bfd8cf"), roughness: 0.3, transparent: true, opacity: 0.88, side: THREE.DoubleSide, glow: ["#ffe2b0", 0.5] }), 0, 0.75, 0);
    const steel = P.mat({ color: "#6d7380" });
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.TorusGeometry(0.78, 0.02, 4, 20, Math.PI);
      rib.scale(1, 0.5, 1);
      add(g, rib, steel, -1.6 + i * 0.64, 0.75, 0).rotation.y = Math.PI / 2;
    }
    const sign = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = "#b8322a";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#fff6e0";
      c.font = "bold 40px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("남부시장", w / 2, h / 2 + 2);
    });
    add(g, new THREE.BoxGeometry(1.4, 0.34, 0.04), P.mat({ color: "#b8322a" }), 0, 1.2, 0.76);
    add(g, new THREE.PlaneGeometry(1.4, 0.34), k.std({ color: "#ffffff", map: sign, emissiveMap: sign, glow: ["#ffffff", 1.2] }), 0, 1.2, 0.781).castShadow = false;
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, 1.2, 0.05), steel, s * 0.68, 0.6, 0.78);
    // 옥상 청년몰: 화분 + 꼬마전구 줄
    const pot = P.mat({ color: "#b8734a" });
    for (let i = 0; i < 5; i++) {
      add(g, new THREE.CylinderGeometry(0.06, 0.05, 0.08, 8), pot, -1.4 + i * 0.7, 0.8, -0.62);
      add(g, new THREE.SphereGeometry(0.09, 8, 6), M.LEAF.persimmon, -1.4 + i * 0.7, 0.9, -0.62);
    }
    const pts: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(-1.7 + t * 3.4, 1.16 - Math.sin(t * Math.PI * 4) * 0.04, 0);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.Points(pg, P.nightAdd(new THREE.PointsMaterial({ color: "#ffe2a0", size: 0.07, transparent: true }))));
  }

  // ── 야시장 노점 ──
  // 차양 다섯 장을 한 텍스처(5칸)에, 먹거리는 정점색 — 노점 다섯이 재질 몇 개로
  const awnCols = ["#d9472b", "#f2c230", "#2f7fb8", "#3f8a6a", "#c84a6a"];
  const awnM = k.std({
    color: "#ffffff",
    roughness: 0.8,
    side: THREE.DoubleSide,
    glow: ["#ffd090", 0.35],
    map: canvasTex(320, 64, (c) => {
      awnCols.forEach((a, j) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? "#fff4e6" : a;
          c.fillRect(j * 64 + i * 8, 0, 8, 64);
        }
      });
    }),
  });
  const foods = ["#e8574a", "#f2c230", "#f08a3c", "#6b9a3c", "#c84a6a", "#fff2d0"];
  const stallWood = P.mat({ color: "#8a5a3a" }), pole = P.mat({ color: "#4a4a52" }), bulb = P.mat({ color: "#fff1c0", glow: ["#ffd27a", 4], dayGlow: 0.3 });
  const puffs = makePuffs(9, radialTex("rgba(255,255,255,.5)", "rgba(255,255,255,0)"));
  root.add(puffs.points);
  const stalls: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = 4.2 + i * 1.05, z = 5.75, g = place(root, [x, z, 0, 1], TOP);
    add(g, new THREE.BoxGeometry(0.75, 0.32, 0.42), stallWood, 0, 0.16, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5), pole, sx * 0.36, 0.31, sz * 0.2);
    add(g, atlasUV(new THREE.PlaneGeometry(0.86, 0.6), i, 0, 5, 1), awnM, 0, 0.66, -0.02).rotation.x = -Math.PI / 2 + 0.28;
    for (let j = 0; j < 4; j++) add(g, tint(new THREE.BoxGeometry(0.12, 0.04, 0.12), foods[(i + j) % foods.length]), P.VC_GLOW, -0.24 + j * 0.16, 0.34, -0.06);
    add(g, new THREE.SphereGeometry(0.04, 8, 6), bulb, 0, 0.56, -0.18).castShadow = false;
    if (i % 2 === 0) stalls.push([x + 0.1, z + 0.32]); // 차양 앞 (차양 밑이면 가려 안 보인다)
  }
  for (const x of [3.8, 8.8]) add(root, new THREE.CylinderGeometry(0.015, 0.02, 1.1, 5), pole, x, TOP + 0.55, 5.0);
  {
    const pts: number[] = [];
    for (let r = 0; r < 3; r++)
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        pts.push(3.8 + t * 5.0, TOP + 1.05 - Math.sin(t * Math.PI) * 0.18, 4.75 + r * 0.25);
      }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.Points(pg, P.nightAdd(new THREE.PointsMaterial({ color: "#ffd890", size: 0.075, transparent: true }))));
  }

  // ── 영화의 거리 ──
  {
    const g = place(root, SITES.cinema, TOP);
    add(g, new THREE.BoxGeometry(1.7, 1.0, 0.95), P.mat({ color: dn("#5d6070", "#4a4a5e"), roughness: 0.6 }), 0, 0.5, 0);
    add(g, new THREE.BoxGeometry(1.2, 0.5, 0.02), P.mat({ color: dn("#9ab8c8", "#ffd9a0"), roughness: 0.2, glow: ["#ffcf8a", 1.4] }), 0, 0.27, 0.48).castShadow = false;
    const mq = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = "#1c1c24";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#ffe9b0";
      c.font = "bold 34px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("영화의 거리", w / 2, h / 2 + 2);
    });
    add(g, new THREE.BoxGeometry(1.5, 0.3, 0.06), P.mat({ color: "#1c1c24" }), 0, 0.72, 0.5);
    add(g, new THREE.PlaneGeometry(1.5, 0.3), k.std({ color: "#ffffff", map: mq, emissiveMap: mq, glow: ["#ffffff", 1.4], dayGlow: 0.4 }), 0, 0.72, 0.531).castShadow = false;
    for (let i = 0; i < 14; i++) for (const y of [0.55, 0.89]) add(g, new THREE.SphereGeometry(0.018, 6, 4), bulb, -0.72 + i * 0.11, y, 0.54).castShadow = false;
    ["#e8574a", "#2f7fb8", "#f2c230"].forEach((c, i) => (add(g, tint(new THREE.BoxGeometry(0.02, 0.36, 0.24), c), P.VC_GLOW, 0.86, 0.4, -0.28 + i * 0.28).castShadow = false));
    const reel = add(g, new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24), P.mat({ color: "#c9ccd4", metalness: 0.6, roughness: 0.3 }), -0.45, 1.3, 0);
    reel.rotation.x = Math.PI / 2;
    const hole = P.mat({ color: "#3a3a44" });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.2566;
      add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), hole, -0.45 + Math.cos(a) * 0.15, 1.3 + Math.sin(a) * 0.15, 0).rotation.x = Math.PI / 2;
    }
    add(g, new THREE.BoxGeometry(0.04, 0.32, 0.04), P.mat({ color: "#6d7380" }), -0.45, 1.08, 0);
  }

  // ── 합죽선 조형물 ──
  {
    const g = place(root, SITES.fan, TOP);
    add(g, new RoundedBoxGeometry(0.9, 0.16, 0.5, 2, 0.04), M.STONE, 0, 0.08, 0);
    const paper = canvasTex(256, 128, (c, w) => {
      c.fillStyle = "#fbf3df";
      c.fillRect(0, 0, w, 128);
      c.strokeStyle = "#4a3a2a";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(30, 120);
      c.quadraticCurveTo(90, 60, 170, 70);
      c.stroke();
      for (let i = 0; i < 9; i++) {
        c.fillStyle = i % 3 ? "#e86a7a" : "#d8304a";
        c.beginPath();
        c.arc(60 + i * 14 + k.rnd() * 6, 60 + k.rnd() * 30, 5, 0, 6.3);
        c.fill();
      }
      c.fillStyle = "#c8322a";
      c.fillRect(200, 20, 16, 16);
    });
    const fan = new THREE.RingGeometry(0.35, 1.0, 28, 1, Math.PI * 0.12, Math.PI * 0.76);
    const uv = fan.attributes.uv, fp = fan.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const fx = fp.getX(i), fy = fp.getY(i);
      uv.setXY(i, (fx + 1) / 2, fy);
      fp.setZ(i, Math.sin(Math.atan2(fy, fx) * 40) * 0.025 * Math.hypot(fx, fy)); // 살 사이 주름
    }
    fan.computeVertexNormals();
    add(g, fan, k.std({ color: "#ffffff", map: paper, side: THREE.DoubleSide, roughness: 0.9, glow: ["#ffe2b0", 0.35] }), 0, 0.2, 0);
    const rib = P.mat({ color: "#b8915a" });
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * 0.12 + (i / 16) * Math.PI * 0.76;
      strut(g, rib, new THREE.Vector3(0, 0.2, 0.01), new THREE.Vector3(Math.cos(a), 0.2 + Math.sin(a), 0.01), 0.008);
    }
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), P.mat({ color: "#3a2a1a" }), 0, 0.2, 0.02).rotation.x = Math.PI / 2;
  }

  // ── 나무 · 청사초롱 ──
  for (const x of [-0.6, 1.9, 4.4, 6.9, 9.0]) P.tree(root, "ginkgo", x, 1.2, 0.85);
  const T: [Parameters<Parts["tree"]>[1], number, number, number][] = [
    ["maple", -8.6, 5.6, 0.9], ["maple", -9.0, 4.2, 0.8], ["maple", -3.4, 0.4, 0.85], ["maple", 9.0, 6.0, 0.7], ["ginkgo", 4.5, -2.3, 0.95], ["maple", 9.1, -1.0, 0.8],
    ["pine", -2.9, -3.6, 0.9], ["pine", -8.8, -0.6, 0.8], ["ginkgo", -4.8, 1.0, 0.8], ["persimmon", -6.6, 6.0, 0.8], ["ginkgo", 9.1, 3.3, 0.8],
  ];
  for (const [kind, x, z, s] of T) P.tree(root, kind, x, z, s);
  for (let i = 0; i < 8; i++) {
    P.chorong(root, -1.4 + i * 1.45, 1.4);
    P.chorong(root, -1.0 + i * 1.45, 2.35);
  }

  // ── 밤: 등 아래 따뜻한 빛 웅덩이 ──
  const poolMat = P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,180,110,.5)", "rgba(255,180,110,0)"), transparent: true }));
  const spots: [number, number, number][] = [...P.lanterns.map(([x, z]) => [x, z, 0.9] as [number, number, number]), [0.8, 0.0, 3.2], [6.6, -2.2, 3.2], [0.4, -3.4, 3.0], [-7.6, 3.6, 2.0], [6.4, 4.6, 3.0], [2.5, 6.6, 2.0]];
  for (const [x, z, s] of spots) P.decal(root, poolMat, x, TOP + 0.04, z, s);

  const tick = (t: number) => {
    stalls.forEach(([x, z], i) => {
      for (let j = 0; j < 3; j++) {
        const v = (t * 0.3 + j / 3 + i * 0.17) % 1;
        puffs.set(i * 3 + j, x + Math.sin(t + j * 2 + i) * 0.06, TOP + 0.7 + v * 0.9, z - 0.15, 0.3 + v * 0.5, 0.9 * (1 - v) * Math.min(1, v * 5)); // 차양 위로 피어오른다
      }
    });
    puffs.commit();
  };
  tick(0);
  return { tick };
}
