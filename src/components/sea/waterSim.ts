import * as THREE from "three";

/**
 * 수면 높이장 시뮬레이션 (2D 파동 방정식, 핑퐁 렌더타깃).
 * R = 높이 h, G = 속도 v.  v += c·(이웃 평균 − h); v *= damp; h += v  (정점 셰이더가 R 을 읽어 수면을 변형한다)
 * 고정 스텝(STEP_HZ)으로 돌려 프레임레이트와 무관하게 같은 속도로 번진다. 경계는 클램프 샘플링 = 반사하는 벽.
 * 입력 두 종류: 임펄스(한 번 일어나는 사건 — 큐에 쌓였다가 다음 스텝에 들어간다)와 누름(유지되는 상태 — 매 스텝 적용).
 * 아무 입력 없이 WAKE_S 가 지나면 잠들어 스텝을 돌리지 않는다 (잔여 진폭 < 1%).
 */
export const SIM_W = 256;
export const SIM_H = 208; // 수조 17×13.6 비례 (셀 ≈ 0.066)
export const SIM_TEXEL = new THREE.Vector2(1 / SIM_W, 1 / SIM_H);
export const MAX_IMPULSES = 8;
export const STEP_HZ = 90; // 젤리처럼 느리게 번진다 (c 0.9 → ≈ 2.5 u/s)
export const DEFAULT_CALM = 0.9;
const MAX_STEPS_PER_FRAME = 4;
const WAKE_S = 8;

const simVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const simFragment = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uSize;        // 수조 월드 크기 (W, D) — 임펄스를 월드 단위 원으로
uniform float uC;          // 전파 계수 (< 2 안정)
uniform float uDamp;       // 스텝당 속도 감쇠
uniform vec4 uImpulses[${MAX_IMPULSES}]; // uv.xy, 반지름(월드), 세기(높이)
uniform int uCount;
uniform vec4 uPress;       // 누름: uv.xy, 반지름(월드, ≤ 0 이면 없음), 목표 깊이
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uPrev, vUv);
  float h = c.r;
  float v = c.g;
  float l = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float d = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float u = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  float avg = (l + r + d + u) * 0.25;
  v += (avg - h) * uC;
  v *= uDamp;
  h += v;
  // 체커보드(격자 주파수) 잡음은 살짝 번지게 해서 죽인다
  h = mix(h, avg, 0.02);
  for (int i = 0; i < ${MAX_IMPULSES}; i++) {
    if (i >= uCount) break;
    vec4 im = uImpulses[i];
    vec2 dd = (vUv - im.xy) * uSize;
    float q = dot(dd, dd) / (im.z * im.z);
    // 부피 중립(멕시칸햇): 가운데가 파이면 밀려난 물이 테두리로 솟는다 → 수위가 통째로 내려가지 않는다
    h += im.w * (1.0 - 2.5 * q) * exp(-q * 2.5);
  }
  if (uPress.z > 0.0) {
    // 손가락처럼 그 자리의 높이를 목표 깊이로 끌어내린다 → 누르는 동안 그릇이 유지되고 떼면 되튄다
    vec2 dd = (vUv - uPress.xy) * uSize;
    float prof = exp(-dot(dd, dd) / (uPress.z * uPress.z) * 2.0);
    float k = 0.25 * prof;
    h = mix(h, uPress.w * prof, k);
    v *= 1.0 - k * 0.5;
  }
  // 부피 보존: 누름·클램프가 뺀 부피만큼 수면 전체 평균이 흘러내리므로 평균(밉맵 1×1)을 0 으로 되돌린다
  float mean = texture2DLodEXT(uPrev, vec2(0.5), 12.0).r;
  h -= mean * 0.08;
  h = clamp(h, -0.6, 0.6);
  v = clamp(v, -0.3, 0.3);
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}
`;

export class WaterSim {
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private cur = 0;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly mat: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private acc = 0;
  private readonly queue: THREE.Vector4[] = []; // uv.xy, 반지름, 세기
  private wake = 0; // 남은 깨어 있는 시간(s)

  constructor(
    private readonly w: number,
    private readonly d: number,
  ) {
    const mk = () =>
      new THREE.WebGLRenderTarget(SIM_W, SIM_H, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        // 밉맵 꼭대기(1×1)가 평균 높이 — 스텝 셰이더가 읽어 수위를 0 으로 되돌린다. 정점 샘플링은 lod 0 이라 영향 없다
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: true,
      });
    this.targets = [mk(), mk()];
    this.mat = new THREE.ShaderMaterial({
      vertexShader: simVertex,
      fragmentShader: simFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: SIM_TEXEL },
        uSize: { value: new THREE.Vector2(w, d) },
        uC: { value: 0.9 },
        uDamp: { value: 1 },
        uImpulses: { value: Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4()) },
        uCount: { value: 0 },
        uPress: { value: new THREE.Vector4() },
      },
    });
    this.setCalm(DEFAULT_CALM);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** 현재 높이 텍스처 (수면 셰이더가 읽는다) */
  get texture() {
    return this.targets[this.cur].texture;
  }

  /** 감쇠: calm 0.3..2 → 스텝당 0.9982..0.988 (기본 0.9 → 0.9946, 손 뗀 뒤 5초(450스텝)면 ≈ 9%) */
  setCalm(calm: number) {
    this.mat.uniforms.uDamp.value = THREE.MathUtils.clamp(1 - 0.006 * calm, 0.985, 0.9995);
  }

  /** 월드 xz → 수면 uv (평면 로컬 y = −월드 z) 를 out.xy 에 */
  private toUv(x: number, z: number, out: THREE.Vector4) {
    out.x = x / this.w + 0.5;
    out.y = -z / this.d + 0.5;
    return out;
  }

  /** 다음 스텝에 들어갈 임펄스. strength < 0 이면 파이고, > 0 이면 솟는다 (높이 단위, 월드) */
  push(x: number, z: number, radius: number, strength: number) {
    const im = this.toUv(x, z, new THREE.Vector4());
    im.z = radius;
    im.w = strength;
    this.queue.push(im);
    this.wake = WAKE_S;
  }

  /** 누르고 있는 자리: 반지름 안의 높이를 depth(< 0) 쪽으로 끌어내린다. clearPress 까지 유지된다 */
  setPress(x: number, z: number, radius: number, depth: number) {
    const p = this.toUv(x, z, this.mat.uniforms.uPress.value as THREE.Vector4);
    p.z = radius;
    p.w = depth;
    this.wake = WAKE_S;
  }

  clearPress() {
    (this.mat.uniforms.uPress.value as THREE.Vector4).z = 0;
  }

  /** 셰이더 워밍업 (첫 프레임 긴 작업 방지) — 첫 스텝은 Precompile 뒤라 링크 완료를 기다릴 필요가 없다 */
  compile(gl: THREE.WebGLRenderer) {
    void gl.compileAsync(this.scene, this.camera);
  }

  /** dt 만큼 고정 스텝을 돌린다. 임펄스는 첫 스텝에만 넣고, 입력이 끊긴 지 WAKE_S 가 지나면 쉰다 */
  update(gl: THREE.WebGLRenderer, dt: number) {
    if (this.wake <= 0 && this.queue.length === 0) return;
    this.wake -= dt;
    this.acc = Math.min(this.acc + dt, MAX_STEPS_PER_FRAME / STEP_HZ);
    const stepDt = 1 / STEP_HZ;
    const u = this.mat.uniforms;
    const arr = u.uImpulses.value as THREE.Vector4[];
    const prevTarget = gl.getRenderTarget();
    while (this.acc >= stepDt) {
      this.acc -= stepDt;
      const n = Math.min(this.queue.length, MAX_IMPULSES);
      for (let i = 0; i < n; i++) arr[i].copy(this.queue[i]);
      u.uCount.value = n;
      this.queue.splice(0, n);
      u.uPrev.value = this.targets[this.cur].texture;
      const next = 1 - this.cur;
      gl.setRenderTarget(this.targets[next]);
      gl.render(this.scene, this.camera);
      this.cur = next;
    }
    gl.setRenderTarget(prevTarget);
  }

  dispose() {
    this.targets[0].dispose();
    this.targets[1].dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}

/** ?simdebug=1 — 높이 텍스처를 화면 왼쪽 위에 그대로 띄운다 (클립 공간 직접 출력, 카메라 무관) */
export class SimDebugMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.x * 0.35 - 0.62, position.y * 0.35 + 0.55, 0.0, 1.0);
}
`,
      fragmentShader: /* glsl */ `
precision highp float;
uniform sampler2D uTex;
varying vec2 vUv;
void main() {
  float h = texture2D(uTex, vUv).r;
  // 0 = 회색, 파임(−) = 파랑, 솟음(+) = 흰색
  vec3 col = h < 0.0 ? mix(vec3(0.5), vec3(0.1, 0.2, 0.9), clamp(-h * 8.0, 0.0, 1.0)) : mix(vec3(0.5), vec3(1.0), clamp(h * 8.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`,
      depthTest: false,
      depthWrite: false,
      transparent: true, // 투명 패스 맨 끝에 그려 물 옆면 위에 덮인다
      uniforms: { uTex: { value: null } },
    });
  }
}
