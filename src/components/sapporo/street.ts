import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, dn, keepDynamic, type Kit, radialTex } from "@/components/diorama/kit";
import { LAMPS, SITES, TOP, TRAM } from "./layout";
import { makePuffs, type Parts, place } from "./parts";

/**
 * 거리: 눈 등롱 길(온천 → 시계탑 → 아카렌가) · 노면전차(선로·전차선·왕복하는 2색 전차) · 스케이트장(스케이터 2) ·
 * 라멘 야타이(김) · 침엽수·자작나무·눈 무더기·작은 눈사람 · 가로등 · 밤의 빛 웅덩이.
 */
export function buildStreet(k: Kit, P: Parts, parent: THREE.Object3D) {
  const root = new THREE.Group();
  parent.add(root);
  const lanterns: [number, number][] = [];

  // ── 눈 등롱 길 ──
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.4, 0, 5.6), new THREE.Vector3(-2.4, 0, 4.9), new THREE.Vector3(0.2, 0, 5.2), new THREE.Vector3(2.4, 0, 5.8), new THREE.Vector3(3.6, 0, 6.0)]);
  add(root, new THREE.TubeGeometry(path, 120, 0.22, 4, false).scale(1, 0.05, 1), P.mat({ color: dn("#d9d6cf", "#a9afc9") }), 0, TOP + 0.02, 0);
  const lanM = P.mat({ color: "#f4f6ff", glow: ["#ffbf6a", 2.4] });
  for (let i = 0; i <= 10; i++) {
    const p = path.getPointAt(i / 10), t = path.getTangentAt(i / 10), n = new THREE.Vector3(-t.z, 0, t.x);
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(n, s * 0.38);
      add(root, new THREE.CylinderGeometry(0.09, 0.11, 0.2, 10), lanM, q.x, TOP + 0.1, q.z);
      add(root, new THREE.SphereGeometry(0.095, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), P.SNOW, q.x, TOP + 0.2, q.z);
      lanterns.push([q.x, q.z]);
    }
  }

  // ── 노면전차 ──
  const { z: z0, x0, x1 } = TRAM;
  add(root, new THREE.BoxGeometry(x1 - x0, 0.015, 0.7), P.mat({ color: dn("#bdbab4", "#8d93ad") }), (x0 + x1) / 2, TOP + 0.01, z0);
  const railM = P.mat({ color: "#70737e", metalness: 0.7, roughness: 0.3 });
  for (const o of [-0.17, 0.17]) add(root, new THREE.BoxGeometry(x1 - x0, 0.025, 0.03), railM, (x0 + x1) / 2, TOP + 0.03, z0 + o);
  const tie = P.mat({ color: "#6b5a4c" });
  for (let x = x0 + 0.2; x < x1; x += 0.22) add(root, new THREE.BoxGeometry(0.06, 0.012, 0.5), tie, x, TOP + 0.02, z0);
  const pole = P.mat({ color: "#3a3b44" });
  for (let x = x0 + 0.6; x < x1; x += 2.2) {
    add(root, new THREE.CylinderGeometry(0.018, 0.022, 1.1, 6), pole, x, TOP + 0.55, z0 - 0.5);
    add(root, new THREE.BoxGeometry(0.03, 0.03, 0.55), pole, x, TOP + 1.05, z0 - 0.25);
  }
  add(root, new THREE.CylinderGeometry(0.004, 0.004, x1 - x0, 4).rotateZ(Math.PI / 2), pole, (x0 + x1) / 2, TOP + 1.0, z0);
  // 전차: 아래 진초록·위 크림, 둥근 지붕, 창 띠, 헤드라이트, 팬터그래프 — 통째로 움직이므로 따로 병합
  const tram = keepDynamic(new THREE.Group());
  tram.position.set(0.9, TOP + 0.06, z0);
  root.add(tram);
  const green = P.mat({ color: "#2f6b4f", roughness: 0.5 }), cream = P.mat({ color: "#f1e7cf", roughness: 0.5 });
  add(tram, new RoundedBoxGeometry(1.7, 0.26, 0.48, 3, 0.06), green, 0, 0.2, 0);
  add(tram, new RoundedBoxGeometry(1.7, 0.28, 0.48, 3, 0.06), cream, 0, 0.45, 0);
  const roof = new THREE.CylinderGeometry(0.26, 0.26, 1.66, 16, 1, false, 0, Math.PI);
  roof.rotateZ(Math.PI / 2);
  roof.scale(1, 0.4, 1);
  add(tram, roof, cream, 0, 0.58, 0);
  P.snowCap(tram, 1.5, 0.36, 0, 0.7, 0, 0.05);
  const win = P.mat({ color: dn("#3e5563", "#ffe0a0"), roughness: 0.2, glow: ["#ffcf80", 2.2] });
  for (const s of [-1, 1]) add(tram, new THREE.BoxGeometry(1.5, 0.15, 0.01), win, 0, 0.46, s * 0.245);
  for (const s of [-1, 1]) add(tram, new THREE.BoxGeometry(0.01, 0.15, 0.36), win, s * 0.855, 0.46, 0);
  const head = P.mat({ color: "#fff6d8", glow: ["#fff1c0", 4], dayGlow: 0.5 });
  for (const s of [-1, 1]) add(tram, new THREE.SphereGeometry(0.035, 10, 8), head, s * 0.86, 0.22, 0);
  add(tram, new THREE.BoxGeometry(0.3, 0.02, 0.02), pole, 0, 0.85, 0).rotation.z = 0.5;
  add(tram, new THREE.BoxGeometry(0.3, 0.02, 0.02), pole, 0.12, 0.9, 0).rotation.z = -0.5;
  const beamMat = P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,236,190,.55)", "rgba(255,236,190,0)"), transparent: true }));
  const beams = [-1, 1].map((s) => keepDynamic(P.decal(tram, beamMat, s * 1.4, -0.04, 0, 1.2, 0.6))); // 진행 방향만 켜므로 병합하지 않는다

  // ── 스케이트장 ──
  const rg = place(root, SITES.rink, TOP);
  const rink = new THREE.CircleGeometry(1.0, 48);
  rink.rotateX(-Math.PI / 2);
  rink.scale(1.3, 1, 0.75);
  add(rg, rink, k.phys({ color: dn("#dff1fb", "#a9c8ee"), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, metalness: 0.1, glow: ["#6fa8ff", 0.4] }), 0, 0.02, 0);
  const bank: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    bank.push(new THREE.Vector3(Math.cos(a) * 1.36, 0.05, Math.sin(a) * 0.79));
  }
  add(rg, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bank, true), 96, 0.09, 8, true), P.SNOW);
  const skin = P.mat({ color: "#f2dcc4" }), scarf = P.mat({ color: "#f2f2f2" });
  // 스케이터 둘: 한 원판에 마주 세워 원판째 돈다 (그룹 하나 = 재질 수만큼의 드로우)
  const skaters = keepDynamic(new THREE.Group());
  rg.add(skaters);
  for (const [a, r, c] of [[0, 0.55, "#d8402f"], [Math.PI * 0.9, 0.42, "#2c5fa0"]] as const) {
    const m = P.mat({ color: c }), x = Math.cos(a) * r, z = Math.sin(a) * r;
    add(skaters, new THREE.CapsuleGeometry(0.06, 0.14, 4, 10), m, x, 0.18, z);
    add(skaters, new THREE.SphereGeometry(0.055, 12, 10), skin, x, 0.36, z);
    add(skaters, new THREE.SphereGeometry(0.058, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, x, 0.37, z);
    add(skaters, new THREE.TorusGeometry(0.05, 0.015, 6, 16).rotateX(Math.PI / 2), scarf, x, 0.29, z);
  }
  const ring: number[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    ring.push(Math.cos(a) * 1.45, 0.35 + 0.05 * Math.sin(a * 6), Math.sin(a) * 0.86);
  }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute("position", new THREE.Float32BufferAttribute(ring, 3));
  rg.add(new THREE.Points(rgeo, P.nightAdd(new THREE.PointsMaterial({ color: "#ffe6a8", size: 0.07, transparent: true }))));

  // ── 라멘 야타이 ──
  const yg = place(root, SITES.yatai, TOP);
  const woodM = P.mat({ color: "#8a5a3a" }), dark = P.mat({ color: "#4e3524" });
  add(yg, new THREE.BoxGeometry(1.0, 0.36, 0.5), woodM, 0, 0.3, 0);
  for (const s of [-1, 1]) add(yg, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16).rotateX(Math.PI / 2), dark, s * 0.32, 0.13, 0.27);
  for (const [x, z] of [[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]]) add(yg, new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), dark, x, 0.75, z);
  add(yg, new THREE.BoxGeometry(1.2, 0.05, 0.7), dark, 0, 1.02, 0);
  P.snowCap(yg, 1.15, 0.65, 0, 1.08, 0, 0.06);
  add(yg, new THREE.BoxGeometry(1.0, 0.18, 0.01), P.mat({ color: "#c9372c", glow: ["#ff6a4a", 0.6] }), 0, 0.9, 0.25);
  add(yg, new THREE.CapsuleGeometry(0.08, 0.1, 6, 12), P.mat({ color: "#e8473a", roughness: 0.6, glow: ["#ff8a4a", 3] }), 0.56, 0.86, 0.2);
  const stool = P.mat({ color: "#6b5a4c" });
  for (let i = 0; i < 3; i++) add(yg, new THREE.CylinderGeometry(0.06, 0.08, 0.14, 10), stool, -0.6 + i * 0.25, 0.07, 0.55);
  const puffs = makePuffs(5, radialTex("rgba(255,255,255,.5)", "rgba(255,255,255,0)"));
  yg.add(puffs.points);
  P.decal(yg, P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,170,110,.5)", "rgba(255,170,110,0)"), transparent: true })), 0, 0.03, 0, 2.2);

  // ── 나무·눈 무더기·작은 눈사람 ──
  const fir = P.mat({ color: dn("#355e49", "#264237") }), birch = P.mat({ color: "#efece4" }), twig = P.mat({ color: "#5a4a42" });
  const firs: [number, number][] = [[-9.0, -0.4], [-8.6, 0.6], [-9.2, 1.6], [-3.2, 0.0], [-2.4, -0.4], [9.0, 0.2], [9.2, 1.6], [8.9, 6.0], [-4.4, -0.6], [-1.6, 5.95], [7.6, -0.6], [9.1, -1.8], [-5.2, 6.05]];
  for (const [x, z] of firs) {
    const s = 0.8 + k.rnd() * 0.6;
    for (let j = 0; j < 4; j++) {
      add(root, new THREE.ConeGeometry(0.34 * s * (1 - j * 0.2), 0.42 * s, 8), fir, x, TOP + (0.26 + j * 0.22) * s, z);
      add(root, new THREE.ConeGeometry(0.3 * s * (1 - j * 0.2), 0.12 * s, 8), P.SNOW, x, TOP + (0.42 + j * 0.22) * s, z);
    }
  }
  for (const [x, z] of [[-1.2, -0.3], [6.8, -0.4], [4.4, -0.5], [1.6, -0.5]]) {
    add(root, new THREE.CylinderGeometry(0.025, 0.035, 0.9, 6), birch, x, TOP + 0.45, z);
    for (let j = 0; j < 5; j++) {
      const br = add(root, new THREE.CylinderGeometry(0.006, 0.012, 0.35, 4), twig, x + Math.cos(j * 1.3) * 0.08, TOP + 0.8 + j * 0.03, z + Math.sin(j * 1.3) * 0.08);
      br.rotation.set(Math.sin(j * 1.3) * 0.7, 0, -Math.cos(j * 1.3) * 0.7);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = -8.8 + k.rnd() * 17.6, z = -5.8 + k.rnd() * 11.8;
    if (x < -4 && z > 1.4) continue; // 온천·료칸 자리
    const d = new THREE.SphereGeometry(0.3 + k.rnd() * 0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    d.scale(1.4, 0.35, 1);
    add(root, d, P.SNOW, x, TOP, z);
  }
  const carrot = P.mat({ color: "#f08a3c" });
  for (const [x, z] of [[-3.0, 6.2], [3.6, 5.2]]) {
    add(root, new THREE.SphereGeometry(0.13, 16, 10), P.SNOW, x, TOP + 0.12, z);
    add(root, new THREE.SphereGeometry(0.09, 16, 10), P.SNOW, x, TOP + 0.3, z);
    add(root, new THREE.ConeGeometry(0.015, 0.06, 6).rotateX(Math.PI / 2), carrot, x, TOP + 0.3, z + 0.1);
  }
  // 가로등
  const lampPole = P.mat({ color: "#2e2f38" }), lamp = P.mat({ color: "#fff3d6", glow: ["#ffd48a", 3] });
  for (const [x, z] of LAMPS) {
    add(root, new THREE.CylinderGeometry(0.015, 0.022, 0.55, 6), lampPole, x, TOP + 0.27, z);
    add(root, new THREE.SphereGeometry(0.05, 10, 8), lamp, x, TOP + 0.57, z);
    P.snowCap(root, 0.1, 0.1, x, TOP + 0.63, z, 0.03);
  }

  // ── 밤: 등불·가로등·건물 앞 눈 위의 따뜻한 빛 웅덩이 ──
  const poolMat = P.nightAdd(new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,196,120,.5)", "rgba(255,196,120,0)"), transparent: true }));
  const spots: [number, number, number][] = [...lanterns.map(([x, z]) => [x, z, 0.42] as [number, number, number]), ...LAMPS.map(([x, z]) => [x, z, 1.3] as [number, number, number]), [-0.7, 3.6, 2.6], [6.4, 5.3, 3.2], [-7.4, 6.1, 2.6], [6.9, -3.3, 2.0], [1.6, -2.4, 3.0]];
  for (const [x, z, s] of spots) P.decal(root, poolMat, x, TOP + 0.03, z, s);

  // 전차: 선로 양 끝 사이를 왕복 (끝에서 천천히 서고 출발), 헤드라이트 빛은 진행 방향만
  const span = (x1 - x0) / 2 - 1.2, mid = (x0 + x1) / 2;
  const tick = (t: number, night: number) => {
    const u = (t / 38) % 1, ph = u * Math.PI * 2;
    tram.position.x = mid - Math.cos(ph) * span;
    const dir = Math.sin(ph) >= 0 ? 1 : -1;
    beams[0].visible = night > 0.01 && dir < 0;
    beams[1].visible = night > 0.01 && dir > 0;
    skaters.rotation.y = -t * 0.4; // 반시계로 한 바퀴 약 16초
    for (let i = 0; i < 5; i++) {
      const v = (t * 0.25 + i / 5) % 1;
      puffs.set(i, -0.2 + v * 0.15 + Math.sin(t + i * 1.8) * 0.05, 0.55 + v * 0.9, 0, 0.35 + v * 0.6, 0.5 * (1 - v) * Math.min(1, v * 5));
    }
    puffs.commit();
  };
  return { tram, skaters, tick };
}
