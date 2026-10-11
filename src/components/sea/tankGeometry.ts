import * as THREE from "three";

/** 옆면 단면 한 점: 둘레에서 바깥(+)/안쪽(-)으로 o 만큼, 높이 y, 법선 (바깥 nr, 위 ny) */
export interface ProfilePoint {
  o: number;
  y: number;
  nr: number;
  ny: number;
}

/** 둥근 모서리 단면: 직선 옆면 + 위/아래 모서리를 반지름 b 로 깎는다 */
export function slabProfile(y0: number, y1: number, topBevel: number, bottomBevel: number, segs = 6): ProfilePoint[] {
  const pts: ProfilePoint[] = [];
  const arc = (cy: number, b: number, from: number, to: number) => {
    for (let i = 0; i <= segs; i++) {
      const a = from + ((to - from) * i) / segs;
      pts.push({ o: -b + b * Math.cos(a), y: cy + b * Math.sin(a), nr: Math.cos(a), ny: Math.sin(a) });
    }
  };
  if (bottomBevel > 0) arc(y0 + bottomBevel, bottomBevel, -Math.PI / 2, 0);
  else pts.push({ o: 0, y: y0, nr: 1, ny: 0 });
  if (topBevel > 0) arc(y1 - topBevel, topBevel, 0, Math.PI / 2);
  else pts.push({ o: 0, y: y1, nr: 1, ny: 0 });
  return pts;
}

/**
 * 둥근 사각형 둘레(반폭 hx, hz, 모서리 반지름 r)를 따라 단면을 쓸어 만든 옆면.
 * 위·아래 뚜껑은 없다 — 수면/바닥이 따로 덮는다.
 */
export function roundedSlab(hx: number, hz: number, r: number, profile: ProfilePoint[], cornerSegs = 8) {
  const perim: { x: number; z: number; nx: number; nz: number }[] = [];
  const corners = [
    [hx - r, hz - r],
    [-(hx - r), hz - r],
    [-(hx - r), -(hz - r)],
    [hx - r, -(hz - r)],
  ];
  corners.forEach(([cx, cz], k) => {
    for (let i = 0; i <= cornerSegs; i++) {
      const a = (k * Math.PI) / 2 + (Math.PI / 2) * (i / cornerSegs);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      perim.push({ x: cx + nx * r, z: cz + nz * r, nx, nz });
    }
  });

  const rows = profile.length;
  const cols = perim.length;
  const pos = new Float32Array(rows * cols * 3);
  const nor = new Float32Array(rows * cols * 3);
  for (let i = 0; i < cols; i++) {
    const p = perim[i];
    for (let j = 0; j < rows; j++) {
      const s = profile[j];
      const k = (i * rows + j) * 3;
      pos[k] = p.x + p.nx * s.o;
      pos[k + 1] = s.y;
      pos[k + 2] = p.z + p.nz * s.o;
      nor[k] = p.nx * s.nr;
      nor[k + 1] = s.ny;
      nor[k + 2] = p.nz * s.nr;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < cols; i++) {
    const i1 = (i + 1) % cols;
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = i1 * rows + j;
      const c = i * rows + j + 1;
      const d = i1 * rows + j + 1;
      idx.push(a, c, b, b, c, d); // 바깥을 향하도록
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** XZ 바닥에 눕힌 둥근 사각형 판 (위를 향함) */
export function roundedPlate(hx: number, hz: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hx, hz - r);
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hx + r, hz);
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hx, -hz + r);
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  return g;
}
