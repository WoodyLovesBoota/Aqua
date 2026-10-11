# 캡처·계측 치트시트 (`next dev` 가 3000 에 떠 있어야 한다)

뷰포트는 모든 스크립트에서 `VW=390 VH=844` 로 바꿀 수 있다 (세로 화면 결함은 데스크톱 캡처로는 안 보인다).
조작 흐름은 `pnpm check:flow <라벨>`, 로딩 긴 작업 원인은 `URL=/sea pnpm check:profile` 로 본다. 계측(check:render)은 다른 캡처와 **동시에 돌리지 않는다**(GPU 시간이 두 배로 나온다).

```bash
# 한 장 캡처 (기본 /sea). 환경변수로 조절:
URL="/?pose=1&species=manta&still=1&view=top" DPR=2 WAIT=3500 \
STORE='{"species":"manta","creatures":{"manta":{"name":"M","furColor":"#35405a","bellyColor":"#e6ebf3"}}}' \
  node scripts/visual-check/shot.mjs .visual-check/stepX/top.png
#   URL: 경로+쿼리 / STORE: localStorage 상태(species·creatures.<종>) 주입 / DPR: 배율 / WAIT: ms
#   CLICK=x,y AFTER=ms / DRAG=x1,y1,x2,y2[,x3,y3…](지그재그) / HOLD=x,y,ms(누른 채) / HOVER=x1,y1,x2,y2(누르지 않고) : 수조 조작 뒤 캡처
#   블록 흔들기: DRAG 시작점을 지층 앞면(데스크톱 620,750 / 모바일 150,470)에 두면 잡기. `?shear=x,z` 는 정적 전단(푸딩 변형). 되튐은 `node scripts/visual-check/jelly.mjs` 로 수치 샘플
#   수면 시뮬 점검: URL="/sea?simdebug=1" 로 높이 텍스처 오버레이(왼쪽 위, 회색 0·파랑 −·흰 +)를 찍고 PIL 로 (28,50)-(518,352) 를 잘라 128 기준 편차를 잰다. `&calm=` 은 감쇠 초기값

# 스튜디오 쿼리: pose=1(고정 포즈) still=1(헤엄 정지) view=top|side|front|back|below lod=mid|lo species=manta|hammerhead

# 렌더 계측 (fps·worst·draws·tris·GPU ms·long task·힙·콘솔) → .visual-check/step<라벨>/metrics.json
ROUTES=/sea pnpm check:render <라벨>
STORE='{"species":"manta"}' ROUTES=/ pnpm check:render <라벨>s
#   DPR=2 / DRIFT=30 (힙 드리프트 초) / 프로덕션은 pnpm build && pnpm start -p 3001 뒤 baseUrl 인자, 끝나면 포트로만 kill

# 커스터마이징 매트릭스 (상어 9 + 종별 4 → sheet.png)
pnpm check:matrix <라벨>

# 조건부 캡처: 페이지 안 식이 참이 되는 순간 찍고 EXPR 결과를 출력 (행동 검증용)
COND='window.__aquaDebug?.dolphin.phase==="air"' URL="/sea?jump=4" AFTER=250 DPR=2 \
EXPR='JSON.stringify(window.__aquaDebug)' TIMEOUT=45000 node scripts/visual-check/probe.mjs out.png
```

여러 장을 한 시트로 (PIL):
```python
from PIL import Image
names=['q','top','side','front']
ims=[Image.open('.visual-check/stepX/%s.png'%v).crop((300,120,1100,780)) for v in names]
sheet=Image.new('RGB',(ims[0].width*2,ims[0].height*2),'white')
for k,i in enumerate(ims): sheet.paste(i,((k%2)*i.width,(k//2)*i.height))
sheet.save('.visual-check/stepX/sheet.png')
```
픽셀 차이(움직임 확인):
```python
from PIL import Image, ImageChops
A=Image.open(a).convert('RGB'); B=Image.open(b).convert('RGB')
print(ImageChops.difference(A,B).convert('L').point(lambda v:255 if v>20 else 0).getbbox())
```
병렬 캡처는 `for ...; do ... & done; wait` 로. 멈춘 shot.mjs 는 `ps -eo pid,etime,command | grep shot.mjs` 로 PID 만 kill.
