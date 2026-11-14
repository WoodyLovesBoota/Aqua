import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, dn, type Kit } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/**
 * 에스플러네이드: 달걀형 돔 두 개를 알루미늄 삼각 차양이 마름모 격자로 덮는다 (안은 어두운 유리, 밤엔 안에서 주황빛이 샌다)
 * + 두 돔 사이 유리 로비(물결 지붕) + 물가 야외극장(반원 계단·말안장 막 지붕).
 */
export function buildEsplanade(k: Kit) {
  const root = new THREE.Group();
  const glassIn = k.std({ color: dn("#6d7780", "#3a2f2a"), roughness: 0.25, metalness: 0.5, glow: ["#ffa64d", 0.55] });
  const shadeM = k.std({ color: dn("#d6ccbb", "#9a9083"), roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide });
  const frameM = k.std({ color: dn("#b9ad99", "#6f655c"), metalness: 0.5, roughness: 0.4 });
  const plinthM = k.std({ color: dn("#e7e1d6", "#b8b0bf") });
  // 차양 하나: 표면에 붙은 삼각형 밑변 + 바깥으로 들린 꼭짓점 (접힌 지느러미)
  const shade = new THREE.BufferGeometry();
  shade.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0.55, -0.5, 0, 0, 0, 1, 0.55, 0, 1, 0, 0.5, 0, 0, 0, 1, 0, 0, 1, 0.55], 3));
  shade.computeVertexNormals();
  for (const [x, z, R, hk, ry] of SITES.esplanade.domes) {
    const Hd = R * hk, P = 2.3, SX = 1.28;
    const rAt = (y: number) => R * Math.pow(Math.max(0, 1 - Math.pow(y / Hd, P)), 1 / P);
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const y = (i / 40) * Hd;
      prof.push(new THREE.Vector2(rAt(y) + 0.001, y));
    }
    const geo = new THREE.LatheGeometry(prof, 72);
    geo.scale(SX, 1, 1);
    const grp = new THREE.Group();
    grp.position.set(x, TOP, z);
    grp.rotation.y = ry;
    root.add(grp);
    add(grp, geo, glassIn);
    // 줄(위도)마다 둘레에 고르게, 줄마다 반 칸 어긋나게 → 마름모
    const rows = 15, mats: THREE.Matrix4[] = [];
    const dy = Hd / rows;
    for (let j = 0; j < rows; j++) {
      const y = ((j + 0.5) / rows) * Hd * 0.97, r = rAt(y), n = Math.max(6, Math.round((2 * Math.PI * r * 1.1) / 0.16));
      const dr = (rAt(y + 0.01) - r) / 0.01;
      for (let i = 0; i < n; i++) {
        const a = ((i + (j % 2) * 0.5) / n) * Math.PI * 2;
        const p = new THREE.Vector3(Math.cos(a) * r * SX, y - dy * 0.45, Math.sin(a) * r);
        const nrm = new THREE.Vector3(Math.cos(a) / SX, -dr, Math.sin(a)).normalize();
        const up = new THREE.Vector3(Math.cos(a) * dr * SX, 1, Math.sin(a) * dr).normalize();
        const right = new THREE.Vector3().crossVectors(up, nrm).normalize();
        const m = new THREE.Matrix4().makeBasis(right, up, nrm).scale(new THREE.Vector3((2 * Math.PI * r * 1.9) / n, dy * 1.5, 0.1));
        m.setPosition(p);
        mats.push(m);
      }
    }
    const im = new THREE.InstancedMesh(shade, shadeM, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    grp.add(im);
    add(grp, new THREE.TorusGeometry(R, 0.04, 6, 72).rotateX(Math.PI / 2).scale(SX, 1, 1), frameM, 0, 0.04, 0);
    add(grp, new THREE.CylinderGeometry(R * 1.04, R * 1.08, 0.12, 64).scale(SX, 1, 1), plinthM, 0, 0.06, 0);
  }
  // 유리 로비 + 물결 지붕
  const [lx, lz] = SITES.esplanade.lobby;
  add(root, new RoundedBoxGeometry(1.3, 0.42, 0.9, 2, 0.1), k.std({ color: "#cfe0ea", roughness: 0.08, metalness: 0.35, glow: ["#ffe2b8", 1.4] }), lx, TOP + 0.21, lz);
  const lr = new THREE.PlaneGeometry(1.5, 1.05, 30, 6);
  lr.rotateX(-Math.PI / 2);
  const lp = lr.attributes.position;
  for (let i = 0; i < lp.count; i++) lp.setY(i, 0.05 * Math.sin(lp.getX(i) * 6));
  lr.computeVertexNormals();
  add(root, lr, k.std({ color: "#f5f1e9", side: THREE.DoubleSide }), lx, TOP + 0.45, lz);
  // 물가 야외극장
  const th = new THREE.Group();
  th.position.set(SITES.esplanade.theatre[0], TOP, SITES.esplanade.theatre[1]);
  th.rotation.y = 0.12;
  root.add(th);
  const stepM = k.std({ color: dn("#efe9de", "#d6d0db"), side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.RingGeometry(0.35 + i * 0.13, 0.48 + i * 0.13, 40, 1, Math.PI * 0.08, Math.PI * 0.84);
    s.rotateX(-Math.PI / 2);
    add(th, s, stepM, 0, 0.02 + i * 0.05, 0);
  }
  add(th, new THREE.CylinderGeometry(0.35, 0.35, 0.04, 40), k.std({ color: "#d9cdb6" }), 0, 0.02, 0);
  const saddle = new THREE.PlaneGeometry(1.3, 0.9, 24, 16);
  saddle.rotateX(-Math.PI / 2);
  const sp = saddle.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const sx = sp.getX(i) / 0.65, sz = sp.getZ(i) / 0.45;
    sp.setY(i, 0.22 * sx * sx - 0.16 * sz * sz);
  }
  saddle.computeVertexNormals();
  add(th, saddle, k.std({ color: "#fbfaf6", roughness: 0.6, side: THREE.DoubleSide, glow: ["#ffe6c0", 0.8] }), 0, 0.85, -0.05);
  const mast = k.std({ color: "#d9d9de", metalness: 0.6 });
  for (const [sx, sz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.35], [0.6, 0.35]]) add(th, new THREE.CylinderGeometry(0.012, 0.012, 1.05, 5), mast, sx, 0.5, sz);
  return root;
}
