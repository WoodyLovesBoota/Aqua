import * as THREE from "three";

/**
 * 자체 조명 셰이더(물·모래·지층·생물·열대어)가 공유하는 유니폼.
 * 수조의 하루 주기(sea/dayCycle·LagoonDay)가 매 프레임 채운다. 머티리얼 uniforms 에 같은 객체를 넣으면 한 번 갱신으로 전부 바뀐다. 수조를 떠나면 resetEnv() 로 한낮 값으로 되돌린다.
 */
export const ENV = {
  uEnvLight: { value: new THREE.Vector3(1, 1, 1) }, // 선형 배율 — 정오 1
  uKeyDir: { value: new THREE.Vector3(3, 6, 2).normalize() }, // 주광(해/달)이 오는 방향 (월드)
  uKeyCol: { value: new THREE.Color(1, 1, 1) }, // 주광 반사 색 × 세기
  uSkyCol: { value: new THREE.Color("#f1eee8") }, // 물에 비치는 하늘 색
  uSunUp: { value: 1 }, // 해가 떠 있는 정도 (커스틱·빛줄기)
  uLamp: { value: 0 }, // 밤 조명 켜짐 (0 ~ 1)
};

export function resetEnv() {
  ENV.uEnvLight.value.set(1, 1, 1);
  ENV.uKeyDir.value.set(3, 6, 2).normalize();
  ENV.uKeyCol.value.setRGB(1, 1, 1);
  ENV.uSkyCol.value.set("#f1eee8");
  ENV.uSunUp.value = 1;
  ENV.uLamp.value = 0;
}
