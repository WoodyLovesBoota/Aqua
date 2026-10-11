/**
 * 베이크된 생물 메시의 바이너리 포맷 정의 (public/<name>-{lod}.{hash}.bin, 생성은 scripts/bake-creature.mts).
 * [u32 headerLen][JSON header][pad→4B][i16 position×3][i8 normal×3][u8 part][pad→4B][u16|u32 index]
 * 위치는 바운딩 박스 기준으로 16비트 양자화한다.
 * 이 모듈은 베이크 스크립트와 런타임이 함께 쓰므로 매니페스트(생성 파일)에 의존하지 않는다.
 */

/** LOD 별 목표 삼각형 수. hi: 스튜디오 본체, mid: 수조(작게 보임), lo: 그림자 프록시 */
export const CREATURE_LODS = { hi: 30000, mid: 12000, lo: 4000 } as const;
export type CreatureLod = keyof typeof CREATURE_LODS;
export type CreatureFiles = Readonly<Record<CreatureLod, string>>;

export interface CreatureMeshHeader {
  vertexCount: number;
  indexCount: number;
  min: [number, number, number];
  max: [number, number, number];
  index32: boolean;
}

/** 베이크 스크립트가 쓰는 생물 정의 (SDF + 그리드 범위 + 부위 분류) */
export interface CreatureDef {
  /** 파일 접두사 (public/<name>-hi.*.bin) */
  name: string;
  /** 자동 생성할 매니페스트 경로 (src/ 기준) 와 export 이름 */
  manifest: { path: string; exportName: string };
  sdf: (x: number, y: number, z: number) => number;
  /** 1 = 몸(배 색 허용), 0 = 지느러미(털 색만) */
  part: (x: number, y: number, z: number) => 0 | 1;
  /** 그리드 [-1,1]³ → 생물 좌표: g / gridScale + gridOffset */
  gridScale: [number, number, number];
  gridOffset: [number, number, number];
  /** marching cubes 해상도 기본값 */
  resolution: number;
}

export const align4 = (n: number) => (n + 3) & ~3;
