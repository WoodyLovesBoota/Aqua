import * as THREE from "three";
import { add, canvasTex, dn, type Kit } from "@/components/diorama/kit";

/**
 * 파리 공용 부품: 재질(석회암·함석·주철·파리 녹색·금박·빨강·가로등) + 오스만 파사드 텍스처 · 망사르드 지붕 · 나무 · 가로등 · 바닥 빛.
 * 한 장면에 하나 — 재질을 공유해야 bakeStatic 이 한 드로우로 합친다. 단색 재질은 설정이 같으면 캐시에서 같은 것을 준다.
 */
export function makeParts(k: Kit) {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (o: Parameters<Kit["std"]>[0]) => {
    if (o.map || o.emissiveMap || o.alphaMap) return k.std(o);
    const key = JSON.stringify(o);
    let m = cache.get(key);
    if (!m) cache.set(key, (m = k.std(o)));
    return m;
  };

  const M = {
    LIME: mat({ color: "#eadfc8", roughness: 0.9 }), // 파리 석회암
    LIME_D: mat({ color: "#d6c8ad", roughness: 0.9 }),
    ZINC: mat({ color: dn("#7f8b9b", "#5d6677"), roughness: 0.5, metalness: 0.35 }), // 함석 망사르드
    IRON: mat({ color: "#2b2f33", roughness: 0.6, metalness: 0.3 }),
    GREEN: mat({ color: "#2f5a45", roughness: 0.55, metalness: 0.2 }), // 파리 공공 녹색 (부키니스트·모리스 기둥·기마르)
    GOLD: mat({ color: "#d6a845", roughness: 0.3, metalness: 0.85, glow: ["#ffcf70", 0.5] }),
    RED: mat({ color: "#b7342f", roughness: 0.55 }),
    WHITE: mat({ color: "#f7f3ea", roughness: 0.8 }),
    LAMP: mat({ color: "#fff1c8", glow: ["#ffc56b", 3.2] }),
    CHIMNEY: mat({ color: "#c9b79c" }),
    POT: mat({ color: "#b4643f" }),
    TRUNK: mat({ color: "#7a6656" }),
    CANDLE: mat({ color: "#fffaf0", glow: ["#ffffff", 0.2] }),
    LEAF: {
      plane: mat({ color: dn("#7ba35a", "#3f5a3a"), roughness: 0.85 }),
      cherry: mat({ color: dn("#f4b9cc", "#b88aa3"), roughness: 0.8 }),
      chestnut: mat({ color: dn("#5e8f4c", "#35503a"), roughness: 0.85 }),
    },
  };

  /** [x, z, 크기] 밤 빛 웅덩이 자리 (월드 좌표) */
  const pools: [number, number, number][] = [];

  /**
   * 오스만 파사드: 크림 석회암 + 키 큰 창 격자 + 발코니 줄(rows 번째 층). 밤엔 창 일부(lit 비율)와 1층 가게가 켜진다.
   * 같은 그림을 낮(map)·밤(emissiveMap) 두 장으로 그려 발광 세기만 보간한다.
   */
  function facade(cols: number, rows: number, o: { balc?: number[]; shop?: boolean; arch?: boolean; lit?: number; bg?: string } = {}) {
    const cw = 32, rh = 40, w = cols * cw, h = rows * rh;
    const lit = Array.from({ length: cols * rows }, () => k.rnd() < (o.lit ?? 0.55));
    const draw = (night: boolean) => (g: CanvasRenderingContext2D) => {
      g.fillStyle = night ? "#000" : (o.bg ?? "#eee2c8");
      g.fillRect(0, 0, w, h);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw + 8, y = r * rh + 8, ground = r === rows - 1 && o.shop;
          if (night) {
            if (lit[r * cols + c] || ground) {
              g.fillStyle = ground ? "#ffb35a" : "#ffd28a";
              g.fillRect(x, y, cw - 16, rh - 12);
            }
            continue;
          }
          g.fillStyle = ground ? "#3a2c28" : "#5e6a78";
          g.fillRect(x, y, cw - 16, rh - 12);
          if (o.arch) {
            g.beginPath();
            g.arc(x + (cw - 16) / 2, y, (cw - 16) / 2, Math.PI, 0);
            g.fill();
          }
          g.fillStyle = "rgba(255,255,255,.35)";
          g.fillRect(x + (cw - 16) / 2 - 1, y, 2, rh - 12);
        }
      if (night) return;
      g.fillStyle = "rgba(120,100,70,.25)";
      for (let r = 1; r < rows; r++) g.fillRect(0, r * rh - 2, w, 2);
      g.fillStyle = "#2b2f33";
      for (const r of o.balc ?? []) {
        g.fillRect(0, r * rh + rh - 6, w, 3);
        for (let x = 0; x < w; x += 4) g.fillRect(x, r * rh + rh - 12, 1, 6);
      }
    };
    const map = canvasTex(w, h, draw(false)), em = canvasTex(w, h, draw(true));
    return k.std({ color: "#ffffff", map, emissiveMap: em, roughness: 0.9, glow: ["#ffffff", 1.3] });
  }

  /** 망사르드 지붕: 사다리꼴 함석 + 앞뒤 지붕창 + 굴뚝(토관). y = 처마 높이 */
  function mansard(parent: THREE.Object3D, w: number, d: number, h: number, y: number, chimney = true) {
    const i = Math.min(w, d) * 0.22;
    const b = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    const t = [[-w / 2 + i, -d / 2 + i], [w / 2 - i, -d / 2 + i], [w / 2 - i, d / 2 - i], [-w / 2 + i, d / 2 - i]];
    const pos: number[] = [];
    for (let q = 0; q < 4; q++) {
      const n = (q + 1) % 4;
      pos.push(b[q][0], 0, b[q][1], t[n][0], h, t[n][1], b[n][0], 0, b[n][1], b[q][0], 0, b[q][1], t[q][0], h, t[q][1], t[n][0], h, t[n][1]);
    }
    pos.push(t[0][0], h, t[0][1], t[2][0], h, t[2][1], t[1][0], h, t[1][1], t[0][0], h, t[0][1], t[3][0], h, t[3][1], t[2][0], h, t[2][1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    add(parent, g, M.ZINC, 0, y, 0);
    const nd = Math.max(1, Math.round(w / 0.32));
    for (const s of [-1, 1])
      for (let q = 0; q < nd; q++) {
        const x = -w / 2 + (q + 0.5) * (w / nd), z = s * (d / 2 - i * 0.45);
        add(parent, new THREE.BoxGeometry(0.1, 0.13, 0.08), M.WHITE, x, y + h * 0.42, z);
        const cap = new THREE.ConeGeometry(0.08, 0.06, 4);
        cap.rotateY(Math.PI / 4);
        add(parent, cap, M.ZINC, x, y + h * 0.42 + 0.09, z);
      }
    if (!chimney) return;
    for (let q = 0; q < 3; q++) {
      const x = -w / 2 + i + k.rnd() * (w - 2 * i);
      add(parent, new THREE.BoxGeometry(0.16, 0.18, 0.08), M.CHIMNEY, x, y + h + 0.09, 0);
      for (let p = 0; p < 3; p++) add(parent, new THREE.CylinderGeometry(0.018, 0.022, 0.06, 6), M.POT, x - 0.05 + p * 0.05, y + h + 0.21, 0);
    }
  }

  /** 나무: 플라타너스 · 벚꽃 · 마로니에(흰 꽃대) */
  function tree(parent: THREE.Object3D, kind: "plane" | "cherry" | "chestnut", x: number, z: number, s = 1, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = k.rnd() * 6;
    g.scale.setScalar(s);
    parent.add(g);
    add(g, new THREE.CylinderGeometry(0.035, 0.06, 0.62, 6), M.TRUNK, 0, 0.31, 0);
    const leaf = M.LEAF[kind];
    if (kind === "chestnut") {
      const c = new THREE.SphereGeometry(0.4, 14, 10);
      c.scale(1, 1.25, 1);
      add(g, c, leaf, 0, 0.95, 0);
      for (let i = 0; i < 14; i++) {
        const a = k.rnd() * 6.28, yy = 0.7 + k.rnd() * 0.5, r = 0.36 * Math.sqrt(Math.max(0, 1 - ((yy - 0.95) / 0.55) ** 2)) + 0.02;
        add(g, new THREE.ConeGeometry(0.03, 0.09, 5), M.CANDLE, Math.cos(a) * r, yy, Math.sin(a) * r).castShadow = false;
      }
      return g;
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + k.rnd();
      add(g, new THREE.SphereGeometry(0.24 + k.rnd() * 0.1, 10, 8), leaf, Math.cos(a) * 0.22, 0.78 + k.rnd() * 0.22, Math.sin(a) * 0.22);
    }
    add(g, new THREE.SphereGeometry(0.28, 10, 8), leaf, 0, 1.0, 0);
    return g;
  }

  /** 가로등: 검은 주철 기둥 + 등 + 갓. pool=false 면 빛 웅덩이를 만들지 않는다 */
  function lamp(parent: THREE.Object3D, x: number, z: number, pool = true) {
    add(parent, new THREE.CylinderGeometry(0.014, 0.024, 0.55, 6), M.IRON, x, 0.275, z);
    add(parent, new THREE.CylinderGeometry(0.035, 0.022, 0.07, 6), M.LAMP, x, 0.58, z).castShadow = false;
    add(parent, new THREE.ConeGeometry(0.045, 0.04, 6), M.IRON, x, 0.635, z);
    if (pool) pools.push([x, z, 0.85]);
  }

  /** 가산 혼합 밤 전용 재질 */
  const nightAdd = <T extends THREE.Material>(m: T) => {
    m.blending = THREE.AdditiveBlending;
    m.depthWrite = false;
    return k.nightOnly(m);
  };

  /** 정점색 재질 — 색만 다른 작은 부품(배·목마·책)을 한 드로우로. tint(geo, 색) 으로 칠해서 쓴다 */
  const VC = mat({ color: "#ffffff", vertexColors: true, roughness: 0.7 });
  const VC_GLOW = mat({ color: "#ffffff", vertexColors: true, roughness: 0.4, glow: ["#ffc070", 1.8] });

  return { M, mat, VC, VC_GLOW, pools, facade, mansard, tree, lamp, nightAdd };
}
export type Parts = ReturnType<typeof makeParts>;

/** 지오메트리 전체를 한 색으로 칠한다 (정점색 재질용) */
export function tint<G extends THREE.BufferGeometry>(geo: G, color: string) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** 두 지점 사이 수직 회전: 로컬 x 가 강 흐름(접선 tg)에 수직이 되는 rotation.y */
export const acrossRiver = (tg: THREE.Vector2) => Math.atan2(-tg.x, -tg.y);
/** 로컬 x 가 강 흐름을 따르는 rotation.y */
export const alongRiver = (tg: THREE.Vector2) => -Math.atan2(tg.y, tg.x);
