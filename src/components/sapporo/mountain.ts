import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, dn, type Kit, radialTex, strut } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";
import { type Parts, place } from "./parts";

/**
 * 모이와산: 능선이 진 원뿔형 설산(정점색 = 눈·숲·바위) + 사면 침엽수 + 로프웨이(산기슭역 → 지주 2 → 정상역, 케이블 두 줄, 곤돌라 2).
 * 정상역은 밤에 빛나고 후광이 진다. 블록 안에 들어오도록 가로 0.89 배 (SITES.mountain).
 */
export function buildMountain(k: Kit, P: Parts, parent: THREE.Object3D) {
  const [x, z, , s] = SITES.mountain;
  const g = place(parent, [x, z, 0, 1], TOP);
  g.scale.set(s, 1, s);
  const HM = 4.3, SZ = 0.82;
  const prof = [[0.001, HM], [0.35, HM - 0.08], [0.9, HM - 0.5], [1.6, HM - 1.45], [2.4, HM - 2.6], [3.1, 0.75], [3.5, 0.22], [3.62, 0]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(48), 120);
  geo.scale(1, 1, SZ);
  const p = geo.attributes.position, col: number[] = [];
  const cS = new THREE.Color("#fbfcff"), cF = new THREE.Color("#3f6b55"), cR = new THREE.Color("#8c8a94"), c = new THREE.Color();
  const ss = THREE.MathUtils.smoothstep;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), y = p.getY(i), pz = p.getZ(i), a = Math.atan2(pz / SZ, px);
    // 능선: 각도 방향 주름 (위로 갈수록 날카롭게) + 잔 요철
    const ridge = Math.abs(Math.sin(a * 3.5 + y * 0.6)) * 0.5 + Math.abs(Math.sin(a * 7 - y)) * 0.2;
    const n = Math.sin(px * 3.1 + pz * 2.3) * 0.5 + Math.sin(px * 6.7 - pz * 5.1 + y * 2) * 0.25;
    const rr = Math.hypot(px, pz / SZ), kk = rr < 0.01 ? 1 : 1 + (ridge - 0.35) * 0.16 * Math.min(1, y / 1.2) + n * 0.03;
    p.setXYZ(i, px * kk, y, pz * kk);
    const fw = ss(n + (0.5 - ridge) * 0.6, -0.1, 0.3) * (1 - ss(y, 1.5, 2.6)) * 0.85; // 숲: 아래쪽 골
    const rw = ss(ridge, 0.55, 0.75) * ss(y, 2.0, 2.8) * 0.45; // 바위: 위쪽 능선
    c.copy(cS).lerp(cF, fw).lerp(cR, rw);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // 밤엔 색을 곱해 푸르게 가라앉히고 옅게 빛낸다 (눈은 달빛)
  add(g, geo, P.mat({ color: dn("#ffffff", "#d2d8f0"), vertexColors: true, roughness: 0.95, glow: ["#5866a8", 0.35] }), 0, -0.04, 0);
  const surfY = (r: number) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      if (r <= a.x && r >= b.x) return b.y + ((a.y - b.y) * (r - b.x)) / (a.x - b.x);
    }
    return 0;
  };
  // 사면 침엽수 (뒤쪽은 안 보이니 건너뛴다)
  const fir = P.mat({ color: dn("#355e49", "#264237") });
  for (let i = 0; i < 90; i++) {
    const a = k.rnd() * Math.PI * 2, r = 1.3 + k.rnd() * 2.1;
    if (Math.sin(a) < -0.6) continue;
    const tx = Math.cos(a) * r, tz = Math.sin(a) * r * SZ, y = surfY(r) - 0.12, sc = 0.5 + k.rnd() * 0.4;
    if (y > 2.4) continue;
    for (let j = 0; j < 3; j++) add(g, new THREE.ConeGeometry(0.16 * sc * (1 - j * 0.25), 0.26 * sc, 7), fir, tx, y + (0.12 + j * 0.13) * sc, tz);
    add(g, new THREE.ConeGeometry(0.06 * sc, 0.1 * sc, 7), P.SNOW, tx, y + 0.46 * sc, tz);
  }
  // 로프웨이: 앞오른쪽 사면을 따라, 케이블은 사면보다 위
  const dir = new THREE.Vector2(Math.cos(0.75), Math.sin(0.75) * SZ).normalize();
  const at = (r: number, lift: number) => new THREE.Vector3(dir.x * r, surfY(r) + lift, dir.y * r);
  const stops = [at(3.75, 0.55), at(2.6, 0.75), at(1.5, 0.75), at(0.55, 0.45)];
  const stM = P.mat({ color: "#e7e2d8", roughness: 0.4, glow: ["#ffe2a8", 1.4] });
  add(g, new RoundedBoxGeometry(0.6, 0.45, 0.45, 2, 0.05), stM, stops[0].x, stops[0].y - 0.3, stops[0].z);
  P.snowCap(g, 0.65, 0.5, stops[0].x, stops[0].y - 0.05, stops[0].z, 0.06);
  add(g, new RoundedBoxGeometry(0.75, 0.32, 0.55, 2, 0.06), stM, stops[3].x, stops[3].y - 0.15, stops[3].z);
  P.snowCap(g, 0.8, 0.6, stops[3].x, stops[3].y + 0.04, stops[3].z, 0.06);
  const towerM = P.mat({ color: "#9aa0ad", metalness: 0.5 });
  for (const q of [stops[1], stops[2]]) {
    const base = surfY(Math.hypot(q.x, q.z / SZ)) - 0.05;
    add(g, new THREE.CylinderGeometry(0.025, 0.04, q.y - base, 6), towerM, q.x, (q.y + base) / 2, q.z);
    add(g, new THREE.BoxGeometry(0.3, 0.03, 0.03), towerM, q.x, q.y, q.z).rotation.y = -0.75;
  }
  const cableM = P.mat({ color: "#3a3a44", metalness: 0.5 });
  const side = new THREE.Vector3(-dir.y, 0, dir.x).multiplyScalar(0.1);
  for (const o of [-1, 1]) for (let i = 0; i < 3; i++) strut(g, cableM, stops[i].clone().addScaledVector(side, o), stops[i + 1].clone().addScaledVector(side, o), 0.007);
  const gond = P.mat({ color: "#d8402f", roughness: 0.4, glow: ["#ffc070", 1.6] });
  for (const [i, t, o] of [[0, 0.5, -1], [2, 0.4, 1]]) {
    const q = stops[i].clone().lerp(stops[i + 1], t).addScaledVector(side, o);
    add(g, new RoundedBoxGeometry(0.22, 0.17, 0.15, 2, 0.04), gond, q.x, q.y - 0.16, q.z);
    add(g, new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4), cableM, q.x, q.y - 0.05, q.z);
  }
  // 밤: 정상역 후광
  const halo = new THREE.Sprite(P.nightAdd(new THREE.SpriteMaterial({ map: radialTex("rgba(255,214,150,.6)", "rgba(255,214,150,0)") })));
  halo.scale.set(1.6 / s, 1.6, 1);
  halo.position.copy(stops[3]).add(new THREE.Vector3(0, 0.15, 0));
  g.add(halo);
}
