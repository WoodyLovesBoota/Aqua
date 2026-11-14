import * as THREE from "three";

const N = 8;

/**
 * 수면 파문: 누른 자리에서 동심원 링이 퍼지며 사라진다 (최대 8개 동시).
 * 높이 변위 없이 법선만 흔들고 마루에 옅은 빛을 더한다 — 젤리 수면처럼 가볍게.
 * 재질에 onBeforeCompile 로 끼워 넣고, push(x, z, 세기) 로 파문을 추가, update(시간) 을 프레임마다 부른다.
 */
export function attachRipples(mat: THREE.MeshStandardMaterial) {
  const rip = Array.from({ length: N }, () => new THREE.Vector4(0, 0, -100, 0));
  const uTime = { value: 0 };
  let next = 0;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRip = { value: rip };
    shader.uniforms.uRipTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRipXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRipXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform vec4 uRip[${N}];
uniform float uRipTime;
varying vec2 vRipXZ;
// (높이, d높이/dx, d높이/dz) — 링은 속도 1.3 으로 퍼지고 3.5초에 걸쳐 사그라든다
vec3 ripField(vec2 p) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${N}; i++) {
    vec4 r = uRip[i];
    float age = uRipTime - r.z;
    if (age < 0.0 || age > 3.5) continue;
    vec2 d = p - r.xy;
    float dist = length(d) + 1e-4;
    float x = dist - age * 1.3;
    float env = exp(-x * x * 5.0) * exp(-age * 1.1) * r.w * smoothstep(0.0, 0.15, age);
    float w = 16.0;
    float h = sin(x * w) * env;
    float dh = (cos(x * w) * w - sin(x * w) * 10.0 * x) * env;
    acc.x += h;
    acc.yz += dh * d / dist;
  }
  return acc;
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
vec3 ripF = ripField(vRipXZ);
normal = normalize(normal + (viewMatrix * vec4(-ripF.y * 0.05, 0.0, -ripF.z * 0.05, 0.0)).xyz);`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * max(ripF.x, 0.0) * 0.3;");
  };
  mat.customProgramCacheKey = () => "diorama-ripples";
  return {
    push(x: number, z: number, strength = 1) {
      rip[next].set(x, z, uTime.value, strength);
      next = (next + 1) % N;
    },
    update(t: number) {
      uTime.value = t;
    },
  };
}
