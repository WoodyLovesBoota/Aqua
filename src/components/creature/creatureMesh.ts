import * as THREE from "three";
import { align4, type CreatureFiles, type CreatureLod, type CreatureMeshHeader } from "./creatureFormat";

export { CREATURE_LODS, type CreatureLod, type CreatureFiles } from "./creatureFormat";

function decodeCreatureGeometry(buf: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buf);
  const headerLen = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen))) as CreatureMeshHeader;
  const n = header.vertexCount;
  const oPos = align4(4 + headerLen);
  const oNor = oPos + n * 6;
  const oPart = oNor + n * 3;
  const oIdx = align4(oPart + n);
  const p16 = new Int16Array(buf, oPos, n * 3);
  const n8 = new Int8Array(buf, oNor, n * 3);
  const p8 = new Uint8Array(buf, oPart, n);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const part = new Float32Array(n);
  const size = [header.max[0] - header.min[0], header.max[1] - header.min[1], header.max[2] - header.min[2]];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = ((p16[i * 3 + k] + 32768) / 65535) * size[k] + header.min[k];
      nor[i * 3 + k] = n8[i * 3 + k] / 127;
    }
    part[i] = p8[i];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
  g.setIndex(
    header.index32
      ? new THREE.BufferAttribute(new Uint32Array(buf, oIdx, header.indexCount), 1)
      : new THREE.BufferAttribute(new Uint16Array(buf, oIdx, header.indexCount), 1),
  );
  g.computeBoundingSphere();
  return g;
}

const pending = new Map<string, Promise<THREE.BufferGeometry>>();

/** 페이지가 먼저 preload 할 수 있도록 실제 요청 URL 을 공개한다 */
export function creatureMeshUrl(files: CreatureFiles, lod: CreatureLod): string {
  const gz = typeof DecompressionStream !== "undefined";
  return gz ? `${files[lod]}.gz` : files[lod];
}

async function fetchMesh(url: string): Promise<ArrayBuffer> {
  // 정적 파일은 서버가 압축해 주지 않으므로 gzip 본을 받아 브라우저에서 푼다 (지원 안 되면 원본)
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`${url} ${r.status}`);
  if (url.endsWith(".gz")) return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return r.arrayBuffer();
}

/** 베이크된 메시를 LOD 별로 한 번만 내려받아 공유한다. */
export function loadCreatureGeometry(files: CreatureFiles, lod: CreatureLod): Promise<THREE.BufferGeometry> {
  const url = creatureMeshUrl(files, lod);
  let p = pending.get(url);
  if (!p) {
    p = fetchMesh(url).then(decodeCreatureGeometry);
    pending.set(url, p);
  }
  return p;
}
