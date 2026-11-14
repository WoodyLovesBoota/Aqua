import * as THREE from "three";
import { add, canvasTex, dn, type Kit, sweep } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/** 가든스 바이 더 베이: 슈퍼트리 8 (수직 정원 줄기·뒤집은 우산 가지·테) + OCBC 스카이웨이 + 격자 유리 돔 2 */
export function buildGardens(k: Kit) {
  const root = new THREE.Group();
  const garden = canvasTex(
    128,
    512,
    (c, w, h) => {
      c.fillStyle = "#7a6656";
      c.fillRect(0, 0, w, h);
      const cols = ["#4f8f4a", "#6aa65a", "#3f7a45", "#c75a8a", "#e8b64a"];
      for (let i = 0; i < 420; i++) {
        c.fillStyle = cols[Math.floor(k.rnd() * (k.rnd() < 0.85 ? 3 : 5))];
        c.beginPath();
        c.arc(k.rnd() * w, k.rnd() * h, 3 + k.rnd() * 6, 0, Math.PI * 2);
        c.fill();
      }
    },
    { repeat: [2, 1] },
  );
  const trunkM = k.std({ color: dn("#ffffff", "#8a72a0"), map: garden, roughness: 0.9, glow: ["#7a3aa8", 0.35] });
  const branchM = k.std({ color: dn("#8f6e5e", "#c98af5"), roughness: 0.5, metalness: 0.3, glow: ["#d36cff", 2.4] });
  const ringM = k.std({ color: dn("#c8597d", "#ffd1f6"), roughness: 0.5, glow: ["#ff7ad9", 2.8] });
  for (const [x, z, h] of SITES.supertrees) {
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      prof.push(new THREE.Vector2(0.2 - 0.11 * Math.sin(t * Math.PI * 0.9) + 0.03 * t, t * h));
    }
    add(root, new THREE.LatheGeometry(prof, 20), trunkM, x, TOP, z);
    const Rc = 0.45 + h * 0.18, top = TOP + h + 0.45;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [new THREE.Vector3(x + ca * 0.12, TOP + h - 0.15, z + sa * 0.12), new THREE.Vector3(x + ca * Rc * 0.45, TOP + h + 0.12, z + sa * Rc * 0.45), new THREE.Vector3(x + ca * Rc, top, z + sa * Rc)];
      add(root, sweep(pts, () => 0.018, 5, 10), branchM);
    }
    add(root, new THREE.TorusGeometry(Rc, 0.03, 6, 48).rotateX(Math.PI / 2), ringM, x, top, z);
    add(root, new THREE.TorusGeometry(Rc * 0.55, 0.018, 6, 36).rotateX(Math.PI / 2), branchM, x, TOP + h + 0.17, z);
  }
  // OCBC 스카이웨이
  const sw = [new THREE.Vector3(6.6, TOP + 1.7, -5.4), new THREE.Vector3(7.5, TOP + 1.75, -5.9), new THREE.Vector3(8.4, TOP + 1.7, -5.6), new THREE.Vector3(8.9, TOP + 1.6, -4.6)];
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sw), 80, 0.04, 6), k.std({ color: "#f0f0f4", glow: ["#ffffff", 1.5] }));
  // 유리 돔: 플라워 돔(길고 낮게, 안에 꽃) + 클라우드 포레스트(높게, 안에 산·폭포)
  const glass = k.phys({ color: "#e6f6ff", roughness: 0.06, transmission: 0.7, thickness: 0.2, transparent: true, opacity: 0.55, glow: ["#c8ecff", 0.35] });
  const gridM = k.std({ color: "#f7f8fb", metalness: 0.5, roughness: 0.3, glow: ["#e6f4ff", 1] });
  const dome = (x: number, z: number, r: number, sx: number, sy: number, sz: number, ry: number, cloud: boolean) => {
    const grp = new THREE.Group();
    grp.position.set(x, TOP, z);
    grp.rotation.y = ry;
    root.add(grp);
    const geo = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(sx, sy, sz);
    add(grp, geo, glass).castShadow = false;
    for (let i = 0; i < 12; i++) {
      const rib = new THREE.TorusGeometry(r, 0.01, 4, 48, Math.PI);
      rib.scale(sx, sy, sz);
      add(grp, rib, gridM).rotation.y = (i / 12) * Math.PI;
    }
    for (let j = 1; j < 5; j++) {
      const ph = (j / 5) * (Math.PI / 2), rr = Math.cos(ph) * r;
      const ring = new THREE.TorusGeometry(rr, 0.01, 4, 64).rotateX(Math.PI / 2);
      ring.scale(sx, 1, sz);
      add(grp, ring, gridM, 0, Math.sin(ph) * r * sy, 0);
    }
    for (let i = 0; i < 3; i++) {
      const arch = new THREE.TorusGeometry(r * 1.06, 0.03, 6, 48, Math.PI);
      arch.scale(sx * 0.35, sy, 1);
      add(grp, arch, gridM, (i - 1) * r * sx * 0.55, 0, 0).rotation.y = Math.PI / 2;
    }
    if (cloud) {
      add(grp, new THREE.ConeGeometry(r * 0.45, r * sy * 0.9, 10), k.std({ color: dn("#4f8f55", "#2f5a3a") }), 0, r * sy * 0.45, 0);
      add(grp, new THREE.BoxGeometry(0.04, r * sy * 0.8, 0.06), k.std({ color: "#dff6ff", transparent: true, opacity: 0.8, glow: ["#9fe2ff", 1.5] }), r * 0.25, r * sy * 0.4, r * 0.1);
    } else {
      const flowers = ["#e88fb0", "#f2c14e", "#7fbf6a"].map((c) => k.std({ color: c }));
      for (let i = 0; i < 14; i++) add(grp, new THREE.SphereGeometry(0.08, 8, 6), flowers[i % 3], (k.rnd() - 0.5) * r * sx * 1.1, 0.08, (k.rnd() - 0.5) * r * sz * 0.9);
    }
  };
  dome(SITES.domes.flower[0], SITES.domes.flower[1], 1.0, 1.45, 0.62, 0.85, 1.25, false);
  dome(SITES.domes.cloud[0], SITES.domes.cloud[1], 0.82, 1.15, 0.95, 0.95, 1.6, true);
  const lawn = new THREE.CircleGeometry(2.0, 40);
  lawn.rotateX(-Math.PI / 2);
  lawn.scale(1.0, 1, 0.75);
  add(root, lawn, k.std({ color: dn("#8cc47e", "#3d6a4b") }), 7.7, TOP + 0.015, -5.0);
  return root;
}
