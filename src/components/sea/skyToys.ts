import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * 젤리 하늘 — 블록 위에 씌운 투명한 젤리 돔(하늘 캡슐) 안에 해·달·별빛·솜 구름이 담겨 있다.
 * 돔의 먼 쪽 벽은 시간대 하늘 그라데이션, 앞쪽 벽·윗면은 유리 같은 프레넬 광택만 (안이 들여다보이게).
 * 해·달은 카메라를 향한 판에 셰이더로 그린 빛 구슬(달: 위상 음영·크레이터·달무리), 별은 십자 광채 점 스프라이트.
 * 화면 배경(종이색)은 바꾸지 않는다 — 하루의 색은 젤리 안에서만.
 */

/** 정점 색은 선형 공간 — 눈으로 고른 sRGB 를 변환해 넣는다 */
const linColor = (hex: string) => new THREE.Color(hex); // THREE.Color 는 hex 를 선형으로 바꿔 둔다

/** 지오메트리 전체를 한 색으로 칠한다 */
function paint(g: THREE.BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  geo.deleteAttribute("uv");
  const n = geo.getAttribute("position").count;
  const c = linColor(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

function merge(list: THREE.BufferGeometry[]) {
  const g = mergeGeometries(list, false)!;
  list.forEach((x) => x.dispose());
  return g;
}

/** 솜 구름: 구 5개를 겹친 납작한 뭉게구름. 폭 ≈ 2.4 기준 */
export function makeCloud() {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, r] of [
    [-0.75, -0.05, 0.42],
    [-0.25, 0.2, 0.58],
    [0.35, 0.15, 0.5],
    [0.8, -0.05, 0.38],
    [0.05, -0.12, 0.45],
  ]) {
    parts.push(paint(new THREE.SphereGeometry(r, 12, 8).scale(1, 0.85, 0.6).translate(x, y, 0), "#ffffff"));
  }
  return merge(parts);
}

/**
 * 구름 재질: 정점 색 × 부드러운 감싸는 빛(화면 기준 왼쪽 위) + 테두리 벨벳 광택 + 자체 발광(uGlow).
 * 씬 라이트를 보지 않는다 — 하늘 장난감은 시간대 색(uTint)과 발광으로만 밝기를 정한다.
 * 인스턴스는 instanceMatrix·instanceColor 를 쓴다.
 */
const toyVert = /* glsl */ `
varying vec3 vColor;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vec3 p = position;
  vec3 n = normal;
  vColor = color;
  #ifdef USE_INSTANCING_COLOR
  vColor *= instanceColor;
  #endif
  vec4 mv = vec4(p, 1.0);
  #ifdef USE_INSTANCING
  mv = instanceMatrix * mv;
  n = mat3(instanceMatrix) * n;
  #endif
  mv = modelViewMatrix * mv;
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}
`;
const toyFrag = /* glsl */ `
precision highp float;
uniform vec3 uTint;
uniform float uGlow;
uniform float uOpacity;
varying vec3 vColor;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(-vViewPos);
  float wrap = dot(n, normalize(vec3(-0.45, 0.7, 0.55))) * 0.5 + 0.5;
  float shade = 0.62 + 0.45 * wrap;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  vec3 col = vColor * uTint * shade + rim * 0.22 * mix(vec3(1.0), vColor, 0.5);
  col += vColor * uGlow;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export class ToyMaterial extends THREE.ShaderMaterial {
  constructor(transparent = false) {
    super({
      vertexShader: toyVert,
      fragmentShader: toyFrag,
      vertexColors: true,
      transparent,
      depthWrite: !transparent,
      uniforms: { uTint: { value: new THREE.Color(1, 1, 1) }, uGlow: { value: 0 }, uOpacity: { value: 1 } },
    });
  }
}

/** 사전 곱 알파 혼합 (색은 이미 알파를 곱해 내보낸다 — 알파 0 이면 가산처럼 빛만 더해진다) */
const PREMULT = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;

/**
 * 사전 곱 출력은 색을 먼저 출력 색공간(sRGB)으로 바꾼 뒤 알파를 곱한다.
 * (알파를 곱한 선형 색에 변환을 걸면 감마 때문에 옅은 알파일수록 하얗게 들뜬다 — 돔이 우윳빛이 됐던 원인)
 */
const toOutGLSL = /* glsl */ `
vec3 toOut(vec3 c) { return linearToOutputTexel(vec4(c, 1.0)).rgb; }
`;

/** 빛 구슬 판의 반폭 (구슬 반지름 1 기준) — 후광까지 담는다 */
export const ORB_EXTENT = 4;

const orbVert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0 * ${ORB_EXTENT.toFixed(1)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const orbFrag = /* glsl */ `
precision highp float;
uniform float uMoon;      // 0 = 해, 1 = 달
uniform vec3 uColor;      // 원반 색
uniform vec3 uGlow;       // 후광 색 × 세기
uniform float uPhase;     // 달 위상: 빛이 오는 방향 각 (0 = 보름, π = 그믐)
uniform float uAlpha;     // 보이는 정도
varying vec2 vP;
${toOutGLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  float r = length(vP);
  float aa = fwidth(r) * 1.5;
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  vec3 surf;
  float halo;
  if (uMoon < 0.5) {
    // 해: 가장자리가 살짝 어두운 빛 원반 + 넓은 코로나
    // (밝은 낮 하늘 위에 더해지니 후광은 약하게 — 세면 1.0 에서 잘려 흰 원판 테두리가 생긴다)
    surf = uColor * (1.15 - 0.25 * r * r);
    halo = exp(-max(r - 1.0, 0.0) * 1.6) * 0.2 + exp(-r * 0.7) * 0.06;
  } else {
    // 달: 구 법선으로 위상 음영(초승~반달), 어두운 쪽은 지구조 푸른빛, 크레이터 얼룩 + 은은한 달무리
    vec3 n = vec3(vP, sqrt(max(1.0 - r * r, 0.0)));
    vec3 L = normalize(vec3(sin(uPhase), 0.18, cos(uPhase)));
    float lit = smoothstep(-0.06, 0.14, dot(n, L));
    float mare = noise(vP * 2.2 + 3.0) * 0.6 + noise(vP * 5.0) * 0.4;
    float crater = smoothstep(0.55, 0.75, noise(vP * 7.0 + 11.0)) * 0.12;
    vec3 day = uColor * (0.98 - 0.16 * smoothstep(0.45, 0.8, mare) - crater) * (0.9 + 0.1 * n.z);
    surf = mix(vec3(0.1, 0.13, 0.24), day, lit);
    halo = exp(-max(r - 1.0, 0.0) * 1.9) * 0.45 + exp(-r * 0.8) * 0.12;
    disc *= mix(0.3, 1.0, lit); // 그늘진 쪽은 하늘이 비쳐 옅다 (초승달 윤곽이 산다)
  }
  halo *= 1.0 - smoothstep(${(ORB_EXTENT * 0.6).toFixed(1)}, ${ORB_EXTENT.toFixed(1)}, r); // 판 가장자리에서 0 (네모가 안 보이게)
  // 원반은 덮고(알파), 후광은 더한다(알파 0)
  vec3 col = toOut(surf) * disc + toOut(uGlow) * halo * (1.0 - disc);
  gl_FragColor = vec4(col * uAlpha, disc * uAlpha);
}
`;
/** 해·달 빛 구슬 (카메라를 향한 판에 그린다) */
export class OrbMaterial extends THREE.ShaderMaterial {
  constructor(moon: boolean) {
    super({
      vertexShader: orbVert,
      fragmentShader: orbFrag,
      transparent: true,
      depthWrite: false,
      ...PREMULT,
      uniforms: {
        uMoon: { value: moon ? 1 : 0 },
        uColor: { value: new THREE.Color(moon ? "#fff6e0" : "#fff3c4") },
        uGlow: { value: new THREE.Color() },
        uPhase: { value: 1.75 },
        uAlpha: { value: 1 },
      },
    });
  }
}

/** 별빛: 점 스프라이트 — 밝은 심 + 퍼진 빛 + 큰 별은 십자 광채, 저마다 반짝인다. 별 양(uStars)이 차례값을 넘으면 하나씩 켜진다 */
const starVert = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aTh;
attribute vec3 aColor;
uniform float uPx;
uniform float uTime;
uniform float uStars;
varying vec3 vColor;
varying float vK;
varying float vRay;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.6 + 0.4 * sin(uTime * (1.2 + aSeed * 2.6) + aSeed * 40.0) * sin(uTime * 0.37 + aSeed * 9.0);
  vK = smoothstep(aTh, aTh + 0.15, uStars) * tw;
  vColor = aColor;
  vRay = smoothstep(0.1, 0.2, aSize);
  gl_PointSize = aSize * uPx / -mv.z * (0.8 + 0.2 * tw) * step(0.001, vK);
  gl_Position = projectionMatrix * mv;
}
`;
const starFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vK;
varying float vRay;
${toOutGLSL}
void main() {
  vec2 d = (gl_PointCoord - 0.5) * 2.0;
  float r2 = dot(d, d);
  float core = exp(-r2 * 60.0);
  float glow = exp(-r2 * 9.0) * 0.4;
  vec2 a = abs(d);
  float rays = (exp(-a.x * 40.0) * exp(-a.y * 3.2) + exp(-a.y * 40.0) * exp(-a.x * 3.2)) * vRay * 0.7;
  float edge = 1.0 - smoothstep(0.85, 1.0, sqrt(r2)); // 판 가장자리에서 잘리지 않게
  gl_FragColor = vec4((toOut(vColor) * (glow + rays) + vec3(core)) * vK * edge, 0.0); // 알파 0 = 가산
}
`;
export class StarFieldMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      ...PREMULT,
      uniforms: { uPx: { value: 1 }, uTime: { value: 0 }, uStars: { value: 0 } },
    });
  }
}

/**
 * 젤리 하늘 돔. back = 먼 쪽 벽(안쪽 면)에 하늘 그라데이션을 깔고(별·달의 배경),
 * front = 앞쪽 벽·윗면은 거의 투명한 유리 — 비스듬한 가장자리 광택과 주광 하이라이트만.
 */
const domeVert = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const domeFrag = /* glsl */ `
precision highp float;
uniform float uBack;
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform float uBase;
uniform float uH;
uniform float uDensity;
uniform vec3 uCamPos;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
varying vec3 vWorld;
varying vec3 vNormalW;
${toOutGLSL}
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(uCamPos - vWorld);
  float h = clamp((vWorld.y - uBase) / uH, 0.0, 1.0);
  float fres = pow(1.0 - abs(dot(n, v)), 2.4);
  vec3 sky = toOut(mix(uSkyBot, uSkyTop, smoothstep(0.0, 1.0, h)));
  vec3 col; // 사전 곱 색
  float a;
  if (uBack > 0.5) {
    // 먼 벽: 하늘. 수면 가까이는 옅게 녹아든다
    a = uDensity * smoothstep(0.0, 0.3, h);
    col = sky * a;
  } else {
    // 앞 유리: 아주 옅은 하늘빛 + 비스듬한 가장자리 광택 + 주광 하이라이트 (빛은 가산)
    float spec = pow(max(dot(reflect(-v, n), normalize(uKeyDir)), 0.0), 400.0); // 평평한 윗판에선 반사가 원반으로 맺히니 작은 반짝임만
    a = (0.015 + fres * 0.12) * mix(0.6, 1.0, uDensity);
    col = sky * a + mix(sky, vec3(1.0), 0.4) * fres * 0.16 + toOut(uKeyCol) * spec * 0.3;
  }
  gl_FragColor = vec4(col, a);
}
`;
export class DomeMaterial extends THREE.ShaderMaterial {
  constructor(back: boolean, base: number, height: number) {
    super({
      vertexShader: domeVert,
      fragmentShader: domeFrag,
      transparent: true,
      depthWrite: false,
      side: back ? THREE.BackSide : THREE.FrontSide,
      ...PREMULT,
      uniforms: {
        uBack: { value: back ? 1 : 0 },
        uSkyTop: { value: new THREE.Color() },
        uSkyBot: { value: new THREE.Color() },
        uBase: { value: base },
        uH: { value: height },
        uDensity: { value: 0.5 },
        uCamPos: { value: new THREE.Vector3() },
        uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
        uKeyCol: { value: new THREE.Color() },
      },
    });
  }
}
