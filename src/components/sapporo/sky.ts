import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTex, keepDynamic, type Kit, radialTex } from "@/components/diorama/kit";
import { BLOCK, TOP } from "./layout";

/** 젤리 뚜껑 + 겨울 하늘(낮/밤 두 장 교차) + 내리는 눈 + 낮 구름 */
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
  const y = TOP + LID_H / 2 - 0.05;
  const backDay = new THREE.Mesh(geo, k.dayOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#9fb9d8"], [0.7, "#d6e2ef"], [1, "#f2f3f2"]]), side: THREE.BackSide, transparent: true, opacity: 0.82, depthWrite: false })));
  const backNight = new THREE.Mesh(geo, k.nightOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#0f1838"], [0.55, "#283a74"], [0.85, "#5f6fa8"], [1, "#a7b2d8"]]), side: THREE.BackSide, transparent: true, opacity: 0.96, depthWrite: false })));
  for (const m of [backDay, backNight]) {
    m.position.y = y;
    m.renderOrder = -1;
    root.add(keepDynamic(m));
  }
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.08, roughness: 0.04, clearcoat: 1, depthWrite: false }));
  front.position.y = y;
  root.add(keepDynamic(front));

  // 내리는 눈: 뚜껑 안을 천천히 내려와 바닥에 닿으면 위에서 다시 (가로로 살짝 흔들림)
  const N = 1400, H = LID_H - 0.3;
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = (k.rnd() - 0.5) * (W - 0.6);
    base[i * 3 + 1] = k.rnd() * H;
    base[i * 3 + 2] = (k.rnd() - 0.5) * (D - 0.6);
    speed[i] = 0.35 + k.rnd() * 0.3;
  }
  const sg = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute("position", attr);
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, TOP + H / 2, 0), 14);
  const snowMat = new THREE.PointsMaterial({ map: radialTex("rgba(255,255,255,1)", "rgba(255,255,255,0)"), color: "#c9d6ea", size: 0.17, transparent: true, depthWrite: false });
  k.tintColor(snowMat.color, "#c9d6ea", "#ffffff");
  k.onNight((n) => (snowMat.opacity = THREE.MathUtils.lerp(0.9, 0.95, n)));
  root.add(new THREE.Points(sg, snowMat));

  // 낮 구름 (천천히 흐른다)
  const cm = k.dayOnly(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.92 }));
  // 구름 넷은 한 그룹 (한 드로우) 으로 뒷벽을 따라 천천히 오간다
  const clouds = keepDynamic(new THREE.Group());
  root.add(clouds);
  for (const [x, yy, z] of [[-4.6, 6.7, -6.6], [-0.6, 7.0, -6.7], [4.2, 6.6, -6.6], [-8.0, 6.3, -1.0]]) {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + k.rnd() * 0.3, 14, 10), cm);
      s.position.set(x + i * 0.42 - 0.85, yy + k.rnd() * 0.15, z);
      s.scale.z = 0.4;
      clouds.add(s);
    }
  }

  let last = 0;
  const tick = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    for (let i = 0; i < N; i++) {
      let yy = base[i * 3 + 1] - speed[i] * dt;
      if (yy < 0) yy += H;
      base[i * 3 + 1] = yy;
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.6 + i) * 0.12;
      pos[i * 3 + 1] = TOP + yy;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.5 + i * 1.7) * 0.08;
    }
    attr.needsUpdate = true;
    clouds.position.x = Math.sin(t * 0.03) * 0.3; // 왼쪽 벽 구름이 뚜껑을 뚫지 않을 만큼만
  };
  tick(0);
  return { root, tick, clouds };
}
