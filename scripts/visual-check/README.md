# visual-check — 실제 렌더링 캡처·계측·검증 루프

`next dev` 가 3000 포트에 떠 있는 상태에서 실행한다. 설치된 Chrome(채널 `chrome`)을 헤드리스로 띄워 실제 GPU로 그린다.
모든 스크립트는 `VW=390 VH=844`(뷰포트) `DPR=2` 환경변수를 받는다 — **세로 화면은 반드시 따로 본다**(데스크톱 캡처로는 안 보이는 결함이 있다).

```bash
pnpm check:all <라벨> [baseUrl]   # 회귀 게이트: tsc → lint → 렌더 → 흐름(데스크톱·세로) → 소크(수조·스튜디오) → 매트릭스. SKIP=matrix,soak-sea / SOAK=초
pnpm check:render <라벨> [baseUrl] # /, /sea 캡처 + fps·draw call·삼각형·GPU ms·long task·콘솔 에러 → .visual-check/step<라벨>/ (ROUTES=/sea, DRIFT=초)
pnpm check:matrix <라벨>          # 커스터마이징 25케이스 스튜디오 캡처 → .visual-check/step<라벨>/matrix/sheet.png
pnpm check:flow <라벨> [baseUrl]  # 스튜디오→수조 조작 흐름(종 전환·이름·색·클릭 파임·드래그·블록 흔들기·물 색·복귀) 캡처 + 상태 검증, 실패 시 exit 1
SECS=120 URL=/sea pnpm check:soak # 소크: 생물이 갇히거나 범위를 벗어나는지, fps 저하 (URL=/ 이면 스튜디오). `?debug` 의 __aquaDebug.<이름>Nav 사용
pnpm check:navsim                 # navStep 단독 시뮬레이션 (갇혔던 상태에서 탈출하는지, 브라우저 없이)
URL=/sea pnpm check:profile       # 로딩 긴 작업(longtask)마다 원인 함수 집계 (CDP 프로파일)
pnpm check:shot <out.png>         # 한 장 캡처 (URL=, STORE=, WAIT=ms, CLICK=x,y / DRAG=x1,y1,x2,y2 + AFTER=ms)
COND='…' URL=/sea?jump=4 node scripts/visual-check/probe.mjs out.png   # 페이지 안 조건이 참이 되는 순간 캡처 (EXPR 로 상태 출력)
```

주의: 계측(check:render)은 다른 캡처와 **동시에 돌리지 않는다**(GPU 시간이 두 배로 나온다). GPU 시간이 갑자기 부풀면 `ps -Ao pcpu,comm | sort -nr | head` 로
다른 GPU 사용 프로세스(macOS 동적 배경화면 등)를 먼저 확인한다. 프로덕션 수치는 `pnpm build && pnpm start -p 3001` 뒤 baseUrl 로 넘기고, 끝나면 포트로만 죽인다.

각 단계가 끝날 때마다 `IDEAL.md` 체크리스트(A 인형 형태 / B 커스터마이징 / C 렉 없음 / D 수조 / E 코드)와 비교한다. 발견·조치 기록은 `QUALITY.md`.
