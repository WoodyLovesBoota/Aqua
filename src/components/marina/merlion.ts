import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, keepDynamic, type Kit, sweep } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/**
 * 머라이언: 두 겹 갈기 사자 머리 · 비늘 S 몸통 · 등 능선 · 말려 오르는 꼬리 + 부채 지느러미, 파도 마루 받침,
 * 입에서 만으로 떨어지는 굵은 물줄기(물보라·파문). 옆에 풀러턴 호텔(열주·창).
 */
export function buildMerlion(k: Kit) {
  const root = new THREE.Group();
  const { x, z, ry, scale } = SITES.merlion;
  const g = new THREE.Group();
  g.position.set(x, TOP, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  root.add(g);
  const stoneW = k.std({ color: "#f6f3ec", roughness: 0.5, glow: ["#fff1d8", 0.55] });
  const scales = canvasTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = "#f4f1ea";
      c.fillRect(0, 0, w, h);
      for (let y = -16; y < h + 16; y += 14)
        for (let xx = ((y / 14) % 2 ? 9 : 0) - 18; xx < w + 18; xx += 18) {
          const gr = c.createRadialGradient(xx, y + 2, 2, xx, y, 11);
          gr.addColorStop(0, "rgba(255,255,255,0)");
          gr.addColorStop(1, "rgba(150,138,120,.28)");
          c.fillStyle = gr;
          c.beginPath();
          c.arc(xx, y, 10, 0, Math.PI);
          c.fill();
        }
    },
    { repeat: [3, 4] },
  );
  const scaleM = k.std({ color: "#ffffff", map: scales, bumpMap: scales, bumpScale: 0.6, roughness: 0.5, glow: ["#fff1d8", 0.45] });

  // 받침: 2단 돌 + 물결치는 파도 마루 고리 두 겹
  add(g, new THREE.CylinderGeometry(0.42, 0.48, 0.1, 32), k.std({ color: "#cbc3b4" }), 0, 0.05, 0);
  add(g, new THREE.CylinderGeometry(0.34, 0.4, 0.1, 32), k.std({ color: "#ddd6c9" }), 0, 0.15, 0);
  for (const [rr, y0, amp, kk] of [[0.33, 0.22, 0.035, 7], [0.24, 0.29, 0.03, 5]]) {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(a) * rr, y0 + amp * Math.sin(a * kk), Math.sin(a) * rr));
    }
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 200, 0.06, 10, true), stoneW);
  }
  // 몸통: 받침에서 S 로 일어나 가슴을 내밀고 머리로
  const spine = [new THREE.Vector3(-0.18, 0.22, 0), new THREE.Vector3(-0.02, 0.36, 0), new THREE.Vector3(0.04, 0.6, 0), new THREE.Vector3(0.0, 0.86, 0), new THREE.Vector3(0.05, 1.0, 0)];
  add(g, sweep(spine, (t) => 0.13 + 0.06 * Math.sin(t * Math.PI) - 0.03 * t, 18, 30), scaleM);
  const spineC = new THREE.CatmullRomCurve3(spine);
  const ridge: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const p = spineC.getPointAt(0.15 + i * 0.055);
    ridge.push(new THREE.Vector3(p.x - 0.15 + 0.02 * Math.sin(i), p.y, p.z));
  }
  add(g, sweep(ridge, (t) => 0.025 * Math.sin(t * Math.PI) + 0.008, 8, 20, 0.35), stoneW);
  // 꼬리 + 부채 지느러미
  const tail = [new THREE.Vector3(-0.18, 0.22, 0), new THREE.Vector3(-0.38, 0.24, 0.02), new THREE.Vector3(-0.5, 0.36, 0.04), new THREE.Vector3(-0.52, 0.52, 0.04)];
  add(g, sweep(tail, (t) => 0.1 * (1 - t) + 0.025, 12, 18), scaleM);
  const fan = new THREE.Shape();
  fan.moveTo(0, 0);
  fan.quadraticCurveTo(-0.2, 0.12, -0.16, 0.28);
  fan.quadraticCurveTo(-0.05, 0.2, 0, 0.3);
  fan.quadraticCurveTo(0.05, 0.2, 0.16, 0.28);
  fan.quadraticCurveTo(0.2, 0.12, 0, 0);
  const fanG = new THREE.ExtrudeGeometry(fan, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  add(g, fanG, stoneW, -0.52, 0.5, 0.03).rotation.set(0, Math.PI / 2, 0.15);
  for (const s of [-1, 1]) {
    const pf = new THREE.SphereGeometry(0.08, 12, 8);
    pf.scale(1, 0.3, 0.45);
    add(g, pf, stoneW, 0.06, 0.5, s * 0.19).rotation.set(s * 0.6, 0, -0.5);
  }
  // 머리: 둥근 두개 + 두 겹 갈기 + 주둥이·코·벌린 입·눈·귀
  const H = new THREE.Group();
  H.position.set(0.07, 1.08, 0);
  g.add(H);
  add(H, new THREE.SphereGeometry(0.16, 24, 18), stoneW);
  for (const [ring, rr, n, sz] of [[0, 0.17, 14, 0.06], [1, 0.22, 16, 0.055]]) {
    const lobe = new THREE.SphereGeometry(sz, 10, 8);
    lobe.scale(1, 1.25, 0.8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.2;
      if (Math.cos(a) > 0.82 && ring === 0) continue;
      add(H, lobe, stoneW, -0.04 - ring * 0.03, Math.sin(a) * rr, Math.cos(a) * rr).rotation.x = -a;
    }
  }
  add(H, new RoundedBoxGeometry(0.15, 0.1, 0.13, 3, 0.045), stoneW, 0.14, -0.03, 0);
  add(H, new THREE.SphereGeometry(0.03, 10, 8), k.std({ color: "#e8e1d4" }), 0.22, 0, 0);
  add(H, new RoundedBoxGeometry(0.06, 0.03, 0.08, 2, 0.012), k.std({ color: "#5a4d44" }), 0.2, -0.07, 0);
  const eye = k.std({ color: "#2f2a26", roughness: 0.2 });
  for (const s of [-1, 1]) {
    add(H, new THREE.SphereGeometry(0.022, 10, 8), eye, 0.12, 0.06, s * 0.08);
    add(H, new THREE.ConeGeometry(0.04, 0.07, 6), stoneW, -0.02, 0.15, s * 0.1).rotation.x = s * 0.4;
  }
  // 물줄기 + 물보라 + 파문
  const jet = k.std({ color: "#e4f8ff", transparent: true, opacity: 0.82, roughness: 0.1, glow: ["#9be5ff", 1.6], dayGlow: 0.25 });
  const jetE = new THREE.Color("#4fb3cc"), jetN = new THREE.Color("#9be5ff");
  k.onNight((n) => jet.emissive.copy(jetE).lerp(jetN, n));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    pts.push(new THREE.Vector3(0.3 + t * 1.55, 1.01 + t * 0.3 - t * t * 1.3, 0));
  }
  add(g, sweep(pts, (t) => 0.03 + t * 0.035, 12, 36), jet).castShadow = false;
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const d = add(g, new THREE.SphereGeometry(0.01 + k.rnd() * 0.016, 6, 4), jet, 1.75 + k.rnd() * 0.3, -0.12 + k.rnd() * 0.22, (k.rnd() - 0.5) * 0.35);
    d.castShadow = false;
    drops.push(keepDynamic(d));
  }
  const rings: THREE.Mesh[] = [];
  for (const r of [0.12, 0.22, 0.32]) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 4, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 - r }));
    m.position.set(1.85, -0.15, 0);
    g.add(keepDynamic(m));
    rings.push(m);
  }

  // 풀러턴 호텔
  const f = SITES.fullerton;
  const fg = new THREE.Group();
  fg.position.set(f.x, TOP, f.z);
  fg.rotation.y = f.ry;
  root.add(fg);
  const stone = k.std({ color: dn("#efe4cc", "#f4e4c4"), roughness: 0.7, glow: ["#ffcf86", 0.45] });
  add(fg, new RoundedBoxGeometry(1.4, 0.8, 2.2, 2, 0.04), stone, 0, 0.4, 0);
  add(fg, new THREE.BoxGeometry(1.5, 0.08, 2.3), stone, 0, 0.84, 0);
  add(fg, new THREE.BoxGeometry(1.1, 0.12, 1.9), stone, 0, 0.94, 0);
  const col = k.std({ color: "#fbf6ea" });
  for (let i = 0; i < 9; i++) add(fg, new THREE.CylinderGeometry(0.035, 0.04, 0.62, 10), col, 0.74, 0.37, -0.95 + i * 0.237);
  const win = k.std({ color: dn("#6f8796", "#ffd892"), glow: ["#ffcc78", 2] });
  for (let j = 0; j < 2; j++) for (let i = 0; i < 8; i++) add(fg, new THREE.BoxGeometry(0.02, 0.12, 0.1), win, 0.71, 0.25 + j * 0.3, -0.84 + i * 0.237);

  /** 물보라 반짝임 + 파문 퍼짐 */
  const tick = (t: number) => {
    drops.forEach((d, i) => (d.position.y = -0.12 + ((t * 0.9 + i * 0.137) % 1) * 0.22));
    rings.forEach((m, i) => {
      const p = (t * 0.6 + i / 3) % 1;
      m.scale.setScalar(0.4 + p * 1.4);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - p);
    });
  };
  return { root, tick };
}
