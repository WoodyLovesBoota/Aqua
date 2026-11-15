import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTex, keepDynamic, type Kit, radialTex } from "@/components/diorama/kit";
import { BLOCK, TOP } from "./layout";

/** 젤리 뚜껑 + 봄 하늘(낮/밤 교차) + 초승달·별(밤) + 구름(낮) + 흩날리는 벚꽃잎 */
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
  const backDay = new THREE.Mesh(geo, k.dayOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#86b8e8"], [0.7, "#d6e6f3"], [1, "#fbeee0"]]), side: THREE.BackSide, transparent: true, opacity: 0.8, depthWrite: false })));
  const backNight = new THREE.Mesh(geo, k.nightOnly(new THREE.MeshBasicMaterial({ map: grad([[0, "#111a46"], [0.55, "#2c3b80"], [0.85, "#6a5f9a"], [1, "#e0a27c"]]), side: THREE.BackSide, transparent: true, opacity: 0.96, depthWrite: false })));
  for (const m of [backDay, backNight]) {
    m.position.y = y;
    m.renderOrder = -1;
    root.add(keepDynamic(m));
  }
  const front = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.07, roughness: 0.04, clearcoat: 1, depthWrite: false }));
  front.position.y = y;
  root.add(keepDynamic(front));

  // 초승달 + 달무리 + 별 (밤). 달 판의 투명한 부분이 깊이를 쓰면 뒤 달무리를 가린다 → depthWrite 끔
  const moonTex = canvasTex(128, 128, (c) => {
    c.fillStyle = "#fff1c8";
    c.beginPath();
    c.arc(64, 64, 60, 0, 6.3);
    c.fill();
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    c.arc(88, 50, 56, 0, 6.3);
    c.fill();
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), k.nightOnly(new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false })));
  moon.position.set(3.4, TOP + 5.6, -D / 2 + 0.05);
  moon.renderOrder = 1;
  const halo = new THREE.Sprite(k.nightOnly(new THREE.SpriteMaterial({ map: radialTex("rgba(255,236,190,.35)", "rgba(255,236,190,0)"), blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.set(3, 3, 1);
  halo.position.copy(moon.position).setZ(moon.position.z + 0.02);
  root.add(keepDynamic(moon), halo);
  const sp: number[] = [];
  for (let i = 0; i < 120; i++) {
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
  for (const [x, yy, z] of [[-1.6, 6.6, -6.6], [3.6, 7.0, -6.7], [7.8, 6.4, -6.6], [-9.0, 5.6, 1.6]])
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 + k.rnd() * 0.25, 14, 10), cm);
      s.position.set(x + i * 0.45 - 0.7, yy + k.rnd() * 0.15, z);
      s.scale.z = 0.4;
      clouds.add(s);
    }

  // 벚꽃잎: 바람에 비스듬히 흩날리며 내려오고 바닥에 닿으면 다시 위로
  const N = 260, H = 3.6;
  const base = new Float32Array(N * 3), pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    base[i * 3] = (k.rnd() - 0.5) * (W - 1);
    base[i * 3 + 1] = k.rnd() * H;
    base[i * 3 + 2] = (k.rnd() - 0.5) * (D - 1);
    speed[i] = 0.1 + k.rnd() * 0.1;
  }
  const pg = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  pg.setAttribute("position", attr);
  const petalMat = new THREE.PointsMaterial({ color: "#f7c3d3", size: 0.075 });
  k.tintColor(petalMat.color, "#f7c3d3", "#c79ab4");
  const petals = new THREE.Points(pg, petalMat);
  petals.frustumCulled = false;
  root.add(petals);

  let last = 0;
  const halfW = (W - 1) / 2;
  const tick = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    for (let i = 0; i < N; i++) {
      let yy = base[i * 3 + 1] - speed[i] * dt;
      if (yy < 0) yy += H;
      base[i * 3 + 1] = yy;
      let x = base[i * 3] + speed[i] * 0.6 * dt; // 서풍
      if (x > halfW) x -= 2 * halfW;
      base[i * 3] = x;
      pos[i * 3] = x + Math.sin(t * 1.7 + i * 2.1) * 0.12;
      pos[i * 3 + 1] = TOP + 0.3 + yy;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 1.3 + i) * 0.1;
    }
    attr.needsUpdate = true;
    clouds.position.x = Math.sin(t * 0.03) * 0.3;
  };
  tick(0);
  return { root, tick, clouds };
}
