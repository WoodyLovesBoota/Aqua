/* eslint-disable react-hooks/immutability -- three.js 객체는 프레임마다 직접 변경한다 */
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";
import { compileSpread } from "@/components/three/precompile";

interface Props {
  position: [number, number, number];
  /** 평면 크기 (x, z) */
  size: [number, number];
  /** 평면 위로 이만큼 높이까지 그림자를 만든다 */
  far: number;
  /** 그림자 카메라와 블러 평면이 속한 레이어. 이 레이어의 물체만 그림자를 만든다 */
  layer: number;
  opacity: number;
  blur: number;
  color: string;
  resolution?: number;
}

/**
 * 바닥 접촉 그림자: 평면 아래에서 위를 보는 직교 카메라로 깊이를 찍고 두 번 블러해 바닥 평면에 입힌다.
 * drei ContactShadows 와 같은 원리지만, 그림자 카메라가 지정 레이어만 보게 해
 * 저해상 프록시 메시만으로 그림자를 만들 수 있다 (본체 수만 tris 를 다시 그리지 않는다).
 */
export function ContactShadow({ position, size, far, layer, opacity, blur, color, resolution = 512 }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const group = useRef<THREE.Group>(null!);
  const [width, height] = size;

  const r = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution);
    const targetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false;
    const planeGeo = new THREE.PlaneGeometry(width, height).rotateX(Math.PI / 2);
    const blurPlane = new THREE.Mesh(planeGeo);
    blurPlane.layers.set(layer);
    const depthMat = new THREE.MeshDepthMaterial();
    depthMat.depthTest = depthMat.depthWrite = false;
    depthMat.onBeforeCompile = (shader) => {
      shader.uniforms.ucolor = { value: new THREE.Color(color) };
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform vec3 ucolor;\nvoid main() {")
        // 그림자 색을 입히고, 가까울수록(바닥에 붙을수록) 진하게
        .replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );", "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );");
    };
    const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    hBlur.depthTest = vBlur.depthTest = false;
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0, far);
    camera.layers.set(layer);
    const shadowMat = new THREE.MeshBasicMaterial({ map: target.texture, transparent: true, opacity, depthWrite: false });
    return { target, targetBlur, planeGeo, blurPlane, depthMat, hBlur, vBlur, camera, shadowMat };
  }, [resolution, width, height, far, layer, color, opacity]);

  // 깊이·블러 셰이더도 미리 컴파일해 둔다 (첫 그림자 패스의 동기 컴파일 방지)
  useEffect(() => {
    let alive = true;
    const warm = new THREE.Group();
    for (const m of [r.depthMat, r.hBlur, r.vBlur]) warm.add(new THREE.Mesh(r.planeGeo, m));
    compileSpread(gl, warm, r.camera, scene, () => alive).catch(() => {});
    return () => {
      alive = false;
    };
  }, [gl, scene, r]);

  useEffect(
    () => () => {
      r.target.dispose();
      r.targetBlur.dispose();
      r.planeGeo.dispose();
      r.depthMat.dispose();
      r.hBlur.dispose();
      r.vBlur.dispose();
      r.shadowMat.dispose();
    },
    [r],
  );

  const blurPass = (amount: number) => {
    // 블러 평면은 씬에 넣지 않고 그림자 카메라 앞(평면 위 far/2 높이)에 직접 놓고 그린다
    r.blurPlane.position.set(position[0], position[1] + far * 0.5, position[2]);
    r.blurPlane.updateMatrixWorld();
    r.blurPlane.visible = true;
    r.blurPlane.material = r.hBlur;
    r.hBlur.uniforms.tDiffuse.value = r.target.texture;
    r.hBlur.uniforms.h.value = amount / 256;
    gl.setRenderTarget(r.targetBlur);
    gl.render(r.blurPlane, r.camera);
    r.blurPlane.material = r.vBlur;
    r.vBlur.uniforms.tDiffuse.value = r.targetBlur.texture;
    r.vBlur.uniforms.v.value = amount / 256;
    gl.setRenderTarget(r.target);
    gl.render(r.blurPlane, r.camera);
    r.blurPlane.visible = false;
  };

  useFrame(() => {
    const prevBg = scene.background;
    const prevOverride = scene.overrideMaterial;
    group.current.visible = false;
    scene.background = null;
    scene.overrideMaterial = r.depthMat;
    gl.setRenderTarget(r.target);
    gl.render(scene, r.camera);
    blurPass(blur);
    blurPass(blur * 0.4);
    gl.setRenderTarget(null);
    group.current.visible = true;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
  });

  return (
    <group ref={group} position={position} rotation-x={Math.PI / 2}>
      <mesh geometry={r.planeGeo} material={r.shadowMat} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]} />
      <primitive object={r.camera} />
    </group>
  );
}
