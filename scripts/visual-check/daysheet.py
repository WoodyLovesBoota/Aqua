"""하루 주기 시트: 여러 시각(?hour=)을 찍어 한 장으로 합치고 밝기·하늘색을 잰다.

python3 scripts/visual-check/daysheet.py <출력 폴더> [시각,시각,…]   (기본 0,3,5.5,6.5,9,12,15,17.5,18.5,19.5,22)
환경변수: VW/VH(뷰포트, 기본 1440×900) · J(동시 캡처 수, 기본 4) · EXTRA(URL 에 덧붙일 쿼리) · SKIP=1(캡처 생략, 측정만)
출력: <폴더>/h<시각>.png, sheet.png, stats.txt (블록 영역 평균 휘도 · 정오 대비 · 하늘 위/아래 색)
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageStat

out = sys.argv[1]
hours = [float(h) for h in (sys.argv[2].split(",") if len(sys.argv) > 2 else "0,3,5.5,6.5,9,12,15,17.5,18.5,19.5,22".split(","))]
os.makedirs(out, exist_ok=True)
VW, VH = int(os.environ.get("VW", 1440)), int(os.environ.get("VH", 900))
extra = os.environ.get("EXTRA", "")


def shot(h):
    path = f"{out}/h{h:g}.png"
    env = dict(os.environ, URL=f"/sea?hour={h:g}{extra}", DPR="1", WAIT=os.environ.get("WAIT", "4500"), VW=str(VW), VH=str(VH))
    subprocess.run(["node", "scripts/visual-check/shot.mjs", path], env=env, check=False, timeout=120)
    return path


if not os.environ.get("SKIP"):
    with ThreadPoolExecutor(int(os.environ.get("J", 4))) as ex:
        list(ex.map(shot, hours))

# 블록 영역(데스크톱 기준선 캡처의 물·섬 부분)과 하늘 표본 자리
mobile = VW < VH
block = (60, 260, 330, 560) if mobile else (300, 160, 1100, 820)
sky_top = (20, 120) if mobile else (40, 40)
sky_bot = (20, 700) if mobile else (40, 760)

lines = []
lum = {}
for h in hours:
    im = Image.open(f"{out}/h{h:g}.png").convert("RGB")
    lum[h] = ImageStat.Stat(im.crop(block).convert("L")).mean[0]
noon = lum.get(12.0) or max(lum.values())
for h in hours:
    im = Image.open(f"{out}/h{h:g}.png").convert("RGB")
    lines.append(f"{h:5g}h  luma {lum[h]:6.1f}  ({lum[h] / noon * 100:5.1f}% of noon)  skyTop {im.getpixel(sky_top)}  skyBot {im.getpixel(sky_bot)}")
open(f"{out}/stats.txt", "w").write("\n".join(lines) + "\n")
print("\n".join(lines))

# 시트: 4열, 칸마다 시각 라벨
cols = 4
tw = 480 if not mobile else 195
ims = []
for h in hours:
    im = Image.open(f"{out}/h{h:g}.png").convert("RGB")
    im = im.resize((tw, int(im.height * tw / im.width)))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 70, 22), fill=(0, 0, 0))
    d.text((6, 5), f"{h:g}h", fill=(255, 255, 255))
    ims.append(im)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * ims[0].height), "white")
for k, im in enumerate(ims):
    sheet.paste(im, ((k % cols) * tw, (k // cols) * im.height))
sheet.save(f"{out}/sheet.png")
