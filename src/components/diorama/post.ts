import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const DIR_X = new THREE.Vector2(1, 0), DIR_Y = new THREE.Vector2(0, 1);

/**
 * 밤 블룸 경로 — EffectComposer 대신 전체 해상도 패스를 둘로 줄인 전용 파이프라인.
 *   ① 장면 → MSAA 4x HDR 타깃 (컴포저 경로는 계단 현상 방지가 꺼져 있었다)
 *   ② 밝은 부분 추출 + 5단 가우시안 번짐 (UnrealBloomPass 의 재질·타깃을 그대로 써서 모양이 같다, 1/8 해상도부터)
 *   ③ 장면 + 번짐 → 톤매핑 → sRGB 를 한 번에 화면으로
 * 컴포저는 ②뒤에 "전체 해상도 가산 합성"과 "전체 해상도 OutputPass" 를 따로 돌렸다 — 둘을 ③ 하나로 합친다.
 */
export class BloomPost {
  strength: number;
  private readonly sceneRT: THREE.WebGLRenderTarget;
  private readonly bloom: UnrealBloomPass;
  private readonly quad = new FullScreenQuad();
  private readonly out: THREE.ShaderMaterial;
  private readonly clear = new THREE.Color();

  constructor(gl: THREE.WebGLRenderer, strength: number, radius: number, samples = 4) {
    this.strength = strength;
    // 장면 타깃은 R11F_G11F_B10F (32비트 HDR): half-float(64비트) MSAA 보다 대역폭이 절반이라 4x 를 써도 싸다. 못 그리는 기기는 half-float 로
    this.sceneRT = gl.extensions.has("EXT_color_buffer_float")
      ? new THREE.WebGLRenderTarget(2, 2, { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat, samples })
      : new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), strength, radius, 1.0);
    this.out = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.sceneRT.texture }, tBloom: { value: this.bloom.renderTargetsHorizontal[0].texture } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene; uniform sampler2D tBloom; varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
  }

  /** 장치 픽셀 크기. 번짐은 1/4 에서 시작한다 (UnrealBloomPass 가 그 절반부터 밉을 만든다) */
  setSize(w: number, h: number) {
    this.sceneRT.setSize(w, h);
    this.bloom.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
  }

  /** 워밍업용: 장면 타깃 (렌더타깃에 그릴 때의 셰이더 변형을 미리 컴파일한다) */
  get target() {
    return this.sceneRT;
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const b = this.bloom, q = this.quad;
    const blur = b.separableBlurMaterials, H = b.renderTargetsHorizontal, V = b.renderTargetsVertical;
    gl.setRenderTarget(this.sceneRT);
    gl.render(scene, camera);

    const autoClear = gl.autoClear, alpha = gl.getClearAlpha();
    gl.getClearColor(this.clear);
    gl.autoClear = false;
    gl.setClearColor(0x000000, 0);
    const pass = (m: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null) => {
      q.material = m;
      gl.setRenderTarget(to);
      if (to) gl.clear();
      q.render(gl);
    };
    const hp = b.highPassUniforms as Record<string, THREE.IUniform>;
    hp.tDiffuse.value = this.sceneRT.texture;
    hp.luminosityThreshold.value = b.threshold;
    pass(b.materialHighPassFilter, b.renderTargetBright);
    let input = b.renderTargetBright;
    for (let i = 0; i < b.nMips; i++) {
      blur[i].uniforms.colorTexture.value = input.texture;
      blur[i].uniforms.direction.value = DIR_X;
      pass(blur[i], H[i]);
      blur[i].uniforms.colorTexture.value = H[i].texture;
      blur[i].uniforms.direction.value = DIR_Y;
      pass(blur[i], V[i]);
      input = V[i];
    }
    b.compositeMaterial.uniforms.bloomStrength.value = this.strength;
    b.compositeMaterial.uniforms.bloomRadius.value = b.radius;
    pass(b.compositeMaterial, H[0]);
    pass(this.out, null);
    gl.setClearColor(this.clear, alpha);
    gl.autoClear = autoClear;
  }

  dispose() {
    this.sceneRT.dispose();
    this.bloom.dispose();
    this.quad.dispose();
    this.out.dispose();
  }
}
