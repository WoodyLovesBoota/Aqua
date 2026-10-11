import * as THREE from "three";
import { type CreatureDef } from "@/components/creature/creatureFormat";
import { type Fin, makeFin, makeSurface, sdFin, sdRoundBox, sdRoundCone, smin } from "@/components/creature/sdf";

/**
 * 상어 좌표계: +x = 코(앞), +y = 위, +z = 오른쪽. 몸 길이 ≈ 3.3 (x: 1.8 ~ -1.5)
 * 몸통·해머·지느러미를 SDF(부호 거리 함수)로 정의하고 smooth-min 으로 녹여 이음새 없는 인형 형태를 만든다.
 * 메시는 빌드 타임에 scripts/bake-shark.mts 가 marching cubes 로 구워 public/shark.bin 에 넣고,
 * 런타임에서는 이 모듈을 눈·입·장식을 표면에 붙이는 앵커 계산에만 쓴다.
 * 머리(해머)는 x > 0.9 영역에 있고, 헤엄 변형(셰이더)은 x < 0.9 에서만 걸린다.
 */

export const HAMMER = { x: 1.3, halfW: 0.42, halfH: 0.2, halfD: 0.86, radius: 0.2 };
export const EYE_GUESS = { x: 1.22, y: 0.03, z: 0.9, r: 0.12 };

const FINS: Fin[] = (() => {
  const list: Fin[] = [];
  // 등지느러미: 둥근 삼각형, 끝으로 갈수록 얇게
  list.push(
    makeFin(
      [
        [0.3, -0.1],
        [0.12, 0.4],
        [-0.12, 0.68],
        [-0.3, 0.62],
        [-0.3, 0.25],
        [-0.44, -0.1],
      ],
      0.1,
      0.07,
      new THREE.Vector3(-0.05, 0.45, 0),
      new THREE.Euler(0, 0, 0),
    ),
  );
  // 꼬리지느러미: 통통한 초승달. 홈을 얕게 해서 뒤에서 봐도 고리처럼 보이지 않게
  list.push(
    makeFin(
      [
        [0.12, 0.1],
        [-0.22, 0.5],
        [-0.42, 0.74],
        [-0.56, 0.68],
        [-0.5, 0.36],
        [-0.46, 0.0],
        [-0.5, -0.3],
        [-0.5, -0.46],
        [-0.36, -0.46],
        [-0.16, -0.26],
        [0.06, -0.12],
      ],
      0.1,
      0.06,
      new THREE.Vector3(-1.4, 0.1, 0),
      new THREE.Euler(0, 0, 0),
    ),
  );
  for (const side of [1, -1]) {
    // 가슴지느러미: 둥근 노 모양
    list.push(
      makeFin(
        [
          [0.28, -0.05],
          [0.16, 0.3],
          [-0.1, 0.58],
          [-0.32, 0.6],
          [-0.36, 0.35],
          [-0.3, -0.05],
        ],
        0.1,
        0.07,
        new THREE.Vector3(0.5, -0.2, side * 0.42),
        new THREE.Euler(side * (Math.PI / 2 + 0.6), side * -0.45, 0, "YXZ"),
      ),
    );
    // 배지느러미 (작게)
    list.push(
      makeFin(
        [
          [0.12, 0],
          [0.02, 0.15],
          [-0.14, 0.27],
          [-0.22, 0.23],
          [-0.18, 0],
        ],
        0.06,
        0.04,
        new THREE.Vector3(-0.62, -0.32, side * 0.22),
        new THREE.Euler(side * (Math.PI / 2 + 1.0), side * -0.3, 0, "YXZ"),
      ),
    );
  }
  return list;
})();

export function sdBody(px: number, py: number, pz: number) {
  // 배는 살짝 납작하게, 단면은 약간 가로로 넓게
  const y = py < 0 ? py * 1.12 : py;
  const yy = y * 1.08;
  let d = sdRoundCone(px, yy, pz, 1.1, 0, 0, 0.3, 0.02, 0, 0.52, 0.62);
  d = smin(d, sdRoundCone(px, yy, pz, 0.3, 0.02, 0, -0.5, 0.05, 0, 0.62, 0.4), 0.3);
  d = smin(d, sdRoundCone(px, yy, pz, -0.5, 0.05, 0, -1.15, 0.08, 0, 0.38, 0.15), 0.3);
  d = smin(d, sdRoundCone(px, yy, pz, -1.15, 0.08, 0, -1.5, 0.1, 0, 0.15, 0.07), 0.2);
  return d;
}

export function sdHammer(px: number, py: number, pz: number) {
  const k = Math.min(1, Math.abs(pz) / HAMMER.halfD);
  const k2 = k * k;
  // 끝으로 갈수록 뒤로 젖혀지고 가늘어진다
  const x = px - HAMMER.x + 0.2 * k2;
  const y = py / (1 - 0.34 * k2) - 0.02 * k;
  return sdRoundBox(x, y, pz, HAMMER.halfW * (1 - 0.18 * k2), HAMMER.halfH, HAMMER.halfD, HAMMER.radius);
}

export function sdFins(px: number, py: number, pz: number) {
  let d = Infinity;
  for (const f of FINS) d = Math.min(d, sdFin(px, py, pz, f));
  return d;
}

export function sdShark(px: number, py: number, pz: number) {
  let d = smin(sdBody(px, py, pz), sdHammer(px, py, pz), 0.28);
  d = smin(d, sdFins(px, py, pz), 0.14);
  return d;
}

/** 표면 법선·투영·앵커 */
export const surface = makeSurface(sdShark);
export const { normal: sdNormal, project: projectToSurface, anchor: surfaceAnchor } = surface;


export function eyeAnchor(side: 1 | -1): { p: THREE.Vector3; n: THREE.Vector3 } {
  const p = projectToSurface(new THREE.Vector3(EYE_GUESS.x, EYE_GUESS.y, side * EYE_GUESS.z), 0.0);
  return { p, n: sdNormal(p) };
}

/** 아가미 스티치 (머리 뒤 몸통 옆면, 3줄) */
export function gillPoints(side: 1 | -1): { p: THREE.Vector3; n: THREE.Vector3 }[] {
  return [0.78, 0.66, 0.54].map((x) => {
    const p = projectToSurface(new THREE.Vector3(x, 0.02, side * 0.7), 0.01);
    return { p, n: sdNormal(p) };
  });
}

export function headTop(): THREE.Vector3 {
  return projectToSurface(new THREE.Vector3(HAMMER.x - 0.05, 0.5, 0), 0);
}


/** 베이크 정의. 범위: x [-2.1, 1.9] (꼬리지느러미 끝 -1.96), y [-0.8, 1.3] (등지느러미 끝 ≈ 1.2), z [-1.11, 1.11] */
export const SHARK_DEF: CreatureDef = {
  name: "shark",
  manifest: { path: "components/shark/sharkManifest.ts", exportName: "SHARK_FILES" },
  sdf: sdShark,
  // 지느러미 위의 점이면 0 (배 색 제외)
  part: (x, y, z) => (sdFins(x, y, z) + 0.03 < Math.min(sdBody(x, y, z), sdHammer(x, y, z)) ? 0 : 1),
  gridScale: [0.5, 0.952, 0.9],
  gridOffset: [-0.1, 0.25, 0],
  resolution: 112,
};
