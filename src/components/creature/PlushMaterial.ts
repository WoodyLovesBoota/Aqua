import * as THREE from "three";

/**
 * 플러시 인형 머티리얼 (단일 패스, 불투명).
 * 벨벳처럼 비스듬히 볼수록 밝아지는 시언(sheen) + 감싸는 확산광 + 보풀 텍스처 기반 미세 범프.
 * 헤엄 변형(꼬리 흔들기, 몸 휨)은 정점 셰이더에서 처리한다.
 */

/** 보풀 텍스처: R = 가닥 높이(0~1), G = 가닥별 난수. 한 타일이 화면에서 ~50px 라 256² 이면 충분하다 */
function makeFuzzTexture(size = 256, strands = 10500): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  const id = new Float32Array(size * size);
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let s = 0; s < strands; s++) {
    const cx = rnd() * size, cy = rnd() * size;
    const r = 1.2 + rnd() * 1.6;
    const height = 0.45 + rnd() * 0.55;
    const tag = rnd();
    const ir = Math.ceil(r);
    for (let y = -ir; y <= ir; y++) {
      for (let x = -ir; x <= ir; x++) {
        const d = Math.sqrt(x * x + y * y) / r;
        if (d > 1) continue;
        const px = (((cx + x) % size) + size) % size | 0;
        const py = (((cy + y) % size) + size) % size | 0;
        const i = py * size + px;
        const v = height * Math.sqrt(1 - d);
        if (v > h[i]) {
          h[i] = v;
          id[i] = tag;
        }
      }
    }
  }
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.min(255, h[i] * 255);
    data[i * 4 + 1] = id[i] * 255;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

let fuzzTex: THREE.DataTexture | null = null;

export type PlushSwim = "shark" | "manta" | "turtle" | "dolphin" | "whaleshark";

/** 종별 헤엄 변형. p(위치)·n(법선)을 제자리에서 바꾼다. 공용 입력: uTime uBeat uSwimAmp uTurn */
const SWIM: Record<PlushSwim, string> = {
  // 상어: 머리(x > 0.9)는 단단하게, 꼬리로 갈수록 크게 좌우로 흔들림
  shark: /* glsl */ `
  float amp = smoothstep(0.9, -1.6, position.x);
  amp *= amp;
  float phase = uTime * uBeat * 2.6; // 인형답게 느긋한 박자 (tailBeat 1 ≈ 25회/분)
  p.z += sin(position.x * 1.7 - phase) * amp * 0.24 * uSwimAmp;
  p.z += uTurn * amp * 0.55;
  p.y += cos(position.x * 1.7 - phase) * amp * 0.03 * uSwimAmp;
  `,
  // 만타: 날개 끝으로 갈수록 크게·늦게 펄럭이고(파동이 바깥으로 전파), 꼬리는 좌우로. 변형 기울기로 법선을 보정한다
  manta: /* glsl */ `
  float phase = uTime * uBeat * 1.9;
  float side = position.z < 0.0 ? -1.0 : 1.0;
  float s = abs(position.z);
  // 날개 변위 h(s): 뿌리(≈0.4)부터 끝(1.85)까지 제곱으로 커진다
  #define WING(S) (sin(phase - (S) * 1.25) * pow(smoothstep(0.3, 1.85, (S)), 2.0) * 0.62 * uSwimAmp + uTurn * side * smoothstep(0.3, 1.85, (S)) * 0.22)
  float h = WING(s);
  float dh = (WING(s + 0.02) - WING(s - 0.02)) / 0.04 * side; // dh/dz
  p.y += h;
  // 몸통은 날개 반대 방향으로 살짝 (반작용), 뒷전이 앞전보다 늦게
  p.y -= sin(phase) * 0.03 * (1.0 - smoothstep(0.3, 1.0, s)) * uSwimAmp;
  p.y += sin(phase - s * 1.25 - 0.8) * smoothstep(0.3, 1.85, s) * max(-position.x, 0.0) * 0.1 * uSwimAmp;
  // 꼬리: x < -1 에서 좌우로
  float tail = smoothstep(-0.9, -2.5, position.x);
  tail *= tail;
  p.z += sin(position.x * 1.6 - phase) * tail * 0.18 * uSwimAmp + uTurn * tail * 0.45;
  // 전단 변형(y' = y + h(z))의 법선: (nx, ny, nz - h'·ny)
  n = normalize(vec3(n.x, n.y, n.z - dh * n.y));
  `,
  // 거북: 앞지느러미가 등딱지 테두리 아래 어깨(x 0.45, |z| 0.6)를 축으로 위아래로 느리게 젓는다. 등딱지(테두리 포함)는 단단, 머리는 살짝 끄덕
  turtle: /* glsl */ `
  float phase = uTime * uBeat * 2.0;
  float side = position.z < 0.0 ? -1.0 : 1.0;
  float s = abs(position.z);
  // 등딱지 타원((x+0.1)/1.1, z/0.9) 바깥에서만 움직인다 → 지느러미 뿌리는 테두리 밑에 고정된 어깨
  float tex = position.x + 0.1;
  float outer = smoothstep(0.9, 1.25, tex * tex / 1.21 + position.z * position.z / 0.81);
  float front = smoothstep(0.55, 0.85, s) * smoothstep(-0.6, -0.3, position.x) * smoothstep(0.9, 0.6, position.x) * outer;
  float reach = max(s - 0.55, 0.0);
  #define STROKE(S) (sin(phase - (S) * 1.6) * (S) * 0.5 * uSwimAmp + uTurn * side * (S) * 0.25)
  float h = STROKE(reach) * front;
  float dh = (STROKE(reach + 0.02) - STROKE(reach - 0.02)) / 0.04 * front * side;
  p.y += h;
  // 뒷지느러미: 작게, 반대 위상
  float rear = smoothstep(0.5, 0.75, s) * smoothstep(-1.35, -1.0, position.x) * smoothstep(-0.55, -0.8, position.x) * outer;
  p.y += sin(phase + 1.6) * (s - 0.5) * 0.14 * rear * uSwimAmp;
  // 머리 끄덕임 + 꼬리 좌우 (둘 다 등딱지 밖에서만)
  float headK = smoothstep(1.0, 1.5, position.x) * outer;
  p.y += sin(phase - 0.5) * headK * 0.025 * uSwimAmp;
  float tail = smoothstep(-1.05, -1.3, position.x) * outer;
  p.z += sin(phase * 1.3) * tail * 0.04 + uTurn * tail * 0.15;
  n = normalize(vec3(n.x, n.y, n.z - dh * n.y));
  `,
  // 돌고래: 꼬리가 위아래로 출렁인다 (상어의 좌우와 반대). 머리는 단단, 꼬리로 갈수록 크게. 회전은 좌우 휨
  dolphin: /* glsl */ `
  float phase = uTime * uBeat * 2.8;
  #define WAVE(X) (sin((X) * 1.5 - phase) * pow(smoothstep(0.7, -1.9, (X)), 2.0) * 0.3 * uSwimAmp)
  float h = WAVE(position.x);
  float dh = (WAVE(position.x + 0.02) - WAVE(position.x - 0.02)) / 0.04;
  p.y += h;
  float amp = smoothstep(0.7, -1.9, position.x);
  amp *= amp;
  p.z += uTurn * amp * 0.5;
  // 가슴지느러미 살짝 젓기 (|z| > 0.45, 어깨 근처)
  float pec = smoothstep(0.45, 0.9, abs(position.z)) * smoothstep(-0.3, 0.2, position.x) * smoothstep(1.0, 0.7, position.x);
  p.y += sin(phase * 0.5 + 1.0) * pec * 0.06 * uSwimAmp;
  // 전단 변형(y' = y + h(x))의 법선: (nx − h'·ny, ny, nz)
  n = normalize(vec3(n.x - dh * n.y, n.y, n.z));
  `,
  // 고래상어: 상어처럼 꼬리 좌우지만 더 느리고 온몸이 길게 S 자. 머리(x > 1.2)는 단단
  whaleshark: /* glsl */ `
  float phase = uTime * uBeat * 1.6;
  #define SWAY(X) ((sin((X) * 1.1 - phase) * pow(smoothstep(1.2, -2.6, (X)), 2.0) * 0.3 + uTurn * pow(smoothstep(1.2, -2.6, (X)), 2.0) * 0.55) * uSwimAmp)
  float h = SWAY(position.x);
  float dh = (SWAY(position.x + 0.02) - SWAY(position.x - 0.02)) / 0.04;
  p.z += h;
  // 가슴지느러미 살짝 젓기
  float pec = smoothstep(0.55, 1.1, abs(position.z)) * smoothstep(-0.4, 0.2, position.x) * smoothstep(1.0, 0.7, position.x);
  p.y += sin(phase * 0.5 + 0.6) * pec * 0.06 * uSwimAmp;
  // 전단 변형(z' = z + h(x))의 법선: (nx − h'·nz, ny, nz)
  n = normalize(vec3(n.x - dh * n.z, n.y, n.z));
  `,
};

const vertex = (swim: PlushSwim) => /* glsl */ `
uniform float uTime;
uniform float uBeat;       // 꼬리 박자 배수
uniform float uSwimAmp;    // 헤엄 진폭 0..1
uniform float uTurn;       // 몸 휘어짐 -1..1

attribute float aPart;

varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vNormalO;
varying vec3 vViewPos;
varying vec3 vWorld;
varying float vPart;

void main() {
  vObj = position;
  vPart = aPart;

  vec3 p = position;
  vec3 n = normal;
  ${SWIM[swim]}
  vNormalO = n;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vNormalV = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * 종별 배 마스크 bellyMask (0 = 털, 1 = 배) 와 무늬 marking (배 색을 덧입힐 비율).
 * 상어: 아랫배만. 만타: 아랫면 전체 + 등의 어깨 V 무늬(머리 양옆에서 날개 앞전을 따라 뒤로 벌어지는 밝은 띠)
 */
const BELLY: Record<PlushSwim, string> = {
  shark: /* glsl */ `
  float bellyMask = smoothstep(0.0, -0.5, vNormalO.y) * smoothstep(0.1, -0.15, vObj.y);
  bellyMask = max(bellyMask, smoothstep(-0.25, -0.5, vObj.y));
  float marking = 0.0;
  float markDark = 0.0;
  `,
  manta: /* glsl */ `
  float bellyMask = smoothstep(0.18, -0.22, vNormalO.y);
  float az = abs(vObj.z);
  // 어깨 패치: 머리 양옆(az 0.3, x 1.0)에서 날개 앞전을 따라 뒤로 벌어지는 사선 안쪽(앞쪽)을 밝게
  float lineX = 1.02 - (az - 0.3) * 1.2;
  float marking = smoothstep(-0.14, 0.06, vObj.x - lineX);
  marking *= smoothstep(0.2, 0.45, az) * smoothstep(1.35, 1.0, az) * smoothstep(1.1, 0.98, vObj.x) * smoothstep(0.05, 0.35, vNormalO.y) * 0.62;
  float markDark = 0.0;
  `,
  // 거북: 아랫면(배딱지·턱·지느러미 밑) 배 색. 등딱지 위에는 육각 갑판 솔기(밝은 선)
  turtle: /* glsl */ `
  float bellyMask = smoothstep(-0.05, -0.45, vNormalO.y);
  // 등딱지 돔 영역: x -1.1~0.9, |z| < 0.8 (테두리 띠는 제외), 위를 향한 면
  float shellTop = smoothstep(-1.15, -0.95, vObj.x) * smoothstep(0.98, 0.84, vObj.x) * smoothstep(0.86, 0.74, abs(vObj.z)) * smoothstep(0.15, 0.45, vNormalO.y);
  // 육각 타일: 두 격자(반 칸 어긋남) 중 가까운 중심을 고르고, 육각 거리로 경계까지의 거리를 잰다 (갑판 폭 ≈ 0.46)
  vec2 hs = vec2(1.0, 1.7320508);
  vec2 huv = vec2(vObj.z, vObj.x + 0.12) / 0.46;
  vec2 ha = mod(huv, hs) - hs * 0.5;
  vec2 hb = mod(huv - hs * 0.5, hs) - hs * 0.5;
  vec2 hg = dot(ha, ha) < dot(hb, hb) ? ha : hb;
  vec2 hp = abs(hg);
  float hexD = max(dot(hp, hs * 0.5), hp.x); // 중심 0 → 경계 0.5
  float edge = (0.5 - hexD) * 0.46;
  float marking = (1.0 - smoothstep(0.012, 0.04, edge)) * shellTop * 0.55;
  float markDark = 0.0;
  `,
  // 돌고래: 배 색이 옆면 중간까지 올라온다(법선 + 높이). 눈 뒤에서 가슴지느러미 뿌리로 내려가는 옅은 눈줄 무늬
  dolphin: /* glsl */ `
  float bellyMask = smoothstep(0.25, -0.2, vNormalO.y) * smoothstep(0.2, -0.2, vObj.y - 0.1 * vNormalO.z * vNormalO.z);
  bellyMask = max(bellyMask, smoothstep(-0.15, -0.4, vObj.y));
  // 눈줄: (1.25, 0.05) → (0.55, -0.25) 선분까지의 거리 (옆면에서만)
  vec2 ea = vec2(1.25, 0.05), eb = vec2(0.55, -0.25);
  vec2 ep = vec2(vObj.x, vObj.y) - ea, ed = eb - ea;
  float et = clamp(dot(ep, ed) / dot(ed, ed), 0.0, 1.0);
  float eDist = length(ep - ed * et);
  float marking = (1.0 - smoothstep(0.07, 0.16, eDist)) * smoothstep(0.3, 0.7, abs(vNormalO.z)) * 0.75;
  float markDark = 1.0; // 눈줄은 털 색보다 어둡게
  `,
  // 고래상어: 배는 배 색. 등·옆·지느러미에 밝은 점(별무늬) + 가는 격자선 (체크보드). 점은 셀마다 조금씩 어긋난다
  whaleshark: /* glsl */ `
  float bellyMask = smoothstep(-0.05, -0.4, vNormalO.y) * smoothstep(0.1, -0.2, vObj.y);
  bellyMask = max(bellyMask, smoothstep(-0.3, -0.55, vObj.y));
  // 법선이 가장 큰 축으로 투영한 2D 좌표 (삼면 투영)
  vec3 wn = abs(vNormalO);
  vec2 wq = (wn.y >= wn.x && wn.y >= wn.z) ? vObj.xz : (wn.z >= wn.x ? vObj.xy : vObj.yz);
  vec2 wg = wq / 0.2;
  vec2 wcell = floor(wg);
  vec2 wj = fract(sin(vec2(dot(wcell, vec2(127.1, 311.7)), dot(wcell, vec2(269.5, 183.3)))) * 43758.5453) - 0.5;
  vec2 wf = fract(wg) - 0.5 - wj * 0.35;
  float wspot = 1.0 - smoothstep(0.16, 0.24, length(wf) * (0.9 + 0.3 * wj.x));
  vec2 wl = abs(fract(wg) - 0.5);
  float wline = 1.0 - smoothstep(0.02, 0.06, min(0.5 - wl.x, 0.5 - wl.y));
  float marking = (wspot * 0.8 + wline * 0.25) * (1.0 - bellyMask);
  float markDark = 0.0;
  `,
};

const fragment = (swim: PlushSwim) => /* glsl */ `
precision highp float;

uniform sampler2D uFuzz;
uniform vec3 uFurColor;
uniform vec3 uBellyColor;
uniform float uPile;      // 보풀 길이 → 결 범프 세기
uniform float uDensity;
uniform vec3 uLightDir;   // view space
uniform float uWet;       // 물속이면 1
uniform float uTime;
uniform vec3 uWaterTint;  // 물 색 (깊이 기운)

varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vNormalO;
varying vec3 vViewPos;
varying vec3 vWorld;
varying float vPart;

// 물속 커스틱 (수면에서 내려오는 빛 그물)
float caustic(vec2 p, float t) {
  float a = sin(p.x * 6.0 + t * 0.9 + sin(p.y * 4.0 + t * 0.6) * 1.2);
  float b = sin(p.y * 5.5 - t * 0.8 + sin(p.x * 3.5 - t * 0.5) * 1.2);
  return smoothstep(0.5, 1.0, a * b);
}

void main() {
  // 보풀 텍스처: 법선이 가장 큰 축 하나로 투영해 샘플 (셸 간 가닥이 정렬되도록 베이스 위치 기준)
  vec3 w = abs(vNormalO);
  vec3 c = vObj * uDensity;
  vec2 uv = (w.x >= w.y && w.x >= w.z) ? c.yz : (w.y >= w.z ? c.xz + 0.37 : c.xy + 0.71);
  vec2 st = texture2D(uFuzz, uv).rg;
  float h = st.r;
  float tag = st.g;

  // 배: 아래를 향한 면 (지느러미 제외)
  ${BELLY[swim]}
  bellyMask *= vPart;
  vec3 base = mix(uFurColor, uBellyColor, bellyMask);
  base *= 0.96 + 0.08 * tag; // 가닥마다 미세한 색 차이
  // 배 솔기: 색 경계를 따라 박음질 자국 (점선)
  float seam = 1.0 - smoothstep(0.0, 0.07, abs(bellyMask - 0.5));
  float dash = step(0.5, fract(vObj.x * 14.0 + vObj.z * 3.0));
  base = mix(base, uBellyColor * 0.85, seam * vPart * (0.35 + 0.4 * dash));
  // 등 솔기: 좌우 천 두 장이 등 가운데(z = 0)에서 만나는 점선 박음질 — 위를 향한 몸 면에만 (플러시 인형의 가장 큰 단서)
  float topSeam = (1.0 - smoothstep(0.0, 0.03, abs(vObj.z))) * smoothstep(0.2, 0.55, vNormalO.y) * (1.0 - bellyMask);
  float topDash = step(0.5, fract(vObj.x * 14.0));
  base = mix(base, uBellyColor * 0.85, topSeam * vPart * (0.3 + 0.45 * topDash));
  base = mix(base, mix(uBellyColor * 0.92, uFurColor * 0.7, markDark), marking * vPart);

  // 보풀 결: 가닥 높이의 화면 미분으로 법선을 살짝 흔든다 (천 같은 미세 질감)
  vec3 n = normalize(vNormalV);
  float bump = 0.25 + uPile * 6.0;
  n = normalize(n - vec3(dFdx(h), dFdy(h), 0.0) * bump);
  vec3 v = normalize(-vViewPos);
  vec3 l = normalize(uLightDir);
  float ndl = dot(n, l);
  float diff = 0.42 + 0.58 * (ndl * 0.5 + 0.5);     // 감싸는 확산광 (솜 인형처럼 부드럽게)
  float sky = n.y * 0.5 + 0.5;
  vec3 hemi = mix(vec3(0.80, 0.77, 0.74), vec3(1.0, 0.99, 0.97), sky);

  // 벨벳 시언: 비스듬히 볼수록 털 끝이 빛을 받아 밝아진다
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  vec3 sheen = mix(vec3(1.0), uFurColor, 0.4) * fres * 0.28;
  // 눌린 보풀의 부드러운 하이라이트
  vec3 hv = normalize(l + v);
  float spec = pow(max(dot(n, hv), 0.0), 8.0) * 0.08;

  vec3 col = base * hemi * diff + sheen + spec;
  // 물속: 젖은 윤기 + 위를 향한 면에 커스틱 + 살짝 푸른 기운
  col = mix(col, base * 1.05 + spec * 3.0, uWet * 0.3);
  float up = max(vNormalO.y, 0.0);
  col += caustic(vWorld.xz * 1.6, uTime) * up * 0.22 * uWet;
  col = mix(col, col * uWaterTint, uWet * 0.08);
  // 물 너머로 보여도 색이 죽지 않게: 밝기·채도 보정
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, mix(vec3(lum), col, 1.35) * 1.15, uWet);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class PlushMaterial extends THREE.ShaderMaterial {
  constructor(swim: PlushSwim = "shark") {
    if (!fuzzTex) fuzzTex = makeFuzzTexture();
    super({
      vertexShader: vertex(swim),
      fragmentShader: fragment(swim),
      uniforms: {
        uFuzz: { value: fuzzTex },
        uPile: { value: 0.05 },
        uTime: { value: 0 },
        uBeat: { value: 1 },
        uSwimAmp: { value: 1 },
        uTurn: { value: 0 },
        uFurColor: { value: new THREE.Color("#8c8168") },
        uBellyColor: { value: new THREE.Color("#f2ece0") },
        uDensity: { value: 2.2 },
        uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.6).normalize() },
        uWet: { value: 0 },
        uWaterTint: { value: new THREE.Color("#7fc4ff") },
      },
      side: THREE.FrontSide,
    });
  }
}
