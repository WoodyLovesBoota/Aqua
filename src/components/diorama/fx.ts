import * as THREE from "three";

/* 디오라마 전시 공용 소도구: 자리 놓기 · 김/연기 입자 · 보이지 않는 그림자 끄기 */

/** 그룹을 [x, z, 회전, 배율] 자리에 놓는다 */
export function place(parent: THREE.Object3D, [x, z, ry, s]: readonly [number, number, number, number], y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

/**
 * 김·연기 입자 무리: 스프라이트 수십 장(장마다 드로우 1)을 점 하나로 — 입자마다 크기(월드 단위)·투명도를 따로 준다.
 * set(i, x, y, z, 크기, 투명도) 로 갱신하고 commit() 으로 올린다. 크기는 스프라이트와 같은 월드 폭이 되게 화면 높이·시야각으로 환산.
 */
export function makePuffs(n: number, map: THREE.Texture) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", aPos);
  geo.setAttribute("aSize", aSize);
  geo.setAttribute("aAlpha", aAlpha);
  const uScale = { value: 400 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uScale },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vAlpha;
      void main() {
        vec4 c = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(c.rgb, c.a * vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const s = new THREE.Vector2();
  // 월드 폭 w 가 화면에서 w · (높이/2) / (tan(fov/2) · 거리) 픽셀 — 스프라이트와 같은 크기
  points.onBeforeRender = (r, _s, cam) => {
    r.getDrawingBufferSize(s);
    const fov = (cam as THREE.PerspectiveCamera).fov ?? 26;
    uScale.value = (s.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  };
  return {
    points,
    set(i: number, x: number, y: number, z: number, w: number, a: number) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      size[i] = w;
      alpha[i] = a;
    },
    commit() {
      aPos.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = true;
    },
  };
}

/**
 * 보이지 않는 그림자 끄기: 얇거나(최소 폭 < 0.035 — 창·레일·침목·길·시계판) 아주 작은(최대 폭 < 0.1) 메시는 그림자를 드리우지 않는다.
 * bakeStatic 은 그림자 설정별로 합치므로, 재질의 메시가 모두 꺼지면 그 묶음은 그림자 패스 드로우가 사라진다.
 */
export function trimShadows(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), size = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.castShadow) return;
    box.setFromObject(m).getSize(size);
    if (Math.min(size.x, size.y, size.z) < 0.035 || Math.max(size.x, size.y, size.z) < 0.1) m.castShadow = false;
  });
}
