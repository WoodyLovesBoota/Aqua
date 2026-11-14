import * as THREE from "three";
import { floorHeightGLSL } from "./lagoonHeight";
import { ENV } from "./dayCycle";
import { SIM_TEXEL } from "./waterSim";

/** 둥근 사각형 SDF (바깥 > 0) — 수면·모래가 둘레 밖을 버릴 때 공용 */
export const roundedRectGLSL = /* glsl */ `
float roundedRect(vec2 p, vec2 half_, float corner) {
  return length(max(abs(p) - (half_ - corner), 0.0)) - corner;
}
`;

/** 하루 주기 공용 유니폼 (dayCycle.ENV) — 자체 조명 셰이더가 환경광·주광·하늘색·조명 켜짐을 같이 본다 */
const envGLSL = /* glsl */ `
uniform vec3 uEnvLight;  // 선형 배율 (정오 1, 밤 ≈ 0.1~0.3 푸른빛)
uniform vec3 uKeyDir;    // 주광(해/달)이 오는 방향 (월드)
uniform vec3 uKeyCol;    // 주광 반사 색 × 세기
uniform vec3 uSkyCol;    // 비치는 하늘 색
uniform float uSunUp;    // 해가 떠 있는 정도 (커스틱·빛줄기)
uniform float uLamp;     // 밤 조명 켜짐
`;

/** 물 색 (라군 청록 하나로 고정): 얕은 곳 · 깊은 곳 · 모래 위 물빛 */
const WATER = { shallow: "#8fe6dc", deep: "#149ab4", tint: "#a8f0e6" };

/** 밤 빛 웅덩이 자리 개수: 방갈로 수중등(수면) · 섬 횃불(모래) */
export const POOL_N = 8;
export const TORCH_N = 4;
const zeros = (n: number) => Array.from({ length: n }, () => new THREE.Vector2(1e4, 1e4));

/** 공통: 수면 높이 — 기본 잔물결(해석적) + 시뮬 높이 텍스처(waterSim) */
const heightGLSL = /* glsl */ `
uniform float uTime;
uniform sampler2D uHeight;   // 시뮬 높이장 (R)
uniform vec2 uSimTexel;      // 1/해상도
uniform float uAmp;          // 시뮬 높이 배율 (월드)
uniform float uSlopeK;       // 법선 기울기 과장
uniform vec2 uHalf;          // 수면 반폭 (x, z)

float baseWave(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 2.1 + t * 1.3) * 0.5;
  h += sin(p.y * 2.7 - t * 1.1) * 0.5;
  h += sin((p.x + p.y) * 1.6 + t * 0.8) * 0.4;
  h += sin((p.x - p.y * 0.6) * 3.3 - t * 1.7) * 0.2;
  return h * 0.02;
}

float edgeFade(vec2 p) {
  return smoothstep(0.0, 0.3, min(uHalf.x - abs(p.x), uHalf.y - abs(p.y)));
}
`;

const surfaceVertex = /* glsl */ `
${heightGLSL}
${floorHeightGLSL}
uniform float uTop;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUvP;
varying float vDepth;
varying float vR;
varying float vLap;

void main() {
  // 평면은 XY → 회전으로 XZ에 눕히므로 로컬 x,y 를 수면 좌표로 쓴다
  vec2 p = position.xy;
  float t = uTime;
  float e = 0.03;
  float fade = edgeFade(p);
  // 기본 잔물결: 유한차분 3탭
  float b = baseWave(p, t);
  float bx = baseWave(p + vec2(e, 0.0), t);
  float by = baseWave(p + vec2(0.0, e), t);
  // 시뮬 높이장: 중앙 + 4 이웃 (uv 는 평면과 같은 방향)
  float hc = texture2D(uHeight, uv).r;
  float hl = texture2D(uHeight, uv - vec2(uSimTexel.x, 0.0)).r;
  float hr = texture2D(uHeight, uv + vec2(uSimTexel.x, 0.0)).r;
  float hd = texture2D(uHeight, uv - vec2(0.0, uSimTexel.y)).r;
  float hu = texture2D(uHeight, uv + vec2(0.0, uSimTexel.y)).r;
  vec2 cell = uSimTexel * uHalf * 2.0; // 텍셀 하나의 월드 크기
  float sim = hc * uAmp;
  // 법선은 기울기를 과장해(uSlopeK) 얕은 링도 음영·굴절로 읽히게 한다 (변위는 그대로)
  float dsx = (hr - hl) * uAmp * uSlopeK / (2.0 * cell.x);
  float dsy = (hu - hd) * uAmp * uSlopeK / (2.0 * cell.y);
  float h = (b + sim) * fade;
  float dhx = ((bx - b) / e + dsx) * fade;
  float dhy = ((by - b) / e + dsy) * fade;
  vec3 pos = vec3(p, h);
  // 로컬 공간 법선 (z가 위)
  vec3 n = normalize(vec3(-dhx, -dhy, 1.0));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vWorld = w.xyz;
  vUvP = p;
  // 수심(모래 높이맵)은 매끈한 장이라 정점에서 재고 보간한다 (프래그먼트마다 exp 12번 대신)
  vDepth = uTop - floorHeight(w.xz);
  vR = sim * fade;
  vLap = (hl + hr + hd + hu - 4.0 * hc) * uAmp * fade; // 곡률: 마루 꼭대기는 음수

  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const surfaceFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
${envGLSL}
uniform sampler2D uBelow;     // 수면을 뺀 장면 (굴절용)
uniform vec2 uResolution;     // 드로잉 버퍼 크기
uniform float uRefract;       // 굴절 세기
uniform vec3 uCamPos;
uniform vec2 uHalf;
uniform float uCorner;
uniform float uTop;
uniform float uBottom;
uniform vec2 uPools[${POOL_N}]; // 방갈로 수중등 자리 (월드 xz)
${roundedRectGLSL}
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUvP;
varying float vDepth;
varying float vR;
varying float vLap;

float caustic(vec2 p, float t) {
  float a = sin(p.x * 7.0 + t * 0.9 + sin(p.y * 4.0 + t * 0.6) * 1.2);
  float b = sin(p.y * 6.5 - t * 0.8 + sin(p.x * 3.5 - t * 0.5) * 1.2);
  float c = a * b;
  return smoothstep(0.55, 1.0, c);
}

void main() {
  // 둥근 사각형(물 옆면 둘레) 바깥은 버린다
  if (roundedRect(vUvP, uHalf, uCorner) > 0.0) discard;
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(uCamPos - vWorld);
  vec3 l = normalize(uKeyDir);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.4);

  // 수심: 모래 높이맵 기준(정점에서 보간). 얕은 곳은 민트, 깊은 곳은 청록
  float depth = vDepth;
  float dk = clamp(depth / (uTop - uBottom), 0.0, 1.0);

  // 굴절: 법선의 수평 성분만큼 화면을 비틀어 아래를 샘플링 (얕으면 덜 휜다)
  vec2 suv = gl_FragCoord.xy / uResolution;
  vec2 off = n.xz * uRefract * (0.35 + 0.65 * smoothstep(0.0, 0.5, dk));
  off.y = -off.y;
  vec3 below = texture2D(uBelow, clamp(suv + off, 0.001, 0.999)).rgb;

  // 물 색: 아래 장면에 물빛을 곱하고(색유리) 깊이만큼 물빛을 더한다
  vec3 tint = mix(uShallow, uDeep, pow(dk, 0.75));
  float absorb = 0.5 + 0.4 * dk;
  // 아래 장면은 이미 시간대 빛을 받았다 — 물이 더하는 빛(산란)만 환경광을 곱한다
  vec3 col = below * mix(vec3(1.0), tint * 1.1, absorb) + tint * (0.06 + 0.2 * dk) * uEnvLight;
  col += caustic(vUvP, uTime) * 0.07 * vec3(1.0, 1.0, 0.95) * uSunUp;

  // 물가 거품: 해안선 띠 + 밀려오는 잔거품
  float shore = smoothstep(0.45, 0.0, depth);
  float lap = sin(depth * 34.0 - uTime * 1.8 + sin(vWorld.x * 2.3 + vWorld.z * 1.7 + uTime * 0.4) * 2.5);
  float foamShore = smoothstep(0.1, 0.0, depth) + shore * smoothstep(0.55, 1.0, lap) * 0.7;
  foamShore = clamp(foamShore, 0.0, 1.0);
  col = mix(col, vec3(1.0) * min(uEnvLight * 1.15 + 0.08, vec3(1.0)), foamShore * 0.85);

  // 파임: 골은 짙게, 마루 꼭대기(곡률 음수)에 가는 밝은 선, 아주 가파른 비탈만 살짝 희게
  float slope = length(n.xz);
  col = mix(col, uDeep * 0.75, smoothstep(-0.015, -0.1, vR) * 0.35);
  float crestLine = smoothstep(0.0025, 0.008, -vLap);
  col = mix(col, vec3(0.92, 0.99, 1.0) * min(uEnvLight * 1.2 + 0.1, vec3(1.0)), crestLine * 0.5);
  float ridge = smoothstep(0.5, 1.2, slope);
  col = mix(col, vec3(0.93, 0.99, 1.0) * uEnvLight, ridge * 0.1);

  vec3 h = normalize(l + v);
  float ndh = max(dot(n, h), 0.0);
  float spec = pow(ndh, 80.0);
  col += (spec * 0.45 + pow(ndh, 16.0) * 0.05) * uKeyCol; // 가는 하이라이트 + 넓은 광택 (해/달 색)
  // 밤: 방갈로 아래 수중등이 물을 밝은 청록으로 비춘다 (빛 그물이 일렁인다)
  if (uLamp > 0.001) {
    vec2 wp = vec2(vUvP.x, -vUvP.y);
    float pool = 0.0;
    for (int i = 0; i < ${POOL_N}; i++) {
      vec2 d = wp - uPools[i];
      pool += exp(-dot(d, d) * 1.8);
    }
    float ripple = 0.75 + 0.5 * caustic(vUvP * 0.8, uTime * 1.3);
    col += vec3(0.2, 0.95, 0.85) * min(pool, 1.4) * ripple * uLamp * 0.45;
  }
  // 반짝이: 물결 위 작은 빛 조각이 따로 깜빡인다 — 낮엔 옅게(햇빛), 밤엔 또렷한 달빛 (장난감 무대답게 과장)
  vec2 gp = vUvP * 14.0 + vec2(uTime * 0.12, -uTime * 0.07);
  vec2 gc = floor(gp);
  float gh = fract(sin(dot(gc, vec2(41.3, 289.1))) * 43758.5453);
  float glint = step(0.9, gh) * smoothstep(0.16, 0.0, length(fract(gp) - 0.5)) * pow(0.5 + 0.5 * sin(uTime * (2.0 + gh * 4.0) + gh * 60.0), 3.0);
  col += glint * mix(vec3(1.0, 0.97, 0.85), vec3(0.85, 0.92, 1.0), 1.0 - uSunUp) * mix(0.35, 0.9, 1.0 - uSunUp) * (1.0 - foamShore);
  // 비스듬히 볼수록 하늘이 비친다 (낮 종이색 → 노을 주황 → 밤 남색)
  col = mix(col, uSkyCol, fres * 0.4);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class WaterSurfaceMaterial extends THREE.ShaderMaterial {
  constructor(halfX: number, halfZ: number, corner: number, top: number, bottom: number) {
    super({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      // 아래 장면을 직접 합성하므로 불투명하게 그린다 (투명 패스 정렬 문제 없음)
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBelow: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uRefract: { value: 0.08 },
        uHeight: { value: null },
        uSimTexel: { value: SIM_TEXEL },
        uAmp: { value: 1 },
        uSlopeK: { value: 1.8 },
        uHalf: { value: new THREE.Vector2(halfX, halfZ) },
        uCorner: { value: corner },
        uTop: { value: top },
        uBottom: { value: bottom },
        uShallow: { value: new THREE.Color(WATER.shallow) },
        uDeep: { value: new THREE.Color(WATER.deep) },
        uCamPos: { value: new THREE.Vector3() },
        uPools: { value: zeros(POOL_N) },
        ...ENV,
      },
    });
  }
}

/** 수조 옆면 — 깊이 그라데이션 + 프레넬 + 가벼운 투명 */
const sideVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const sideFragment = /* glsl */ `
precision highp float;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uTop;
uniform float uBottom;
uniform float uOpacity;
uniform vec3 uCamPos;
uniform float uTime;
${envGLSL}
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(uCamPos - vWorld);
  float depth = clamp((uTop - vWorld.y) / (uTop - uBottom), 0.0, 1.0);
  vec3 col = mix(uShallow, uDeep, pow(depth, 0.7));
  // 옆면으로 비치는 빛줄기 (해가 떠 있을 때만)
  float ray = sin(vWorld.x * 3.0 + vWorld.z * 2.0 + uTime * 0.6) * 0.5 + 0.5;
  col += ray * (1.0 - depth) * 0.08 * uSunUp;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col = mix(col, mix(vec3(0.9, 0.97, 1.0), uSkyCol, 0.5), fres * 0.3);
  col *= uEnvLight;
  float alpha = mix(uOpacity, 0.55, fres); // 비스듬히 봐도 안이 보이게
  if (!gl_FrontFacing) alpha *= 0.5; // 뒷면은 옅게 겹쳐 물 밀도를 만든다
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

export class WaterSideMaterial extends THREE.ShaderMaterial {
  constructor(top: number, bottom: number) {
    super({
      vertexShader: sideVertex,
      fragmentShader: sideFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uShallow: { value: new THREE.Color(WATER.shallow) },
        uDeep: { value: new THREE.Color(WATER.deep) },
        uTop: { value: top },
        uBottom: { value: bottom },
        uOpacity: { value: 0.5 },
        uCamPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        ...ENV,
      },
    });
  }
}

/** 모래 바닥 — 커스틱 + 알갱이 */
const floorFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uSand;
uniform vec3 uTint;
uniform float uTop;
uniform float uBottom;
uniform vec2 uHalf;
uniform float uCorner;
uniform vec2 uTorches[${TORCH_N}]; // 섬 횃불 자리 (월드 xz)
${envGLSL}
varying vec3 vWorld;
varying vec3 vNormalW;
${roundedRectGLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// 보로노이 경계 → 커스틱 그물망
float voro(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(i + g);
    o = 0.5 + 0.45 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
void main() {
  vec2 p = vWorld.xz;
  if (roundedRect(p, uHalf, uCorner) > 0.0) discard;
  float grain = hash(floor(p * 60.0)) * 0.12;
  float above = vWorld.y - uTop; // 양수 = 마른 모래
  float dk = clamp(-above / (uTop - uBottom), 0.0, 1.0);
  vec3 col = uSand * (0.9 + grain);
  col = mix(col, uTint, 0.2 + 0.35 * dk);
  // 물가: 젖은 모래(어둡게) → 마른 모래(밝게)
  col = mix(col, uSand * 0.82, smoothstep(-0.3, -0.02, above));
  col = mix(col, vec3(0.95, 0.89, 0.76) * (0.95 + grain * 0.5), smoothstep(0.0, 0.1, above));
  float under = smoothstep(0.02, -0.08, above);
  float c1 = 1.0 - smoothstep(0.0, 0.12, voro(p * 2.8, uTime * 0.7));
  float c2 = 1.0 - smoothstep(0.0, 0.2, voro(p * 1.1 + 4.0, uTime * 0.5));
  vec3 n = normalize(vNormalW);
  // 커스틱은 얕고 평평한 모래에서 또렷하고, 경사·깊은 곳에선 흐려진다
  float flat_ = smoothstep(0.55, 0.95, n.y);
  float causticK = under * flat_ * mix(0.45, 1.0, 1.0 - dk);
  col += (c1 * 0.2 + c2 * 0.12) * vec3(1.0, 1.0, 0.95) * causticK * uSunUp;
  float shade = 0.74 + 0.26 * max(dot(n, normalize(vec3(0.4, 0.9, 0.5))), 0.0);
  vec3 lit = col * shade * uEnvLight;
  // 밤: 횃불 둘레 모래가 주황빛으로 물든다
  if (uLamp > 0.001) {
    float warm = 0.0;
    for (int i = 0; i < ${TORCH_N}; i++) {
      vec2 d = p - uTorches[i];
      warm += exp(-dot(d, d) * 3.0);
    }
    lit += col * vec3(1.0, 0.55, 0.25) * min(warm, 1.2) * uLamp * 0.55 * smoothstep(-0.05, 0.05, above);
  }
  gl_FragColor = vec4(lit, 1.0);
  #include <colorspace_fragment>
}
`;

export class SandFloorMaterial extends THREE.ShaderMaterial {
  constructor(top: number, bottom: number, halfX: number, halfZ: number, corner: number) {
    super({
      vertexShader: sideVertex,
      fragmentShader: floorFragment,
      uniforms: {
        uTime: { value: 0 },
        uSand: { value: new THREE.Color("#ecdfc4") },
        uTint: { value: new THREE.Color(WATER.tint) },
        uTop: { value: top },
        uBottom: { value: bottom },
        uHalf: { value: new THREE.Vector2(halfX, halfZ) },
        uCorner: { value: corner },
        uTorches: { value: zeros(TORCH_N) },
        ...ENV,
      },
    });
  }
}

/** 지층 블록 — 높이에 따른 띠 + 알갱이 */
const strataFragment = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormalW;
uniform float uTop;
${envGLSL}
float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
void main() {
  float d = uTop - vWorld.y; // 0 at top
  vec3 col;
  float sp = hash(floor(vWorld * 38.0));
  if (d < 0.22) {
    col = vec3(0.91, 0.86, 0.74) * (0.94 + sp * 0.1);
  } else if (d < 0.7) {
    col = vec3(0.95, 0.93, 0.88);
    col -= step(0.93, sp) * 0.12;
  } else if (d < 0.95) {
    col = vec3(0.85, 0.77, 0.62) * (0.95 + sp * 0.08);
  } else {
    col = vec3(0.47, 0.35, 0.27);
    col += step(0.9, sp) * 0.45;
  }
  float shade = 0.72 + 0.28 * max(dot(normalize(vNormalW), normalize(vec3(0.4, 0.9, 0.5))), 0.0);
  gl_FragColor = vec4(col * shade * uEnvLight, 1.0);
  #include <colorspace_fragment>
}
`;

export class StrataMaterial extends THREE.ShaderMaterial {
  constructor(top: number) {
    super({
      vertexShader: sideVertex,
      fragmentShader: strataFragment,
      uniforms: { uTop: { value: top }, ...ENV },
    });
  }
}

/** 빛줄기 — 수면에서 바닥으로 내려오는 부드러운 가산 평면 */
const shaftFragment = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uTime;
${envGLSL}
varying vec2 vUv;
varying float vSeed;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float edge = 1.0 - smoothstep(0.2, 1.0, x);
  float fall = smoothstep(0.0, 0.25, vUv.y) * pow(vUv.y, 1.6);
  float flick = 0.75 + 0.25 * sin(uTime * 0.7 + vSeed * 6.0 + vUv.y * 3.0);
  // 해 빛줄기 — 해가 지면 사라지고, 노을엔 해 색을 띤다
  gl_FragColor = vec4(uColor * mix(vec3(1.0), uKeyCol, 0.6), edge * fall * flick * 0.45 * uSunUp);
}
`;
const shaftVertex = /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
/** 여러 장의 빛줄기를 한 메시로 그린다. 장마다 다른 흔들림 위상은 정점 속성 aSeed 로 준다. */
export class LightShaftMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color("#dff4ff") }, uTime: { value: 0 }, ...ENV },
    });
  }
}
