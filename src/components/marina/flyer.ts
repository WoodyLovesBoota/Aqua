import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, dn, keepDynamic, type Kit, strut } from "@/components/diorama/kit";
import { SITES, TOP } from "./layout";

/** 싱가포르 플라이어: 이중 테 트러스 + 양쪽 케이블 바퀴살 + 캡슐 28 + A 자 다리 + 물결 지붕 터미널. 바퀴(wheel)는 천천히 돈다 */
export function buildFlyer(k: Kit) {
  const { x, z, ry } = SITES.flyer;
  const g = new THREE.Group();
  g.position.set(x, TOP, z);
  g.rotation.y = ry;
  const Rr = 1.9, cy = 2.5;
  const steel = k.std({ color: "#f3f5f9", metalness: 0.55, roughness: 0.3, glow: ["#a8dcff", 1.4] });
  const cable = k.std({ color: "#dfe3ea", metalness: 0.4 });
  const wheel = keepDynamic(new THREE.Group()); // 돌아가므로 병합 제외 (바퀴 안은 따로 병합)
  wheel.position.set(0, cy, 0);
  g.add(wheel);
  for (const zz of [-0.09, 0.09]) {
    add(wheel, new THREE.TorusGeometry(Rr, 0.035, 8, 140), steel, 0, 0, zz);
    add(wheel, new THREE.TorusGeometry(Rr - 0.16, 0.018, 6, 140), steel, 0, 0, zz);
  }
  // 트러스 지그재그 (두 테 사이)
  for (let i = 0; i < 96; i++) {
    const a0 = (i / 96) * Math.PI * 2, a1 = ((i + 1) / 96) * Math.PI * 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * Rr, Math.sin(a0) * Rr, i % 2 ? 0.09 : -0.09);
    const p1 = new THREE.Vector3(Math.cos(a1) * (Rr - 0.16), Math.sin(a1) * (Rr - 0.16), i % 2 ? -0.09 : 0.09);
    strut(wheel, steel, p0, p1, 0.008);
  }
  // 케이블 바퀴살 양쪽 + 허브
  for (let i = 0; i < 28; i++)
    for (const zz of [-0.32, 0.32]) {
      const a = (i / 28) * Math.PI * 2;
      strut(wheel, cable, new THREE.Vector3(Math.cos(a) * (Rr - 0.16), Math.sin(a) * (Rr - 0.16), 0), new THREE.Vector3(0, 0, zz), 0.004, 0.004, 3);
    }
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 16);
  hub.rotateX(Math.PI / 2);
  add(wheel, hub, k.std({ color: "#e8ebf0", metalness: 0.5 }));
  // 캡슐: 바퀴 바깥 투명 알약 (축이 바퀴 축과 나란해 돌아도 모양이 같다 — 바퀴와 함께 병합)
  const capM = k.phys({ color: "#eaf6ff", roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.9, glow: ["#ffe3a6", 2.2] });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, cap = new THREE.CapsuleGeometry(0.085, 0.2, 6, 12);
    cap.rotateX(Math.PI / 2);
    add(wheel, cap, capM, Math.cos(a) * (Rr + 0.13), Math.sin(a) * (Rr + 0.13), 0);
  }
  // A 자 다리 (양쪽) + 터미널 + 물결 지붕
  const legM = k.std({ color: "#eef0f4", metalness: 0.4 });
  for (const zz of [-0.45, 0.45]) for (const s of [-1, 1]) strut(g, legM, new THREE.Vector3(s * 0.8, 0.5, zz * 1.4), new THREE.Vector3(0, cy, zz * 0.7), 0.06, 0.04, 10);
  add(g, new RoundedBoxGeometry(2.6, 0.5, 1.5, 3, 0.2), k.std({ color: dn("#e2e9ee", "#c0cbe0"), roughness: 0.2, metalness: 0.3, glow: ["#ffe0b0", 0.6] }), 0, 0.25, 0.1);
  const tr = new THREE.PlaneGeometry(2.8, 1.7, 40, 8);
  tr.rotateX(-Math.PI / 2);
  const tp = tr.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, 0.1 * Math.sin(tp.getX(i) * 3));
  tr.computeVertexNormals();
  add(g, tr, k.std({ color: "#f7f4ee", side: THREE.DoubleSide }), 0, 0.55, 0.1);
  /** 바퀴 회전 (실제 한 바퀴 30분 → 여기선 4분) */
  const tick = (t: number) => {
    wheel.rotation.z = t * ((Math.PI * 2) / 240);
  };
  return { root: g, tick, wheel };
}
