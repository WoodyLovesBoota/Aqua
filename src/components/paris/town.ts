import * as THREE from "three";
import { place } from "@/components/diorama/fx";
import { add, canvasTex, type Kit, radialTex } from "@/components/diorama/kit";
import { HAUSSMANN, hwAt, riverFrame, SITES, tAtX, TOP } from "./layout";
import { alongRiver, type Parts, tint } from "./parts";

/**
 * 거리: 오스만 건물 2채(사용자 규칙 — 한 양식으로 채우지 않는다) + 센강 쪽 카페 테라스 · 샹젤리제 가로수·가로등 ·
 * 튈르리·샹드마르스 나무 · 모리스 기둥 · 기마르 메트로 입구 · 월리스 분수 · 부키니스트 녹색 상자 · 강둑 가로등 · 벚꽃·마로니에 · 밤 빛 웅덩이.
 */
export function buildTown(k: Kit, P: Parts, parent: THREE.Object3D) {
  const { M } = P;
  const root = new THREE.Group();
  parent.add(root);

  // ── 오스만 건물 2채: 면 순서 +x, −x(큰길), +y, −y, +z(센강 쪽), −z ──
  const { x: hx, w, h } = HAUSSMANN;
  for (const [z, cols] of HAUSSMANN.rows) {
    const g = place(root, [hx, z, 0, 1], TOP);
    const d = cols * 0.27;
    const fac = P.facade(cols, 6, { balc: [1, 4], shop: true, lit: 0.6 });
    const side = P.facade(4, 6, { balc: [1, 4], shop: true, lit: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [fac, fac, M.LIME, M.LIME, side, side]);
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    P.mansard(g, w, d, 0.36, h);
    P.pools.push([hx - 0.95, z, 1.4]);
  }
  // 카페: 두 번째 건물 센강 쪽 1층 — 빨간 차양 + 원탁·의자 + 밤 탁자 등
  {
    const [z, cols] = HAUSSMANN.rows[1];
    const g = place(root, [hx, z + (cols * 0.27) / 2, 0, 1], TOP);
    const awn = canvasTex(64, 32, (c, cw) => {
      c.fillStyle = "#b8302d";
      c.fillRect(0, 0, cw, 32);
      c.fillStyle = "#f2e4c8";
      c.font = "bold 14px Georgia, serif";
      c.textAlign = "center";
      c.fillText("CAFÉ", cw / 2, 21);
    });
    add(g, new THREE.BoxGeometry(1.1, 0.015, 0.34), M.RED, 0, 0.36, 0.165).rotation.x = 0.35;
    add(g, new THREE.PlaneGeometry(1.1, 0.08), k.std({ color: "#ffffff", map: awn, emissiveMap: awn, glow: ["#ffffff", 0.5] }), 0, 0.3, 0.33).castShadow = false;
    const TABLE = P.mat({ color: "#c9c4b8", metalness: 0.4, roughness: 0.4 }), CHAIR = P.mat({ color: "#7a4a2a" });
    const candle = k.nightOnly(k.std({ color: "#fff1c8", glow: ["#ffc56b", 3.2] }));
    for (let i = 0; i < 3; i++) {
      const x = -0.36 + i * 0.36, tz = 0.42;
      add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.015, 12), TABLE, x, 0.17, tz);
      add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.17, 5), M.IRON, x, 0.085, tz);
      for (const s of [-1, 1]) {
        add(g, new THREE.BoxGeometry(0.06, 0.012, 0.06), CHAIR, x + s * 0.11, 0.1, tz);
        add(g, new THREE.BoxGeometry(0.01, 0.08, 0.06), CHAIR, x + s * 0.14, 0.14, tz);
      }
      add(g, new THREE.SphereGeometry(0.015, 6, 4), candle, x, 0.19, tz).castShadow = false;
    }
    P.pools.push([hx, z + (cols * 0.27) / 2 + 0.4, 1.6]);
  }

  // ── 샹젤리제 가로수·가로등 ──
  for (let i = 0; i < 6; i++) {
    P.tree(root, "plane", 5.85, -2.6 + i * 0.85, 0.62);
    P.tree(root, "plane", 7.25, -2.6 + i * 0.85, 0.62);
    P.lamp(root, 6.15, -2.2 + i * 0.85, i % 2 === 0);
    P.lamp(root, 6.95, -2.2 + i * 0.85, i % 2 === 1);
  }
  // 튈르리 쪽 마로니에 줄 + 가로등, 샹드마르스 플라타너스 줄
  for (let i = 0; i < 6; i++) P.tree(root, "chestnut", 1.0 + i * 0.6, 1.95, 0.6);
  for (let i = 0; i < 4; i++) P.lamp(root, 1.2 + i * 1.0, 1.55);
  for (let i = 0; i < 4; i++) for (const x of [-8.75, -4.45]) P.tree(root, "plane", x, -2.0 + i * 0.75, 0.75);

  // ── 모리스 기둥 (포스터 원통 + 녹색 돔) ──
  {
    const g = place(root, SITES.morris, TOP);
    const poster = canvasTex(128, 64, (c, cw, ch) => {
      const cs = ["#e0b14a", "#c6453a", "#3a6ea5", "#f1e6cc", "#2f5a45"];
      for (let i = 0; i < 8; i++) {
        c.fillStyle = cs[i % 5];
        c.fillRect((i * cw) / 8, 0, cw / 8 - 2, ch);
        c.fillStyle = "rgba(0,0,0,.3)";
        c.fillRect((i * cw) / 8 + 3, 10, cw / 8 - 8, 4);
      }
    });
    add(g, new THREE.CylinderGeometry(0.15, 0.15, 0.48, 16), k.std({ color: "#ffffff", map: poster, roughness: 0.8 }), 0, 0.26, 0);
    add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), M.GREEN, 0, 0.02, 0);
    add(g, new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), M.GREEN, 0, 0.52, 0);
    add(g, new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1), M.GREEN, 0, 0.54, 0);
    add(g, new THREE.SphereGeometry(0.03, 8, 6), M.GREEN, 0, 0.7, 0);
  }
  // ── 기마르 메트로 입구 (계단 구멍 + 녹색 난간 + 휘는 줄기 둘 + 주황 등 + 간판) ──
  {
    const g = place(root, SITES.metro, TOP);
    add(g, new THREE.BoxGeometry(0.42, 0.02, 0.6), P.mat({ color: "#3a3534" }), 0, 0.012, 0).castShadow = false;
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.1, 0.6), M.GREEN, s * 0.22, 0.06, 0);
    const bulb = P.mat({ color: "#ff9a4a", roughness: 0.4, glow: ["#ff8a30", 3] });
    for (const s of [-1, 1]) {
      const pts = [new THREE.Vector3(s * 0.22, 0, -0.3), new THREE.Vector3(s * 0.23, 0.35, -0.3), new THREE.Vector3(s * 0.16, 0.55, -0.3), new THREE.Vector3(s * 0.05, 0.56, -0.3)];
      add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.015, 5), M.GREEN);
      add(g, new THREE.SphereGeometry(0.035, 8, 6).scale(0.8, 1.2, 0.8), bulb, s * 0.12, 0.52, -0.3);
    }
    const mt = canvasTex(128, 20, (c, cw) => {
      c.fillStyle = "#f2dc8a";
      c.fillRect(0, 0, cw, 20);
      c.fillStyle = "#2f5a45";
      c.font = "bold 13px Georgia";
      c.textAlign = "center";
      c.fillText("METROPOLITAIN", cw / 2, 15);
    });
    add(g, new THREE.PlaneGeometry(0.34, 0.06), k.std({ color: "#ffffff", map: mt, emissiveMap: mt, side: THREE.DoubleSide, glow: ["#ffffff", 0.8] }), 0, 0.45, -0.3).castShadow = false;
    P.pools.push([SITES.metro[0], SITES.metro[1] - 0.2, 1.0]);
  }
  // ── 월리스 분수 (녹색 받침 + 기둥 넷 + 돔) ──
  {
    const g = place(root, SITES.wallace, TOP);
    add(g, new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8), M.GREEN, 0, 0.03, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), M.GREEN, Math.cos(a) * 0.06, 0.18, Math.sin(a) * 0.06);
    }
    add(g, new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.GREEN, 0, 0.3, 0);
  }

  // ── 부키니스트: 강둑 녹색 상자 (뚜껑 열림 + 책 줄, 책은 정점색 한 재질) ──
  for (const tt of [0.6, 0.64, 0.68, 0.88, 0.92]) {
    const { p, tg, n } = riverFrame(tt), off = -(hwAt(tt) + 0.32);
    const g = place(root, [p.x + n.x * off, p.y + n.y * off, alongRiver(tg), 1], TOP);
    add(g, new THREE.BoxGeometry(0.42, 0.1, 0.16), M.GREEN, 0, 0.2, 0);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.15, 0.02), M.GREEN, s * 0.18, 0.075, 0);
    add(g, new THREE.BoxGeometry(0.42, 0.02, 0.16), M.GREEN, 0, 0.32, -0.08).rotation.x = -1.1;
    const cs = ["#c6453a", "#e0b14a", "#3a6ea5", "#f1e6cc", "#6a8a4a"];
    for (let i = 0; i < 9; i++) add(g, tint(new THREE.BoxGeometry(0.035, 0.03, 0.11), cs[Math.floor(k.rnd() * 5)]), P.VC, -0.17 + i * 0.042, 0.265, 0).castShadow = false;
  }

  // ── 강둑 가로등 (양쪽, 시테섬 앞은 비운다) ──
  for (let i = 0; i < 9; i++) {
    for (const [x0, side] of [[-8.2, -1], [-8.6, 1]] as const) {
      const x = x0 + i * 2.0, t = tAtX(x), { p, n } = riverFrame(t), off = side * (hwAt(t) + 0.45);
      const lx = p.x + n.x * off, lz = p.y + n.y * off;
      if (side < 0 && Math.abs(x - 5) < 1.2) continue;
      if (lz > -6.3 && lz < 6.35) P.lamp(root, lx, lz);
    }
  }
  // ── 나무: 강둑 벚꽃·마로니에 + 빈 자리 ──
  for (const [x, z, kind] of [
    [-8.3, 6.0, "cherry"], [-6.6, 6.0, "cherry"], [-4.4, 5.85, "chestnut"], [-1.6, 5.6, "cherry"], [0.6, 5.0, "cherry"], [2.6, 5.15, "chestnut"], [7.6, 5.95, "cherry"], [8.9, 5.9, "chestnut"],
    [-8.8, 2.0, "cherry"], [3.6, -2.7, "cherry"], [4.6, -3.8, "chestnut"], [-3.9, -4.2, "chestnut"], [-4.8, -5.6, "cherry"], [9.0, -3.2, "plane"], [9.0, -5.3, "cherry"], [-2.4, -5.8, "plane"],
  ] as const)
    P.tree(root, kind, x, z, 0.7);

  // ── 밤: 가로등·랜드마크 아래 따뜻한 빛 웅덩이 (재질 하나 → 병합 한 드로우) ──
  const poolMat = P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,190,120,.5)", "rgba(255,190,120,0)"), transparent: true }));
  const decals = () => {
    for (const [x, z, s] of P.pools) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(s, s), poolMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, TOP + 0.04, z);
      d.renderOrder = 3;
      root.add(d);
    }
  };
  return { root, decals };
}
