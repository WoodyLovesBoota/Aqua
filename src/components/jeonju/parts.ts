import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { add, canvasTex, dn, type Kit } from "@/components/diorama/kit";
import { TOP } from "./layout";

/**
 * 전주 공용 부품: 재질(기와·단청·회벽·나무·붉은 기둥·돌·한지 창·청사초롱·나뭇잎) + 기와지붕 · 한옥 · 청사초롱 · 나무 · 장독대 · 돌담 · 바닥 빛.
 * 한 장면에 하나 — 재질을 공유해야 bakeStatic 이 한 드로우로 합친다. 단색 재질은 설정이 같으면 캐시에서 같은 것을 준다.
 */
export function makeParts(k: Kit) {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (o: Parameters<Kit["std"]>[0]) => {
    if (o.map || o.emissiveMap) return k.std(o);
    const key = JSON.stringify(o);
    let m = cache.get(key);
    if (!m) cache.set(key, (m = k.std(o)));
    return m;
  };

  const giwaTex = canvasTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = "#4a4d55";
      c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 10) {
        c.fillStyle = "#3b3e46";
        c.fillRect(x, 0, 4, h);
        c.fillStyle = "#5a5d66";
        c.fillRect(x + 5, 0, 2, h);
      }
      for (let y = 0; y < h; y += 16) {
        c.fillStyle = "rgba(0,0,0,.18)";
        c.fillRect(0, y, w, 2);
      }
    },
    { repeat: [3, 2] },
  );
  const hanji = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = "#fbf1d8";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#6e4b30";
    c.lineWidth = 3;
    for (let i = 0; i <= w; i += 16) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, h);
      c.stroke();
      c.beginPath();
      c.moveTo(0, i);
      c.lineTo(w, i);
      c.stroke();
    }
    c.strokeRect(2, 2, w - 4, h - 4);
  });
  const stoneWallTex = canvasTex(
    128,
    64,
    (c, w, h) => {
      c.fillStyle = "#cfc5b3";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        c.fillStyle = ["#b3a891", "#d9d0c0", "#9f9580"][Math.floor(k.rnd() * 3)];
        c.beginPath();
        c.ellipse(k.rnd() * w, k.rnd() * h, 5 + k.rnd() * 6, 3 + k.rnd() * 3, 0, 0, 6.3);
        c.fill();
      }
    },
    { repeat: [3, 1] },
  );

  const M = {
    GIWA: k.std({ color: dn("#ffffff", "#c4c6dc"), map: giwaTex, roughness: 0.75 }),
    DANCHEONG: mat({ color: "#3f7a66", roughness: 0.7, side: THREE.BackSide }), // 처마 밑 단청 초록
    RIDGE: mat({ color: "#34363d" }),
    PLASTER: mat({ color: "#f3eee2", glow: ["#ffe2b0", 0.08] }),
    WOOD: mat({ color: "#6e4b30" }),
    RED: mat({ color: "#a83a2c", roughness: 0.6 }),
    STONE: mat({ color: "#b9b3a6", roughness: 0.95 }),
    WIN: k.std({ color: "#ffffff", map: hanji, emissiveMap: hanji, roughness: 0.9, glow: ["#ffc778", 1.7] }),
    LAN_R: mat({ color: "#c83a32", roughness: 0.6, glow: ["#ff7a50", 2.6] }),
    LAN_B: mat({ color: "#2f4f9a", roughness: 0.6, glow: ["#6f8cff", 1.6] }),
    STONE_WALL: k.std({ color: "#ffffff", map: stoneWallTex, roughness: 0.95 }),
    ONGGI: mat({ color: "#5a3a28", roughness: 0.35, metalness: 0.1 }),
    TRUNK: mat({ color: "#6b5444" }),
    PINE_TRUNK: mat({ color: "#8a4f3a" }),
    KAM: mat({ color: "#f07a24", glow: ["#ff8a3a", 0.3] }),
    LEAF: {
      ginkgo: mat({ color: dn("#f2c230", "#d9a933"), roughness: 0.8 }),
      maple: mat({ color: dn("#d9472b", "#b8402c"), roughness: 0.8 }),
      pine: mat({ color: dn("#3c6b4c", "#2c4a3a"), roughness: 0.85 }),
      persimmon: mat({ color: dn("#8a9a46", "#6f7a3c") }),
    },
  };

  /** [x, z] 청사초롱 자리 (밤 빛 웅덩이용, 월드 좌표) */
  const lanterns: [number, number][] = [];

  /** 기와지붕: 처마가 오목하게 휘고 네 귀가 들린 우진각/모임 지붕. 윗면 기와 골, 아랫면 단청, 곡면을 따르는 내림마루, 용마루 끝 흰 망와 */
  function giwa(parent: THREE.Object3D, w: number, d: number, h: number, x: number, y: number, z: number, lift = 0.18) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    const hw = w / 2, hd = d / 2;
    const surf = (px: number, pz: number) => {
      const u = Math.min(1, Math.abs(px) / hw), v = Math.min(1, Math.abs(pz) / hd);
      const t = THREE.MathUtils.clamp(Math.min((hw - Math.abs(px)) / hd, (hd - Math.abs(pz)) / hd), 0, 1); // 0 처마 → 1 마루 (pow 에 음수가 들어가면 NaN)
      return h * Math.pow(t, 1.45) + lift * Math.pow(u, 3) * Math.pow(v, 3) * (1 - t) + lift * 0.35 * (Math.pow(u, 4) + Math.pow(v, 4)) * (1 - t);
    };
    const geo = new THREE.PlaneGeometry(w, d, 24, 16);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, surf(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    add(g, geo, M.GIWA);
    add(g, geo, M.DANCHEONG, 0, -0.035, 0).castShadow = false;
    const rl = Math.max(0, hw - hd);
    if (rl > 0.01) {
      add(g, new THREE.BoxGeometry(rl * 2 + 0.14, 0.09, 0.1), M.RIDGE, 0, h + 0.03, 0);
      for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, 0.11, 0.12), M.PLASTER, s * (rl + 0.08), h + 0.04, 0);
    }
    // 내림마루: 용마루 끝 → 귀, 지붕 곡면을 따라 (직선이면 오목한 면 위로 떠 보인다)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const pts: THREE.Vector3[] = [];
        for (let q = 0; q <= 10; q++) {
          const a = q / 10, px = sx * (rl + (hw - 0.04 - rl) * a), pz = sz * (hd - 0.04) * a;
          pts.push(new THREE.Vector3(px, surf(px, pz) + 0.03, pz));
        }
        add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.03, 5), M.RIDGE);
      }
    return g;
  }

  /** 한옥 한 채: 기단 + 기둥·창방 + 흰 회벽 + 창호(밤엔 한지 불빛) + 기와지붕 */
  function hanok(parent: THREE.Object3D, x: number, z: number, ry: number, w: number, d: number, o: { wallH?: number; roofH?: number; lift?: number; red?: boolean } = {}) {
    const g = new THREE.Group();
    g.position.set(x, TOP, z);
    g.rotation.y = ry;
    parent.add(g);
    const wallH = o.wallH ?? 0.62, post = o.red ? M.RED : M.WOOD;
    add(g, new RoundedBoxGeometry(w + 0.24, 0.14, d + 0.24, 2, 0.03), M.STONE, 0, 0.07, 0);
    add(g, new THREE.BoxGeometry(w, wallH, d), M.PLASTER, 0, 0.14 + wallH / 2, 0);
    const n = Math.max(2, Math.round(w / 0.45));
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, wallH, 0.06), post, -w / 2 + (i * w) / n, 0.14 + wallH / 2, s * (d / 2 + 0.005));
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(w + 0.04, 0.06, 0.07), post, 0, 0.14 + wallH - 0.03, s * (d / 2 + 0.005));
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + ((i + 0.5) * w) / n, door = i === Math.floor(n / 2) || i === Math.floor((n - 1) / 2);
      const wh = door ? wallH * 0.78 : wallH * 0.45;
      add(g, new THREE.BoxGeometry((w / n) * 0.7, wh, 0.02), M.WIN, cx, 0.14 + (door ? wh / 2 + 0.03 : wallH * 0.55), d / 2 + 0.02).castShadow = false;
    }
    giwa(g, w + 0.75, d + 0.7, o.roofH ?? 0.5, 0, 0.14 + wallH, 0, o.lift ?? 0.17);
    return g;
  }

  /** 청사초롱: 기둥 + 팔 + 위 파랑·아래 빨강 등. track=false 면 빛 웅덩이 목록에 넣지 않는다 */
  function chorong(parent: THREE.Object3D, x: number, z: number, h = 0.55, track = true) {
    add(parent, new THREE.CylinderGeometry(0.012, 0.016, h, 5), M.WOOD, x, h / 2, z);
    add(parent, new THREE.BoxGeometry(0.16, 0.012, 0.012), M.WOOD, x + 0.06, h, z);
    add(parent, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), M.LAN_B, x + 0.12, h - 0.06, z);
    add(parent, new THREE.CylinderGeometry(0.06, 0.052, 0.09, 10), M.LAN_R, x + 0.12, h - 0.135, z);
    if (track) lanterns.push([x + 0.12, z]);
  }

  /** 나무: 은행(노랑) · 단풍(빨강) · 감(주황 열매) · 소나무 */
  function tree(parent: THREE.Object3D, kind: "ginkgo" | "maple" | "persimmon" | "pine", x: number, z: number, s = 1, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = k.rnd() * 6;
    g.scale.setScalar(s);
    parent.add(g);
    const leaf = M.LEAF[kind];
    if (kind === "pine") {
      add(g, new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), M.PINE_TRUNK, 0.04, 0.4, 0).rotation.z = 0.15;
      for (const [px, py, pz, r] of [[0.1, 0.8, 0, 0.32], [-0.18, 0.62, 0.1, 0.24], [0.28, 0.66, -0.12, 0.22]]) {
        const c = new THREE.SphereGeometry(r, 10, 6);
        c.scale(1.4, 0.45, 1.2);
        add(g, c, leaf, px, py, pz);
      }
      return g;
    }
    add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.7, 6), M.TRUNK, 0, 0.35, 0);
    if (kind === "ginkgo") {
      const c = new THREE.SphereGeometry(0.42, 14, 10);
      c.scale(1, 1.45, 1);
      add(g, c, leaf, 0, 1.05, 0);
      for (let i = 0; i < 4; i++) add(g, new THREE.SphereGeometry(0.22, 10, 8), leaf, Math.cos(i * 1.6) * 0.3, 0.75 + i * 0.12, Math.sin(i * 1.6) * 0.3);
    } else {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + k.rnd();
        add(g, new THREE.SphereGeometry(0.26 + k.rnd() * 0.1, 10, 8), leaf, Math.cos(a) * 0.24, 0.85 + k.rnd() * 0.25, Math.sin(a) * 0.24);
      }
      add(g, new THREE.SphereGeometry(0.3, 10, 8), leaf, 0, 1.1, 0);
    }
    if (kind === "persimmon")
      for (let i = 0; i < 12; i++) {
        const a = k.rnd() * 6.28, r = 0.3 + k.rnd() * 0.15;
        add(g, new THREE.SphereGeometry(0.045, 8, 6), M.KAM, Math.cos(a) * r, 0.8 + k.rnd() * 0.45, Math.sin(a) * r);
      }
    return g;
  }

  /** 장독대: 돌단 + 옹기 항아리 무리 */
  function jangdok(parent: THREE.Object3D, x: number, z: number, n = 6) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = k.rnd() * 3;
    parent.add(g);
    add(g, new RoundedBoxGeometry(0.75, 0.08, 0.5, 2, 0.02), M.STONE, 0, 0.04, 0);
    for (let i = 0; i < n; i++) {
      const s = 0.6 + k.rnd() * 0.5, j = new THREE.SphereGeometry(0.1 * s, 12, 10), jx = -0.26 + (i % 3) * 0.26, jz = i < 3 ? -0.1 : 0.12;
      j.scale(1, 1.15, 1);
      add(g, j, M.ONGGI, jx, 0.08 + 0.11 * s, jz);
      add(g, new THREE.CylinderGeometry(0.06 * s, 0.065 * s, 0.03, 10), M.ONGGI, jx, 0.08 + 0.23 * s, jz);
    }
  }

  /** 돌담 + 기와 얹은 담: a → b */
  function wall(parent: THREE.Object3D, a: [number, number], b: [number, number], h = 0.32) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const g = new THREE.Group();
    g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    g.rotation.y = -Math.atan2(dz, dx);
    parent.add(g);
    add(g, new THREE.BoxGeometry(L, h, 0.14), M.STONE_WALL, 0, h / 2, 0);
    const cap = new THREE.CylinderGeometry(0.1, 0.1, L + 0.06, 3);
    cap.rotateZ(Math.PI / 2);
    cap.rotateX(Math.PI / 6);
    cap.scale(1, 0.55, 1.5);
    add(g, cap, M.GIWA, 0, h + 0.03, 0);
  }

  /** 바닥에 눕힌 빛 무늬 (그림자 없음) */
  function decal(parent: THREE.Object3D, m: THREE.Material, x: number, y: number, z: number, sx: number, sz = sx) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), m);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, y, z);
    d.renderOrder = 3;
    parent.add(d);
    return d;
  }
  /** 가산 혼합 밤 전용 재질 */
  const nightAdd = <T extends THREE.Material>(m: T) => {
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    return k.nightOnly(m);
  };

  /** 정점색 재질 하나 — 색만 다른 작은 부품(지붕·먹거리·한복)을 한 드로우로. tint(geo, 색) 으로 칠해서 쓴다 */
  const VC = mat({ color: "#ffffff", vertexColors: true, roughness: 0.7 });
  const VC_GLOW = mat({ color: "#ffffff", vertexColors: true, roughness: 0.7, glow: ["#ffd9a8", 0.3] });

  return { M, mat, VC, VC_GLOW, lanterns, giwa, hanok, chorong, tree, jangdok, wall, decal, nightAdd };
}
export type Parts = ReturnType<typeof makeParts>;


/** 지오메트리 전체를 한 색으로 칠한다 (정점색 재질용) */
export function tint<G extends THREE.BufferGeometry>(geo: G, color: string) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** uv 를 아틀라스 칸 (col, row) / (cols, rows) 로 옮긴다 — 그림만 다른 부품이 텍스처 하나를 나눠 쓰게 */
export function atlasUV<G extends THREE.BufferGeometry>(geo: G, col: number, row: number, cols: number, rows: number) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / cols, (row + uv.getY(i)) / rows);
  return geo;
}
