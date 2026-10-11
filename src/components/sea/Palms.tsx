"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { captureParam } from "@/components/creature/debugProbe";
import { floorHeight } from "./lagoonHeight";
import { PALMS } from "./resortLayout";

/**
 * 야자수 — 기준 키 1 로 정밀하게 만들고 그루마다 축소한다.
 * 줄기: 마디가 있는 테이퍼 튜브. 잎: 축(튜브) + 잎몸 24쌍(각각 5정점 4삼각형).
 */
export { PALMS };
// ?focus=guests 근접 뷰(점검용)에선 잎을 숨긴다 — 관 아래를 걷는 손님이 가려진다
const HIDE_FRONDS = captureParam("focus") === "guests";

/** 정점 색은 선형 공간이라, 눈으로 고른 sRGB 값을 변환해 넣는다 */
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const FRONDS = 11;
const FROND_LEN = 1.3;

const trunkMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, flatShading: true, vertexColors: true });
const frondMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8, side: THREE.DoubleSide, vertexColors: true });
const deadMat = new THREE.MeshStandardMaterial({ color: "#a8884f", roughness: 0.95, side: THREE.DoubleSide });
const DEAD = 3; // 그루당 관 아래 늘어진 마른 잎
const nutMat = new THREE.MeshStandardMaterial({ color: "#6f4f33", roughness: 0.9 });

/** 줄기 곡선 (기준 키 1) 과 끝점 */
const TRUNK_TIP = new THREE.Vector3(0.32, 1, 0);
const TRUNK_CURVE = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.04, 0.55, 0), TRUNK_TIP);

/** 줄기: 링 16개, 마디마다 살짝 부푼 테이퍼 + 밑동 + 관 혹 */
function makeTrunk() {
  const RINGS = 16;
  const RADIAL = 8;
  const g = new THREE.TubeGeometry(TRUNK_CURVE, RINGS, 1, RADIAL, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const pts = TRUNK_CURVE.getPoints(RINGS);
  const perRing = RADIAL + 1;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / perRing);
    const c = pts[Math.min(ring, RINGS)];
    const t = ring / RINGS;
    const bulge = ring % 2 === 0 ? 1.0 : 0.86; // 마디
    const r = (0.07 * (1 - t) + 0.04) * bulge;
    pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r);
  }
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / perRing);
    const t = ring / RINGS;
    const k = (ring % 2 === 0 ? 1.0 : 0.72) * (0.85 + 0.2 * t);
    col[i * 3] = lin(0.6 * k);
    col[i * 3 + 1] = lin(0.47 * k);
    col[i * 3 + 2] = lin(0.33 * k);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const foot = new THREE.CylinderGeometry(0.075, 0.11, 0.12, RADIAL);
  const crown = new THREE.SphereGeometry(0.075, 8, 6);
  crown.translate(TRUNK_TIP.x, TRUNK_TIP.y, TRUNK_TIP.z);
  for (const x of [foot, crown]) {
    const n = x.attributes.position.count;
    x.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).map((_, j) => lin([0.45, 0.35, 0.25][j % 3])), 3));
  }
  for (const x of [g, foot, crown]) x.deleteAttribute("uv");
  const merged = mergeGeometries([g, foot, crown], false)!;
  g.dispose();
  foot.dispose();
  crown.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** 잎 한 장: +x 로 뻗는 축 (t² 처짐) + 양쪽 잎몸 */
function makeFrond() {
  const N = 24;
  const spinePt = (t: number) => new THREE.Vector3(FROND_LEN * t, -0.62 * t * t + 0.05 * t, 0);
  const spineCurve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => spinePt(i / 8)));
  const spine = new THREE.TubeGeometry(spineCurve, 12, 0.011, 4, false);
  spine.deleteAttribute("uv");

  const verts: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const T = new THREE.Vector3();
  const d = new THREE.Vector3();
  const w = new THREE.Vector3();
  const w2 = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const push = (v: THREE.Vector3, shade: number) => {
    verts.push(v.x, v.y, v.z);
    // 밑동은 짙고 끝으로 갈수록 연두 — 잎마다 조금씩 다르게
    cols.push(lin(0.14 + 0.26 * shade), lin(0.42 + 0.3 * shade), lin(0.12 + 0.16 * shade));
  };
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    p.copy(spinePt(t));
    T.copy(spinePt(t + 0.01)).sub(p).normalize();
    // 잎몸 길이: 밑동과 끝은 짧고 가운데가 길다
    const len = 0.1 + 0.3 * Math.sin(Math.PI * Math.min(1, 0.1 + 0.9 * t));
    for (const side of [-1, 1]) {
      // 축에서 벌어지고 아래로 처지며, 끝으로 갈수록 뒤로 쏠린다
      const a = 0.95 - t * 0.35;
      d.set(T.x * Math.cos(a), T.y * Math.cos(a) - 0.55 * (0.4 + t), side * Math.sin(a)).normalize();
      w.crossVectors(d, up).normalize().multiplyScalar(0.011);
      w2.copy(w).multiplyScalar(2.4);
      const base = verts.length / 3;
      // 5정점: 밑동 2, 중간 2, 끝 1
      const jitter = ((i * 7 + (side + 1) * 3) % 5) * 0.04;
      const s0 = t * 0.35 + jitter;
      push(q.copy(p).sub(w), s0);
      push(q.copy(p).add(w), s0);
      push(q.copy(p).addScaledVector(d, len * 0.5).sub(w2), s0 + 0.3);
      push(q.copy(p).addScaledVector(d, len * 0.5).add(w2), s0 + 0.3);
      push(q.copy(p).addScaledVector(d, len), s0 + 0.6);
      idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
  }
  const leaflets = new THREE.BufferGeometry();
  leaflets.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  leaflets.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  leaflets.setIndex(idx);
  const flat = leaflets.toNonIndexed();
  flat.computeVertexNormals();
  const spineFlat = spine.toNonIndexed();
  spineFlat.deleteAttribute("uv");
  spineFlat.setAttribute("color", new THREE.BufferAttribute(new Float32Array(spineFlat.attributes.position.count * 3).map((_, j) => lin([0.28, 0.4, 0.16][j % 3])), 3));
  spineFlat.computeVertexNormals();
  const merged = mergeGeometries([spineFlat, flat], false)!;
  spine.dispose();
  spineFlat.dispose();
  leaflets.dispose();
  flat.dispose();
  return merged;
}

export function Palms({ bottom }: { bottom: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null!);
  const fronds = useRef<THREE.InstancedMesh>(null!);
  const nuts = useRef<THREE.InstancedMesh>(null!);
  const dead = useRef<THREE.InstancedMesh>(null!);
  const trunkGeo = useMemo(() => makeTrunk(), []);
  const frondGeo = useMemo(() => makeFrond(), []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );
  const trees = useMemo(
    () =>
      PALMS.map((p) => {
        const y = floorHeight(bottom, p.x, p.z) - 0.02;
        const root = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, y, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.yaw, 0)),
          new THREE.Vector3(p.h, p.h, p.h),
        );
        const crown = TRUNK_TIP.clone().applyMatrix4(root);
        return { def: p, root, crown };
      }),
    [bottom],
  );

  useEffect(() => {
    trees.forEach((t, i) => trunks.current.setMatrixAt(i, t.root));
    trunks.current.instanceMatrix.needsUpdate = true;
    trees.forEach((t, i) => {
      for (let k = 0; k < 4; k++) {
        const a = k * 1.6 + t.def.yaw;
        tmp.m.compose(
          tmp.v.set(t.crown.x + Math.cos(a) * 0.06 * t.def.h, t.crown.y - 0.07 * t.def.h, t.crown.z + Math.sin(a) * 0.06 * t.def.h),
          tmp.q.identity(),
          tmp.s.setScalar(0.04 * t.def.h),
        );
        nuts.current.setMatrixAt(i * 4 + k, tmp.m);
      }
    });
    nuts.current.instanceMatrix.needsUpdate = true;
    // 마른 잎: 관 바로 아래에 축 늘어진다 (정적)
    trees.forEach((t, i) => {
      for (let k = 0; k < DEAD; k++) {
        const a = (k / DEAD) * Math.PI * 2 + t.def.yaw + 0.4;
        tmp.e.set(0, -a, -1.25 + (k % 2) * 0.15, "YXZ");
        tmp.q.setFromEuler(tmp.e);
        tmp.m.compose(tmp.v.set(t.crown.x, t.crown.y - 0.03 * t.def.h, t.crown.z), tmp.q, tmp.s.setScalar((0.5 + t.def.h * 0.3) * 0.8));
        dead.current.setMatrixAt(i * DEAD + k, tmp.m);
      }
    });
    dead.current.instanceMatrix.needsUpdate = true;
  }, [trees, tmp]);

  useEffect(() => () => void (trunkGeo.dispose(), frondGeo.dispose()), [trunkGeo, frondGeo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const inst = fronds.current;
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      const sway = Math.sin(t * 1.1 + tr.def.ph) * 0.05;
      const sway2 = Math.cos(t * 0.7 + tr.def.ph * 1.7) * 0.035;
      const scale = 0.5 + tr.def.h * 0.3;
      for (let k = 0; k < FRONDS; k++) {
        const a = (k / FRONDS) * Math.PI * 2 + tr.def.yaw + sway2;
        // 위쪽 잎은 서고 아래 잎은 늘어진다 (3단)
        const lift = 0.7 - (k % 3) * 0.38 + sway * (1 + (k % 2));
        tmp.e.set(0, -a, lift, "YXZ");
        tmp.q.setFromEuler(tmp.e);
        tmp.m.compose(tr.crown, tmp.q, tmp.s.setScalar(scale));
        inst.setMatrixAt(i * FRONDS + k, tmp.m);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={trunks} args={[trunkGeo, trunkMat, PALMS.length]} />
      <instancedMesh ref={fronds} args={[frondGeo, frondMat, PALMS.length * FRONDS]} frustumCulled={false} visible={!HIDE_FRONDS} />
      <instancedMesh ref={dead} args={[frondGeo, deadMat, PALMS.length * DEAD]} frustumCulled={false} visible={!HIDE_FRONDS} />
      <instancedMesh ref={nuts} args={[undefined, nutMat, PALMS.length * 4]}>
        <sphereGeometry args={[1, 7, 6]} />
      </instancedMesh>
    </>
  );
}
