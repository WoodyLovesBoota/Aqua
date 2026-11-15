import * as THREE from "three";
import { place } from "@/components/diorama/fx";
import { add, canvasTex, dn, keepDynamic, type Kit, radialTex, strut } from "@/components/diorama/kit";
import { hwAt, ISLE, riverFrame, SITES, T_ISLE, tAtX, TOP } from "./layout";
import { acrossRiver, type Parts } from "./parts";

type Tick = (t: number, night: number) => void;

/** 밤 후광 스프라이트 (가산, 밤 전용) */
function halo(P: Parts, parent: THREE.Object3D, rgba: string, s: number, x: number, y: number, z: number) {
  const sp = new THREE.Sprite(P.nightAdd(new THREE.SpriteMaterial({ map: radialTex(rgba, rgba.replace(/[\d.]+\)$/, "0)")) })));
  sp.scale.set(s, s, 1);
  sp.position.set(x, y, z);
  parent.add(sp);
  return sp;
}

/** 에펠탑: 휘어 오르는 네 다리 + 격자면(알파 구멍) + 1층 아치 + 전망대 3층 + 안테나. 밤엔 황금빛 + 반짝임 + 꼭대기 등 */
export function buildEiffel(k: Kit, P: Parts, parent: THREE.Object3D): Tick {
  const { M } = P;
  const g = place(parent, SITES.eiffel, TOP);
  const Ht = 5.75, wAt = (y: number) => 0.075 + 1.2 * Math.pow(Math.max(0, 1 - y / 6.05), 2.6);
  const BRONZE = P.mat({ color: dn("#7c5b40", "#8a5a30"), roughness: 0.7, metalness: 0.25, glow: ["#ff9030", 0.38] });
  const lattice = canvasTex(
    128,
    128,
    (c, w, h) => {
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#fff";
      c.lineWidth = 12;
      c.strokeRect(0, 0, w, h);
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w, h);
      c.moveTo(w, 0);
      c.lineTo(0, h);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w / 2, 0);
      c.lineTo(w / 2, h);
      c.stroke();
    },
    { linear: true, repeat: [1, 1] }, // uv 가 0..1 밖으로 나간다 — 반복이 없으면 가장자리 흰 줄이 늘어나 면이 꽉 막힌다
  );
  const LAT = k.std({ color: dn("#7c5b40", "#8a5a30"), roughness: 0.7, metalness: 0.25, alphaMap: lattice, alphaTest: 0.5, side: THREE.DoubleSide, glow: ["#ff9030", 0.38] });
  // 격자 면 4개: 두 다리 사이, uv 는 실제 길이(셀 크기 일정)
  const face = (y0: number, y1: number, ny: number) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= ny; j++) {
      const y = y0 + ((y1 - y0) * j) / ny, w = wAt(y);
      for (const s of [-1, 1]) {
        pos.push(s * w, y, w);
        uv.push((s * w) / 0.34, y / 0.34);
      }
    }
    for (let j = 0; j < ny; j++) {
      const a = j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  for (let q = 0; q < 4; q++) add(g, face(0.92, Ht, 40).rotateY((q * Math.PI) / 2), LAT);
  // 다리: 아래 넓은 네 기둥 + 석조 받침 + 모서리 관
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(sx * wAt(0) * 0.92, 0, sz * wAt(0) * 0.92), b = new THREE.Vector3(sx * wAt(1.0) * 0.98, 1.0, sz * wAt(1.0) * 0.98);
      strut(g, BRONZE, a, b, 0.2, 0.12, 4);
      add(g, new THREE.BoxGeometry(0.42, 0.12, 0.42), M.LIME_D, a.x, 0.06, a.z);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const y = 0.9 + (Ht - 0.9) * (i / 24), w = wAt(y);
        pts.push(new THREE.Vector3(sx * w, y, sz * w));
      }
      add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.055, 5), BRONZE);
    }
  // 1층 아치 (네 면)
  for (let q = 0; q < 4; q++) {
    const arch = new THREE.TorusGeometry(0.78, 0.05, 6, 24, Math.PI);
    arch.translate(0, 0.12, wAt(0.5));
    arch.rotateY((q * Math.PI) / 2);
    add(g, arch, BRONZE);
  }
  // 전망대 3층 + 꼭대기
  for (const [y, ext, hh] of [[1.0, 0.1, 0.16], [2.35, 0.08, 0.12], [Ht - 0.05, 0.06, 0.16]]) {
    const w = wAt(y) + ext;
    add(g, new THREE.BoxGeometry(w * 2, hh, w * 2), BRONZE, 0, y, 0);
    add(g, new THREE.BoxGeometry(w * 2 + 0.06, 0.03, w * 2 + 0.06), M.IRON, 0, y + hh / 2 + 0.05, 0);
  }
  add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.22, 8), BRONZE, 0, Ht + 0.15, 0);
  add(g, new THREE.CylinderGeometry(0.012, 0.03, 0.5, 6), M.IRON, 0, Ht + 0.5, 0);
  const beacon = halo(P, g, "rgba(255,236,190,.8)", 0.9, 0, Ht + 0.3, 0);
  P.pools.push([SITES.eiffel[0], SITES.eiffel[1], 3.4]);

  // 반짝임: 표면 위 흰 점 4 무리가 엇갈려 깜빡인다 (밤)
  const sparks: THREE.PointsMaterial[] = [];
  for (let s = 0; s < 4; s++) {
    const sp: number[] = [];
    for (let i = 0; i < 90; i++) {
      const y = 0.9 + k.rnd() * (Ht - 0.9), w = wAt(y) + 0.02, side = Math.floor(k.rnd() * 4), u = k.rnd() * 2 - 1, r = (side * Math.PI) / 2;
      sp.push(u * w * Math.cos(r) + w * Math.sin(r), y, -u * w * Math.sin(r) + w * Math.cos(r));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    const m = new THREE.PointsMaterial({ color: "#ffffff", size: 0.05, transparent: true, opacity: 0, depthWrite: false });
    sparks.push(m);
    g.add(keepDynamic(new THREE.Points(sg, m)));
  }
  return (t, night) => {
    for (let s = 0; s < 4; s++) {
      const f = Math.max(0, Math.sin(t * 7.3 + s * 1.7) * Math.sin(t * 3.1 + s * 2.9));
      sparks[s].opacity = night * (0.25 + 0.75 * f);
      sparks[s].visible = night > 0.01;
    }
    beacon.material.rotation = t * 0.8;
  };
}

/** 회전목마: 줄무늬 천막 + 금 기둥 + 목마 8 + 밤 전구 띠. 위쪽(천막·목마)이 천천히 돈다 */
export function buildCarousel(k: Kit, P: Parts, parent: THREE.Object3D, bakeGroups: THREE.Object3D[]): Tick {
  const { M } = P;
  const g = place(parent, SITES.carousel, TOP);
  add(g, new THREE.CylinderGeometry(0.62, 0.66, 0.1, 24), P.mat({ color: "#c9a46a" }), 0, 0.05, 0);
  const spin = keepDynamic(new THREE.Group());
  g.add(spin);
  bakeGroups.push(spin);
  const stripes = canvasTex(256, 32, (c, w, h) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? "#f5ead2" : "#c2363a";
      c.fillRect((i * w) / 16, 0, w / 16, h);
    }
  });
  const CAN = k.std({ color: "#ffffff", map: stripes, emissiveMap: stripes, roughness: 0.7, glow: ["#ffffff", 0.35] });
  add(spin, new THREE.ConeGeometry(0.72, 0.42, 24), CAN, 0, 1.0, 0);
  add(spin, new THREE.CylinderGeometry(0.72, 0.72, 0.1, 24, 1, true), CAN, 0, 0.75, 0);
  add(spin, new THREE.CylinderGeometry(0.1, 0.1, 0.75, 10), M.GOLD, 0, 0.42, 0);
  add(spin, new THREE.SphereGeometry(0.05, 8, 6), M.GOLD, 0, 1.25, 0);
  add(spin, new THREE.CylinderGeometry(0.6, 0.6, 0.03, 24), P.mat({ color: "#e8d6b0" }), 0, 0.115, 0);
  const horse = [M.WHITE, P.mat({ color: "#d9b88a" }), P.mat({ color: "#8a5a3a" })];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.48, y = 0.35 + (i % 2) * 0.08;
    add(spin, new THREE.CylinderGeometry(0.01, 0.01, 0.62, 5), M.GOLD, x, 0.42, z);
    const body = new THREE.CapsuleGeometry(0.04, 0.12, 4, 8);
    body.rotateZ(Math.PI / 2);
    add(spin, body, horse[i % 3], x, y, z).rotation.y = -a;
    add(spin, new THREE.CapsuleGeometry(0.025, 0.06, 4, 6), horse[i % 3], x + Math.cos(a + Math.PI / 2) * 0.08, y + 0.07, z + Math.sin(a + Math.PI / 2) * 0.08).rotation.z = 0.5;
  }
  const bulbs = k.nightOnly(k.std({ color: "#fff1c8", glow: ["#ffc56b", 3.2] }));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    add(spin, new THREE.SphereGeometry(0.02, 6, 4), bulbs, Math.cos(a) * 0.73, 0.7, Math.sin(a) * 0.73).castShadow = false;
  }
  P.pools.push([SITES.carousel[0], SITES.carousel[1], 2.2]);
  return (t) => {
    spin.rotation.y = -t * 0.45;
  };
}

/** 사크레쾨르: 몽마르트르 언덕(정점색 풀빛·정면 계단·나무) 위 흰 돔 성당 (큰 돔 + 작은 돔 4 + 종탑) */
export function buildSacreCoeur(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const g = place(parent, SITES.sacrecoeur, TOP);
  const prof = [[0.001, 1.25], [0.7, 1.22], [1.4, 0.95], [1.95, 0.5], [2.3, 0.12], [2.45, 0]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(32), 72);
  geo.scale(1, 1, 0.74);
  const p = geo.attributes.position, col: number[] = [], cA = new THREE.Color("#8fb35e"), cB = new THREE.Color("#b8c77a");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), n = Math.sin(x * 2.3 + z * 3.1) * 0.5 + 0.5;
    p.setY(i, y + Math.sin(x * 3 - z * 2) * 0.03 * Math.min(1, y));
    const c = cA.clone().lerp(cB, n * 0.7);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // 밤엔 재질 색으로 어둡게 (정점색 × 재질색)
  add(g, geo, P.mat({ color: dn("#ffffff", "#8a9a86"), vertexColors: true, roughness: 1 }), 0, -0.03, 0).castShadow = false;
  for (let i = 0; i < 9; i++) add(g, new THREE.BoxGeometry(0.6, 0.06, 0.12), M.LIME, 0, 1.2 - i * 0.12, 0.55 + i * 0.12).castShadow = false;
  for (const [x, z] of [[-1.5, 0.4], [-1.2, 0.85], [1.4, 0.55], [1.6, -0.2], [-1.75, -0.3], [1.0, 1.0], [-0.8, 1.15]]) {
    const y = 1.25 * Math.max(0, 1 - Math.hypot(x / 2.45, z / (2.45 * 0.74))) * 0.95;
    P.tree(g, k.rnd() < 0.5 ? "chestnut" : "cherry", x, z, 0.55, y - 0.05);
  }
  const SC = P.mat({ color: "#f6f2ea", roughness: 0.75, glow: ["#fff2d8", 0.5] });
  const c = new THREE.Group();
  c.position.set(0, 1.2, -0.15);
  c.scale.setScalar(1.3);
  g.add(c);
  add(c, new THREE.BoxGeometry(1.3, 0.5, 0.9), SC, 0, 0.25, 0);
  add(c, new THREE.BoxGeometry(0.75, 0.42, 0.25), SC, 0, 0.21, 0.55);
  for (let i = 0; i < 3; i++) add(c, new THREE.TorusGeometry(0.08, 0.02, 4, 12, Math.PI), P.mat({ color: "#cfc4b0" }), -0.22 + i * 0.22, 0.24, 0.68);
  const dome = (x: number, y: number, z: number, r: number, kk: number) => {
    add(c, new THREE.CylinderGeometry(r * 0.95, r, r * 0.9, 16), SC, x, y + r * 0.45, z);
    const d = new THREE.SphereGeometry(r, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    d.scale(1, kk, 1);
    add(c, d, SC, x, y + r * 0.9, z);
    add(c, new THREE.CylinderGeometry(r * 0.22, r * 0.25, r * 0.5, 10), SC, x, y + r * 0.9 + r * kk + r * 0.2, z);
    add(c, new THREE.ConeGeometry(r * 0.24, r * 0.4, 10), SC, x, y + r * 0.9 + r * kk + r * 0.6, z);
  };
  dome(0, 0.5, 0, 0.36, 1.45);
  for (const [x, z] of [[-0.48, 0.3], [0.48, 0.3]]) dome(x, 0.5, z, 0.15, 1.35);
  for (const [x, z] of [[-0.45, -0.32], [0.45, -0.32]]) dome(x, 0.5, z, 0.12, 1.3);
  add(c, new THREE.BoxGeometry(0.28, 0.9, 0.28), SC, 0, 0.45, -0.6);
  dome(0, 0.9, -0.6, 0.13, 1.3);
  halo(P, c, "rgba(255,240,210,.45)", 1.5, 0, 0.7, 0);
}

/** 물랭루주: 빨간 극장 + 네온 간판 + 지붕 위 풍차(날개 4가 천천히 돈다) */
export function buildMoulinRouge(k: Kit, P: Parts, parent: THREE.Object3D, bakeGroups: THREE.Object3D[]): Tick {
  const { M } = P;
  const g = place(parent, SITES.moulin, TOP);
  const sign = canvasTex(256, 48, (c, w, h) => {
    c.fillStyle = "#3a0f12";
    c.fillRect(0, 0, w, h);
    c.font = "bold 25px Georgia, serif";
    c.fillStyle = "#ffd36a";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("MOULIN ROUGE", w / 2, h / 2 + 2);
  });
  add(g, new THREE.BoxGeometry(1.5, 0.6, 0.8), P.mat({ color: "#c23a33", roughness: 0.6 }), 0, 0.3, 0);
  add(g, new THREE.BoxGeometry(1.55, 0.06, 0.85), P.mat({ color: "#f2e0b8" }), 0, 0.62, 0);
  add(g, new THREE.PlaneGeometry(1.2, 0.22), k.std({ color: "#ffffff", map: sign, emissiveMap: sign, glow: ["#ffffff", 2.2] }), 0, 0.45, 0.41).castShadow = false;
  add(g, new THREE.BoxGeometry(0.9, 0.24, 0.02), P.mat({ color: "#2a1a1a", glow: ["#ff6a50", 1.4] }), 0, 0.14, 0.41);
  const mill = new THREE.Group();
  mill.position.set(-0.45, 0.62, 0.05);
  g.add(mill);
  add(mill, new THREE.CylinderGeometry(0.17, 0.24, 0.6, 8), P.mat({ color: "#d0413a", roughness: 0.55, glow: ["#ff3a30", 1.6] }), 0, 0.3, 0);
  add(mill, new THREE.ConeGeometry(0.22, 0.24, 8), P.mat({ color: "#7a2a2a" }), 0, 0.72, 0);
  add(mill, new THREE.BoxGeometry(0.12, 0.14, 0.02), P.mat({ color: "#ffe2a0", glow: ["#ffd080", 2] }), 0, 0.3, 0.215);
  const sails = keepDynamic(new THREE.Group());
  sails.position.set(0, 0.55, 0.28);
  mill.add(sails);
  bakeGroups.push(sails);
  const sailTex = canvasTex(
    32,
    128,
    (c, w, h) => {
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#fff";
      c.lineWidth = 3;
      c.strokeRect(2, 2, w - 4, h - 4);
      for (let y = 0; y < h; y += 14) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(w / 2, 0);
      c.lineTo(w / 2, h);
      c.stroke();
    },
    { linear: true },
  );
  const SAIL = k.std({ color: "#f3e6cf", alphaMap: sailTex, alphaTest: 0.5, side: THREE.DoubleSide, glow: ["#ffd890", 1.6] });
  for (let q = 0; q < 4; q++) {
    const a = (q * Math.PI) / 2;
    add(sails, new THREE.PlaneGeometry(0.12, 0.5), SAIL, Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0).rotation.z = -a;
  }
  add(sails, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateX(Math.PI / 2), M.IRON, 0, 0, -0.02);
  P.pools.push([SITES.moulin[0], SITES.moulin[1] + 0.6, 2.0]);
  return (t) => {
    sails.rotation.z = 0.35 - t * 0.5;
  };
}

/** 루브르: ㄷ자 궁전(아치 창 파사드·망사르드·파빌리온) + 유리 피라미드(큰 1 + 작은 3, 밤에 불빛) + 삼각 분수 */
export function buildLouvre(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const g = place(parent, SITES.louvre, TOP);
  const fac = P.facade(24, 3, { arch: true, lit: 0.35, bg: "#efe4cc" });
  const wing = (x: number, z: number, w: number, d: number, ry = 0) => {
    const s = new THREE.Group();
    s.position.set(x, 0, z);
    s.rotation.y = ry;
    g.add(s);
    add(s, new THREE.BoxGeometry(w, 0.62, d), fac, 0, 0.31, 0);
    P.mansard(s, w, d, 0.24, 0.62, false);
  };
  wing(0, -0.85, 3.4, 0.5);
  wing(-1.45, 0.05, 1.3, 0.5, Math.PI / 2);
  wing(1.45, 0.05, 1.3, 0.5, Math.PI / 2);
  for (const [x, z] of [[-1.45, -0.85], [1.45, -0.85], [0, -0.85]]) {
    const s = new THREE.Group();
    s.position.set(x, 0, z);
    g.add(s);
    add(s, new THREE.BoxGeometry(0.6, 0.72, 0.62), fac, 0, 0.36, 0);
    P.mansard(s, 0.6, 0.62, 0.36, 0.72, false);
  }
  const grid = (bg: string, line: string) =>
    canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = line;
      c.lineWidth = 2;
      for (let i = 0; i <= w; i += 12) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, h);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i);
        c.lineTo(w, i);
        c.stroke();
      }
    });
  const GLASS = k.phys({ color: "#ffffff", map: grid("#b9d4df", "#7d8f99"), emissiveMap: grid("#ffd99a", "#a87a3a"), roughness: 0.1, metalness: 0.3, clearcoat: 1, glow: ["#ffffff", 1.6] });
  const pyr = (x: number, z: number, s: number) => add(g, new THREE.ConeGeometry(s * Math.SQRT1_2, s * 0.65, 4, 1).rotateY(Math.PI / 4), GLASS, x, s * 0.325, z);
  pyr(0, 0.15, 1.0);
  for (const [x, z] of [[-0.9, 0.2], [0.9, 0.2], [0, 0.95]]) pyr(x, z, 0.3);
  const POOL = k.phys({ color: dn("#7fb6c6", "#3a5a8a"), roughness: 0.05, clearcoat: 1, glow: ["#2a4a80", 0.6] });
  for (const [x, z, ry] of [[-0.6, 0.62, 0.4], [0.6, 0.62, -0.4], [0, -0.45, 0]]) {
    add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 3), POOL, x, 0.03, z).rotation.y = ry;
    add(g, new THREE.CylinderGeometry(0.37, 0.37, 0.04, 3), M.LIME_D, x, 0.015, z).rotation.y = ry;
  }
  P.pools.push([SITES.louvre[0], SITES.louvre[1] + 0.15, 2.4]);
}

/** 콩코르드 광장: 둥근 포장 + 오벨리스크(금 꼭지) + 분수 둘 + 가로등 4 */
export function buildConcorde(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const g = place(parent, SITES.concorde, TOP);
  add(g, new THREE.CylinderGeometry(1.0, 1.0, 0.02, 40), P.mat({ color: dn("#e3d6bd", "#8f8898"), roughness: 1 }), 0, 0.01, 0).castShadow = false;
  add(g, new THREE.BoxGeometry(0.2, 0.18, 0.2), M.LIME_D, 0, 0.09, 0);
  add(g, new THREE.CylinderGeometry(0.045 * Math.SQRT2, 0.075 * Math.SQRT2, 1.25, 4).rotateY(Math.PI / 4), P.mat({ color: "#d9b98a", roughness: 0.8, glow: ["#ffcf90", 0.4] }), 0, 0.8, 0);
  add(g, new THREE.ConeGeometry(0.045 * Math.SQRT2, 0.1, 4).rotateY(Math.PI / 4), M.GOLD, 0, 1.47, 0);
  const FW = k.phys({ color: dn("#8cc3d0", "#4a6ea0"), roughness: 0.05, clearcoat: 1, glow: ["#3a5f9a", 0.8] });
  const SPRAY = k.std({ color: "#e6f6ff", transparent: true, opacity: 0.6, glow: ["#bfe0ff", 0.8] });
  for (const s of [-1, 1]) {
    const x = s * 0.6, z = s * 0.18;
    add(g, new THREE.CylinderGeometry(0.3, 0.32, 0.08, 24), M.LIME_D, x, 0.04, z);
    add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.06, 24), FW, x, 0.06, z);
    add(g, new THREE.CylinderGeometry(0.04, 0.06, 0.25, 10), M.GREEN, x, 0.18, z);
    add(g, new THREE.CylinderGeometry(0.14, 0.04, 0.05, 16), M.GOLD, x, 0.3, z);
    add(g, new THREE.CylinderGeometry(0.02, 0.03, 0.14, 8), M.GREEN, x, 0.38, z);
    add(g, new THREE.ConeGeometry(0.07, 0.18, 10, 1, true), SPRAY, x, 0.52, z).castShadow = false;
  }
  for (const [x, z] of [[-0.9, -0.55], [0.9, 0.55], [-0.9, 0.6], [0.9, -0.6]]) P.lamp(g, x, z, false);
  P.pools.push([SITES.concorde[0], SITES.concorde[1], 2.2]);
}

/** 개선문: 두 기둥 + 아치 + 처마·아틱 + 부조판 + 아치 아래 국기 + 밤 꺼지지 않는 불 */
export function buildArc(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const g = place(parent, SITES.arc, TOP);
  const ARC = P.mat({ color: "#e9ddc4", roughness: 0.85, glow: ["#ffe2b0", 0.45] });
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.42, 0.95, 0.62), ARC, s * 0.4, 0.475, 0);
  add(g, new THREE.BoxGeometry(1.24, 0.42, 0.62), ARC, 0, 1.16, 0);
  add(g, new THREE.BoxGeometry(1.32, 0.06, 0.7), M.LIME_D, 0, 1.4, 0);
  add(g, new THREE.BoxGeometry(1.26, 0.1, 0.64), ARC, 0, 1.48, 0);
  const arch = new THREE.CylinderGeometry(0.19, 0.19, 0.64, 16, 1, false, 0, Math.PI);
  arch.rotateX(Math.PI / 2);
  arch.rotateZ(Math.PI / 2);
  add(g, arch, ARC, 0, 0.95, 0);
  // 옆면 작은 아치 (양 기둥을 뚫는 횡 아치 대신 어두운 판)
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.36, 0.22), P.mat({ color: "#6f6658" }), s * 0.615, 0.4, 0);
  for (const s of [-1, 1]) for (const zz of [-1, 1]) add(g, new THREE.BoxGeometry(0.26, 0.28, 0.02), P.mat({ color: "#d9cbb0" }), s * 0.4, 0.55, zz * 0.32);
  const flag = canvasTex(48, 32, (c, w, h) => {
    c.fillStyle = "#24408e";
    c.fillRect(0, 0, w / 3, h);
    c.fillStyle = "#f4f1ea";
    c.fillRect(w / 3, 0, w / 3, h);
    c.fillStyle = "#d8343a";
    c.fillRect((2 * w) / 3, 0, w / 3, h);
  });
  add(g, new THREE.PlaneGeometry(0.3, 0.2), k.std({ color: "#ffffff", map: flag, side: THREE.DoubleSide }), 0, 0.68, 0).castShadow = false;
  add(g, new THREE.SphereGeometry(0.04, 8, 6), k.nightOnly(k.std({ color: "#ffb060", glow: ["#ff9a40", 4] })), 0, 0.04, 0);
  add(g, new THREE.CylinderGeometry(0.95, 0.95, 0.03, 40), M.LIME_D, 0, 0.015, 0).castShadow = false;
  P.pools.push([SITES.arc[0], SITES.arc[1], 2.4]);
}

/** 시테섬: 노트르담(서쪽 정면 두 탑·장미창·신랑·익랑·후진·첨탑·플라잉 버트레스) + 섬 끝 정원 나무 */
export function buildNotreDame(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(ISLE.x + 0.15, TOP - 0.05, ISLE.z);
  g.rotation.y = ISLE.ry;
  parent.add(g);
  const ND = P.mat({ color: "#ddd1b8", roughness: 0.85, glow: ["#ffdca0", 0.55] });
  const LEAD = P.mat({ color: dn("#6d7888", "#4a5466"), roughness: 0.6, metalness: 0.3 });
  const DARK = P.mat({ color: "#5b5248" });
  const prism = (len: number, w: number, h: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.lineTo(w / 2, 0);
    sh.lineTo(0, h);
    sh.lineTo(-w / 2, 0);
    return new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
  };
  add(g, new THREE.BoxGeometry(1.5, 0.42, 0.42), ND, 0.15, 0.21, 0); // 신랑
  add(g, prism(1.5, 0.48, 0.3).rotateY(Math.PI / 2), LEAD, 0.15, 0.42, 0);
  add(g, new THREE.BoxGeometry(0.32, 0.42, 0.78), ND, 0.35, 0.21, 0); // 익랑
  add(g, prism(0.84, 0.36, 0.26), LEAD, 0.35, 0.42, 0);
  add(g, new THREE.CylinderGeometry(0.21, 0.21, 0.42, 16, 1, false, 0, Math.PI), ND, 0.9, 0.21, 0); // 후진
  add(g, new THREE.ConeGeometry(0.22, 0.3, 16, 1, false, 0, Math.PI), LEAD, 0.9, 0.57, 0);
  for (let i = 0; i < 5; i++)
    for (const s of [-1, 1]) {
      const m = add(g, new THREE.TorusGeometry(0.16, 0.012, 4, 8, Math.PI / 2), ND, -0.35 + i * 0.28, 0.24, s * 0.21);
      m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      add(g, new THREE.BoxGeometry(0.04, 0.3, 0.04), ND, -0.35 + i * 0.28, 0.15, s * 0.37);
      add(g, new THREE.ConeGeometry(0.025, 0.08, 4), ND, -0.35 + i * 0.28, 0.34, s * 0.37);
    }
  // 서쪽 정면: 장미창·세 문 그림 (밤엔 장미창이 빛난다)
  const rose = canvasTex(128, 128, (c, w) => {
    c.fillStyle = "#ddd1b8";
    c.fillRect(0, 0, w, w);
    c.fillStyle = "#3b4a7a";
    c.beginPath();
    c.arc(64, 54, 26, 0, 6.3);
    c.fill();
    c.strokeStyle = "#ddd1b8";
    c.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      c.beginPath();
      c.moveTo(64, 54);
      c.lineTo(64 + Math.cos(i * 0.52) * 26, 54 + Math.sin(i * 0.52) * 26);
      c.stroke();
    }
    c.fillStyle = "#5b5248";
    for (const x of [28, 64, 100]) {
      c.beginPath();
      c.moveTo(x - 12, 128);
      c.lineTo(x - 12, 104);
      c.arc(x, 104, 12, Math.PI, 0);
      c.lineTo(x + 12, 128);
      c.fill();
    }
    c.fillStyle = "#a89c86";
    c.fillRect(0, 86, w, 4);
  });
  const roseEm = canvasTex(128, 128, (c, w) => {
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, w);
    c.fillStyle = "#ffb878";
    c.beginPath();
    c.arc(64, 54, 24, 0, 6.3);
    c.fill();
  });
  const FACADE = k.std({ color: "#ffffff", map: rose, emissiveMap: roseEm, roughness: 0.85, glow: ["#ffffff", 2] });
  add(g, new THREE.BoxGeometry(0.34, 0.78, 0.74), ND, -0.75, 0.39, 0);
  add(g, new THREE.PlaneGeometry(0.74, 0.78).rotateY(-Math.PI / 2), FACADE, -0.921, 0.39, 0).castShadow = false;
  // 두 탑: 루버 창 둘 + 난간 + 모서리 첨두
  for (const s of [-1, 1]) {
    const z = s * 0.24;
    add(g, new THREE.BoxGeometry(0.3, 0.42, 0.26), ND, -0.75, 0.99, z);
    for (const q of [-1, 1]) add(g, new THREE.BoxGeometry(0.31, 0.2, 0.035), DARK, -0.75, 1.0, z + q * 0.055).castShadow = false;
    add(g, new THREE.BoxGeometry(0.33, 0.04, 0.29), ND, -0.75, 1.22, z);
    for (const a of [-1, 1]) for (const b of [-1, 1]) add(g, new THREE.ConeGeometry(0.022, 0.09, 4), ND, -0.75 + a * 0.14, 1.28, z + b * 0.12);
  }
  add(g, new THREE.BoxGeometry(0.33, 0.05, 0.76), ND, -0.75, 0.8, 0); // 왕의 회랑 띠
  add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.22, 8), LEAD, 0.35, 0.72, 0); // 첨탑
  add(g, new THREE.ConeGeometry(0.05, 0.75, 8), LEAD, 0.35, 1.2, 0);
  for (const [x, z] of [[1.35, 0.1], [1.25, -0.25], [-1.35, 0.15], [-1.25, -0.2]]) P.tree(g, x > 0 ? "chestnut" : "cherry", x, z, 0.5);
  P.pools.push([ISLE.x, ISLE.z, 2.6]);
}

/** 다리: 알렉상드르 3세교(낮은 철제 아치 옆판·금빛 기둥·촛대 가로등) + 퐁뇌프(섬 → 앞 강둑, 돌 아치 셋) */
export function buildBridges(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  {
    const { p, tg } = riverFrame(tAtX(-2.8));
    const g = new THREE.Group();
    g.position.set(p.x, TOP, p.y);
    g.rotation.y = acrossRiver(tg); // 로컬 x = 강을 가로지름
    parent.add(g);
    const L = 2.6, span = 0.95;
    add(g, new THREE.BoxGeometry(L, 0.08, 0.72), M.LIME, 0, 0.02, 0);
    // 철제 아치 옆판: 위 = 상판 밑, 아래 = 강둑에서 솟는 낮은 아치 (원형 구멍 무늬)
    const steel = P.mat({ color: "#4a5e56", metalness: 0.45, roughness: 0.45, side: THREE.DoubleSide });
    const sh = new THREE.Shape();
    const arc = (x: number) => -0.32 + 0.17 * (1 - (x / span) ** 2); // 가운데도 상판 아래로 0.13 늘어져 옆에서 아치가 보인다
    sh.moveTo(-span, -0.02);
    sh.lineTo(span, -0.02);
    for (let i = 0; i <= 24; i++) {
      const x = span - (2 * span * i) / 24;
      sh.lineTo(x, arc(x));
    }
    for (let q = -3; q <= 3; q++) {
      const hx = q * 0.24, top = -0.04, bot = arc(hx) + 0.03, r = Math.min(0.06, (top - bot) / 2 - 0.005);
      if (r > 0.015) {
        const hole = new THREE.Path();
        hole.absarc(hx, (top + bot) / 2, r, 0, Math.PI * 2, true);
        sh.holes.push(hole);
      }
    }
    const side = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 10 });
    for (const z of [-0.4, 0, 0.37]) add(g, side.clone(), steel, 0, 0, z); // 바깥 두 장은 상판 가장자리 밖 — 위에서도 아치가 보인다
    for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12).rotateX(Math.PI / 2), M.GOLD, 0, -0.08, s * 0.42).castShadow = false; // 가운데 금 메달
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(L, 0.07, 0.03), steel, 0, 0.09, s * 0.34);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * (L / 2 - 0.12), z = sz * 0.44;
        add(g, new THREE.BoxGeometry(0.16, 0.85, 0.16), M.LIME, x, 0.45, z);
        add(g, new THREE.SphereGeometry(0.07, 10, 8), M.GOLD, x, 0.94, z);
        add(g, new THREE.ConeGeometry(0.05, 0.16, 5), M.GOLD, x, 1.05, z);
      }
    for (let i = 0; i < 4; i++)
      for (const s of [-1, 1]) {
        const x = -0.75 + i * 0.5;
        add(g, new THREE.CylinderGeometry(0.01, 0.014, 0.3, 5), M.IRON, x, 0.2, s * 0.33);
        add(g, new THREE.SphereGeometry(0.025, 8, 6), M.LAMP, x, 0.36, s * 0.33).castShadow = false;
      }
    P.pools.push([p.x, p.y, 2.0]);
  }
  {
    const tI = T_ISLE - 0.05, { p, tg, n } = riverFrame(tI);
    const off = Math.max(0.95, (0.5 + hwAt(tI)) / 2); // 섬 가장자리 → 앞 강둑 사이 갈래 가운데
    const g = new THREE.Group();
    g.position.set(p.x + n.x * off, TOP, p.y + n.y * off);
    g.rotation.y = acrossRiver(tg);
    parent.add(g);
    const STONE = M.LIME_D;
    add(g, new THREE.BoxGeometry(0.95, 0.08, 0.42), STONE, 0, 0, 0);
    for (const x of [-0.3, 0, 0.3]) add(g, new THREE.TorusGeometry(0.1, 0.035, 5, 12, Math.PI).scale(1, 1, 5.5), STONE, x, -0.3, 0);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.95, 0.06, 0.03), STONE, 0, 0.07, s * 0.2);
  }
}
