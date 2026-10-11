"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUNGALOWS } from "./Resort";

/**
 * 가짜 그림자 두 종류 (그림자 맵 없이):
 * 1. 소품 블롭: 방갈로 아래 수면 위 부드러운 타원 (인스턴스 1 드로우). 야자수 블롭은 섬 가장자리 물 위에 큰 얼룩처럼 떨어져 뺐다
 * 2. 블록 그림자: 종이 바닥 위에 떨어지는 둥근 사각형 그림자 (SDF 1 드로우)
 */

// 그림자가 밀리는 방향 (높이 1당 x, z). 카메라에서 보이는 오른쪽 앞으로 떨어지게 한다
const OFF_X = 0.5;
const OFF_Z = 0.14;

function makeBlobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(15,40,60,0.75)");
  g.addColorStop(0.55, "rgba(15,40,60,0.35)");
  g.addColorStop(1, "rgba(15,40,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const blockShadowVert = /* glsl */ `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const blockShadowFrag = /* glsl */ `
  precision highp float;
  uniform vec2 uHalf; uniform float uCorner;
  varying vec2 vP;
  void main() {
    float d = length(max(abs(vP) - (uHalf - uCorner), 0.0)) - uCorner;
    float a = (1.0 - smoothstep(-0.6, 3.2, d)) * 0.34;
    gl_FragColor = vec4(0.28, 0.24, 0.22, a);
    #include <colorspace_fragment>
  }
`;

interface Props {
  top: number;
  groundY: number; // 블록 밑면 높이
  halfX: number;
  halfZ: number;
  corner: number;
}

export function Shadows({ top, groundY, halfX, halfZ, corner }: Props) {
  const blobs = useRef<THREE.InstancedMesh>(null!);
  const tex = useMemo(() => makeBlobTexture(), []);
  const blobMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), [tex]);
  const blockMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: blockShadowVert,
        fragmentShader: blockShadowFrag,
        uniforms: { uHalf: { value: new THREE.Vector2(halfX, halfZ) }, uCorner: { value: corner } },
      }),
    [halfX, halfZ, corner],
  );
  const count = BUNGALOWS.length;

  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    // 방갈로: 수면 위 작은 타원
    BUNGALOWS.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x + OFF_X * 0.4, top + 0.012, b.z + OFF_Z * 0.4), q, new THREE.Vector3(0.95, 0.75, 1));
      blobs.current.setMatrixAt(i, m);
    });
    blobs.current.instanceMatrix.needsUpdate = true;
  }, [top]);

  useEffect(
    () => () => {
      tex.dispose();
      blobMat.dispose();
      blockMat.dispose();
    },
    [tex, blobMat, blockMat],
  );

  return (
    <>
      <instancedMesh ref={blobs} args={[undefined, blobMat, count]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      {/* 블록 그림자: 블록보다 큰 판을 빛 반대쪽으로 밀어 종이 위에 */}
      <mesh
        material={blockMat}
        position={[OFF_X * (top - groundY), groundY - 0.002, OFF_Z * (top - groundY)]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[halfX * 2 + 8, halfZ * 2 + 8]} />
      </mesh>
    </>
  );
}
