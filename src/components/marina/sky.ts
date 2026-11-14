import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTex, keepDynamic, type Kit } from "@/components/diorama/kit";
import { BLOCK, TOP } from "./layout";

/** 젤리 뚜껑: 블록 벽을 위로 이은 투명 큐브. 먼 벽(뒷면)에 하늘 — 낮/밤 두 장을 교차하고, 밤엔 별·달, 낮엔 솜 구름 */
export function buildSky(k: Kit) {
  const root = new THREE.Group();
  const { W, D, LID_H } = BLOCK;
  const geo = new RoundedBoxGeometry(W + 0.28, LID_H, D + 0.28, 5, 1.0);
  const grad = (stops: [number, string][]) =>
    canvasTex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      for (const [o, c] of stops) gr.addColorStop(o, c);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  const dayTex = grad([[0, "#86bff0"], [0.7, "#cde6f8"], [1, "#f4f1ea"]]);
  const nightTex = grad([[0, "#151b47"], [0.5, "#3f4389"], [0.8, "#b97aa5"], [1, "#f3b58e"]]);
  const y = TOP + LID_H / 2 - 0.05;
  const backDay = new THREE.Mesh(geo, k.dayOnly(new THREE.MeshBasicMaterial({ map: dayTex, side: THREE.BackSide, transparent: true, opacity: 0.78, depthWrite: false })));
  const backNight = new THREE.Mesh(geo, k.nightOnly(new THREE.MeshBasicMaterial({ map: nightTex, side: THREE.BackSide, transparent: true, opacity: 0.96, depthWrite: false })));
  for (const m of [backDay, backNight]) {
    m.position.y = y;
    m.renderOrder = -1;
    root.add(m);
  }
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.07, roughness: 0.04, clearcoat: 1, depthWrite: false }));
  front.position.y = y;
  root.add(front);

  // 별: 뒷벽 두 면 위쪽
  const pos: number[] = [];
  for (let i = 0; i < 110; i++) {
    const yy = TOP + LID_H * (0.42 + k.rnd() * 0.55);
    if (k.rnd() < 0.5) pos.push(-W / 2 + 0.1, yy, -D / 2 + 0.6 + k.rnd() * (D - 1.5));
    else pos.push(-W / 2 + 1 + k.rnd() * (W - 2), yy, -D / 2 + 0.1);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  root.add(new THREE.Points(sg, k.nightOnly(new THREE.PointsMaterial({ color: "#ffffff", size: 0.08, transparent: true, opacity: 0.9 }))));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), k.nightOnly(new THREE.MeshBasicMaterial({ color: "#d8cfb6", transparent: true })));
  moon.position.set(-2.6, TOP + LID_H * 0.84, -D / 2 + 0.7);
  root.add(moon);

  // 구름 (천천히 흐른다)
  const cm = k.dayOnly(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.93 }));
  const clouds: THREE.Group[] = [];
  for (const [x, yy, z] of [[-4.6, 6.6, -6.6], [-1.0, 7.0, -6.7], [4.5, 6.4, -6.6], [-9.6, 6.1, -1.6]]) {
    const cl = keepDynamic(new THREE.Group());
    cl.position.set(x, yy, z);
    root.add(cl);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + k.rnd() * 0.25, 14, 10), cm);
      s.position.set(i * 0.45 - 0.7, k.rnd() * 0.15, 0);
      s.scale.z = 0.4;
      cl.add(s);
    }
    clouds.push(cl);
  }
  const base = clouds.map((c) => c.position.x);
  const tick = (t: number) =>
    clouds.forEach((c, i) => {
      if (c.position.z < -6) c.position.x = base[i] + Math.sin(t * 0.03 + i) * 0.8;
      else c.position.z = -1.6 + Math.sin(t * 0.03 + i) * 0.8;
    });
  return { root, tick };
}
