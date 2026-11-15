import * as THREE from "three";

/**
 * 디오라마 전시(마리나베이·삿포로…) 공용 모델링 도구.
 * 모든 재질은 낮/밤 한 쌍으로 만든다 — `Kit.setNight(k)` (0 = 낮, 1 = 밤) 가 등록된 보간을 한 번에 돌린다.
 * 장면은 한 번만 짓고 하루 주기는 색·발광·투명도 보간으로만 바꾼다 (재컴파일 없음).
 */

/** 낮/밤 값 한 쌍 */
export interface DN<T> {
  day: T;
  night: T;
}
export const dn = <T>(day: T, night: T): DN<T> => ({ day, night });

type ColorIn = string | DN<string>;
type StdParams = Omit<THREE.MeshStandardMaterialParameters, "color" | "emissive" | "emissiveIntensity">;
type PhysParams = Omit<THREE.MeshPhysicalMaterialParameters, "color" | "emissive" | "emissiveIntensity">;
export interface MatOpts {
  color: ColorIn;
  /** 밤에만 켜지는 발광: [색, 밤 세기]. dayGlow 는 낮에도 남는 세기 */
  glow?: [string, number];
  dayGlow?: number;
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

export class Kit {
  private tweens: ((k: number) => void)[] = [];
  private seed: number;
  constructor(seed = 11) {
    this.seed = seed;
  }

  /** 시드 고정 난수 (매번 같은 배치) */
  rnd = () => (this.seed = (this.seed * 16807) % 2147483647) / 2147483647;

  /** 낮/밤 보간 등록 */
  onNight(fn: (k: number) => void) {
    this.tweens.push(fn);
  }
  setNight(k: number) {
    for (const t of this.tweens) t(k);
  }

  private wire<M extends THREE.MeshStandardMaterial>(m: M, o: MatOpts) {
    if (typeof o.color !== "string") {
      const a = new THREE.Color(o.color.day), b = new THREE.Color(o.color.night);
      this.onNight((k) => m.color.copy(a).lerp(b, k));
    }
    if (o.glow) {
      const [c, kNight] = o.glow, kDay = o.dayGlow ?? 0;
      m.emissive.set(c);
      this.onNight((k) => (m.emissiveIntensity = kDay + (kNight - kDay) * k));
    }
    return m;
  }

  std(o: MatOpts & StdParams) {
    const { color, glow, dayGlow, ...rest } = o;
    const m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...rest, color: typeof color === "string" ? color : color.day });
    return this.wire(m, { color, glow, dayGlow });
  }

  phys(o: MatOpts & PhysParams) {
    const { color, glow, dayGlow, ...rest } = o;
    const m = new THREE.MeshPhysicalMaterial({ ...rest, color: typeof color === "string" ? color : color.day });
    return this.wire(m, { color, glow, dayGlow });
  }

  /** 밤에만 보이는 재질 (불빛 반사·별·후광): 투명도 = 기본 × k, 거의 0 이면 숨김 */
  nightOnly<M extends THREE.Material>(m: M, objs?: THREE.Object3D[]) {
    const base = m.opacity;
    m.transparent = true;
    this.onNight((k) => {
      m.opacity = base * k;
      m.visible = k > 0.01;
      if (objs) for (const o of objs) o.visible = k > 0.01;
    });
    return m;
  }
  /** 낮에만 보이는 재질 (구름) */
  dayOnly<M extends THREE.Material>(m: M) {
    const base = m.opacity;
    m.transparent = true;
    this.onNight((k) => {
      m.opacity = base * (1 - k);
      m.visible = k < 0.99;
    });
    return m;
  }
  /** 색 보간만 (Basic·Points 재질 등) */
  tintColor(c: THREE.Color, day: string, night: string) {
    const a = new THREE.Color(day), b = new THREE.Color(night);
    this.onNight((k) => c.copy(tmpA.copy(a)).lerp(tmpB.copy(b), k));
  }
}

/** 메시 하나 추가 (그림자 주고받기) */
export function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** 캔버스 텍스처 */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { repeat?: [number, number]; linear?: boolean } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(o.repeat[0], o.repeat[1]);
  }
  return t;
}

/** 경로를 따라 굵기가 변하는 관 (양 끝 마개) — 꽃잎·가지·꼬리. flat < 1 이면 법선 방향으로 납작 */
export function sweep(pts: THREE.Vector3[], radius: (t: number) => number, radial = 10, seg = 32, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const fr = curve.computeFrenetFrames(seg, false);
  const pos: number[] = [];
  const idx: number[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), r = radius(t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(fr.normals[i]).multiplyScalar(Math.cos(a) * r * flat).addScaledVector(fr.binormals[i], Math.sin(a) * r);
      pos.push(p.x + n.x, p.y + n.y, p.z + n.z);
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
  const end = curve.getPointAt(1), start = curve.getPointAt(0);
  const ei = pos.length / 3;
  pos.push(end.x, end.y, end.z, start.x, start.y, start.z);
  for (let j = 0; j < radial; j++) {
    idx.push(seg * radial + j, seg * radial + ((j + 1) % radial), ei);
    idx.push(j, ei + 1, (j + 1) % radial);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 두 점을 잇는 막대 (트러스·케이블) */
export function strut(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, radial = 4) {
  const d = b.clone().sub(a);
  const m = add(parent, new THREE.CylinderGeometry(r1, r0, d.length(), radial), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** 둥근 사각형 (xy 평면) */
export function roundRect(w: number, d: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** 방사형 그라데이션 점 (후광·그림자) */
export const radialTex = (rgba0: string, rgba1: string) =>
  canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, rgba0);
    r.addColorStop(1, rgba1);
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });

/** 움직이거나 따로 다뤄야 하는 물체 표시 — bakeStatic 이 건너뛴다 */
export const keepDynamic = <T extends THREE.Object3D>(o: T) => {
  o.userData.dynamic = true;
  return o;
};

/**
 * 정적 메시를 재질·그림자 설정별로 하나로 합친다 (드로우 콜 수천 → 수십).
 * 지오메트리는 root 기준 좌표로 구워 넣고, 원래 메시는 떼어 낸다. InstancedMesh·Points·Sprite·dynamic 표시 하위는 그대로 둔다.
 * 합친 버퍼를 한 번에 잡아 정점을 바로 변환해 써넣는다 (메시마다 clone → applyMatrix4 → mergeGeometries 로 두 번 복사하던 것이 로딩 긴 작업의 1/3 이었다).
 * 남기는 속성은 위치·법선·uv, 정점색 재질이면 color 까지.
 */
export function bakeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  interface Bucket {
    mat: THREE.Material;
    cast: boolean;
    receive: boolean;
    order: number;
    meshes: THREE.Mesh[];
    verts: number;
    indices: number;
  }
  const buckets = new Map<string, Bucket>();
  const walk = (o: THREE.Object3D) => {
    if (o !== root && o.userData.dynamic) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
      const mat = mesh.material as THREE.Material, g = mesh.geometry;
      const key = `${mat.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, meshes: [], verts: 0, indices: 0 }));
      if (!g.attributes.normal) g.computeVertexNormals();
      b.meshes.push(mesh);
      b.verts += g.attributes.position.count;
      b.indices += g.index ? g.index.count : g.attributes.position.count;
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  for (const b of buckets.values()) {
    const withColor = !!(b.mat as THREE.MeshStandardMaterial).vertexColors;
    const pos = new Float32Array(b.verts * 3), nor = new Float32Array(b.verts * 3), uv = new Float32Array(b.verts * 2);
    const col = withColor ? new Float32Array(b.verts * 3).fill(1) : null;
    const idx = b.verts > 65535 ? new Uint32Array(b.indices) : new Uint16Array(b.indices);
    let v0 = 0, i0 = 0;
    for (const mesh of b.meshes) {
      const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color, n = P.count;
      const e = m.multiplyMatrices(inv, mesh.matrixWorld).elements, ne = nm.getNormalMatrix(m).elements;
      for (let i = 0; i < n; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), o = (v0 + i) * 3;
        pos[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pos[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const a = N.getX(i), bb = N.getY(i), c = N.getZ(i);
        const nx = ne[0] * a + ne[3] * bb + ne[6] * c, ny = ne[1] * a + ne[4] * bb + ne[7] * c, nz = ne[2] * a + ne[5] * bb + ne[8] * c;
        const l = 1 / (Math.hypot(nx, ny, nz) || 1);
        nor[o] = nx * l;
        nor[o + 1] = ny * l;
        nor[o + 2] = nz * l;
      }
      if (U) for (let i = 0, o = v0 * 2; i < n; i++, o += 2) {
        uv[o] = U.getX(i);
        uv[o + 1] = U.getY(i);
      }
      if (col && C) for (let i = 0, o = v0 * 3; i < n; i++, o += 3) {
        col[o] = C.getX(i);
        col[o + 1] = C.getY(i);
        col[o + 2] = C.getZ(i);
      }
      if (g.index) {
        const src = g.index.array;
        for (let i = 0; i < src.length; i++) idx[i0 + i] = src[i] + v0;
        i0 += src.length;
      } else {
        for (let i = 0; i < n; i++) idx[i0 + i] = v0 + i;
        i0 += n;
      }
      v0 += n;
      mesh.removeFromParent();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    if (col) merged.setAttribute("color", new THREE.BufferAttribute(col, 3));
    merged.setIndex(new THREE.BufferAttribute(idx, 1));
    const out = new THREE.Mesh(merged, b.mat);
    out.castShadow = b.cast;
    out.receiveShadow = b.receive;
    out.renderOrder = b.order;
    root.add(out);
  }
  return buckets.size;
}
