import * as THREE from "three";
import { add, canvasTex, dn, type Kit, sweep } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/** 아트사이언스 뮤지엄: 끝이 둥글고 바깥으로 벌어지는 손가락 10개 연꽃 + 받침 + 반사 연못 */
export function buildLotus(k: Kit) {
  const { x, z, ry, scale } = SITES.lotus;
  const g = new THREE.Group();
  g.position.set(x, TOP, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  const pond = new THREE.CircleGeometry(1.15, 40);
  pond.rotateX(-Math.PI / 2);
  add(g, pond, k.phys({ color: dn("#7fd0dc", "#2b4d7a"), roughness: 0.05, clearcoat: 1 }), 0, 0.02, 0);
  add(g, new THREE.CylinderGeometry(0.42, 0.5, 0.42, 32), k.std({ color: dn("#efe9de", "#d7d2df") }), 0, 0.21, 0);
  // 꽃잎 표면: 가는 가로줄 (패널 이음매)
  const skin = canvasTex(64, 256, (c, w, h) => {
    c.fillStyle = "#fbf9f4";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(160,150,140,.35)";
    for (let y = 0; y < h; y += 10) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
  });
  const pm = k.std({ color: dn("#ffffff", "#e6e0f0"), map: skin, roughness: 0.4, metalness: 0.05, glow: ["#ffe0b0", 0.55] });
  const heights = [1.55, 1.25, 1.75, 1.15, 1.45, 1.95, 1.3, 1.6, 1.2, 1.4];
  heights.forEach((h, i) => {
    const a = (i / 10) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const rad = (r: number, y: number) => new THREE.Vector3(ca * r, y, sa * r);
    const pts = [rad(0.12, 0.32), rad(0.55, 0.42), rad(0.98, 0.62 * h), rad(1.22, 0.95 * h), rad(1.3 + 0.06 * (i % 3), 1.12 * h)];
    // 끝 18% 는 반원으로 오므려 둥근 손가락 끝
    const r = (t: number) => (0.24 * (1 - t * 0.3) + 0.03) * (t > 0.82 ? Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2)) : 1);
    add(g, sweep(pts, r, 12, 30, 0.5), pm);
  });
  return g;
}
