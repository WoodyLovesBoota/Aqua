# 품질·최적화 루프 (2026-10-10)

"코드 전반 최적화 + 모든 기능을 실제 화면으로 확인해 품질 개선" 을 5회 반복한 기록. 이후에도 같은 루프를 계속 돈다 (아래 "다음 후보").

## 루프 절차

1. `DPR=2 pnpm check:render <라벨>` (단독 실행) → fps·draws·tris·GPU ms·longtask·콘솔
2. 스크린샷을 눈으로 확인 — 데스크톱(1440×900) **과 세로(VW=390 VH=844)** 둘 다
3. `pnpm check:flow <라벨>` — 종 전환→이름→색→바다→클릭/드래그/먹이/물 색/시점→복귀
4. `URL=/sea pnpm check:profile` — 긴 작업이 남아 있으면 원인 함수
5. 코드 감사 → 수정 → `tsc --noEmit` + `pnpm lint` → 재계측

## 발견·수정 (심각도순)

| ID | 심각도 | 영역 | 위치 | 문제 → 조치 |
|---|---|---|---|---|
| Q-01 | HIGH | 렌더/반응형 | `sea/SeaScene.tsx` | 세로 화면에서 카메라가 r≈128 까지 물러나는데 `far: 120` 이라 **수조가 통째로 안 보임** → far 220, 세로는 r = 37×1.4/aspect 로 블록 대각선이 폭의 ≈80% |
| Q-02 | HIGH | 로딩 | 양쪽 Canvas | 첫 프레임에 셰이더 ~20개를 동기 컴파일 → 긴 작업 137+153ms(수조) → `components/three/precompile.tsx`: `frameloop="never"` 로 열고 물체 하나씩 `gl.compile` + 12ms 예산마다 양보 + `compileAsync` 대기 후 루프 ON. 생물 메시는 받은 뒤 임시 메시로 먼저 컴파일. **렌더타깃(굴절 패스)은 출력 색공간이 달라 프로그램 변형이 하나 더 생김** → `ExtraTargets` 컨텍스트로 그 변형까지 미리 컴파일 |
| Q-03 | MED | UX | `studio/StudioScene.tsx` | 생물이 오른쪽 패널 뒤(가로) / 아래 패널 뒤(세로)로 자주 들어감, 첫 목표도 (4,0.8,0)=패널 뒤 → `roamBox(aspect)` 로 가려지는 영역은 목표에서 제외, 첫 목표 (1.5,0.8,0) |
| Q-04 | MED | 기능 | `sea/SeaScene.tsx` | 먹이가 섬·방갈로·여울에 떨어지면 상어가 못 가는 먹이를 쫓다 갇힘, 알갱이(r 0.055)가 화면에서 5px 로 안 보임 → 열린 물(바닥 < BOTTOM+0.5)에만 투하, r 0.085, `?debug` 때 `__aquaDebug.pellets` 공개 |
| Q-05 | LOW | GPU | `sea/waterMaterials.ts` | 수면 정점 셰이더가 24-파문 루프를 정점당 4회(높이 3 + vR 1) → 파문을 한 번 계산해 재사용(3회). 수조 GPU 중앙값 3.2 → 2.3~2.5ms |
| Q-06 | LOW | 보안 | `next.config.ts` | 보안 헤더 없음 → `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| Q-07 | LOW | 접근성 | `ui/Panel.tsx`, Canvas | 색 스와치가 `title` 만 → `aria-label`+`aria-pressed`; 이름 입력 `aria-label`; 두 Canvas 에 `role="img"` + 설명 |
| Q-08 | LOW | SEO/메타 | `app/layout.tsx`, `page.tsx`, `sea/page.tsx` | 제목이 "Plush Hammerhead"(5종인데) → 템플릿 제목·라우트별 metadata·viewport/themeColor |
| Q-09 | LOW | 코드 | `sea/SeaScene.tsx`, `studio/*` | 안 쓰는 `onMood`/`onEat` 프롭·`SharkMood` export 제거, URL 파라미터 파싱을 `captureParam` 하나로 통일, 스캐폴드 svg 5개 삭제 |
| Q-10 | LOW | 도구 | `scripts/visual-check` | `VW/VH` 뷰포트, `check:flow`(조작 흐름, 실패 시 exit 1), `check:profile`(긴 작업 원인) 추가 |

## 수치 (M4 Pro, 헤드리스 Chrome ANGLE Metal, DPR 2)

| 항목 | 기준(dev) | 5회차(dev) | 5회차(prod) |
|---|---|---|---|
| 스튜디오 fps / draws / tris | 60.5 / 11 / 38k | 60.2 / 11 / 38k | 60.2 / 11 |
| 스튜디오 GPU 중앙값 / p95 | 1.73 / 3.42ms | 1.53 / 3.25ms | 1.92 / 3.45ms |
| 스튜디오 longtask | 63ms | 70ms | **없음** |
| 수조 fps / draws / tris | 60.3 / 81 / 348k | 60.3 / 81 / 348k | 60.4 / 81 |
| 수조 GPU 중앙값 / p95 | 3.2 / 4.52ms | 2.31 / 3.42ms | 2.76 / 4.23ms |
| 수조 longtask | 137 + 153ms | 151ms(마운트) | **83ms** |
| 힙 드리프트(30s, prod) | — | — | +1.1 / +1.3MB |
| 콘솔 에러 | 0 (THREE.Clock 경고는 R3F 내부) | 0 | 0 |
| 전송량(prod, 압축 전) | — | — | JS 1.4MB(gzip ≈373KB, three.js 고정비) + 폰트 81KB + 메시 267/474KB |

남은 수조 마운트 긴 작업(dev 151 / prod 83ms)은 씬 마운트 자체 — Resort 빌더 19ms, 모래 격자 11ms, 부품 SDF 투영 11ms, PlushMaterial 5ms, 나머지는 React/R3F 커밋.

## 6회차 (자율 루프)

| ID | 심각도 | 영역 | 위치 | 문제 → 조치 |
|---|---|---|---|---|
| Q-11 | LOW | UX | `ui/Frame.tsx`, 두 Page | 청크 로드 뒤 워밍업 동안 캔버스가 비어 보임 → `Precompile onReady` 까지 로딩 문구 유지, `CanvasSlot ready` 로 0.45s 페이드인 |
| Q-12 | MED | 견고성 | `ui/GlBoundary.tsx` | WebGL 미지원/차단이면 빈 화면 → 에러 경계가 안내 문구 표시 + `onFail` 로 로딩 오버레이 해제 (`--disable-webgl` 크롬으로 확인: 문구 노출, pageerror 0) |
| Q-13 | LOW | 접근성 | `ui/Panel.tsx`, `sea/SeaPage.tsx` | 종 선택이 radiogroup 인데 화살표 키 이동 없음 → roving tabindex + 화살표; 슬라이더 `aria-valuetext`; 패널 제목 `h2`; 수조에 sr-only `h1` |

메모: Next 16(cacheComponents) 은 클라이언트 이동 뒤 **이전 라우트를 `hidden` Activity 로 DOM 에 남긴다** — 캔버스 2개가 공존하지만 숨은 쪽은 그리지 않고(draws 로 확인) WebGL 컨텍스트는 재사용되며(왕복 4회에 생성 2·손실 0), 힙도 31→33MB 로 안정. 점검 스크립트는 `getByRole("heading", { level: 1 })` 처럼 보이는 요소만 잡아야 한다.

## 7회차 (자율 루프) — 수조 소크 테스트

새 도구 `pnpm check:soak`(SECS 초 동안 2초마다 5마리 위치·fps 를 읽어 갇힘/범위 이탈/fps 저하를 찾는다. `?debug` 에서 `__aquaDebug.<종>Nav` 공개) 와
`pnpm check:navsim`(브라우저 없이 `navStep` 을 node 로 돌려 갇힌 상태에서 빠져나오는지 본다) 로 찾아 고쳤다.

| ID | 심각도 | 영역 | 위치 | 문제 → 조치 |
|---|---|---|---|---|
| Q-14 | HIGH | 행동 | `sea/lagoonNav.ts`, `SeaScene.tsx` | 90초 소크에서 고래상어가 벽×리조트 여유 경계 모서리(6.4, 0.75)에 25초+ 정지, 거북·만타·돌고래도 리조트/섬 경계에서 정지. 원인 3가지: (1) 벽·되밀기에 닿으면 **매 프레임** 목표를 새로 뽑아 조향이 수렴 못 함 → 목표가 막힌 곳/벽 너머일 때만 재선택, (2) `pushAway` 가 섬/리조트 중 가까운 쪽을 하드 스위치해 경계에서 방향이 매 프레임 뒤집힘 → 1/d² 가중 혼합, (3) 정반대(±180°)로 돌아야 할 때 최단 회전 부호가 프레임마다 바뀌어 요가 ±0.015 로 떨기만 함 → `yawDelta` 에 직전 회전 방향 히스테리시스. 안전망으로 1.5초 제자리면 열린 앞바다 목표. 결과: 120초 소크 문제 0, 평균 61fps |

## 8회차 (자율 루프) — 장기 소크

- 수조 300초 소크: 문제 0, 평균 61fps (5마리 모두 x ±6.4 · z 0.4~5.2 안에서 유영, 돌고래 점프 y 최대 0.49).
- 스튜디오에도 `studioNav`(pos + 화면 비율 nx/ny) 공개 → `URL=/ pnpm check:soak` 120초: 문제 0, x −5.3~2.2(오른쪽 패널 회피 확인), 화면 밖 이탈 0.
- soak.mjs 가 `VW/VH` 를 받아 세로 화면 소크도 가능.

## 9회차 (자율 루프) — 컨텍스트 손실·명암비

- WebGL 컨텍스트 손실/복구를 `WEBGL_lose_context` 로 강제: 손실 중 0 draws → 복구 뒤 수조 3599·스튜디오 660 draws/s 로 완전 재개, 에러 0, 화면 정상. three 기본 복구로 충분해 코드 변경 없음.
- 옅은 글자색 `--ink-faint #9a948a` 의 명암비가 종이 바탕에서 **2.44:1**(AA 4.5 미달) — fig 라벨·슬라이더 양끝·통계 라벨·푸터 보조문·로딩 문구에 쓰인다 (스와치 이름은 ink-soft 5.8:1 로 이미 충분) → `#6a665f`(4.63:1, 카드 위 5.02:1)로 조정 (Q-15).

- 수조 120초 힙 드리프트(dev): −8.2MB (GC 로 오히려 줄어듦) — 누수 없음.

## 10회차 (자율 루프) — 좁은 화면 굴절 해상도

| ID | 심각도 | 영역 | 위치 | 문제 → 조치 |
|---|---|---|---|---|
| Q-16 | LOW | 모바일 GPU | `sea/SeaScene.tsx` | 굴절 렌더타깃이 화면 폭과 무관하게 0.75 배 → 좁은 화면(< 800 css px)은 0.5 배 (`?rt=` 로 강제 가능). 390×844·DPR 2 캡처에서 0.75 와 0.5 의 평균 픽셀 차 1.99(생물 움직임 포함)로 구별 불가, M4 Pro GPU 2.73→2.76ms 로 동일 — 약한 폰 GPU 에서 첫 패스 비용 ≈ −55% 기대 |

## 11회차 (자율 루프) — 회귀 게이트

- `pnpm check:all <라벨> [baseUrl]`: tsc → lint → 렌더(두 라우트) → 흐름(데스크톱·세로) → 소크(수조·스튜디오, SOAK=초) → 매트릭스 를 차례로 돌리고 `summary.json` + 한 줄 요약. `SKIP=matrix,soak-sea` 로 생략.
- dev 게이트 8/8 PASS (흐름 OK·소크 문제 0·매트릭스 에러 0). 이 회차의 GPU 시간(스튜디오 3.5 / 수조 5.8ms)은 평소의 두 배인데, 같은 시각 macOS `WallpaperAerialsExtension`+`VTDecoderXPCService`(동적 배경화면 재생) 가 GPU 를 쓰고 있었고 draws·tris·fps 는 그대로 → 환경 노이즈. **계측 전엔 `ps -Ao pcpu,comm | sort -nr | head` 로 GPU 를 쓰는 다른 프로세스를 확인할 것.**

## 12회차 (자율 루프) — 프로덕션 게이트·키보드

- 프로덕션(3001) 게이트: 렌더(스튜디오 긴 작업 없음 / 수조 83ms, 콘솔 0)·흐름 데스크톱/세로·소크 40초×2 모두 PASS. GPU 시간은 동적 배경화면 때문에 여전히 부푼 값(노이즈).
- 키보드: Tab 순서 링크→종 세그먼트→이름→스와치, 포커스 링(브라우저 기본 `outline auto`)이 종이 바탕에서 또렷. 세그먼트 ←/→ 로 Manta↔Hammerhead 전환되며 제목도 바뀜. 추가 조치 없음.
- `scripts/visual-check/README.md` 를 전체 스크립트 목록으로 다시 씀.

## 13회차 (자율 루프) — 정리

- 수조 마운트 분할은 **보류**: 기대 이득이 prod 83→≈55ms 로 작고(목표 100ms 는 이미 충족), 소품이 첫 프레임 뒤에 튀어나오는 팝인·워밍업 순서 꼬임 위험이 있다. 다시 볼 때는 지연 그룹을 보이지 않게 마운트해 `compileSpread` 뒤에 켜는 방식으로.
- 파일 밖에서 안 쓰는 export 정리: `resolveNoGo`·`DEBUG`·`buildMerged`·`decodeCreatureGeometry`·`BUMPS` 비공개. (타입 export 는 문서 역할이라 유지)

## 15회차 (자율 루프) — 종 전환 글리치

| ID | 심각도 | 영역 | 위치 | 문제 → 조치 |
|---|---|---|---|---|
| Q-17 | MED | 시각 | `creature/PlushCreature.tsx` | 스튜디오에서 종을 바꾸면 새 메시를 받는 동안(캐시 없으면 0.3~1s) **옛 몸통에 새 종의 색·헤엄 셰이더·배 마스크·부품(눈 위치 어긋남, 입 사라짐)·솜 배율**이 입혀진 중간 상태가 보임 (메시 응답 1.5s 지연으로 재현) → `useShown`: 종·설정·머티리얼·메시(+그림자 프록시)를 "새 메시 로드 + 셰이더 워밍업이 끝난 순간" 한 덩어리로 교체. 그 전까지 이전 종을 그대로 두고, 같은 종의 색 변경은 즉시 반영. 내려간 머티리얼은 그때 dispose(교체 전에 버리면 옛 몸통이 동기 재컴파일됨) |

## 16회차 (자율 루프) — 동작 줄이기

- `prefers-reduced-motion: reduce` 면 스튜디오의 커서 추적 카메라 패럴랙스를 끈다 (생물 유영은 유지). Playwright `reducedMotion: "reduce"` 컨텍스트로 확인.

## 다음 후보 (루프 계속)
- 주기 점검: `pnpm check:all` 로 회귀만 감시 (새 결함이 없으면 조치 없음)
- `THREE.Clock` 경고: R3F 9.8 이 내부에서 생성 — 업스트림
