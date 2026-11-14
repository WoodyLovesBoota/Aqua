import * as THREE from "three";
import { add, dn, type Kit, strut } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/** 헬릭스 브리지: 물길을 건너는 데크 + 굵기가 다른 이중 나선 + 연결살. 밤엔 분홍/하늘색 */
export function buildHelix(k: Kit) {
  const root = new THREE.Group();
  const a = new THREE.Vector3(SITES.helix.a[0], TOP + 0.12, SITES.helix.a[1]);
  const b = new THREE.Vector3(SITES.helix.b[0], TOP + 0.12, SITES.helix.b[1]);
  const dir = b.clone().sub(a), L = dir.length();
  dir.normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x), yaw = -Math.atan2(dir.z, dir.x);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  add(root, new THREE.BoxGeometry(L + 0.6, 0.06, 0.38), k.std({ color: dn("#f0ede7", "#d6d3e3") }), mid.x, a.y, mid.z).rotation.y = yaw;
  add(root, new THREE.BoxGeometry(L + 0.6, 0.012, 0.05), k.std({ color: "#ffffff", glow: ["#bfe9ff", 3] }), mid.x, a.y + 0.04, mid.z).rotation.y = yaw;
  const steel = (c: string) => k.std({ color: "#eef2f7", metalness: 0.7, roughness: 0.2, glow: [c, 2.4] });
  const helix = (ph: number, r: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, ang = t * Math.PI * 9 + ph;
      pts.push(a.clone().lerp(b, t).addScaledVector(side, Math.cos(ang) * r).add(new THREE.Vector3(0, 0.26 + Math.sin(ang) * r, 0)));
    }
    return pts;
  };
  const outer = helix(0, 0.3), inner = helix(Math.PI, 0.22);
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outer), 500, 0.022, 6), steel("#ff7cc0"));
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner), 500, 0.016, 6), steel("#7fd8ff"));
  const rod = steel("#ffffff");
  for (let i = 0; i < 160; i += 4) strut(root, rod, outer[i], inner[i], 0.006, 0.006, 3);
  return root;
}
