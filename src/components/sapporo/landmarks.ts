import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, type Kit, radialTex, strut } from "@/components/diorama/kit";
import { dayHour } from "@/components/sea/dayCycle";
import { ODORI, SITES, TOP } from "./layout";
import { type Parts, place } from "./parts";

/** 삿포로 TV 타워: 주황 격자 철탑(X 가새·수평 띠·아치 다리) + 전망대 + 디지털 시계(전시 시각) + 안테나 표시등. 밤엔 철탑 조명 */
export function buildTower(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = place(parent, SITES.tower, TOP);
  const steel = P.mat({ color: dn("#e0582e", "#ff9a6a"), roughness: 0.5, metalness: 0.3, glow: ["#ff8c4a", 1.6] });
  const H1 = 3.0, H2 = 5.0, B = 0.62, M = 0.22, T2 = 0.1;
  const corner = (h: number, half: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(sx * half, h, sz * half));
  const halfAt = (h: number) => (h <= H1 ? THREE.MathUtils.lerp(B, M, Math.pow(h / H1, 0.8)) : THREE.MathUtils.lerp(M, T2, (h - H1) / (H2 - H1)));
  const levels = [0, 0.45, 0.95, 1.5, 2.1, 2.6, 3.0, 3.6, 4.2, 5.0];
  for (let L = 0; L < levels.length - 1; L++) {
    const a = corner(levels[L], halfAt(levels[L])), b = corner(levels[L + 1], halfAt(levels[L + 1]));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      strut(g, steel, a[i], b[i], 0.03 - L * 0.002, 0.03 - L * 0.002, 5);
      strut(g, steel, a[i], b[j], 0.012); // X 가새
      strut(g, steel, a[j], b[i], 0.012);
      strut(g, steel, b[i], b[j], 0.014); // 수평 띠
    }
  }
  // 아치 다리: 네 면
  for (let i = 0; i < 4; i++) {
    const m = add(g, new THREE.TorusGeometry(0.42, 0.03, 6, 24, Math.PI), steel, Math.sin((i * Math.PI) / 2) * B * 0.86, 0.02, Math.cos((i * Math.PI) / 2) * B * 0.86);
    m.rotation.y = (i * Math.PI) / 2;
  }
  // 전망대 (유리 띠)
  const deckGlass = P.mat({ color: dn("#9fc4d6", "#ffe8b8"), roughness: 0.15, metalness: 0.3, glow: ["#ffd98a", 1.8] });
  add(g, new THREE.BoxGeometry(0.62, 0.32, 0.62), deckGlass, 0, H1 + 0.02, 0);
  add(g, new RoundedBoxGeometry(0.72, 0.06, 0.72, 2, 0.02), steel, 0, H1 + 0.21, 0);
  add(g, new RoundedBoxGeometry(0.72, 0.06, 0.72, 2, 0.02), steel, 0, H1 - 0.17, 0);
  P.snowCap(g, 0.7, 0.7, 0, H1 + 0.27, 0, 0.05);
  // 디지털 시계: 전시 시각(dayHour)을 분이 바뀔 때만 다시 그린다
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 96;
  const clock = new THREE.CanvasTexture(cv);
  clock.colorSpace = THREE.SRGBColorSpace;
  clock.anisotropy = 8;
  let shown = "";
  const draw = (text: string) => {
    const c = cv.getContext("2d");
    if (!c || text === shown) return;
    shown = text;
    c.fillStyle = "#121216";
    c.fillRect(0, 0, 256, 96);
    c.fillStyle = "#f4f8ff";
    c.font = "bold 64px Menlo, monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 128, 52);
    clock.needsUpdate = true;
  };
  const hhmm = () => {
    const h = dayHour(), m = Math.floor((h % 1) * 60);
    return `${String(Math.floor(h)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  draw(hhmm());
  const clockM = P.mat({ color: "#ffffff", map: clock, emissiveMap: clock, glow: ["#ffffff", 1.6], dayGlow: 0.6 });
  for (let i = 0; i < 2; i++) {
    const pl = add(g, new THREE.PlaneGeometry(0.62, 0.23), clockM, 0, 2.55, 0);
    pl.rotation.y = (i * Math.PI) / 2;
    pl.translateZ(0.42);
  }
  // 안테나 + 꼭대기 표시등
  add(g, new THREE.CylinderGeometry(0.012, 0.03, 0.8, 6), P.mat({ color: "#f2f2f2" }), 0, H2 + 0.4, 0);
  add(g, new THREE.SphereGeometry(0.05, 8, 6), P.mat({ color: "#ff3b3b", glow: ["#ff3b3b", 4], dayGlow: 0.8 }), 0, H2 + 0.82, 0);
  // 밤: 철탑 조명 점
  const pts: number[] = [];
  for (let i = 0; i < 120; i++) {
    const h = k.rnd() * H2, c = corner(h, halfAt(h)), sd = Math.floor(k.rnd() * 4), t = k.rnd();
    const a = c[sd], b = c[(sd + 1) % 4];
    pts.push(a.x + (b.x - a.x) * t, h, a.z + (b.z - a.z) * t);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.Points(pg, P.nightAdd(new THREE.PointsMaterial({ color: "#ffe2b0", size: 0.06, transparent: true }))));
  return { tick: () => draw(hhmm()) };
}

/** 오도리 공원 눈축제: 공원 띠 + 눈 성(계단 기단·본채·탑 4·아치문, 밤엔 분홍/하늘 조명) + 얼음 조각 3 + 큰 눈사람 + 미끄럼틀 + 꼬마전구 나무 줄 */
export function buildOdori(k: Kit, P: Parts, parent: THREE.Object3D) {
  const root = new THREE.Group();
  parent.add(root);
  add(root, new RoundedBoxGeometry(10.2, 0.05, 2.2, 3, 0.2), P.mat({ color: dn("#eef3fb", "#c9d4f2") }), ODORI.x, TOP + 0.02, ODORI.z);
  add(root, new THREE.BoxGeometry(10, 0.012, 0.25), P.mat({ color: dn("#b9b7b3", "#8c8fa8") }), ODORI.x, TOP + 0.05, ODORI.z);
  // 눈 성
  const sn = P.mat({ color: dn("#ffffff", "#e4ebff"), roughness: 0.75, glow: ["#7da6ff", 0.55] });
  const cg = place(root, SITES.castle, TOP);
  for (let i = 0; i < 3; i++) add(cg, new RoundedBoxGeometry(2.6 - i * 0.5, 0.22, 1.2 - i * 0.18, 3, 0.06), sn, 0, 0.11 + i * 0.22, 0);
  add(cg, new RoundedBoxGeometry(1.2, 0.8, 0.7, 3, 0.08), sn, 0, 1.06, 0);
  for (const [x, z] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) {
    add(cg, new THREE.CylinderGeometry(0.16, 0.18, 1.2, 16), sn, x, 1.0, z);
    add(cg, new THREE.ConeGeometry(0.2, 0.36, 16), sn, x, 1.78, z);
  }
  P.gable(cg, 1.2, 0.7, 0.35, sn, 0, 1.46, 0, 0.06);
  add(cg, new THREE.ConeGeometry(0.16, 0.5, 16), sn, 0, 2.0, 0);
  const dark = P.mat({ color: dn("#c9d6e8", "#5a6aa8"), glow: ["#9fb6ff", 0.6] });
  add(cg, new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16, 1, false, 0, Math.PI), dark, 0, 0.9, 0.36).rotation.x = Math.PI / 2;
  add(cg, new THREE.BoxGeometry(0.36, 0.25, 0.02), dark, 0, 0.78, 0.36);
  // 밤 프로젝션 매핑 느낌: 분홍·하늘 빛
  for (const [c, x] of [["rgba(255,140,220,.45)", -0.6], ["rgba(120,190,255,.5)", 0.6]] as const) {
    const sp = new THREE.Sprite(P.nightAdd(new THREE.SpriteMaterial({ map: radialTex(c, "rgba(0,0,0,0)") })));
    sp.scale.set(2.2, 2.2, 1);
    sp.position.set(x, 1.1, 0.7);
    cg.add(sp);
  }
  // 얼음 조각: 투명한 수정 기둥 무리 (투과 렌더 패스를 피해 반투명 + 밤 발광)
  const iceM = P.mat({ color: "#d6f2ff", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.8, glow: ["#5fc8ff", 1.6], dayGlow: 0.15 });
  for (const [x, z, s] of [[-2.0, -2.6, 1], [-1.3, -3.1, 0.8], [4.0, -2.4, 0.9]]) {
    const ig = place(root, [x, z, 0, 1.3], TOP);
    add(ig, new RoundedBoxGeometry(0.6 * s, 0.12, 0.6 * s, 2, 0.03), iceM, 0, 0.06, 0);
    for (let j = 0; j < 5; j++) {
      const c = new THREE.OctahedronGeometry(0.16 * s, 0);
      c.scale(0.7, 2.4 + k.rnd(), 0.7);
      const m = add(ig, c, iceM, (k.rnd() - 0.5) * 0.35 * s, 0.4 * s + k.rnd() * 0.1, (k.rnd() - 0.5) * 0.35 * s);
      m.rotation.set((k.rnd() - 0.5) * 0.4, k.rnd() * 3, (k.rnd() - 0.5) * 0.4);
      m.castShadow = false;
    }
  }
  // 큰 눈사람
  const sm = place(root, SITES.snowman, TOP);
  add(sm, new THREE.SphereGeometry(0.42, 24, 16), P.SNOW, 0, 0.38, 0);
  add(sm, new THREE.SphereGeometry(0.3, 24, 16), P.SNOW, 0, 0.9, 0);
  add(sm, new THREE.SphereGeometry(0.21, 24, 16), P.SNOW, 0, 1.3, 0);
  add(sm, new THREE.TorusGeometry(0.2, 0.05, 8, 24).rotateX(Math.PI / 2), P.mat({ color: "#d8402f" }), 0, 1.13, 0);
  const hat = P.mat({ color: "#2c3d6b" });
  add(sm, new THREE.CylinderGeometry(0.12, 0.14, 0.18, 16), hat, 0, 1.52, 0);
  add(sm, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), hat, 0, 1.43, 0);
  const coal = P.mat({ color: "#222222" });
  for (const s of [-1, 1]) add(sm, new THREE.SphereGeometry(0.025, 8, 6), coal, s * 0.07, 1.36, 0.19);
  add(sm, new THREE.ConeGeometry(0.03, 0.14, 8).rotateX(Math.PI / 2), P.mat({ color: "#f08a3c" }), 0, 1.3, 0.24);
  // 눈 미끄럼틀
  const slide = new THREE.Shape();
  slide.moveTo(0, 0);
  slide.lineTo(0, 0.55);
  slide.lineTo(0.25, 0.55);
  slide.quadraticCurveTo(0.5, 0.1, 1.2, 0);
  slide.closePath();
  add(root, new THREE.ExtrudeGeometry(slide, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }), P.SNOW, -3.6, TOP, -3.3).rotation.y = 0.2;
  // 꼬마전구 나무 줄 (공원 양쪽, 성 뒤는 비움)
  const bark = P.mat({ color: dn("#6b5a4c", "#3a3340") });
  const bulbs: number[] = [];
  for (let i = 0; i < 9; i++)
    for (const side of [-1, 1]) {
      const x = -3.4 + i * 1.2, z = ODORI.z + side * 1.0;
      if (Math.abs(x - 1.6) < 1.5 && side < 0) continue;
      add(root, new THREE.CylinderGeometry(0.025, 0.04, 0.6, 6), bark, x, TOP + 0.3, z);
      for (let j = 0; j < 5; j++) {
        const a = j * 1.26 + k.rnd();
        const br = add(root, new THREE.CylinderGeometry(0.008, 0.016, 0.38, 4), bark, x + Math.cos(a) * 0.1, TOP + 0.68, z + Math.sin(a) * 0.1);
        br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      P.snowCap(root, 0.22, 0.22, x, TOP + 0.88, z, 0.05);
      for (let j = 0; j < 14; j++) bulbs.push(x + (k.rnd() - 0.5) * 0.45, TOP + 0.45 + k.rnd() * 0.45, z + (k.rnd() - 0.5) * 0.45);
    }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute(bulbs, 3));
  root.add(new THREE.Points(bg, P.nightAdd(new THREE.PointsMaterial({ color: "#bfe0ff", size: 0.07, transparent: true }))));
}

/** 시계탑(도케이다이): 흰 판자벽 2층 + 붉은 박공 + 창 + 현관 포치 + 종루(시계 4면·첨탑) + 붉은 별 + 앞 울타리 */
export function buildClockTower(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = place(parent, SITES.clock, TOP);
  const clap = canvasTex(
    128,
    128,
    (c, w, h) => {
      c.fillStyle = "#f7f4ee";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(120,110,95,.35)";
      c.lineWidth = 2;
      for (let y = 4; y < h; y += 8) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
    },
    { repeat: [3, 2] },
  );
  const wallM = P.mat({ color: "#ffffff", map: clap, glow: ["#ffe8c4", 0.25] });
  const roofM = P.mat({ color: dn("#b4483c", "#a3473d"), roughness: 0.6 });
  const trim = P.mat({ color: "#5c6b5e" });
  add(g, new THREE.BoxGeometry(1.8, 1.1, 1.2), wallM, 0, 0.55, 0);
  P.gable(g, 1.8, 1.2, 0.5, roofM, 0, 1.1, 0, 0.1);
  P.gableSnow(g, 1.8, 1.2, 0.5, 0, 1.1, 0, 0.1);
  const winM = P.mat({ color: dn("#4d6a7a", "#ffd28c"), roughness: 0.3, glow: ["#ffc070", 2.2] });
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 4; i++) {
      add(g, new THREE.BoxGeometry(0.2, 0.28, 0.02), winM, -0.6 + i * 0.4, 0.3 + r * 0.5, 0.61);
      add(g, new THREE.BoxGeometry(0.26, 0.04, 0.03), trim, -0.6 + i * 0.4, 0.13 + r * 0.5, 0.62);
    }
  add(g, new THREE.BoxGeometry(0.5, 0.45, 0.3), wallM, 0, 0.22, 0.75);
  P.gable(g, 0.5, 0.3, 0.18, roofM, 0, 0.45, 0.75, 0.05);
  // 종루
  const bt = new THREE.Group();
  bt.position.set(0, 1.25, 0.35);
  g.add(bt);
  add(bt, new THREE.BoxGeometry(0.44, 0.5, 0.44), wallM, 0, 0.25, 0);
  const face = canvasTex(128, 128, (c) => {
    c.fillStyle = "#fbfaf4";
    c.beginPath();
    c.arc(64, 64, 60, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#2a2a2a";
    c.lineWidth = 6;
    c.stroke();
    c.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.beginPath();
      c.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
      c.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54);
      c.stroke();
    }
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(64, 64);
    c.lineTo(64, 28);
    c.stroke();
    c.beginPath();
    c.moveTo(64, 64);
    c.lineTo(92, 74);
    c.stroke();
  });
  const faceM = P.mat({ color: "#ffffff", map: face, emissiveMap: face, transparent: true, glow: ["#fff1d2", 1.3] });
  for (let i = 0; i < 4; i++) {
    const pl = add(bt, new THREE.CircleGeometry(0.17, 32), faceM, Math.sin((i * Math.PI) / 2) * 0.225, 0.27, Math.cos((i * Math.PI) / 2) * 0.225);
    pl.rotation.y = (i * Math.PI) / 2;
    pl.castShadow = false;
  }
  add(bt, new THREE.BoxGeometry(0.34, 0.3, 0.34), wallM, 0, 0.65, 0);
  add(bt, new THREE.ConeGeometry(0.3, 0.42, 4).rotateY(Math.PI / 4), roofM, 0, 1.0, 0);
  add(bt, new THREE.ConeGeometry(0.31, 0.12, 4).rotateY(Math.PI / 4), P.SNOW, 0, 0.86, 0);
  const iron = P.mat({ color: "#3f3f46" });
  add(bt, new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), iron, 0, 1.3, 0);
  // 붉은 별 (앞 박공)
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.035 : 0.085, a = (i * Math.PI) / 5 + Math.PI / 2;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  add(g, new THREE.ExtrudeGeometry(star, { depth: 0.015, bevelEnabled: false }), P.mat({ color: "#d8302a", glow: ["#ff4a3a", 1.5] }), 0, 1.33, 0.67);
  // 앞 울타리
  for (let i = 0; i < 12; i++) add(g, new THREE.BoxGeometry(0.03, 0.18, 0.03), iron, -1.1 + i * 0.2, 0.09, 1.25);
  add(g, new THREE.BoxGeometry(2.3, 0.02, 0.02), iron, 0, 0.15, 1.25);
}

/** 아카렌가(옛 홋카이도 청사): 붉은 벽돌 본채 + 날개 + 회청 박공 + 흰 아치 창틀 18 + 현관 + 팔각 탑·돔·랜턴 */
export function buildAkarenga(k: Kit, P: Parts, parent: THREE.Object3D) {
  const g = place(parent, SITES.akarenga, TOP);
  const brick = canvasTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = "#b3503c";
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8)
        for (let x = (y / 8) % 2 ? -8 : 0; x < w; x += 16) {
          c.fillStyle = ["#a8452f", "#ba5843", "#9e3f2c"][Math.floor(k.rnd() * 3)];
          c.fillRect(x + 1, y + 1, 14, 6);
        }
    },
    { repeat: [3, 1.5] },
  );
  const brickM = P.mat({ color: "#ffffff", map: brick, roughness: 0.9, glow: ["#ffb27a", 0.25] });
  const roofM = P.mat({ color: dn("#5f6f7a", "#4f5b66"), roughness: 0.6 });
  const white = P.mat({ color: "#f5f1e8" });
  add(g, new THREE.BoxGeometry(3.0, 1.0, 1.1), brickM, 0, 0.5, 0);
  for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.5, 1.1, 1.25), brickM, s * 1.35, 0.55, 0);
  P.gable(g, 3.0, 1.1, 0.42, roofM, 0, 1.0, 0, 0.08);
  P.gableSnow(g, 3.0, 1.1, 0.42, 0, 1.0, 0, 0.08);
  for (const s of [-1, 1]) {
    P.gable(g, 0.5, 1.25, 0.32, roofM, s * 1.35, 1.1, 0, 0.05);
    P.snowCap(g, 0.45, 1.25, s * 1.35, 1.32, 0, 0.05);
  }
  const winM = P.mat({ color: dn("#3e5563", "#ffd892"), roughness: 0.3, glow: ["#ffca7a", 1.8] });
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 9; i++) {
      const x = -1.2 + i * 0.3;
      add(g, new THREE.BoxGeometry(0.14, 0.26, 0.02), winM, x, 0.3 + r * 0.45, 0.56);
      add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.025, 12, 1, false, -Math.PI / 2, Math.PI), white, x, 0.44 + r * 0.45, 0.565).rotation.x = Math.PI / 2;
    }
  add(g, new THREE.BoxGeometry(0.6, 0.6, 0.25), brickM, 0, 0.3, 0.65);
  P.gable(g, 0.6, 0.25, 0.2, roofM, 0, 0.6, 0.65, 0.04);
  add(g, new THREE.CylinderGeometry(0.3, 0.32, 0.55, 8), brickM, 0, 1.55, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    add(g, new THREE.BoxGeometry(0.1, 0.2, 0.02), winM, Math.sin(a) * 0.3, 1.58, Math.cos(a) * 0.3).rotation.y = a;
  }
  add(g, new THREE.SphereGeometry(0.34, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofM, 0, 1.82, 0);
  add(g, new THREE.SphereGeometry(0.35, 8, 8, 0, Math.PI * 2, 0, Math.PI / 5), P.SNOW, 0, 1.83, 0);
  add(g, new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), white, 0, 2.25, 0);
  add(g, new THREE.ConeGeometry(0.08, 0.16, 8), roofM, 0, 2.43, 0);
}
