# Aqua — Model Showcase

모델링을 하나씩 만들어 걸어 두고 감상하는 전시용 웹. 첫 전시는 인형(플러시) 귀상어·만타 가오리·바다거북·돌고래·고래상어가 헤엄치는 젤리 블록 리조트 라군이다. 꾸미기·설정 기능은 없다 — 모든 것은 기본값으로 고정이다.

- 전시마다 라우트 하나: 새 전시는 `src/app/<slug>/page.tsx` 에 페이지를 만든다. 화면에는 선택·설정 UI(패널)가 없다 — 장면과 위쪽 안내 한 줄뿐.
- `/marina-bay` 마리나베이(전시 02): 같은 젤리 블록 문법의 싱가포르 마리나베이 디오라마. 만 건너편에 마리나 베이 샌즈(앞 다리가 휘는 세 동 + 왼쪽으로 내민 스카이파크 배 — 밤엔 테두리 LED·인피니티 풀·갑판 점등이 가장 밝은 빛), 아트사이언스 연꽃, 왼쪽 뒤 싱가포르 플라이어(천천히 돈다), 앞오른쪽 헬릭스 브리지, 앞왼쪽 에스플러네이드 두리안 돔(삼각 차양 마름모 격자), 왼쪽 물가 머라이언(물줄기·파문) + 풀러턴, 오른쪽 가든스 바이 더 베이(슈퍼트리 8·스카이웨이·유리 돔 2). CBD 빌딩은 넣지 않는다(사용자 요청). 하루 주기는 라군과 같은 `dayHour`(`?hour=` 고정) → `nightOf` 로 재질 낮/밤 보간·하늘 두 장 교차·밤 블룸(1/4 해상도). 만을 누르면 파문, 땅·지층을 잡고 끌면 푸딩 흔들림. 점검: `?focus=mbs|lotus|flyer|gardens|esplanade|merlion|helix` 근접 · `?bloom=0` · `?shadow=0` · `?msaa=0` · `?dpr=` · `&debug`(`__aquaDebug.<id>Meshes` 메시별 삼각형). 목표 그림·목업은 `.visual-check/marinabay/`, 목표·결과는 `scripts/visual-check/MARINABAY.md`.
- `/sapporo` 삿포로(전시 03): 눈 덮인 젤리 블록. 앞왼쪽 노천 온천(유백색 물·바위 테·김) + 2층 목조 료칸(장지문·붉은 초롱)·석등·대나무 울타리, 뒤왼쪽 모이와산(능선 설산·로프웨이·밤에 빛나는 정상역), 가운데 뒤 오도리 눈축제(눈 성·얼음 조각·큰 눈사람·꼬마전구 나무), 뒤오른쪽 TV 타워(주황 격자 철탑·전시 시각 디지털 시계), 시계탑·아카렌가, 왕복하는 노면전차, 스케이트장(도는 스케이터), 라멘 야타이, 눈 등롱 길. 뚜껑 안에 눈이 내린다. 하루 주기·블룸·흔들기는 마리나와 같은 공용 셸. 온천을 누르면 파문. 점검: `?focus=onsen|clock|tower|odori|akarenga|mountain|tram|rink|yatai`. 목표 그림·목업은 `.visual-check/sapporo/`, 목표·결과는 `scripts/visual-check/SAPPORO.md`.
- `/jeonju` 전주(전시 04): 가을 젤리 블록. 앞왼쪽 전주천(둑 돌·억새·징검다리, 밤엔 유등이 흐른다) 위 남천교·청연루와 바위 위 한벽당, 뒤왼쪽 오목대 언덕(정자) + 자만 벽화마을, 가운데 경기전(담장·홍살문·정전·대숲)과 풍남문(홍예문·2층 문루·옹성), 뒤오른쪽 전동성당(벽돌·돔 종탑 3), 앞오른쪽 남부시장(아치 지붕·간판·옥상 청년몰) + 야시장 노점, 영화의 거리 극장, 합죽선 조형물, 한옥 2채(사용자 요청으로 2채만), 청사초롱 길, 은행·단풍·감나무, 떨어지는 은행잎, 밤엔 보름달. 점검: `?focus=market|jaman|gyeonggi|gate|cathedral|bridge|hanbyeok|cinema`. 목표·결과 `scripts/visual-check/JEONJU.md`.
- `/paris` 파리(전시 05): 봄 젤리 블록. 앞쪽을 굽이치는 센강(돌 난간, 시테섬에서 두 갈래로 넓어짐) 위 시테섬 노트르담(두 탑·장미창·첨탑·플라잉 버트레스)·퐁뇌프·알렉상드르 3세교(철제 아치 옆판·금빛 기둥), 센강을 오가는 바토무슈 두 척, 강둑 부키니스트, 뒤왼쪽 에펠탑(격자 알파 면·아치·전망대 3층, 밤엔 황금빛 + 반짝임) + 샹드마르스 + 회전목마(돈다), 뒤가운데 몽마르트르 언덕 사크레쾨르, 물랭루주(풍차가 돈다), 가운데 루브르(ㄷ자 궁전·유리 피라미드·삼각 분수), 콩코르드 오벨리스크·분수, 뒤오른쪽 개선문 + 에투알 + 샹젤리제 가로수, 오스만 건물 2채(한 양식으로 채우지 않는다) + 센강 쪽 카페 테라스, 기마르 메트로·모리스 기둥·월리스 분수, 벚꽃·마로니에·플라타너스, 흩날리는 벚꽃잎, 밤엔 초승달. 센강을 누르면 파문. 점검: `?focus=eiffel|sacrecoeur|louvre|notredame|arc|moulin|cafe|bridge`. 목표 그림·목업은 `.visual-check/paris/`, 목표·결과 `scripts/visual-check/PARIS.md`.
- `/` 메인(전시 목록): 전시를 한 곳씩 넘겨 보는 화면(`components/home/`). 장면을 실시간으로 그리지 않고 미리 찍은 낮·밤 사진(`public/posters/<slug>-day|night.webp`, 배경 투명)만 쓴다 — three.js 를 싣지 않는다. 가운데 큰 블록 + 양옆에 이웃이 살짝, 아래에 번호·이름·한 줄 설명·이름 줄. 넘기기: 끌기/스와이프 · ←/→ 키 · 휠 · 옆 블록이나 이름 누르기. 사진은 라군 시각(`lib/lagoonClock.ts`)에 맞춰 낮·밤이 섞이고, 가운데 블록에 마우스를 올리면 떠오르며 젤리처럼 출렁이고 반대 시간대를 엿본다. 누르면 블록이 화면 가득 커지며 전시로 들어간다 — 전시 로딩 배경(`PosterBackdrop`)이 같은 자리·같은 크기의 사진이라 실제 장면으로 그대로 이어진다. 전시 안에서는 위쪽 오른쪽 `All places` 배지로 돌아오고, 마지막으로 본 전시에서 다시 시작한다. **새 전시 = 라우트 하나 + `components/home/places.ts` 한 줄 + `pnpm posters [baseUrl] [slug…]`**(dev 서버가 떠 있어야 한다. 전시 모습을 고치면 다시 찍는다).
- `/lagoon` 라군(전시 01, 옛 `/sea` 는 쿼리째 `/lagoon` 으로 리다이렉트 — 아래 `/sea?…` 점검 파라미터는 그대로 쓴다): 몰디브 리조트 디오라마. 패널 없음(시계·사진·숨기기 모두 삭제). UI 문구는 모두 영어. 파비콘은 `app/icon.svg`(+ favicon.ico 16/32/48, apple-icon.png 180). 둥근 젤리 블록(17×13.6 — 레이아웃은 10×8 기준 × `lagoonHeight.S` 1.7) 위에 모래섬·야자수 8·수상 방갈로 8·데크·파라솔·선베드·보트. 수면은 화면공간 굴절(수면을 뺀 장면을 렌더타깃에 한 번 더 그려 법선대로 비틀어 샘플링)로 아래가 젤리처럼 비친다. 수면은 높이장 파동 시뮬레이션(`waterSim.ts`: 256×208 half-float 핑퐁 타깃, 90Hz 고정 스텝)으로 움직인다 — 누르면 손가락처럼 그 자리가 그릇으로 **파이고**(누르는 동안 유지, 떼면 되튀어 링이 퍼짐), 끌면 지나간 자리가 한 줄의 골로 파이며, 그냥 지나가도 얕게 파인다. 파는 벽에 반사·간섭해 수면 전체가 울렁이다 5초쯤에 잦아든다. 물 색·파도·감쇠·시점은 전부 기본값 고정이고(물 색은 `waterMaterials.WATER` 라군 청록 하나), 먹이 주기는 없앴다(상어도 먹이 추격 없이 자율 유영만). **블록 아래 지층·모래를 잡고 끌면 푸딩처럼 흔들린다**: 바닥이 손을 조금 따라가고 윗부분(물 포함)은 전단으로 크게 휘청이며 눌렸다 펴지고, 놓으면 2Hz 로 대여섯 번 출렁이다 ≈ 2.4초에 멈춘다(아무 조작 없이 60초가 지나면 무작위 방향으로 저절로 살짝 출렁인다 — 최대 전단 ≈ 0.034, `?wobble=초` 로 주기 변경·0 이면 끔)(전단 스프링 ζ 0.085, 최대 전단 0.26 = 윗면 변위 ≈ 1.1). 파도 물리는 무시한다 — 수면은 블록과 함께 움직일 뿐 쏠리거나 수평을 지키지 않는다. 다섯 마리는 항상 전부 바다에 있다(생김새는 `creature/species.ts` 의 `CREATURE_CONFIGS` 기본값). 크기는 실제 비율을 압축한 것(몸길이: 고래상어 ≈ 2.6 · 귀상어 ≈ 1.4 · 돌고래 ≈ 1.15 · 만타 폭 ≈ 1.85 · 거북 ≈ 0.8, 배율 0.56/0.42/0.33/0.5/0.26). 상어는 섬·방갈로 구역을 피해 열린 물에서 자율 유영한다. 만타는 중간 수심에서 넓은 호를 그리며 활공하고 가끔 수면을 스치며, 거북은 바닥 가까이 느리게 유영하다 25~40초마다 수면에 올라와 숨을 쉬고, 돌고래는 가장 빠르게 중상층을 돌다 18~30초마다 열린 물에서 수면 위로 뛰어오른다(파문). 고래상어는 가장 크고 느리게 넓은 호를 그리며 30~45초마다 수면 근처에서 천천히 여과 섭식한다(등지느러미 끝이 수면을 살짝 가른다). 다섯 마리는 서로·섬·얕은 물가·산호 군락을 피한다. **산호초**: 앞 모래톱·섬 앞 여울·왼쪽 앞 깊은 물 세 군락에 가지(사슴뿔)·뇌·손가락·테이블·부채·말미잘 산호가 깔려 있고(정점 색 1 드로우 + 부채 알파 격자 1 드로우), 말미잘 촉수와 부채는 느리게 흔들린다. 군락마다 **열대어**(흰동가리·블루탱·옐로탱·나비고기, 모두 10마리, 인스턴스 1 드로우)가 산호 위를 배회하다 가끔 질주하고, 큰 생물이 다가오면 산호 사이로 내려가 숨는다. `/sea?jump=초` 는 첫 점프 시각을 당기고 상태를 `window.__aquaDebug` 에 노출한다(점검용). `/sea?focus=sandbar|shore|deep` 은 산호 군락 근접 뷰(점검용). **하루 주기**: 실제 1시간 = 라군 24시간(벽시계 기준 — 매시 정각이 자정, 30분이 정오, 패널에 라군 시각 한 줄). 화면 배경(종이색)은 그대로 두고, 블록 위에 씌운 투명한 **젤리 큐브 뚜껑**(블록 바깥 벽을 그대로 위로 이은 돔) 안에서만 하늘이 바뀐다 — 낮 연하늘 → 노을 분홍·주황 → 밤 남색. 금빛 해와 위상 음영·크레이터·달무리가 있는 달이 돔 안 호를 따라 뜨고 지며, 밤엔 십자 광채 별빛 72개가 하나씩 켜져 반짝이고 낮엔 솜 구름이 흐른다. 물·모래·생물·열대어도 시간대 빛을 받고, 해 질 녘부터 방갈로 창·가로등·섬 횃불·야자수 꼬마전구가 켜지며 방갈로 아래 물이 수중등으로 청록빛을 낸다. `/sea?hour=H` 시각 고정 · `&daylen=초` 하루 길이 · `&sky=0` 돔 끄기(점검용). **손님 커플**: 작은 목각 인형 둘(밀짚모자·민트 수영복 / 코랄 반바지, 구슬 눈·볼터치)이 섬을 손잡고 산책하고, 선베드에 눕고, 해먹에서 쉬고, 선베드 앞 얕은 물에서 헤엄치고(파문), 피어 끝에 매어 둔 보트를 타고 열린 물을 한 바퀴 돌고(항적), 방갈로 테라스 데크체어에 앉고, 노을엔 피어 끝에 나란히 앉고, 밤엔 횃불 옆에 앉거나 방갈로 안으로 들어간다(창 불빛만). 활동은 라군 시각의 가중치로 고르고 같은 활동은 연속하지 않는다. `/sea?guest=<stroll|sunbed|hammock|swim|boat|bungalow|pier|torch>` 활동 고정 · `?guest=pose:<포즈>` 포즈 시트 · `?focus=guests` 근접 뷰(야자수 잎 숨김) — 모두 점검용. **해상 비행기**: 흰 동체에 청록 포인트(기수 카울·날개 끝·꼬리·플로트 줄)의 작은 고익 수상기가 블록 바깥 상공을 한 바퀴 돌다 오른쪽 사분원으로 들어와 앞바다(z ≈ 1.85 의 열린 물)에 착수하고(물보라), 활주하며 플로트 뒤로 항적을 남기다 이륙해 왼쪽 벽을 넘어 다시 상승한다 — 한 바퀴 ≈ 31초를 무한 반복. 경로는 닫힌 CatmullRom 스플라인(`seaplanePath.ts`, 조종점마다 속도·플레어/회전 피치 보정)이고 선회 때 요 각속도만큼 뱅킹한다. 프로펠러는 정점 셰이더로 돌고 밤엔 항법등(좌 빨강·우 초록·꼬리 흰색)이 켜진다. 물 위에 있을 땐 블록을 흔들면 수면과 같이 움직이고 공중에선 안 움직인다. 그림자는 블롭 1장(발자국 안 수면 / 밖 종이). `/sea?plane=off` 끄기 · `?plane=park` 활주로 정지 · `?plane=<초>` 경로 시작 위상 · `?focus=plane&view=q|top|side|front|back` 근접 뷰 — 점검용.

## Stack

Next 16 (App Router) · TypeScript · SCSS Modules + `classnames/bind` · three.js / @react-three/fiber

## 구조

```
src/
  app/                 페이지 (클라이언트 전용 dynamic import)
  components/creature/ 생물 공용: species(종 목록·고정 생김새 CREATURE_CONFIGS), registry(종 → 메시·Parts·솜 배율), PlushCreature(모든 종의 몸체 컴포넌트), sdf(SDF 도우미·지느러미·표면 팩토리),
                       creatureFormat/creatureMesh(바이너리 포맷·LOD 로더), PlushMaterial(벨벳 셰이더 — 종별 헤엄 변형·배 마스크 스니펫),
                       parts(부품 병합 + 구슬 눈/볼터치/케어 태그/콧구멍 헬퍼), debugProbe(점검용 URL 파라미터·window.__aquaDebug)
  components/shark/    sharkSdf(형태 정의·표면 앵커·SHARK_DEF), sharkManifest(자동 생성), SharkParts(눈/아가미/케어 태그/장식)
  components/manta/    mantaSdf(납작 몸통+날개+머리지느러미+꼬리·MANTA_DEF), mantaManifest(자동 생성), MantaParts(눈/볼터치/아가미/케어 태그)
  components/turtle/   turtleSdf(높은 돔 등딱지+챙 테두리+배딱지+큰 머리+노 지느러미 4+꼬리·TURTLE_DEF), turtleManifest(자동 생성), TurtleParts(눈/볼터치/콧구멍/케어 태그)
  components/dolphin/  dolphinSdf(멜론+부리+방추 몸통+등/가슴/꼬리지느러미·DOLPHIN_DEF), dolphinManifest(자동 생성), DolphinParts(눈/볼터치/숨구멍/케어 태그)
  components/whaleshark/ whalesharkSdf(납작 머리+네모 입+능선 3+지느러미·WHALESHARK_DEF), whalesharkManifest(자동 생성), WhaleSharkParts(눈/볼터치/아가미/케어 태그)
  components/sea/      물 셰이더(수면/옆면/모래/지층/빛줄기), waterSim(수면 높이장 파동 시뮬: 핑퐁 타깃·임펄스/누름·부피 보존·?simdebug 오버레이), 상어 AI(먹이 추격), LagoonSwimmer(공용 수조 생물: 조향·그림자) + swimBehaviours(종별 행동), 라군 UI
                       lagoonNav(수조 치수·활동 범위·금지 구역 판정/되밀기·얕은 바닥 판정·공용 조향 스텝 navStep·블롭 그림자),
                       tankGeometry(둥근 블록 지오메트리), lagoonHeight(섬 높이맵 — JS/GLSL 공용, 금지 구역(섬·산호 원·리조트), 산호 군락 자리 REEF_SITES, 맵 배율 S),
                       Reef(산호 6종 빌더 → 정점 색 1 메시 + 부채 알파 격자 메시, aSway 흔들림), ReefFish(열대어 10마리 — 인스턴스 1 드로우, 무늬·눈 프래그먼트, 꼬리 파동 정점 셰이더, 배회·질주·숨기 AI),
                       resortLayout(야자수·방갈로·데크 척추선·선베드·파라솔·덤불·횃불·해먹 배치 데이터 — 순수 .ts, 길찾기·Node 점검이 같이 읽음), Palms(야자수 인스턴스), Resort(방갈로·데크·소품 → 재질별 병합 + 밤 조명: 창·전구 발광 재질·횃불·꼬마전구·후광 점 스프라이트), Shadows(블롭·블록 가짜 그림자),
                       guestModel(손님 인형 지오메트리 — 정점 색 + 부위 속성 aPart, 부위 회전 정점 셰이더 재질, 포즈 → 행렬), guestPoses(걷기·앉기·눕기·수영·손 흔들기 프리셋·블렌드), guestNav(모래 격자 0.1 A* + 직선 당기기, 데크 척추선·다리 그래프, 장애물 원), guestBrain(커플 상태 기계: 활동 선택·걷기/손잡고 따라가기·자리 놓기·보트 조향·항적), Guests(렌더: 사람 2 메시 + 보트 1 + 발밑 블롭 인스턴스),
                       dayCycle(라군 시각·키프레임 13개 보간·해/달 호 — 하루 주기의 단일 진실), LagoonDay(라이트 3개·ENV 갱신 + 젤리 돔·해·달·별빛·구름), skyToys(돔·빛 구슬·별빛·구름 셰이더 재질)
                       seaplanePath(수상기 닫힌 스플라인 경로 — 조종점·속도·피치 보정·phase, Node 점검이 같이 읽음), seaplaneModel(수상기 정점 색 1 메시 — 회전체 동체·창 띠·aPart 프로펠러/항법등 재질), Seaplane(경로 추종·착수 물보라·항적·블록 따라가기·뱅킹·그림자)
  components/diorama/  디오라마 전시 공용 셸: kit(낮/밤 재질 보간 Kit·sweep 관·strut·canvasTex·bakeStatic 재질별 병합), ripples(수면 파문 셰이더 주입),
                       DioramaScene(DioramaSpec 하나로 카메라·조명 낮/밤 보간·하루 주기·밤 블룸·흔들기·물 파문 히트·?focus=, 블록에 맞춘 그림자 틀 + 30Hz 그림자 갱신), post(BloomPost — MSAA HDR 장면 타깃 → 번짐 → 합성·톤매핑 한 패스), fx(place·makePuffs 김 입자·trimShadows)
  components/three/quality  렌더 예산(Quality): 해상도 배율을 기기 배율(최대 2)까지, 픽셀 예산·프레임 예산을 넘으면 자동으로 낮춘다 (`?dpr=` 고정, `&debug` → `__aquaDebug.quality`)
  components/marina/   마리나베이 전시: layout(블록·만 윤곽·랜드마크 자리 — 순수 데이터),
                       ground(블록·만·둑·난간·가로등·불빛 반사·레인트리·범보트), sands, lotus, flyer, helix, esplanade, merlion(+풀러턴), gardens, sky(뚜껑·하늘·별·달·구름),
                       MarinaScene(DioramaSpec — 자리·조명·블룸·물), MarinaPage
  components/sapporo/  삿포로 전시: layout(블록·탕 윤곽·inPool·자리 — 순수 데이터), parts(눈 재질·눈판·박공·바닥 빛·단색 재질 캐시·김 입자 makePuffs·trimShadows),
                       onsen(블록·지층·처마·고드름·온천·바위·김·료칸·소품), mountain, landmarks(TV 타워·오도리·시계탑·아카렌가), street(등롱 길·전차·스케이트장·야타이·나무·가로등·빛 웅덩이),
                       sky(뚜껑·내리는 눈·구름), SapporoScene(DioramaSpec), SapporoPage
  components/jeonju/   전주 전시: layout(물길 윤곽·inStream·자리), parts(재질 + 기와지붕 giwa·hanok·청사초롱·나무·장독대·돌담, 정점색 tint·아틀라스 atlasUV),
                       ground(블록·전주천·유등 인스턴스), landmarks(남천교·한벽당·오목대/자만·풍남문·전동성당·경기전), town(길·한옥 2·남부시장·야시장·극장·합죽선·초롱·빛 웅덩이),
                       sky(뚜껑·보름달·별·구름·은행잎), JeonjuScene(DioramaSpec), JeonjuPage
  components/paris/    파리 전시: layout(센강 윤곽·inSeine·시테섬·riverFrame·자리), parts(재질 + 오스만 facade·mansard·나무·가로등, 정점색 tint, acrossRiver/alongRiver),
                       ground(블록·센강·섬·난간·큰길·바토무슈 인스턴스), landmarks(에펠·회전목마·사크레쾨르·물랭루주·루브르·콩코르드·개선문·노트르담·다리), town(오스만 2·카페·가로수·거리 소품·빛 웅덩이),
                       sky(뚜껑·초승달·별·구름·벚꽃잎), ParisScene(DioramaSpec), ParisPage
  components/three/    sceneEnv(자체 조명 셰이더 공용 유니폼 ENV — 환경광·주광·하늘색·조명 켜짐, 수조를 떠나면 resetEnv), precompile(셰이더 워밍업: Canvas 를 frameloop="never" 로 열고 물체 하나씩 비동기 컴파일한 뒤 루프를 켠다. 렌더타깃 변형은 ExtraTargets 컨텍스트)
  components/ui/       공용 프레임(캔버스 슬롯·위쪽 안내·로딩) 컴포넌트
scripts/bake-creature.mts <shark|manta|turtle|dolphin|whaleshark>  SDF → marching cubes → meshoptimizer 단순화 → LOD 3개 베이크 (ts-alias.mjs 가 @/ 별칭을 풀어준다)
public/{shark,manta,turtle,dolphin,whaleshark}-{hi,mid,lo}.{hash}.bin(.gz)  베이크된 메시 (hi 30k / mid 12k / lo 4k tris, 16비트 양자화, gzip 본 포함)
scripts/visual-check/  렌더 점검(check: fps·draw·tris·GPU 시간·long task·힙), 단일 캡처(shot), 조건부 캡처(probe),
                       조작 흐름(flow: 패널 없음 확인→클릭/드래그/블록 흔들기), 로딩 프로파일(profile: 긴 작업별 원인 함수),
                       블록 흔들기 수치 점검(jelly: 지층을 잡고 끈 뒤 전단·스쿼시를 50ms 샘플링), 열대어 소크(fishsoak: 군락 반경 이탈·정지·숨기 샘플), 산호 군락 확대 크롭(zoom.py),
                       목표/결과(OPT.md, RESORT.md, MANTA.md, TURTLE.md, DOLPHIN.md, WHALESHARK.md, QUALITY.md, REMODEL.md — 거북 재모델·크기 비례·입 제거/플러시 디테일, WAVESIM.md — 수면 파임 시뮬, JELLY.md — 블록 젤리 흔들림, REEF.md — 산호초·열대어, DAYNIGHT.md — 하루 주기·젤리 돔·밤 조명, GUESTS.md — 손님 커플, SEAPLANE.md — 해상 비행기), 손님 소크(guestsoak.mjs), 수상기 소크(planesoak.mjs)·경로 점검(planecheck.mts), 하루 주기 시트(daysheet.py: ?hour= 여러 장 + 휘도), 시각 진행·반짝임(daytick.mjs)
```

## 렌더링 메모

- 수조 수면은 프레임마다 장면을 두 번 그린다(굴절 텍스처 0.75배 해상도 + 본 렌더). draws·tris 계측값은 두 패스 합이다. 수면 높이장 시뮬(`waterSim.ts`)은 프레임당 1~2 스텝(90Hz 고정)을 256×208 쿼드로 더 그린다(+1~2 draws, GPU 비용 무시 가능). 입력(임펄스·누름·생물 물보라)이 끊긴 지 8초가 지나면 잠들어 스텝을 돌리지 않는다. 임펄스는 큐(사건), 누름은 `uPress` 상태(매 스텝 적용)로 들어간다. 포인터 레이캐스트는 수면 메시(36k tri) 대신 보이지 않는 2-tri 히트 평면과 지층 히트 박스가 받는다(모래·섬은 그대로). 수심(`vDepth`)은 정점에서 재고 보간한다. 수면 정점 셰이더는 높이 텍스처 5탭으로 높이·법선을 얻는다(법선 기울기 1.8배 과장). 임펄스는 부피 중립(멕시칸햇)이고, 누름은 목표 깊이로 끌어내리는 제약이며, 밉맵 1×1 평균으로 수위를 0 에 묶는다 — 안 그러면 누르는 동안 수조 전체 수위가 내려간다. `/sea?simdebug=1` 은 높이 텍스처를 왼쪽 위에 띄우고, `?calm=` 은 감쇠 초기값, `?shear=x,z` 는 블록 정적 전단(점검용). 블록은 그룹 하나에 행렬을 합성해 넣는다(바닥 변위 · BLOCK_MID 피벗 기울기 · 바닥 피벗 스쿼시·전단, `Matrix4.makeShear`)이고 조명·디버그 오버레이는 바깥에 있다. 흔들기 입력은 지층 히트 박스·모래 메시의 pointerdown 에서 `setPointerCapture` 로 잡아 메시 밖에서도 move/up 을 받는다(빠르게 흔들면 포인터가 메시를 벗어난다). 수면 끌기는 캡처하지 않는다(캡처되면 `e.point` 가 고정된다).
- 생물 메시는 런타임에 만들지 않는다. SDF 정의(`*Sdf.ts`)나 LOD 목표를 바꿨으면 `pnpm bake:shark` / `bake:manta` / `bake:turtle` / `bake:dolphin` / `bake:whaleshark` 로 다시 굽는다 (파일명 해시·매니페스트가 같이 갱신된다).
- 수조는 mid LOD 를 그린다 (hi·lo 는 베이크만 해 둔다).
- 생물은 단일 패스 불투명 머티리얼 하나로 그린다 (셸 퍼 없음). 헤엄 변형은 종별 정점 셰이더 스니펫(상어: 꼬리 좌우, 만타: 날개 펄럭임, 거북: 앞지느러미 노젓기, 돌고래: 꼬리 상하 파동, 고래상어: 느린 좌우 S 자 — 전단 변형 법선 보정). 고래상어 별무늬는 삼면 투영 격자 셀마다 어긋난 점 + 가는 선.. 거북 등딱지의 육각 갑판 솔기는 프래그먼트에서 육각 타일 거리로 그린다. 모든 종에 등 가운데 점선 솔기(|z| < 0.03, 위를 향한 몸 면)와 배 색 경계의 점선 솔기를 셰이더로 그린다. 수조 수치는 REMODEL.md 결과표 참고.
- 눈·볼터치·아가미·케어 태그(꼬리 쪽 솔기에 눕힌 천 라벨 + 붉은 줄)·장식은 SDF 표면에 투영해 붙이므로 솜(stuffing) 스케일과 함께 움직인다. 그룹마다 정점 색으로 합쳐 1 드로우.
- 수조의 바위·수초는 InstancedMesh, 빛줄기는 정점 속성(aSeed)으로 위상을 나눈 1 메시. 산호는 종류별 프로시저럴 지오메트리를 정점 색으로 칠해 하나로 합친다(Icosahedron 은 인덱스가 없어 전부 `toNonIndexed` 뒤 병합). 부채 산호의 격자는 캔버스 텍스처인데, 투명 배경 `map` 으로 쓰면 투명 픽셀의 검정 RGB 가 밉맵에서 선에 번져 멀리서 검게 보이므로 검정 배경 흰 선을 `alphaMap` 으로만 쓴다. 말미잘 촉수·부채의 흔들림은 `aSway` 정점 속성 × `onBeforeCompile` 사인 변위. 열대어는 ShaderMaterial InstancedMesh 하나(인스턴스 속성 aKind·aTail·aWag) — 종 무늬와 구슬 눈을 로컬 좌표로 프래그먼트에서 그린다. 물속 물체는 수면의 색유리 곱으로 붉은 계열 채도가 크게 깎이니 팔레트를 한 단계 진하고 밝게 잡는다.
- 하루 주기: 자체 조명 셰이더는 `sceneEnv.ENV` 유니폼 객체를 공유한다(물이 더하는 산란 빛에만 환경광을 곱한다 — 굴절로 비치는 아래 장면은 이미 시간대 빛을 받았다). 라이트 개수는 고정하고 색·세기만 바꾼다(개수가 바뀌면 전 재질 재컴파일). 젤리 돔·해·달·별빛은 레이어 1 이라 굴절 패스에서 빠진다. 사전 곱 알파 셰이더는 색을 먼저 `linearToOutputTexel` 로 바꾼 뒤 알파를 곱한다(거꾸로 하면 옅은 알파가 감마로 하얗게 들뜬다).
- 조향 안전망(`lagoonNav.navStep`): 금지 원(+여유)이 벽과 겹치는 교점에선 `pushAway` 가 벽 쪽으로 밀어 조향이 프레임마다 뒤집히며 제자리에 선다 → 벽 근처에선 벽 쪽 성분을 빼고, 1.5초 제자리면 가장 가까운 금지 원에서 멀어지는 쪽(벽 따라)을 목표로 잡아 `escape`(1.5 + π/maxTurn 초) 동안 재목표를 쉰다. 갇힘은 `pnpm check:navsim` 에 자리를 넣어 재현한다.
- 산호 군락은 금지 구역 원(`NO_GO.reefs`)이지만 **clearance < 1 인 종(상어·거북·돌고래)만** 보고 margin 도 0.6 으로 깎는다 — 고래상어·만타는 얕은 바닥 판정으로 어차피 산호 위에 못 오고, 그 큰 margin(1.2)을 산호 원에 더하면 벽·리조트 띠와 겹쳐 빠져나올 수 없는 주머니가 생긴다(navsim 으로 잡음).
- 셰이더는 첫 프레임 전에 `components/three/precompile.tsx` 가 물체 하나씩 비동기로 컴파일한다 (동기 컴파일로 생기던 130~150ms 긴 작업 제거). 생물 메시는 받은 뒤 임시 메시로 먼저 컴파일하고 화면에 올린다.
- 세로(모바일) 화면: 수조 카메라는 블록 대각선이 화면 폭의 ≈80% 가 되게 물러난다(far 220).

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
pnpm check:flow <라벨> [baseUrl]      # 조작 흐름 점검 (실패하면 종료 코드 1). VW=390 VH=844 로 모바일
URL=/sea pnpm check:profile [baseUrl]  # 로딩 긴 작업별 원인 함수 (CDP 프로파일)
SECS=120 pnpm check:soak [baseUrl]     # 수조 소크: 생물이 갇히거나 범위를 벗어나는지 (문제 있으면 exit 1)
pnpm check:navsim                      # navStep 단독 시뮬레이션 (갇힌 상태에서 탈출하는지, 브라우저 없이)
pnpm check:guestnav                    # 손님 길찾기 단독 점검 (모래 경로 200쌍·데크/방갈로 경로, 브라우저 없이)
pnpm check:plane                       # 수상기 경로 단독 점검 (물 위 구간 금지 구역·야자수/방갈로 간섭·한 바퀴 시간·최대 요 각속도, 브라우저 없이)
pnpm check:all <라벨> [baseUrl]         # 회귀 게이트: tsc·lint·렌더·흐름(데스크톱/세로)·소크 한 번에 (SKIP=soak-sea SOAK=60)
COND='window.__aquaDebug?.dolphin.phase==="air"' URL=/sea?jump=4 node scripts/visual-check/probe.mjs out.png   # 페이지 안 조건이 참이 되는 순간 캡처 (EXPR 로 상태 출력)
node scripts/visual-check/jelly.mjs           # 블록 흔들기: 놓은 뒤 전단·바닥 변위·스쿼시 샘플 (DRAG=…, MS=ms)
SECS=60 URL='/sea?guest=stroll' node scripts/visual-check/guestsoak.mjs   # 손님 소크: 물 위 걷기·장애물 침범·손잡기 간격·활동 등장 (문제 있으면 exit 1, OUT= 로 샘플 저장)
SECS=60 node scripts/visual-check/planesoak.mjs   # 수상기 소크: phase 순서·한 바퀴 시간·자세 튐·물 위 고도 (문제 있으면 exit 1, OUT= 로 샘플 저장)
SECS=30 node scripts/visual-check/fishsoak.mjs # 열대어 소크: 군락 반경 이탈·정지·숨기/질주 샘플 (문제 있으면 exit 1)
python3 scripts/visual-check/zoom.py in2x.png out.png [sandbar shore deep]   # DPR 2 전체 캡처에서 산호 군락만 잘라 한 시트로
python3 scripts/visual-check/daysheet.py .visual-check/out [0,6.5,12,18.5]     # 하루 주기 시트: 시각마다 캡처 + 블록 휘도·배경 픽셀 (VW/VH 로 모바일)
python3 scripts/visual-check/daymockup.py .visual-check/out                      # 위 캡처(데스크톱 6 + mobile/ 3)를 폰 프레임과 함께 한 장 목업으로
node scripts/visual-check/daytick.mjs .visual-check/out   # 라군 시각이 실제 150초에 1시간 흐르는지 + 정오·자정 0.5초 차 두 장
```
