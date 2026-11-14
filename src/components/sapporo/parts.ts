import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, dn, type Kit } from "@/components/diorama/kit";

/**
 * 삿포로 공용 부품: 눈 재질 + 지붕 눈판 + 박공 지붕 + 박공 눈 + 바닥에 까는 빛 무늬(그림자 없음).
 * 한 장면에 하나 — 재질을 공유해야 bakeStatic 이 한 드로우로 합친다.
 */
export function makeParts(k: Kit) {
  const SNOW = k.std({ color: dn("#fbfcff", "#dfe6ff"), roughness: 0.9 });
  // 같은 설정의 단색 재질은 하나로 (병합 묶음 = 드로우가 하나 준다). 텍스처가 있으면 매번 새로
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (o: Parameters<Kit["std"]>[0]) => {
    if (o.map || o.emissiveMap) return k.std(o);
    const key = JSON.stringify(o);
    let m = cache.get(key);
    if (!m) cache.set(key, (m = k.std(o)));
    return m;
  };

  /** 지붕 위 눈: 둥근 판 */
  const snowCap = (p: THREE.Object3D, w: number, d: number, x: number, y: number, z: number, t = 0.09) => add(p, new RoundedBoxGeometry(w, t, d, 3, t * 0.45), SNOW, x, y, z);

  /** 박공 지붕(삼각 기둥): 폭 w(x), 깊이 d(z), 높이 h, 처마 over */
  function gable(p: THREE.Object3D, w: number, d: number, h: number, mat: THREE.Material, x: number, y: number, z: number, over = 0.08) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - over, 0);
    s.lineTo(w / 2 + over, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + over * 2, bevelEnabled: false });
    g.translate(0, 0, -(d + over * 2) / 2);
    return add(p, g, mat, x, y, z);
  }

  /** 박공 지붕 눈: 양쪽 경사면에 얇은 판 */
  function gableSnow(p: THREE.Object3D, w: number, d: number, h: number, x: number, y: number, z: number, over = 0.08) {
    const len = Math.hypot(w / 2 + over, h), ang = Math.atan2(h, w / 2 + over);
    for (const s of [-1, 1]) {
      const m = add(p, new RoundedBoxGeometry(len + 0.04, 0.07, d + over * 2 + 0.04, 2, 0.03), SNOW, x + s * (w / 4 + over / 2), y + h / 2 + 0.04, z);
      m.rotation.z = -s * ang;
    }
  }

  /** 바닥에 눕힌 빛 무늬(빛 웅덩이·헤드라이트) — 그림자를 드리우지 않는다 */
  function decal(p: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, sx: number, sz = sx) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 3;
    p.add(m);
    return m;
  }

  /** 가산 혼합 밤 전용 재질 (스프라이트·점·바닥 빛) */
  const nightAdd = <M extends THREE.Material>(m: M) => {
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    return k.nightOnly(m);
  };

  return { SNOW, mat, snowCap, gable, gableSnow, decal, nightAdd };
}
export type Parts = ReturnType<typeof makeParts>;

export { makePuffs, place, trimShadows } from "@/components/diorama/fx";
