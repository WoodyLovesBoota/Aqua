# Aqua 에 생물 추가하기 — 파일·순서·함정 (만타 가오리 추가에서 정리, 2026-10-10)

> 2026-11-14 구조 변경: 사이트는 꾸미기 없는 **모델 전시장**이 됐다. 스튜디오(`/studio`)·스토어(`store/`)·물 색 설정·매트릭스 점검은 삭제됐고,
> 생물 생김새는 `src/components/creature/species.ts` 의 `CREATURE_CONFIGS` 기본값 하나로 고정, 모든 종이 항상 라군에 있다.
> 새 전시(별도 모델링)는 `src/app/<slug>/page.tsx` 라우트 하나로 만든다. 화면에 패널·선택 UI 는 두지 않는다(사용자 요청, 라군도 삭제). 아래 문서의 스튜디오·팔레트·매트릭스 단계는 건너뛴다.

좌표계: +x = 앞(입), +y = 위, +z = 오른쪽. 기준 크기는 상어 몸길이 ≈ 3.3, 만타 날개폭 ≈ 3.7 — 새 생물도 이 자릿수로 만들고 수조에서 배율로 줄인다.

## 만들 파일 — 종 하나 = SDF + 부품 + 매니페스트 + 레지스트리 두 줄 + 수조 행동
| 파일 | 역할 | 본보기 |
|---|---|---|
| `src/components/<name>/<name>Sdf.ts` | SDF 형태 정의 + `export const surface = makeSurface(sdX)` + `<NAME>_DEF: CreatureDef` | `manta/mantaSdf.ts` |
| `src/components/<name>/<name>Manifest.ts` | 자동 생성. 처음엔 빈 값으로 만들어 두고 `pnpm bake:<name>` 이 덮어쓴다 | — |
| `src/components/<name>/<Name>Parts.tsx` | 눈·입·볼터치 등. `creature/parts.tsx` 의 `beadEyes / stitchLine / blushPair / satinMat` 로 조립해 `Merged` 1 드로우 | `dolphin/DolphinParts.tsx` |
| `src/components/creature/species.ts` | `SPECIES_IDS` 에 id, `CREATURE_CONFIGS` 에 고정 생김새(털·배 색·솜·보풀·박자) | — |
| `src/components/creature/files.ts`, `registry.tsx` | 매니페스트 등록, `CREATURES` 에 swim 키·Parts·plump | — |
| `src/components/creature/PlushMaterial.ts` | `PlushSwim` 에 종 추가, `SWIM`(정점 변형)·`BELLY`(배 마스크·무늬) 스니펫 — 변수에 접두사 | — |
| `src/components/sea/swimBehaviours.ts` | `Behaviour` 하나(nav 파라미터·init·tick·motion) 추가하고 `SWIMMERS` 에 넣기. 조향·회피·클램프·그림자는 `LagoonSwimmer`+`navStep` 공용 | — |
| `scripts/bake-creature.mts`, `package.json` | `DEFS` 등록, `bake:<name>` 스크립트 | — |
| `README.md` | 구조·명령 | — |

몸체 컴포넌트는 `PlushCreature`(공용) 이라 종마다 만들지 않는다. 수조·preload 는 레지스트리를 읽으므로 손댈 곳이 없다.

## 순서 (10단계 기본형)
1. 파이프라인: 위 파일 뼈대 + SDF v0(몸통만이라도) → `pnpm bake:<name>` 성공 → 근접 focus 뷰(없으면 `?focus=<name>` 를 SeaScene 에 추가)로 첫 캡처.
2. 실루엣: 4방향 시트(`view=` q/top/side/front) → 비율·부위 배치.
3. 플러시 다듬기: 두께·둥글기·smin, `?still=1&lod=hi|mid|lo` 세 LOD 비교 (고정 포즈에서도 헤엄이 돌아가니 `still=1` 필수).
4. 재질: 배 마스크·무늬 스니펫, 팔레트 4색 top 뷰.
5. 부품: 눈·입·볼터치·종 특유 디테일. 앵커는 `surfaceAnchor` 로 표면 투영 — 투영이 **엉뚱한 부위(가까운 지느러미)** 에 붙을 수 있으니 투영 시작점을 표면 가까이 두고 캡처로 확인.
6. 유영 셰이더: 시간차 프레임 + PIL diff. 변위 h 가 한 축의 함수면 법선은 전단 공식 `(nx, ny, nz − h'·ny)` 로 보정.
7. (스튜디오 단계는 삭제됨) 기본 색·솜을 `CREATURE_CONFIGS` 에서 확정하고 수조 배율을 기존 종과 비례하게.
8. 수조: `swimBehaviours.ts` 에 행동 추가. 조향은 `navStep` 공용이라 `NavParams` 수치와 상태 기계(tick)만 쓴다. 수심이 높은 생물은 섬 물가 얕은 바닥 위로 떠올라 금지 구역을 넘는다 → `clearance` 키우고 `resolveNoGo` 안전망. 상어와 겹치지 않게 목표 선정 때 상어 3.5 밖 + 근접 밀어냄. 시간차 4장(6/14/22/30s)으로 확인.
9. 성능: `pnpm check:render <라벨>`. 예산: 생물 1마리당 수조 draws +≤8(두 패스), tris +≤30k.
10. 정리: 기존 생물 근접 캡처로 불변 확인, README·결과표·메모리.

## SDF 작성 요령
- 도우미는 `creature/sdf.ts`: `smin, smoothstep, sdRoundCone, sdRoundBox, sdEllipsoid, sdPolygon, smoothPoly, makeFin/sdFin, sdfNormal, sdfProject`.
- 납작한 부위는 좌표를 미리 나누어(`py*1.5`) 평가하고 결과를 그 배율의 최대값으로 나눈다(근사 SDF). 베이크가 표면 스냅을 2회 하므로 근사여도 된다.
- 넓은 판(날개·등딱지)은 2D 평면형(`smoothPoly`) × 두께 프로파일(가장자리로 갈수록 0, 끝으로 갈수록 얇게) 로.
- `part()` 는 1 = 배 색 허용(몸), 0 = 털 색만(지느러미·꼬리). 배 마스크는 `BELLY` 스니펫에서 법선·위치로.
- 그리드 범위(`gridScale = 2/범위`, `gridOffset = 범위 중심`)가 형태를 다 담는지 베이크 로그의 bbox 로 확인. 해상도 112~128.

- 성능 예산: 생물 1마리 ≈ draws +8, tris +30~34k(두 패스). 예산을 넘기면 목표를 낮추지 말고 부품 캡슐 분할(4·8 → 2·6)부터 줄인다.
- 종이 늘어 패널 분할 버튼이 넘치면 `.segmented` 는 flex-wrap(2줄) — 이미 반영됨.

## 함정 모음 (거북·돌고래 루프에서 추가)
- **종별 GLSL 스니펫의 변수 이름**은 프래그먼트 본문의 `col/base/n/h/seam` 등과 겹치면 셰이더 컴파일이 실패해 **몸만 안 그려지고 부품만 보인다**. 스니펫 변수에는 접두사(hex*, e*, ...)를 붙인다.
- **좌우 지느러미**는 오른쪽 하나만 `makeFin` 으로 정의하고 `sdFin(px, py, Math.abs(pz), fin)` 으로 거울상을 만든다. 좌우 Euler 를 따로 적으면 거울상이 안 나와 bbox 가 비대칭이 된다. 판을 눕히는 x축 회전은 `+π/2` (local +y → world +z 바깥쪽), 뒤로 쓸기는 y축 음수. 숫자가 의심되면 Node 로 `applyMatrix4` 해서 끝점 좌표를 찍어 본다.
- 무늬가 **안 보인다고 느껴지면 눈이 아니라 픽셀을 찍는다**(`getpixel` 로 무늬 안/밖 비교). 옅은 무늬는 시언 광택에 묻힌다. 셰이더 경로 자체를 의심할 땐 `bellyMask = 1.0` 같은 극단 TEST 를 넣어 서빙 결과로 확인한 뒤 되돌린다(서빙 JS 에 텍스트가 있는지는 playwright 로 응답 본문을 grep).
- 축소 시트에서 방향(앞/뒤)을 오판한 적이 있다 — 판정은 원본 해상도 크롭으로.
- 수조 AI 의 **금지 구역 되밀기 + 벽 클램프**가 서로 밀어내며 생물을 영원히 가두던 틈(방갈로 구역 뒤 벽)이 있었다 → `resolveNoGo` 는 활동 범위 밖으로 내보내는 변을 건너뛴다. 새 "돌진" 행동(점프 준비 등)은 반드시 장애물 회피를 유지하고, 시간 제한(8초)으로 포기한다.
- 목표 지점에 "가까워지면" 행동을 바꿀 때 반경은 **회전 반경(속도/회전율)보다 크게** 잡는다. 1.6 < 2.2 라 돌고래가 지점 주위를 영원히 맴돌았다.
- 행동(점프·호흡 등)의 검증은 시간차 캡처보다 `probe.mjs`(페이지 안 조건이 참이 되는 순간 캡처 + 상태 출력)가 확실하다. 점검용 URL 파라미터(`?jump=초`)로 타이밍을 당기고 `window.__aquaDebug` 에 상태를 노출한다(파라미터 있을 때만).
- 새 종 추가 때 `PlushSwim` 유니온·`SWIM`/`BELLY` 두 레코드·스토어 5곳(타입·팔레트·FIXED·DEFAULT·store 필드/setter/partialize/merge)·StudioScene(SPECIES·분기)·StudioPage(옵션·COPY·current/patch/palette)·bake DEFS·package.json·next.config·ClientOnly preload·matrix 케이스를 빠짐없이. 돌고래는 이 체크리스트대로 해서 첫 베이크부터 형태가 맞았다.

## 함정 모음
- Node 베이크는 `@/` 별칭을 `scripts/ts-alias.mjs` 훅이 풀어준다. src 모듈끼리는 `@/` 로 import 해도 된다.
- 베이크 스크립트를 바꾸면 기존 생물 해시가 바뀐다 — 다시 굽고 매트릭스로 동일 확인.
- `?view=` 의 top/below·front/back 은 Euler 부호가 헷갈린다 — 캡처로 확인하고 쓴다(현재 값은 교정 완료).
- 커스텀 ShaderMaterial 은 `#include <colorspace_fragment>` 필수, 정점 색은 선형(sRGB→선형 변환).
- 캡처 프로세스가 가끔 종료에서 멈춘다(위 SKILL.md 규칙).

## 함정 모음 (재모델·크기 비례·입 제거 루프에서 추가, 2026-10-11 REMODEL.md)
- **성능 목표는 같은 기기·직전 게이트의 metrics.json 값으로** 잡는다. 문서에 적힌 다른 세션의 GPU ms 를 그대로 목표로 쓰면 "두 배 느려졌다"고 오판한다(헤드리스 GPU 시간은 실행마다 5.4~8.4ms 로 흔들린다). 의심되면 2회 계측.
- 얼굴에 **입은 없다**(사용자 결정). 플러시 단서는 등 솔기(셰이더 `topSeam`)·배 솔기·`careTag`·필요하면 `nostrilPair`. 새 종도 `careTag(surface, x, y, z)` 를 꼬리 쪽 옆구리(법선이 옆을 향하는 곳)에 둔다 — 배 밑(법선 ↓)에 두면 옆에서 날 끝으로만 보인다.
- 움직이는 부위 마스크는 **고정돼야 할 덩어리의 기하(거북 등딱지 타원)로 잘라내라**. |z| 문턱만으로 자르면 테두리까지 같이 흔들린다.
- 수조 배율은 실제 비율을 압축해 쓴다(몸길이 ≈ 2.6 / 1.4 / 1.15 / 폭 1.85 / 0.8). 몸이 길면 `NavParams.inset` 으로 벽 여유를 두고, 분리 반경은 상대의 반 길이 + 내 반 길이보다 크게.
