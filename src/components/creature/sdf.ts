import * as THREE from "three";

/** SDF(부호 거리 함수) 도우미. 상어·만타가 함께 쓴다. */

export const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** 두 구를 잇는 둥근 원뿔 (iq) */
export function sdRoundCone(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax - bax * y * il2, xy = pay - bay * y * il2, xz = paz - baz * y * il2;
  const x2 = (xx * xx + xy * xy + xz * xz) * l2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

export function sdRoundBox(px: number, py: number, pz: number, hx: number, hy: number, hz: number, r: number) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r, qz = Math.abs(pz) - hz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** 타원체 (iq 근사 — 정확한 거리는 아니지만 표면 스냅 반복으로 충분하다) */
export function sdEllipsoid(px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return (k0 * (k0 - 1)) / k1;
}

/** 2D 다각형 SDF (지느러미 단면) */
export function sdPolygon(px: number, py: number, v: number[][]) {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2;
  let s = 1;
  const n = v.length;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1];
    const wx = px - v[i][0], wy = py - v[i][1];
    const t = Math.min(Math.max((wx * ex + wy * ey) / (ex * ex + ey * ey), 0), 1);
    const bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= v[i][1], c2 = py < v[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/** 제어점을 닫힌 Catmull-Rom 곡선으로 부드럽게 리샘플링 (둥근 인형 지느러미) */
export function smoothPoly(ctrl: number[][], samples = 28): number[][] {
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    "centripetal",
  );
  return curve.getPoints(samples).slice(0, samples).map((v) => [v.x, v.y]);
}

export interface Fin {
  poly: number[][]; // 로컬 2D (x: 몸 앞뒤, y: 지느러미 바깥 방향)
  thick: number; // 반두께
  round: number; // 모서리 둥글기
  inv: THREE.Matrix4; // 월드→로컬
}

export function makeFin(poly: number[][], thick: number, round: number, pos: THREE.Vector3, euler: THREE.Euler): Fin {
  const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(euler), new THREE.Vector3(1, 1, 1));
  return { poly: smoothPoly(poly), thick, round, inv: m.invert() };
}

const _v = new THREE.Vector3();
/** 납작한 지느러미: 다각형 단면 × 두께, 끝으로 갈수록 얇아진다 */
export function sdFin(px: number, py: number, pz: number, f: Fin) {
  _v.set(px, py, pz).applyMatrix4(f.inv);
  const d2 = sdPolygon(_v.x, _v.y, f.poly) + f.round;
  const taper = Math.max(0.45, 1 - Math.max(0, _v.y) * 0.75);
  const dz = Math.abs(_v.z) - f.thick * taper;
  const ox = Math.max(d2, 0), oz = Math.max(dz, 0);
  return Math.min(Math.max(d2, dz), 0) + Math.sqrt(ox * ox + oz * oz) - f.round;
}

/** SDF 기울기 (법선) */
export function sdfNormal(sdf: (x: number, y: number, z: number) => number, p: THREE.Vector3, out = new THREE.Vector3()) {
  const e = 0.004;
  out.set(
    sdf(p.x + e, p.y, p.z) - sdf(p.x - e, p.y, p.z),
    sdf(p.x, p.y + e, p.z) - sdf(p.x, p.y - e, p.z),
    sdf(p.x, p.y, p.z + e) - sdf(p.x, p.y, p.z - e),
  );
  return out.normalize();
}

/** 임의의 점을 표면 위로 투영 (법선 방향 offset 만큼 띄움) */
export function sdfProject(sdf: (x: number, y: number, z: number) => number, p: THREE.Vector3, offset = 0): THREE.Vector3 {
  const q = p.clone();
  const n = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    const d = sdf(q.x, q.y, q.z);
    if (Math.abs(d) < 1e-5) break;
    sdfNormal(sdf, q, n);
    q.addScaledVector(n, -d);
  }
  sdfNormal(sdf, q, n);
  return q.addScaledVector(n, offset);
}

export interface Anchor {
  p: THREE.Vector3;
  n: THREE.Vector3;
}

/** 한 SDF 에 묶인 표면 도우미 (법선·투영·앵커). 종마다 `makeSurface(sdX)` 한 번이면 된다 */
export function makeSurface(sdf: (x: number, y: number, z: number) => number) {
  const normal = (p: THREE.Vector3, out = new THREE.Vector3()) => sdfNormal(sdf, p, out);
  const project = (p: THREE.Vector3, offset = 0) => sdfProject(sdf, p, offset);
  /** 표면 위 임의 지점 앵커 (부품 부착용) */
  const anchor = (x: number, y: number, z: number, offset = 0): Anchor => {
    const p = project(new THREE.Vector3(x, y, z), offset);
    return { p, n: normal(p) };
  };
  return { sdf, normal, project, anchor };
}
export type Surface = ReturnType<typeof makeSurface>;
