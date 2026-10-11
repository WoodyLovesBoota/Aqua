# Aqua — Plush Sea Creatures

귀여운 인형(플러시) 귀상어·만타 가오리·바다거북·돌고래·고래상어를 꾸미고, 작은 젤리 바다에 풀어놓고 관상하는 웹.

- `/` 스튜디오: 종(Hammerhead / Manta / Turtle / Dolphin / Whale)을 고르고 이름과 털 색을 고른다. 눈·볼터치·솜·보풀·박자는 `SPECIES_DATA[종].fixed`(store/species.ts)로 고정(입은 없다 — 얼굴은 구슬 눈 + 볼터치, 플러시 단서는 등·배 솔기와 케어 태그). 생물이 화면 전체(글자 뒤까지)를 자율 유영하고, 누르거나 끌면 그곳으로 따라온다. `?pose=1`(고정 포즈) · `&still=1`(헤엄 정지) · `&view=top|side|front|back|below` · `&lod=mid|lo` · `&species=manta|turtle|dolphin|whaleshark` 는 캡처·점검용.
- `/sea` 라군: 몰디브 리조트 디오라마. 둥근 젤리 블록(15×12) 위에 모래섬·야자수 8·수상 방갈로 8·데크·파라솔·선베드·보트. 수면은 화면공간 굴절(수면을 뺀 장면을 렌더타깃에 한 번 더 그려 법선대로 비틀어 샘플링)로 아래가 젤리처럼 비친다. 수면은 높이장 파동 시뮬레이션(`waterSim.ts`: 256×208 half-float 핑퐁 타깃, 90Hz 고정 스텝)으로 움직인다 — 누르면 손가락처럼 그 자리가 그릇으로 **파이고**(누르는 동안 유지, 떼면 되튀어 링이 퍼짐), 끌면 지나간 자리가 한 줄의 골로 파이며, 그냥 지나가도 얕게 파인다. 파는 벽에 반사·간섭해 수면 전체가 울렁이다 5초쯤에 잦아든다. 오른쪽 패널은 물 색(Flavour)만 — 파도·감쇠·시점은 기본값 고정이고 먹이 주기는 없앴다(상어도 먹이 추격 없이 자율 유영만). **블록 아래 지층·모래를 잡고 끌면 푸딩처럼 흔들린다**: 바닥이 손을 조금 따라가고 윗부분(물 포함)은 전단으로 크게 휘청이며 눌렸다 펴지고, 놓으면 2Hz 로 대여섯 번 출렁이다 ≈ 2.4초에 멈춘다(전단 스프링 ζ 0.085, 최대 전단 0.26 = 윗면 변위 ≈ 1.1). 파도 물리는 무시한다 — 수면은 블록과 함께 움직일 뿐 쏠리거나 수평을 지키지 않는다. 다섯 마리의 크기는 실제 비율을 압축한 것(몸길이: 고래상어 ≈ 2.6 · 귀상어 ≈ 1.4 · 돌고래 ≈ 1.15 · 만타 폭 ≈ 1.85 · 거북 ≈ 0.8, 배율 0.56/0.42/0.33/0.5/0.26). 상어는 섬·방갈로 구역을 피해 열린 물에서 자율 유영한다. 만타는 중간 수심에서 넓은 호를 그리며 활공하고 가끔 수면을 스치며, 거북은 바닥 가까이 느리게 유영하다 25~40초마다 수면에 올라와 숨을 쉬고, 돌고래는 가장 빠르게 중상층을 돌다 18~30초마다 열린 물에서 수면 위로 뛰어오른다(파문). 고래상어는 가장 크고 느리게 넓은 호를 그리며 30~45초마다 수면 근처에서 천천히 여과 섭식한다(등지느러미 끝이 수면을 살짝 가른다). 다섯 마리는 서로·섬·얕은 물가·산호 군락을 피한다. **산호초**: 앞 모래톱·섬 앞 여울·왼쪽 앞 깊은 물 세 군락에 가지(사슴뿔)·뇌·손가락·테이블·부채·말미잘 산호가 깔려 있고(정점 색 1 드로우 + 부채 알파 격자 1 드로우), 말미잘 촉수와 부채는 느리게 흔들린다. 군락마다 **열대어**(흰동가리·블루탱·옐로탱·나비고기, 모두 10마리, 인스턴스 1 드로우)가 산호 위를 배회하다 가끔 질주하고, 큰 생물이 다가오면 산호 사이로 내려가 숨는다. `/sea?jump=초` 는 첫 점프 시각을 당기고 상태를 `window.__aquaDebug` 에 노출한다(점검용). `/sea?focus=sandbar|shore|deep` 은 산호 군락 근접 뷰(점검용).

## Stack

Next 16 (App Router) · TypeScript · SCSS Modules + `classnames/bind` · three.js / @react-three/fiber · zustand (persist)

## 구조

```
src/
  app/                 페이지 (클라이언트 전용 dynamic import)
  components/creature/ 생물 공용: registry(종 → 메시·Parts·스튜디오 배율), PlushCreature(모든 종의 몸체 컴포넌트), sdf(SDF 도우미·지느러미·표면 팩토리),
                       creatureFormat/creatureMesh(바이너리 포맷·LOD 로더), PlushMaterial(벨벳 셰이더 — 종별 헤엄 변형·배 마스크 스니펫),
                       parts(부품 병합 + 구슬 눈/볼터치/케어 태그/콧구멍 헬퍼), debugProbe(점검용 URL 파라미터·window.__aquaDebug)
  components/shark/    sharkSdf(형태 정의·표면 앵커·SHARK_DEF), sharkManifest(자동 생성), SharkParts(눈/아가미/케어 태그/장식)
  components/manta/    mantaSdf(납작 몸통+날개+머리지느러미+꼬리·MANTA_DEF), mantaManifest(자동 생성), MantaParts(눈/볼터치/아가미/케어 태그)
  components/turtle/   turtleSdf(높은 돔 등딱지+챙 테두리+배딱지+큰 머리+노 지느러미 4+꼬리·TURTLE_DEF), turtleManifest(자동 생성), TurtleParts(눈/볼터치/콧구멍/케어 태그)
  components/dolphin/  dolphinSdf(멜론+부리+방추 몸통+등/가슴/꼬리지느러미·DOLPHIN_DEF), dolphinManifest(자동 생성), DolphinParts(눈/볼터치/숨구멍/케어 태그)
  components/whaleshark/ whalesharkSdf(납작 머리+네모 입+능선 3+지느러미·WHALESHARK_DEF), whalesharkManifest(자동 생성), WhaleSharkParts(눈/볼터치/아가미/케어 태그)
  components/studio/   커스터마이징 씬(자율 유영 AI, 종 전환) + 패널 + ContactShadow(바닥 접촉 그림자)
  components/sea/      물 셰이더(수면/옆면/모래/지층/빛줄기), waterSim(수면 높이장 파동 시뮬: 핑퐁 타깃·임펄스/누름·부피 보존·?simdebug 오버레이), 상어 AI(먹이 추격), LagoonSwimmer(공용 수조 생물: 조향·그림자) + swimBehaviours(종별 행동), 라군 UI
                       lagoonNav(수조 치수·활동 범위·금지 구역 판정/되밀기·얕은 바닥 판정·공용 조향 스텝 navStep·블롭 그림자),
                       tankGeometry(둥근 블록 지오메트리), lagoonHeight(섬 높이맵 — JS/GLSL 공용, 금지 구역(섬·산호 원·리조트), 산호 군락 자리 REEF_SITES, 맵 배율 S),
                       Reef(산호 6종 빌더 → 정점 색 1 메시 + 부채 알파 격자 메시, aSway 흔들림), ReefFish(열대어 10마리 — 인스턴스 1 드로우, 무늬·눈 프래그먼트, 꼬리 파동 정점 셰이더, 배회·질주·숨기 AI),
                       Palms(야자수 인스턴스), Resort(방갈로·데크·소품 → 재질별 병합), Shadows(블롭·블록 가짜 그림자)
  components/three/    precompile(셰이더 워밍업: Canvas 를 frameloop="never" 로 열고 물체 하나씩 비동기 컴파일한 뒤 루프를 켠다. 렌더타깃 변형은 ExtraTargets 컨텍스트)
  components/ui/       공용 프레임·패널 컴포넌트
  store/               species(종 목록·팔레트·고정 생김새·문구 — 종 레지스트리의 데이터 쪽), sharkStore(creatures[종] 설정 + 선택한 종, localStorage 영속)
scripts/bake-creature.mts <shark|manta|turtle|dolphin|whaleshark>  SDF → marching cubes → meshoptimizer 단순화 → LOD 3개 베이크 (ts-alias.mjs 가 @/ 별칭을 풀어준다)
public/{shark,manta,turtle,dolphin,whaleshark}-{hi,mid,lo}.{hash}.bin(.gz)  베이크된 메시 (hi 30k / mid 12k / lo 4k tris, 16비트 양자화, gzip 본 포함)
scripts/visual-check/  렌더 점검(check: fps·draw·tris·GPU 시간·long task·힙), 커스터마이징 매트릭스(matrix), 단일 캡처(shot), 조건부 캡처(probe),
                       조작 흐름(flow: 종 전환→이름→색→바다→클릭/드래그/물 색→복귀), 로딩 프로파일(profile: 긴 작업별 원인 함수),
                       블록 흔들기 수치 점검(jelly: 지층을 잡고 끈 뒤 전단·스쿼시를 50ms 샘플링), 열대어 소크(fishsoak: 군락 반경 이탈·정지·숨기 샘플), 산호 군락 확대 크롭(zoom.py),
                       목표/결과(OPT.md, RESORT.md, MANTA.md, TURTLE.md, DOLPHIN.md, WHALESHARK.md, QUALITY.md, REMODEL.md — 거북 재모델·크기 비례·입 제거/플러시 디테일, WAVESIM.md — 수면 파임 시뮬, JELLY.md — 블록 젤리 흔들림, REEF.md — 산호초·열대어)
```

## 렌더링 메모

- 수조 수면은 프레임마다 장면을 두 번 그린다(굴절 텍스처 0.75배 해상도 + 본 렌더). draws·tris 계측값은 두 패스 합이다. 수면 높이장 시뮬(`waterSim.ts`)은 프레임당 1~2 스텝(90Hz 고정)을 256×208 쿼드로 더 그린다(+1~2 draws, GPU 비용 무시 가능). 입력(임펄스·누름·생물 물보라)이 끊긴 지 8초가 지나면 잠들어 스텝을 돌리지 않는다. 임펄스는 큐(사건), 누름은 `uPress` 상태(매 스텝 적용)로 들어간다. 포인터 레이캐스트는 수면 메시(36k tri) 대신 보이지 않는 2-tri 히트 평면과 지층 히트 박스가 받는다(모래·섬은 그대로). 수심(`vDepth`)은 정점에서 재고 보간한다. 수면 정점 셰이더는 높이 텍스처 5탭으로 높이·법선을 얻는다(법선 기울기 1.8배 과장). 임펄스는 부피 중립(멕시칸햇)이고, 누름은 목표 깊이로 끌어내리는 제약이며, 밉맵 1×1 평균으로 수위를 0 에 묶는다 — 안 그러면 누르는 동안 수조 전체 수위가 내려간다. `/sea?simdebug=1` 은 높이 텍스처를 왼쪽 위에 띄우고, `?calm=` 은 감쇠 초기값, `?shear=x,z` 는 블록 정적 전단(점검용). 블록은 그룹 하나에 행렬을 합성해 넣는다(바닥 변위 · BLOCK_MID 피벗 기울기 · 바닥 피벗 스쿼시·전단, `Matrix4.makeShear`)이고 조명·디버그 오버레이는 바깥에 있다. 흔들기 입력은 지층 히트 박스·모래 메시의 pointerdown 에서 `setPointerCapture` 로 잡아 메시 밖에서도 move/up 을 받는다(빠르게 흔들면 포인터가 메시를 벗어난다). 수면 끌기는 캡처하지 않는다(캡처되면 `e.point` 가 고정된다).
- 생물 메시는 런타임에 만들지 않는다. SDF 정의(`*Sdf.ts`)나 LOD 목표를 바꿨으면 `pnpm bake:shark` / `bake:manta` / `bake:turtle` / `bake:dolphin` / `bake:whaleshark` 로 다시 굽는다 (파일명 해시·매니페스트가 같이 갱신된다).
- 스튜디오는 hi LOD 를 그리고, 그림자는 레이어 2 의 lo LOD 프록시만 보는 전용 카메라로 만든다. 수조는 mid LOD.
- 생물은 단일 패스 불투명 머티리얼 하나로 그린다 (셸 퍼 없음). 헤엄 변형은 종별 정점 셰이더 스니펫(상어: 꼬리 좌우, 만타: 날개 펄럭임, 거북: 앞지느러미 노젓기, 돌고래: 꼬리 상하 파동, 고래상어: 느린 좌우 S 자 — 전단 변형 법선 보정). 고래상어 별무늬는 삼면 투영 격자 셀마다 어긋난 점 + 가는 선.. 거북 등딱지의 육각 갑판 솔기는 프래그먼트에서 육각 타일 거리로 그린다. 모든 종에 등 가운데 점선 솔기(|z| < 0.03, 위를 향한 몸 면)와 배 색 경계의 점선 솔기를 셰이더로 그린다. 수조 수치는 REMODEL.md 결과표 참고.
- 눈·볼터치·아가미·케어 태그(꼬리 쪽 솔기에 눕힌 천 라벨 + 붉은 줄)·장식은 SDF 표면에 투영해 붙이므로 솜(stuffing) 스케일과 함께 움직인다. 그룹마다 정점 색으로 합쳐 1 드로우.
- 수조의 바위·수초는 InstancedMesh, 빛줄기는 정점 속성(aSeed)으로 위상을 나눈 1 메시. 산호는 종류별 프로시저럴 지오메트리를 정점 색으로 칠해 하나로 합친다(Icosahedron 은 인덱스가 없어 전부 `toNonIndexed` 뒤 병합). 부채 산호의 격자는 캔버스 텍스처인데, 투명 배경 `map` 으로 쓰면 투명 픽셀의 검정 RGB 가 밉맵에서 선에 번져 멀리서 검게 보이므로 검정 배경 흰 선을 `alphaMap` 으로만 쓴다. 말미잘 촉수·부채의 흔들림은 `aSway` 정점 속성 × `onBeforeCompile` 사인 변위. 열대어는 ShaderMaterial InstancedMesh 하나(인스턴스 속성 aKind·aTail·aWag) — 종 무늬와 구슬 눈을 로컬 좌표로 프래그먼트에서 그린다. 물속 물체는 수면의 색유리 곱으로 붉은 계열 채도가 크게 깎이니 팔레트를 한 단계 진하고 밝게 잡는다.
- 산호 군락은 금지 구역 원(`NO_GO.reefs`)이지만 **clearance < 1 인 종(상어·거북·돌고래)만** 보고 margin 도 0.6 으로 깎는다 — 고래상어·만타는 얕은 바닥 판정으로 어차피 산호 위에 못 오고, 그 큰 margin(1.2)을 산호 원에 더하면 벽·리조트 띠와 겹쳐 빠져나올 수 없는 주머니가 생긴다(navsim 으로 잡음).
- `/?pose=1` 이면 상어가 고정 포즈로 멈춘다 (매트릭스 캡처용).
- 셰이더는 첫 프레임 전에 `components/three/precompile.tsx` 가 물체 하나씩 비동기로 컴파일한다 (동기 컴파일로 생기던 130~150ms 긴 작업 제거). 생물 메시는 받은 뒤 임시 메시로 먼저 컴파일하고 화면에 올린다.
- 세로(모바일) 화면: 수조 카메라는 블록 대각선이 화면 폭의 ≈80% 가 되게 물러난다(far 220). 스튜디오 생물은 패널(가로: 오른쪽 18%, 세로: 아래 42vh)에 가려지는 자리를 목표로 고르지 않는다.

```bash
pnpm install
pnpm dev
pnpm bake:shark      # 상어 형태를 바꿨을 때
pnpm bake:manta      # 만타 형태를 바꿨을 때
pnpm bake:turtle     # 거북 형태를 바꿨을 때
pnpm bake:dolphin    # 돌고래 형태를 바꿨을 때
pnpm bake:whaleshark # 고래상어 형태를 바꿨을 때
pnpm check:render <라벨> [baseUrl]   # DPR=2 / DRIFT=30 환경변수로 GPU 시간·힙 드리프트 측정, ROUTES=/sea 로 라우트 한정
pnpm check:shot <out.png>            # 한 장 캡처 (URL=/경로, STORE='{"species":"manta","creatures":{"manta":{...}}}' 로 저장 상태 주입, DPR, WAIT=ms, CLICK=x,y / DRAG=x1,y1,x2,y2[,x3,y3…] / HOLD=x,y,ms / HOVER=x1,y1,x2,y2 + AFTER=ms)
pnpm check:matrix <라벨>
pnpm check:flow <라벨> [baseUrl]      # 조작 흐름 점검 (실패하면 종료 코드 1). VW=390 VH=844 로 모바일
URL=/sea pnpm check:profile [baseUrl]  # 로딩 긴 작업별 원인 함수 (CDP 프로파일)
SECS=120 pnpm check:soak [baseUrl]     # 수조 소크: 생물이 갇히거나 범위를 벗어나는지 (문제 있으면 exit 1)
pnpm check:navsim                      # navStep 단독 시뮬레이션 (갇힌 상태에서 탈출하는지, 브라우저 없이)
pnpm check:all <라벨> [baseUrl]         # 회귀 게이트: tsc·lint·렌더·흐름(데스크톱/세로)·소크·매트릭스 한 번에 (SKIP=matrix SOAK=60)
COND='window.__aquaDebug?.dolphin.phase==="air"' URL=/sea?jump=4 node scripts/visual-check/probe.mjs out.png   # 페이지 안 조건이 참이 되는 순간 캡처 (EXPR 로 상태 출력)
node scripts/visual-check/jelly.mjs           # 블록 흔들기: 놓은 뒤 전단·바닥 변위·스쿼시 샘플 (DRAG=…, MS=ms)
SECS=30 node scripts/visual-check/fishsoak.mjs # 열대어 소크: 군락 반경 이탈·정지·숨기/질주 샘플 (문제 있으면 exit 1)
python3 scripts/visual-check/zoom.py in2x.png out.png [sandbar shore deep]   # DPR 2 전체 캡처에서 산호 군락만 잘라 한 시트로
```
