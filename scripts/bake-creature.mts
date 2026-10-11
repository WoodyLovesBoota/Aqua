// 생물 SDF → marching cubes 메시를 미리 구워 LOD 별로 public/<name>-{hi,mid,lo}.bin(.gz) 으로 저장한다.
// usage: pnpm bake:shark | pnpm bake:manta  (= node scripts/bake-creature.mts <shark|manta> [resolution])
import { createHash } from "node:crypto";
import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { align4, CREATURE_LODS, type CreatureDef, type CreatureLod, type CreatureMeshHeader } from "../src/components/creature/creatureFormat.ts";
import { sdfNormal } from "../src/components/creature/sdf.ts";
import { DOLPHIN_DEF } from "../src/components/dolphin/dolphinSdf.ts";
import { MANTA_DEF } from "../src/components/manta/mantaSdf.ts";
import { SHARK_DEF } from "../src/components/shark/sharkSdf.ts";
import { TURTLE_DEF } from "../src/components/turtle/turtleSdf.ts";
import { WHALESHARK_DEF } from "../src/components/whaleshark/whalesharkSdf.ts";

const DEFS: Record<string, CreatureDef> = { shark: SHARK_DEF, manta: MANTA_DEF, turtle: TURTLE_DEF, dolphin: DOLPHIN_DEF, whaleshark: WHALESHARK_DEF };

/** SDF 를 marching cubes 로 메시화하고 정점을 용접해 인덱스 메시로 만든다. 느리므로 런타임에서는 쓰지 않는다. */
function buildGeometry(def: CreatureDef, resolution: number): THREE.BufferGeometry {
  const scale = new THREE.Vector3(...def.gridScale);
  const offset = new THREE.Vector3(...def.gridOffset);
  const mc = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 1200000);
  mc.isolation = 80;
  const half = resolution / 2;
  const field = mc.field;
  for (let iz = 0; iz < resolution; iz++) {
    const pz = (iz - half) / half / scale.z + offset.z;
    for (let iy = 0; iy < resolution; iy++) {
      const py = (iy - half) / half / scale.y + offset.y;
      for (let ix = 0; ix < resolution; ix++) {
        const px = (ix - half) / half / scale.x + offset.x;
        // 안쪽(sdf<0)일수록 커지는 밀도장. 선형이라 보간이 정확하다.
        field[iz * resolution * resolution + iy * resolution + ix] = 80 - def.sdf(px, py, pz) * 120;
      }
    }
  }
  mc.update();

  const count = mc.geometry.drawRange.count;
  const src = mc.geometry.getAttribute("position") as THREE.BufferAttribute;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const part = new Float32Array(count);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.set(src.getX(i), src.getY(i), src.getZ(i)).divide(scale).add(offset);
    // 표면에 정확히 스냅 + SDF 법선 (매끈함). 근사 SDF 도 있으므로 두 번 당긴다
    for (let k = 0; k < 2; k++) {
      const d = def.sdf(p.x, p.y, p.z);
      sdfNormal(def.sdf, p, n);
      p.addScaledVector(n, -d);
    }
    sdfNormal(def.sdf, p, n);
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
    nor[i * 3] = n.x;
    nor[i * 3 + 1] = n.y;
    nor[i * 3 + 2] = n.z;
    part[i] = def.part(p.x, p.y, p.z);
  }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  raw.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  raw.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
  mc.geometry.dispose();
  // 같은 위치의 정점을 합쳐 인덱스 메시로 (용량 1/5, 법선은 SDF 기준이라 이미 매끈)
  const g = mergeVertices(raw, 1e-4);
  g.computeBoundingSphere();
  return g;
}

function encodeGeometry(g: THREE.BufferGeometry): ArrayBuffer {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const part = g.getAttribute("aPart") as THREE.BufferAttribute;
  const idx = g.getIndex()!;
  const n = pos.count;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const header: CreatureMeshHeader = {
    vertexCount: n,
    indexCount: idx.count,
    min: [bb.min.x, bb.min.y, bb.min.z],
    max: [bb.max.x, bb.max.y, bb.max.z],
    index32: n > 65535,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const oHeader = 4;
  const oPos = align4(oHeader + headerBytes.length);
  const oNor = oPos + n * 6;
  const oPart = oNor + n * 3;
  const oIdx = align4(oPart + n);
  const total = oIdx + idx.count * (header.index32 ? 4 : 2);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  dv.setUint32(0, headerBytes.length, true);
  new Uint8Array(buf, oHeader, headerBytes.length).set(headerBytes);
  const p16 = new Int16Array(buf, oPos, n * 3);
  const n8 = new Int8Array(buf, oNor, n * 3);
  const p8 = new Uint8Array(buf, oPart, n);
  const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = (pos.array as Float32Array)[i * 3 + k];
      p16[i * 3 + k] = Math.round(((v - header.min[k]) / size[k]) * 65535 - 32768);
      n8[i * 3 + k] = Math.round(THREE.MathUtils.clamp((nor.array as Float32Array)[i * 3 + k], -1, 1) * 127);
    }
    p8[i] = (part.array as Float32Array)[i] > 0.5 ? 1 : 0;
  }
  const ia = header.index32 ? new Uint32Array(buf, oIdx, idx.count) : new Uint16Array(buf, oIdx, idx.count);
  for (let i = 0; i < idx.count; i++) ia[i] = idx.getX(i);
  return buf;
}

/** meshoptimizer 로 삼각형 수를 줄인다. 법선·부위(aPart)를 속성으로 넣어 지느러미/배 경계가 뭉개지지 않게 한다. */
function simplifyGeometry(g: THREE.BufferGeometry, targetTris: number): THREE.BufferGeometry {
  const pos = g.getAttribute("position").array as Float32Array;
  const nor = g.getAttribute("normal").array as Float32Array;
  const part = g.getAttribute("aPart").array as Float32Array;
  const n = pos.length / 3;
  const attrs = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    attrs[i * 4] = nor[i * 3];
    attrs[i * 4 + 1] = nor[i * 3 + 1];
    attrs[i * 4 + 2] = nor[i * 3 + 2];
    attrs[i * 4 + 3] = part[i];
  }
  const srcIdx = new Uint32Array(g.getIndex()!.array);
  const [idx, err] = MeshoptSimplifier.simplifyWithAttributes(srcIdx, pos, 3, attrs, 4, [0.3, 0.3, 0.3, 0.6], null, targetTris * 3, 0.02, ["Prune"]);
  // 쓰이는 정점만 남기고 다시 번호 매기기
  const remap = new Int32Array(n).fill(-1);
  let m = 0;
  for (let i = 0; i < idx.length; i++) if (remap[idx[i]] < 0) remap[idx[i]] = m++;
  const p2 = new Float32Array(m * 3), n2 = new Float32Array(m * 3), a2 = new Float32Array(m);
  for (let i = 0; i < n; i++) {
    const j = remap[i];
    if (j < 0) continue;
    p2.set(pos.subarray(i * 3, i * 3 + 3), j * 3);
    n2.set(nor.subarray(i * 3, i * 3 + 3), j * 3);
    a2[j] = part[i];
  }
  const i2 = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) i2[i] = remap[idx[i]];
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(p2, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(n2, 3));
  out.setAttribute("aPart", new THREE.BufferAttribute(a2, 1));
  out.setIndex(new THREE.BufferAttribute(i2, 1));
  console.log(`  simplify → ${idx.length / 3} tris (target ${targetTris}, error ${(err * 100).toFixed(2)}%)`);
  return out;
}

const def = DEFS[process.argv[2] ?? ""];
if (!def) {
  console.error(`usage: bake-creature <${Object.keys(DEFS).join("|")}> [resolution]`);
  process.exit(1);
}
const res = Number(process.argv[3] ?? def.resolution);
const t0 = performance.now();
await MeshoptSimplifier.ready;
const full = buildGeometry(def, res);
full.computeBoundingBox();
const bb = full.boundingBox!;
console.log(
  `${def.name}: marching cubes res=${res} verts=${full.getAttribute("position").count} tris=${full.getIndex()!.count / 3} bbox x[${bb.min.x.toFixed(2)},${bb.max.x.toFixed(2)}] y[${bb.min.y.toFixed(2)},${bb.max.y.toFixed(2)}] z[${bb.min.z.toFixed(2)},${bb.max.z.toFixed(2)}]`,
);
const publicDir = resolve(import.meta.dirname, "../public");
const prefix = new RegExp(`^${def.name}-.*\\.bin(\\.gz)?$`);
for (const f of readdirSync(publicDir)) if (prefix.test(f)) unlinkSync(resolve(publicDir, f));
// 파일명에 내용 해시를 넣어 영구 캐시(immutable)해도 다시 구우면 새 파일을 받게 한다
const files: Record<string, string> = {};
for (const lod of Object.keys(CREATURE_LODS) as CreatureLod[]) {
  const g = simplifyGeometry(full, CREATURE_LODS[lod]);
  const buf = Buffer.from(encodeGeometry(g));
  const hash = createHash("sha1").update(buf).digest("hex").slice(0, 8);
  const name = `${def.name}-${lod}.${hash}.bin`;
  writeFileSync(resolve(publicDir, name), buf);
  const gz = gzipSync(buf, { level: 9 });
  writeFileSync(resolve(publicDir, name + ".gz"), gz);
  files[lod] = `/${name}`;
  console.log(`  ${lod}: verts=${g.getAttribute("position").count} tris=${g.getIndex()!.count / 3} raw=${(buf.byteLength / 1024).toFixed(0)}KB gz=${(gz.byteLength / 1024).toFixed(0)}KB → ${name}`);
}
writeFileSync(
  resolve(import.meta.dirname, "../src", def.manifest.path),
  `// 자동 생성 (pnpm bake:${def.name}) — 손으로 고치지 말 것\nexport const ${def.manifest.exportName} = ${JSON.stringify(files, null, 2)} as const;\n`,
);
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
