import * as THREE from "three";
import { captureParam } from "@/components/creature/debugProbe";

export { ENV, resetEnv } from "@/components/three/sceneEnv";

/**
 * 라군의 하루 — 실제 1시간 = 라군 24시간 (매시 정각이 자정, 30분이 정오).
 * 시간대별 하늘·해·달·별·조명 상태를 키프레임 표 하나(KEYS)에서 보간하고,
 * 커스텀 셰이더가 같이 참조하는 공용 유니폼(ENV)을 매 프레임 채운다.
 * ?hour=H 로 시각 고정, ?daylen=초 로 하루 길이 덮어쓰기 (점검용).
 */

const HOUR_PARAM = captureParam("hour");
const FIXED_HOUR = HOUR_PARAM != null && Number.isFinite(Number(HOUR_PARAM)) ? ((Number(HOUR_PARAM) % 24) + 24) % 24 : null;
const DAY_LEN = Number(captureParam("daylen")) || 3600; // 하루 길이(실제 초)

/** 지금 라군 시각 (0 ~ 24) — 벽시계 기준이라 새로고침·여러 탭에서도 같다 */
export function dayHour(nowMs = Date.now()) {
  if (FIXED_HOUR != null) return FIXED_HOUR;
  return (((nowMs / 1000) % DAY_LEN) / DAY_LEN) * 24;
}

/** 키프레임: 하늘(위·아래), 해/달 방향광, 반구광, 셰이더 환경광(선형 배율), 별, 조명 켜짐 */
interface Key {
  h: number;
  skyTop: string;
  skyBot: string;
  sun: string; // 주 방향광 색 (해, 밤엔 달)
  sunI: number;
  fill: string; // 보조광 색
  fillI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  env: [number, number, number]; // 자체 조명 셰이더(물·모래·생물)에 곱하는 선형 배율 — 정오 1
  stars: number;
  lamp: number;
}

// 정오 값은 기준선 조명(반구광 1 · 방향광 1.5 · 보조광 0.35)과 같다 — 낮 장면은 예전 그대로
const KEYS: Key[] = [
  { h: 0, skyTop: "#070b22", skyBot: "#18224a", sun: "#9db3ea", sunI: 0.6, fill: "#5a6aa8", fillI: 0.15, hemiSky: "#5a70b0", hemiGround: "#1a2240", hemiI: 0.6, env: [0.11, 0.14, 0.26], stars: 1, lamp: 1 },
  { h: 4.6, skyTop: "#0a1030", skyBot: "#22295a", sun: "#9db3ea", sunI: 0.55, fill: "#5a6aa8", fillI: 0.15, hemiSky: "#5a70b0", hemiGround: "#1a2240", hemiI: 0.6, env: [0.12, 0.15, 0.27], stars: 1, lamp: 1 },
  { h: 5.2, skyTop: "#1d2860", skyBot: "#7a5d8e", sun: "#b09ad0", sunI: 0.3, fill: "#7a6aa8", fillI: 0.15, hemiSky: "#7a76b0", hemiGround: "#2a2440", hemiI: 0.58, env: [0.3, 0.28, 0.42], stars: 0.55, lamp: 1 },
  { h: 6.0, skyTop: "#5d7cbc", skyBot: "#f7a77c", sun: "#ff9a5c", sunI: 0.75, fill: "#a99ad0", fillI: 0.22, hemiSky: "#d8b8c4", hemiGround: "#5e5068", hemiI: 0.68, env: [0.6, 0.5, 0.52], stars: 0.08, lamp: 0.45 },
  { h: 7.2, skyTop: "#8fbde6", skyBot: "#fbdcb8", sun: "#ffd2a0", sunI: 1.2, fill: "#cfe0ff", fillI: 0.3, hemiSky: "#fff0e0", hemiGround: "#8e9cb0", hemiI: 0.9, env: [0.92, 0.86, 0.8], stars: 0, lamp: 0 },
  { h: 9.5, skyTop: "#a6d2f0", skyBot: "#f1eee6", sun: "#fff6e8", sunI: 1.45, fill: "#cfe6ff", fillI: 0.35, hemiSky: "#ffffff", hemiGround: "#8fa5b8", hemiI: 1.0, env: [1, 0.99, 0.97], stars: 0, lamp: 0 },
  { h: 12, skyTop: "#9fcff0", skyBot: "#f1eee8", sun: "#ffffff", sunI: 1.5, fill: "#cfe6ff", fillI: 0.35, hemiSky: "#ffffff", hemiGround: "#8fa5b8", hemiI: 1.0, env: [1, 1, 1], stars: 0, lamp: 0 },
  { h: 15, skyTop: "#a3cfee", skyBot: "#f3ede2", sun: "#fff3df", sunI: 1.45, fill: "#cfe6ff", fillI: 0.35, hemiSky: "#ffffff", hemiGround: "#8fa5b8", hemiI: 1.0, env: [1, 0.98, 0.95], stars: 0, lamp: 0 },
  { h: 16.8, skyTop: "#98bfe2", skyBot: "#fad7aa", sun: "#ffcf8e", sunI: 1.3, fill: "#d6dcf5", fillI: 0.3, hemiSky: "#fff0dc", hemiGround: "#8c95a8", hemiI: 0.92, env: [0.97, 0.88, 0.76], stars: 0, lamp: 0 },
  { h: 17.9, skyTop: "#5d6aa8", skyBot: "#ff9468", sun: "#ff7f48", sunI: 0.95, fill: "#b49ad0", fillI: 0.25, hemiSky: "#e8a890", hemiGround: "#5a4866", hemiI: 0.74, env: [0.78, 0.55, 0.48], stars: 0, lamp: 0.35 },
  { h: 18.7, skyTop: "#2e3070", skyBot: "#c56a78", sun: "#d77a6a", sunI: 0.35, fill: "#8a72b8", fillI: 0.2, hemiSky: "#8a6aa0", hemiGround: "#2e2644", hemiI: 0.58, env: [0.36, 0.28, 0.4], stars: 0.3, lamp: 1 },
  { h: 19.6, skyTop: "#121845", skyBot: "#3a3470", sun: "#9db3ea", sunI: 0.5, fill: "#5a6aa8", fillI: 0.15, hemiSky: "#6068a8", hemiGround: "#1a2040", hemiI: 0.6, env: [0.15, 0.16, 0.3], stars: 0.85, lamp: 1 },
  { h: 24, skyTop: "#070b22", skyBot: "#18224a", sun: "#9db3ea", sunI: 0.6, fill: "#5a6aa8", fillI: 0.15, hemiSky: "#5a70b0", hemiGround: "#1a2240", hemiI: 0.6, env: [0.11, 0.14, 0.26], stars: 1, lamp: 1 },
];

// 키프레임 색은 한 번만 파싱해 둔다 (THREE.Color 는 선형 공간)
const PARSED = KEYS.map((k) => ({
  ...k,
  c: {
    skyTop: new THREE.Color(k.skyTop),
    skyBot: new THREE.Color(k.skyBot),
    sun: new THREE.Color(k.sun),
    fill: new THREE.Color(k.fill),
    hemiSky: new THREE.Color(k.hemiSky),
    hemiGround: new THREE.Color(k.hemiGround),
  },
}));
type ColorKey = keyof (typeof PARSED)[number]["c"];

/** 보간된 하루 상태 (객체는 재사용 — 프레임마다 할당하지 않는다) */
export interface DayState {
  hour: number;
  skyTop: THREE.Color;
  skyBot: THREE.Color;
  sun: THREE.Color;
  sunI: number;
  fill: THREE.Color;
  fillI: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  env: THREE.Vector3;
  stars: number;
  lamp: number;
  /** 해·달 고도 (라디안, 지평선 아래는 음수) */
  sunElev: number;
  moonElev: number;
  /** 해·달 방향 (월드, 단위 벡터 — 빛이 오는 쪽) */
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  /** 해·달의 호 진행도 (0 = 뜸, 0.5 = 남중, 1 = 짐 — 밖이면 지평선 아래) */
  sunArc: number;
  moonArc: number;
}

export function makeDayState(): DayState {
  return {
    hour: 12,
    skyTop: new THREE.Color(),
    skyBot: new THREE.Color(),
    sun: new THREE.Color(),
    sunI: 0,
    fill: new THREE.Color(),
    fillI: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiI: 0,
    env: new THREE.Vector3(1, 1, 1),
    stars: 0,
    lamp: 0,
    sunElev: 0,
    moonElev: 0,
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    sunArc: 0.5,
    moonArc: -1,
  };
}

// 해의 수평 방위(월드 xz 각도): 아침엔 화면 왼쪽(카메라 −right), 정오엔 기준선 조명 방향 (3, 2), 저녁엔 화면 오른쪽.
// 카메라 방위각 35° → 화면 오른쪽 = (cos35, −sin35)
const AZ_RISE = Math.atan2(Math.sin((35 * Math.PI) / 180), -Math.cos((35 * Math.PI) / 180)); // ≈ 145°
const AZ_NOON = Math.atan2(2, 3); // ≈ 34° (기준선 방향광 (3, 6, 2))
const AZ_SET = -(35 * Math.PI) / 180;
const SUN_MAX_ELEV = Math.atan2(6, Math.hypot(3, 2)); // ≈ 59° — 정오 방향 = 기준선 방향광
const MOON_MAX_ELEV = (52 * Math.PI) / 180;

/** 호 진행도 a (0 = 뜸, 0.5 = 남중, 1 = 짐) → 방위·고도 → 월드 방향 */
function arcDir(a: number, maxElev: number, out: THREE.Vector3) {
  const elev = maxElev * Math.sin(Math.PI * a);
  const az = a < 0.5 ? THREE.MathUtils.lerp(AZ_RISE, AZ_NOON, a * 2) : THREE.MathUtils.lerp(AZ_NOON, AZ_SET, a * 2 - 1);
  out.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
  return elev;
}

const lerpColor = (out: THREE.Color, a: THREE.Color, b: THREE.Color, t: number) => out.copy(a).lerp(b, t);

/** hour 시각의 상태를 out 에 채운다 */
export function sampleDay(hour: number, out: DayState) {
  const h = ((hour % 24) + 24) % 24;
  out.hour = h;
  let i = 0;
  while (i < PARSED.length - 2 && PARSED[i + 1].h <= h) i++;
  const A = PARSED[i];
  const B = PARSED[i + 1];
  // 키 사이는 smoothstep — 키 근처에서 변화가 꺾이지 않게
  const lin = (h - A.h) / (B.h - A.h);
  const t = lin * lin * (3 - 2 * lin);
  for (const k of ["skyTop", "skyBot", "sun", "fill", "hemiSky", "hemiGround"] as ColorKey[]) lerpColor(out[k], A.c[k], B.c[k], t);
  out.sunI = THREE.MathUtils.lerp(A.sunI, B.sunI, t);
  out.fillI = THREE.MathUtils.lerp(A.fillI, B.fillI, t);
  out.hemiI = THREE.MathUtils.lerp(A.hemiI, B.hemiI, t);
  out.env.set(
    THREE.MathUtils.lerp(A.env[0], B.env[0], t),
    THREE.MathUtils.lerp(A.env[1], B.env[1], t),
    THREE.MathUtils.lerp(A.env[2], B.env[2], t),
  );
  out.stars = THREE.MathUtils.lerp(A.stars, B.stars, t);
  out.lamp = THREE.MathUtils.lerp(A.lamp, B.lamp, t);
  // 해: 6시 뜨고 18시 진다. 달: 18시 30분 뜨고 5시 30분 진다 (해와 반대 호)
  const sa = (h - 6) / 12;
  out.sunElev = arcDir(sa, SUN_MAX_ELEV, out.sunDir);
  if (sa < 0 || sa > 1) out.sunElev = -Math.abs(out.sunElev) - 0.01;
  out.sunArc = sa;
  const ma = (((h - 18.5 + 24) % 24) / 11);
  out.moonElev = arcDir(ma, MOON_MAX_ELEV, out.moonDir);
  if (ma < 0 || ma > 1) out.moonElev = -Math.abs(out.moonElev) - 0.01;
  out.moonArc = ma;
  return out;
}

/** 라군 시각 → "HH:MM" */
export function formatHour(h: number) {
  const m = Math.floor(h * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 시간대 이름 (패널 표시용) */
export function dayPhase(h: number) {
  if (h < 5) return "밤";
  if (h < 6.5) return "새벽";
  if (h < 10) return "아침";
  if (h < 16) return "낮";
  if (h < 19) return "노을";
  return "밤";
}
