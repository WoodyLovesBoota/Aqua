import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, type Kit, radialTex } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/**
 * 마리나 베이 샌즈: 나란한 세 동(앞 다리가 아래로 휘는 A 자) + 층 띠 파사드 + 스카이파크(왼쪽으로 내민 배) + 물결 지붕 쇼핑몰.
 * 밤엔 창은 드문드문, 빛은 스카이파크 테두리 LED·풀·갑판 점등·후광에 몰아준다.
 */
export function buildSands(k: Kit) {
  const root = new THREE.Group();
  const { z: Z, towersX, H: H0 } = SITES.sands;
  const LEGW = 1.25;

  // 파사드: 낮 = 유리 격자 (map), 밤 = 켜진 창만 (emissiveMap). 밤엔 색을 곱해 어둡게
  const rows = 56, cols = 14, lit: boolean[] = [];
  for (let i = 0; i < rows * cols; i++) lit.push(k.rnd() < 0.16);
  const facadeDay = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#cdd7dd";
    g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        g.fillStyle = (j + i) % 7 === 0 ? "#a9c2d2" : "#b6ccd9";
        g.fillRect(i * (w / cols) + 1.5, j * (h / rows) + 2, w / cols - 3, h / rows - 4);
      }
  });
  const facadeNight = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        if (lit[j * cols + i]) {
          g.fillStyle = (i + j) % 2 ? "#ffe2a8" : "#fff2d8";
          g.fillRect(i * (w / cols) + 1.5, j * (h / rows) + 2, w / cols - 3, h / rows - 4);
        }
  });
  const fm = k.std({ color: dn("#ffffff", "#4a5478"), map: facadeDay, emissiveMap: facadeNight, glow: ["#ffffff", 0.9], roughness: 0.35, metalness: 0.2 });
  const edge = k.std({ color: dn("#f2efe9", "#d9d6e4"), roughness: 0.5 });

  // 다리 한 장: 옆 단면(z, y) 을 x 로 밀어낸 판. curved 면 아래로 갈수록 바깥(+z)으로 휜다
  function leg(curved: boolean) {
    const s = new THREE.Shape(), N = 24, T = 0.36;
    const off = (y: number) => (curved ? 0.62 * Math.pow(1 - y / H0, 2) : 0);
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * H0;
      if (i) s.lineTo(0.02 + off(y), y);
      else s.moveTo(0.02 + off(y), y);
    }
    for (let i = N; i >= 0; i--) {
      const y = (i / N) * H0;
      s.lineTo(0.02 + T + off(y), y);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: LEGW, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    g.rotateY(-Math.PI / 2);
    g.translate(LEGW / 2, 0, 0);
    // uv 다시 깔기: u = 폭, v = 높이 → 창 격자가 층 띠로
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + LEGW / 2) / LEGW, p.getY(i) / H0);
    if (!curved) g.scale(1, 1, -1);
    return g;
  }
  const front = leg(true), back = leg(false);
  for (const x of towersX) {
    add(root, front, fm, x, TOP, Z + 0.02);
    add(root, back, fm, x, TOP, Z - 0.02);
    add(root, new THREE.BoxGeometry(LEGW, 0.5, 0.86), fm, x, TOP + H0 - 0.25, Z);
    for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.04, H0, 0.04), edge, x + (s * LEGW) / 2, TOP + H0 / 2, Z + 0.4);
  }

  // 스카이파크: 위가 평평하고 바닥이 둥근 배. 왼쪽(북) 끝이 허공으로 길게 내민다
  const len = 8.8, cx = 1.55, y0 = TOP + H0 + 0.02;
  const hull = new THREE.Shape();
  hull.moveTo(len / 2, -0.62);
  hull.lineTo(len / 2 + 0.15, 0);
  hull.lineTo(len / 2, 0.62);
  hull.lineTo(-len / 2 + 1.4, 0.62);
  hull.bezierCurveTo(-len / 2 + 0.3, 0.6, -len / 2 - 0.2, 0.25, -len / 2 - 0.45, 0);
  hull.bezierCurveTo(-len / 2 - 0.2, -0.25, -len / 2 + 0.3, -0.6, -len / 2 + 1.4, -0.62);
  hull.closePath();
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 5, curveSegments: 24 });
  hg.rotateX(Math.PI / 2);
  add(root, hg, k.std({ color: dn("#f6f4ef", "#f2f0fa"), roughness: 0.4, glow: ["#fff4e0", 0.25] }), cx, y0 + 0.42, Z);
  // 테두리 LED 띠 (아래·위) — 밤의 주인공
  const outline = hull.getSpacedPoints(160).map((p) => new THREE.Vector3(cx + p.x, y0 + 0.02, Z - p.y));
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 240, 0.035, 6, true), k.std({ color: dn("#e9e6df", "#fff6e2"), glow: ["#ffe8c0", 4.5] }));
  const outlineTop = outline.map((v) => new THREE.Vector3(v.x, y0 + 0.5, v.z));
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outlineTop, true), 240, 0.02, 6, true), k.std({ color: "#ffffff", glow: ["#fff1d6", 3.2] }));
  // 갑판: 인피니티 풀(동쪽) · 데크 · 야자수 줄 · 카바나
  add(root, new RoundedBoxGeometry(4.6, 0.05, 0.42, 2, 0.02), k.std({ color: "#5fd6ea", roughness: 0.05, glow: ["#29c4e6", 2.6], dayGlow: 0.35 }), cx + 2.0, y0 + 0.55, Z + 0.12);
  add(root, new RoundedBoxGeometry(4.0, 0.03, 0.5, 2, 0.02), k.std({ color: dn("#d9c4a3", "#b9a48c") }), cx - 2.2, y0 + 0.53, Z - 0.05);
  const frond = k.std({ color: "#4f9a5c" }), trunkM = k.std({ color: "#8c6d52" });
  for (let i = 0; i < 12; i++) {
    const x = cx - 3.9 + i * 0.42, z = Z - 0.42;
    add(root, new THREE.CylinderGeometry(0.012, 0.018, 0.22, 5), trunkM, x, y0 + 0.64, z);
    for (let j = 0; j < 5; j++) {
      const lf = new THREE.SphereGeometry(0.07, 8, 6);
      lf.scale(1.4, 0.35, 0.6);
      const m = add(root, lf, frond, x + Math.cos(j * 1.26) * 0.06, y0 + 0.75, z + Math.sin(j * 1.26) * 0.06);
      m.rotation.set(0, -j * 1.26, -0.35);
    }
  }
  const cabana = k.std({ color: "#fbfaf6", glow: ["#ffd9a0", 1.2] });
  for (let i = 0; i < 6; i++) add(root, new RoundedBoxGeometry(0.16, 0.1, 0.14, 2, 0.03), cabana, cx - 3.4 + i * 0.6, y0 + 0.6, Z + 0.4);
  // 밤: 갑판 점등 + 꼭대기 후광
  const pts: number[] = [];
  for (let i = 0; i < 70; i++) pts.push(cx - 4.2 + k.rnd() * 8.4, y0 + 0.6 + k.rnd() * 0.05, Z - 0.5 + k.rnd() * 1.0);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  root.add(new THREE.Points(pg, k.nightOnly(new THREE.PointsMaterial({ color: "#ffe2a4", size: 0.06, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }))));
  const halo = new THREE.Sprite(k.nightOnly(new THREE.SpriteMaterial({ map: radialTex("rgba(255,226,170,.55)", "rgba(255,226,170,0)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  halo.scale.set(8.5, 1.4, 1);
  halo.position.set(cx - 0.3, y0 + 0.45, Z);
  root.add(halo);

  // 더 숍스: 유리 몸체 + 물결 지붕
  const roof = new THREE.PlaneGeometry(7.2, 1.3, 90, 6);
  roof.rotateX(-Math.PI / 2);
  const rp = roof.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setY(i, 0.12 * Math.sin(rp.getX(i) * 2.6) + 0.06 * Math.cos(rp.getZ(i) * 2));
  roof.computeVertexNormals();
  add(root, new RoundedBoxGeometry(7.0, 0.5, 1.1, 2, 0.12), k.std({ color: dn("#dfe8ec", "#b8c4dc"), roughness: 0.2, metalness: 0.3, glow: ["#ffe1b0", 0.5] }), SITES.sands.x, TOP + 0.25, Z + 1.35);
  add(root, roof, k.std({ color: dn("#f7f4ee", "#e6e2ee"), side: THREE.DoubleSide }), SITES.sands.x, TOP + 0.54, Z + 1.35);
  return root;
}
