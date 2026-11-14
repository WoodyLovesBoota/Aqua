import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { place } from "@/components/diorama/fx";
import { add, canvasTex, dn, type Kit, radialTex } from "@/components/diorama/kit";
import { GYEONGGI, SITES, STREAM, TOP } from "./layout";
import { atlasUV, type Parts, tint } from "./parts";

const glowSprite = (P: Parts, rgba: string, sx: number, sy: number, x: number, y: number, z: number, parent: THREE.Object3D) => {
  const sp = new THREE.Sprite(P.nightAdd(new THREE.SpriteMaterial({ map: radialTex(rgba, rgba.replace(/[\d.]+\)$/, "0)")) })));
  sp.scale.set(sx, sy, 1);
  sp.position.set(x, y, z);
  parent.add(sp);
};

/** 남천교 + 청연루: 돌 홍예다리 위 붉은 기둥 긴 누각 (물 흐름에 수직) */
export function buildBridge(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P, t = 0.62, c = STREAM.getPoint(t), tg = STREAM.getTangent(t);
  const g = place(parent, [c.x, c.y, -Math.atan2(-tg.x, tg.y) + Math.PI / 2, 1], TOP);
  const L = 2.6;
  add(g, new RoundedBoxGeometry(L, 0.14, 0.75, 2, 0.03), M.STONE, 0, 0, 0);
  for (const s of [-1, 1]) add(g, new THREE.TorusGeometry(0.32, 0.07, 6, 16, Math.PI), M.STONE, s * 0.36, -0.28, 0).scale.z = 5;
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(L, 0.08, 0.04), M.RED, 0, 0.32, s * 0.36);
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6), M.RED, -L / 2 + 0.2 + (i * (L - 0.4)) / 6, 0.38, s * 0.33);
  P.giwa(g, L + 0.5, 1.15, 0.42, 0, 0.7, 0, 0.16);
  for (const s of [-1, 1]) P.chorong(g, s * 1.15, 0, 0.62, false);
  for (let i = 0; i < 4; i++) add(g, new THREE.SphereGeometry(0.05, 8, 6), M.LAN_R, -0.9 + i * 0.6, 0.58, 0.38);
}

/** 한벽당: 물가 바위 무더기 위 정자 */
export function buildHanbyeok(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P, g = place(parent, SITES.hanbyeok, TOP);
  const rock = P.mat({ color: dn("#9c968a", "#7c7a88"), flatShading: true });
  for (let i = 0; i < 7; i++) {
    const r = 0.22 + k.rnd() * 0.2, gg = new THREE.IcosahedronGeometry(r, 0);
    gg.scale(1.4, 0.8, 1.2);
    add(g, gg, rock, (k.rnd() - 0.5) * 1.2, r * 0.3, (k.rnd() - 0.5) * 0.8).rotation.set(k.rnd(), k.rnd() * 6, k.rnd());
  }
  add(g, new THREE.BoxGeometry(1.2, 0.06, 0.8), M.WOOD, 0, 0.42, 0);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), M.RED, sx * 0.55, 0.45, sz * 0.36);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(1.2, 0.05, 0.03), M.RED, 0, 0.6, s * 0.4);
  P.giwa(g, 1.7, 1.25, 0.38, 0, 0.88, 0, 0.16);
  glowSprite(P, "rgba(255,200,130,.5)", 1.6, 1.6, 0, 0.7, 0, g);
}

/** 오목대: 가을빛 언덕 + 꼭대기 정자 + 돌계단 + 소나무·단풍, 앞오른쪽 사면엔 자만 벽화마을 */
export function buildOmokdae(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P, g = place(parent, SITES.omokdae, TOP);
  const prof = [[0.001, 1.5], [0.6, 1.45], [1.4, 1.1], [2.1, 0.55], [2.6, 0.12], [2.75, 0]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(32), 72);
  geo.scale(1, 1, 0.78);
  const p = geo.attributes.position, col: number[] = [], cA = new THREE.Color("#9aa45a"), cB = new THREE.Color("#c49a52"), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), n = Math.sin(x * 2.3 + z * 3.1) * 0.5 + 0.5;
    p.setY(i, y + Math.sin(x * 3 - z * 2) * 0.04 * Math.min(1, y));
    c.copy(cA).lerp(cB, n * 0.7);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  add(g, geo, k.std({ color: dn("#ffffff", "#8a8ca8"), vertexColors: true, roughness: 1 }), 0, -0.03, 0).castShadow = false;
  // 정자
  const pg = place(g, [0, 0, 0.3, 1], 1.45);
  add(pg, new RoundedBoxGeometry(1.3, 0.12, 0.9, 2, 0.03), M.STONE, 0, 0.06, 0);
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) add(pg, new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), M.RED, sx * 0.55, 0.43, sz * 0.36);
  add(pg, new THREE.BoxGeometry(1.15, 0.05, 0.75), M.WOOD, 0, 0.3, 0);
  P.giwa(pg, 1.85, 1.35, 0.46, 0, 0.74, 0, 0.18);
  // 돌계단 (앞왼쪽 사면)
  for (let i = 0; i < 9; i++) {
    const r = 2.55 - i * 0.24, a = 1.85;
    add(g, new THREE.BoxGeometry(0.42, 0.08, 0.16), M.STONE, Math.cos(a) * r, i * 0.15 + 0.04, Math.sin(a) * r * 0.78).rotation.y = -a;
  }
  // 자만 벽화마을: 층층이 앉은 알록달록한 작은 집 (벽에 큰 그림)
  const hillY = (r: number) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const A = prof[i], B = prof[i + 1];
      if (r <= A.x && r >= B.x) return B.y + ((A.y - B.y) * (r - B.x)) / (A.x - B.x);
    }
    return 0;
  };
  const palette: [string, string[]][] = [["#f6c9c4", ["#e8574a", "#f2c230", "#5aa36f"]], ["#bfe3dd", ["#2f7fb8", "#f28c38", "#ffffff"]], ["#fbe6a2", ["#d9472b", "#3c6b9e", "#7cbf6a"]], ["#d9d2f2", ["#f06fa0", "#3fa5a5", "#f2c230"]], ["#c9e6f6", ["#e8574a", "#f2c230", "#6b9a3c"]], ["#f8d9b4", ["#3c7ab8", "#c84a6a", "#5aa36f"]]];
  // 벽화 여섯 장을 한 텍스처(3×2 칸)에 — 집마다 uv 칸만 다르다 (재질 하나)
  const muralM = k.std({
    color: "#ffffff",
    roughness: 0.9,
    glow: ["#ffd9a8", 0.12],
    map: canvasTex(192, 128, (cx) => {
      palette.forEach(([base, fig], j) => {
        const ox = (j % 3) * 64, oy = Math.floor(j / 3) * 64;
        cx.fillStyle = base;
        cx.fillRect(ox, oy, 64, 64);
        for (let q = 0; q < 4; q++) {
          cx.fillStyle = fig[q % fig.length];
          cx.beginPath();
          cx.arc(ox + 8 + k.rnd() * 48, oy + 10 + k.rnd() * 44, 6 + k.rnd() * 9, 0, 6.3);
          cx.fill();
        }
        cx.fillStyle = "rgba(255,255,255,.7)";
        cx.fillRect(ox + 6, oy + 40, 52, 4);
      });
    }),
  });
  const roofs = ["#3f6fa8", "#c8503c", "#3f8a6a", "#e0a23a", "#6a5aa8", "#2f8a9a"];
  const door = P.mat({ color: "#5a4632" });
  [[0.25, 2.25], [0.55, 2.3], [0.85, 2.3], [1.15, 2.25], [0.4, 1.7], [0.75, 1.75], [1.05, 1.65], [0.6, 1.2]].forEach(([a, r], i) => {
    const hg = place(g, [Math.cos(a) * r, Math.sin(a) * r * 0.78, -a + Math.PI / 2, 1], hillY(r) - 0.06);
    const j = i % 6;
    add(hg, atlasUV(new THREE.BoxGeometry(0.5, 0.36, 0.4), j % 3, 1 - Math.floor(j / 3), 3, 2), muralM, 0, 0.18, 0);
    add(hg, tint(new THREE.BoxGeometry(0.58, 0.05, 0.48), roofs[j]), P.VC, 0, 0.385, 0).rotation.x = 0.12;
    add(hg, new THREE.BoxGeometry(0.12, 0.18, 0.02), door, 0.12, 0.09, 0.205);
    add(hg, new THREE.BoxGeometry(0.12, 0.1, 0.02), M.WIN, -0.12, 0.2, 0.205).castShadow = false;
  });
  // 소나무·단풍 (벽화마을 쪽 사면은 비운다) — 월드 좌표로 놓되 사면 높이에 앉힌다
  for (let i = 0; i < 16; i++) {
    const a = k.rnd() * 6.28;
    if (Math.sin(a) < -0.5 || (a > 0.05 && a < 1.4)) continue;
    const r = 1.1 + k.rnd() * 1.3, kind = k.rnd() < 0.65 ? "pine" : "maple";
    P.tree(g, kind, Math.cos(a) * r, Math.sin(a) * r * 0.78, 0.75, Math.max(0, 1.5 - (r / 2.75) * 1.4 - 0.15));
  }
}

/** 풍남문: 석축 홍예문 + 여장 + 2층 문루 + 반달 옹성 + 성벽 자락 */
export function buildGate(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P, g = place(parent, SITES.gate, TOP);
  const stoneB = k.std({
    color: "#ffffff",
    roughness: 0.95,
    map: canvasTex(
      256,
      128,
      (c, w, h) => {
        c.fillStyle = "#c9c0ae";
        c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16)
          for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 24) {
            c.fillStyle = ["#bdb3a0", "#d3cbbb", "#b1a793"][Math.floor(k.rnd() * 3)];
            c.fillRect(x + 1, y + 1, 22, 14);
          }
      },
      { repeat: [2, 1] },
    ),
  });
  add(g, new THREE.BoxGeometry(3.0, 0.9, 1.2), stoneB, 0, 0.45, 0);
  const dark = P.mat({ color: "#2a2622" });
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.5, 0.42, 0.02), dark, 0, 0.21, s * 0.605).castShadow = false;
    add(g, new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), dark, 0, 0.42, s * 0.605).rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.2, 0.14, 0.1), stoneB, -1.4 + i * 0.28, 0.97, s * 0.55);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), M.RED, -1.0 + i * 0.5, 1.18, s * 0.35);
  add(g, new THREE.BoxGeometry(2.1, 0.05, 0.8), M.WOOD, 0, 0.92, 0);
  P.giwa(g, 2.8, 1.4, 0.32, 0, 1.45, 0, 0.16);
  add(g, new THREE.BoxGeometry(1.5, 0.4, 0.6), M.PLASTER, 0, 1.78, 0);
  for (let i = 0; i < 4; i++) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6), M.RED, -0.69 + i * 0.46, 1.78, 0.31);
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.3, 0.2, 0.02), M.WIN, -0.46 + i * 0.46, 1.8, 0.31).castShadow = false;
  P.giwa(g, 2.2, 1.15, 0.5, 0, 1.98, 0, 0.2);
  const ongM = stoneB.clone();
  ongM.side = THREE.DoubleSide;
  add(g, new THREE.CylinderGeometry(1.25, 1.25, 0.7, 32, 1, true, Math.PI / 2 + 0.55, Math.PI - 1.1), ongM, 0, 0.35, 0.55);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(1.2, 0.6, 0.9), stoneB, s * 2.05, 0.3, 0);
  glowSprite(P, "rgba(255,190,120,.45)", 4, 2.6, 0, 1.2, 0.8, g);
}

/** 전동성당: 붉은 벽돌 + 회색 석재 띠 + 비잔틴 돔 종탑 3 + 장미창 + 아치 창 (밤엔 스테인드글라스 빛) */
export function buildCathedral(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = place(parent, SITES.cathedral, TOP);
  const brickM = k.std({
    color: "#ffffff",
    roughness: 0.9,
    glow: ["#ffae7a", 0.35],
    map: canvasTex(
      256,
      256,
      (c, w, h) => {
        c.fillStyle = "#9e4a36";
        c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 8)
          for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) {
            c.fillStyle = ["#a8533e", "#93432f", "#b25a43"][Math.floor(k.rnd() * 3)];
            c.fillRect(x + 1, y + 1, 14, 6);
          }
        c.fillStyle = "#d8d2c6";
        for (const y of [60, 140, 220]) c.fillRect(0, y, w, 6);
      },
      { repeat: [2, 1.4] },
    ),
  });
  const domeM = P.mat({ color: dn("#6f8a86", "#7f9a96"), roughness: 0.5, metalness: 0.2 });
  const stone = P.mat({ color: "#d8d2c6" });
  add(g, new THREE.BoxGeometry(1.7, 1.25, 3.2), brickM, 0, 0.62, -0.6);
  const rf = new THREE.Shape();
  rf.moveTo(-0.95, 0);
  rf.lineTo(0.95, 0);
  rf.lineTo(0, 0.55);
  rf.closePath();
  const rg = new THREE.ExtrudeGeometry(rf, { depth: 3.2, bevelEnabled: false });
  rg.translate(0, 0, -1.6);
  add(g, rg, P.mat({ color: dn("#5f6470", "#55586a") }), 0, 1.25, -0.6);
  const glass = P.mat({ color: dn("#36424f", "#ffcf8a"), roughness: 0.3, glow: ["#ffb070", 1.5] });
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.38, 0.16), glass, s * 0.86, 0.6, -1.9 + i * 0.5).castShadow = false;
  add(g, new THREE.BoxGeometry(0.8, 2.3, 0.8), brickM, 0, 1.15, 1.1);
  add(g, new THREE.CylinderGeometry(0.42, 0.44, 0.45, 8), brickM, 0, 2.52, 1.1);
  add(g, new THREE.SphereGeometry(0.43, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1), domeM, 0, 2.74, 1.1);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), stone, 0, 3.45, 1.1);
  add(g, new THREE.BoxGeometry(0.18, 0.025, 0.025), stone, 0, 3.52, 1.1);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.42, 1.7, 0.42), brickM, s * 0.75, 0.85, 1.0);
    add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8), brickM, s * 0.75, 1.84, 1.0);
    add(g, new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1), domeM, s * 0.75, 1.97, 1.0);
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), stone, s * 0.75, 2.36, 1.0);
  }
  const doorM = P.mat({ color: "#3a2a22" });
  add(g, new THREE.BoxGeometry(0.34, 0.5, 0.02), doorM, 0, 0.25, 1.51).castShadow = false;
  add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), doorM, 0, 0.5, 1.51).rotation.x = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), glass, 0, 1.2, 1.51).rotation.x = Math.PI / 2;
  for (const y of [0.9, 1.6, 2.0]) add(g, new THREE.BoxGeometry(0.84, 0.05, 0.84), stone, 0, y, 1.1);
  glowSprite(P, "rgba(255,180,120,.35)", 3.2, 3.2, 0, 1.6, 1.8, g);
  glowSprite(P, "rgba(255,180,120,.35)", 3.5, 3.5, 0, 0.8, 0.2, g);
}

/** 경기전: 담장 + 삼문 + 홍살문(태극) + 월대 위 붉은 기둥 정전 + 대숲 + 은행나무 + 한복 인형 셋 */
export function buildGyeonggi(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P, { x: cx, z: cz, w, d } = GYEONGGI;
  const root = new THREE.Group();
  parent.add(root);
  P.wall(root, [cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2]);
  P.wall(root, [cx - w / 2, cz - d / 2], [cx - w / 2, cz + d / 2]);
  P.wall(root, [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2]);
  P.wall(root, [cx - w / 2, cz + d / 2], [cx - 0.45, cz + d / 2]);
  P.wall(root, [cx + 0.45, cz + d / 2], [cx + w / 2, cz + d / 2]);
  // 삼문
  const gt = place(root, [cx, cz + d / 2, 0, 1], TOP);
  for (const s of [-1, 1]) add(gt, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), M.RED, s * 0.38, 0.25, 0);
  add(gt, new THREE.BoxGeometry(0.7, 0.42, 0.04), M.RED, 0, 0.26, 0);
  P.giwa(gt, 1.05, 0.5, 0.18, 0, 0.5, 0, 0.1);
  // 홍살문
  const hs = place(root, [cx, cz + d / 2 + 1.0, 0, 1], TOP);
  for (const s of [-1, 1]) add(hs, new THREE.CylinderGeometry(0.04, 0.045, 1.35, 8), M.RED, s * 0.62, 0.675, 0);
  for (const y of [1.0, 1.22]) add(hs, new THREE.BoxGeometry(1.36, 0.05, 0.05), M.RED, 0, y, 0);
  for (let i = 0; i < 13; i++) add(hs, new THREE.BoxGeometry(0.022, 0.42, 0.022), M.RED, -0.54 + i * 0.09, 1.38, 0);
  const taeguk = canvasTex(64, 64, (c) => {
    c.fillStyle = "#c8322a";
    c.beginPath();
    c.arc(32, 32, 30, Math.PI, 0);
    c.fill();
    c.fillStyle = "#24479a";
    c.beginPath();
    c.arc(32, 32, 30, 0, Math.PI);
    c.fill();
  });
  add(hs, new THREE.CircleGeometry(0.11, 20), k.std({ color: "#ffffff", map: taeguk, transparent: true }), 0, 1.36, 0.03).castShadow = false;
  // 정전: 월대 + 붉은 기둥 큰 전각
  add(root, new RoundedBoxGeometry(2.9, 0.22, 1.7, 2, 0.04), M.STONE, cx, TOP + 0.11, cz - 0.35);
  P.hanok(root, cx, cz - 0.45, 0, 2.3, 1.0, { red: true, wallH: 0.72, roofH: 0.55, lift: 0.2 }).position.y = TOP + 0.08;
  // 대숲
  const bamboo = P.mat({ color: dn("#5f8f48", "#3f5f3a") }), bLeaf = P.mat({ color: dn("#5a9a4c", "#35553a") });
  for (let i = 0; i < 42; i++) {
    const x = cx - 2.2 + k.rnd() * 1.1, z = cz - 1.2 + k.rnd() * 2.3, h = 1.0 + k.rnd() * 0.6;
    add(root, new THREE.CylinderGeometry(0.015, 0.018, h, 5), bamboo, x, TOP + h / 2, z);
    const lf = new THREE.SphereGeometry(0.13, 8, 6);
    lf.scale(1, 1.8, 1);
    add(root, lf, bLeaf, x, TOP + h - 0.05, z);
  }
  P.tree(root, "ginkgo", cx + 1.9, cz - 0.9, 1.15);
  P.tree(root, "ginkgo", cx + 1.9, cz + 0.6, 0.9);
  // 한복 입은 목각 인형 셋 (홍살문 앞)
  const skin = P.mat({ color: "#f2dcc4" }), hair = P.mat({ color: "#2a2420" });
  for (const [x, z, top, skirt] of [[cx - 0.5, cz + d / 2 + 1.5, "#f2d9e6", "#c8325a"], [cx - 0.15, cz + d / 2 + 1.6, "#fff2c8", "#2f5aa8"], [cx + 0.9, cz + d / 2 + 1.35, "#e7f0dd", "#6b3f8a"]] as const) {
    add(root, tint(new THREE.ConeGeometry(0.1, 0.24, 14), skirt), P.VC, x, TOP + 0.12, z);
    add(root, tint(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), top), P.VC, x, TOP + 0.28, z);
    add(root, new THREE.SphereGeometry(0.055, 12, 10), skin, x, TOP + 0.38, z);
    add(root, new THREE.SphereGeometry(0.057, 12, 10, 0, 6.3, 0, 1.4), hair, x, TOP + 0.4, z - 0.005);
  }
}
