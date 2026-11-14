import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTex, keepDynamic, type Kit, radialTex } from "@/components/diorama/kit";
import { BLOCK, TOP } from "./layout";

/** 젤리 뚜껑 + 가을 하늘(낮/밤 교차) + 보름달·별(밤) + 구름(낮) + 흩날리며 떨어지는 은행잎 */
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
  const backDay = new THREE.Mesh(geo, k.dayOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#7fb4e6"], [0.7, "#cfe3f2"], [1, "#f7ecd8"]]), side: THREE.BackSide, transparent: true, opacity: 0.8, depthWrite: false })));
  const backNight = new THREE.Mesh(geo, k.nightOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#141a44"], [0.55, "#33377a"], [0.85, "#7a5f8f"], [1, "#d99a7a"]]), side: THREE.BackSide, transparent: true, opacity: 0.96, depthWrite: false })));
  for (const m of [backDay, backNight]) {
    m.position.y = y;
    m.renderOrder = -1;
    root.add(keepDynamic(m));
  }
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.07, roughness: 0.04, clearcoat: 1, depthWrite: false }));
  front.position.y = y;
  root.add(keepDynamic(front));

  // 보름달 + 달무리 + 별 (밤)
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), k.nightOnly(new THREE.MeshBasicMaterial({ color: "#fff1c8", transparent: true })));
  moon.position.set(-1.8, TOP + 5.1, -D / 2 + 0.05);
  const halo = new THREE.Sprite(k.nightOnly(new THREE.SpriteMaterial({ map: radialTex("rgba(255,236,190,.5)", "rgba(255,236,190,0)"), blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.set(4, 4, 1);
  halo.position.copy(moon.position);
  root.add(keepDynamic(moon), halo);
  const sp: number[] = [];
  for (let i = 0; i < 110; i++) {
    const yy = TOP + LID_H * (0.45 + k.rnd() * 0.5);
    if (k.rnd() < 0.5) sp.push(-W / 2 + 0.1, yy, -D / 2 + 0.6 + k.rnd() * (D - 1.5));
    else sp.push(-W / 2 + 1 + k.rnd() * (W - 2), yy, -D / 2 + 0.1);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  root.add(new THREE.Points(sg, k.nightOnly(new THREE.PointsMaterial({ color: "#ffffff", size: 0.07, transparent: true }))));

  // 구름 (낮, 한 그룹)
  const cm = k.dayOnly(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.92 }));
  const clouds = keepDynamic(new THREE.Group());
  root.add(clouds);
  for (const [x, yy, z] of [[-4.6, 6.7, -6.6], [0.8, 7.0, -6.7], [5.2, 6.5, -6.6], [-8.0, 6.2, -1.2]])
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + k.rnd() * 0.25, 14, 10), cm);
      s.position.set(x + i * 0.45 - 0.7, yy + k.rnd() * 0.15, z);
      s.scale.z = 0.4;
      clouds.add(s);
    }

  // 은행잎: 나무 높이쯤에서 팔랑이며 떨어지고 바닥에 닿으면 다시 위로
  const N = 240, H = 3.6;
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = (k.rnd() - 0.5) * (W - 1);
    base[i * 3 + 1] = k.rnd() * H;
    base[i * 3 + 2] = (k.rnd() - 0.5) * (D - 1);
    speed[i] = 0.12 + k.rnd() * 0.12;
  }
  const lg = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  lg.setAttribute("position", attr);
  const leafMat = new THREE.PointsMaterial({ color: "#f0b828", size: 0.095 });
  k.tintColor(leafMat.color, "#f0b828", "#c99a3a");
  const leaves = new THREE.Points(lg, leafMat);
  leaves.frustumCulled = false;
  root.add(leaves);

  let last = 0;
  const tick = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    for (let i = 0; i < N; i++) {
      let yy = base[i * 3 + 1] - speed[i] * dt;
      if (yy < 0) yy += H;
      base[i * 3 + 1] = yy;
      pos[i * 3] = base[i * 3] + Math.sin(t * 1.4 + i * 2.1) * 0.15; // 팔랑임
      pos[i * 3 + 1] = TOP + 0.3 + yy;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 1.1 + i) * 0.1;
    }
    attr.needsUpdate = true;
    clouds.position.x = Math.sin(t * 0.03) * 0.3;
  };
  tick(0);
  return { root, tick, clouds };
}
