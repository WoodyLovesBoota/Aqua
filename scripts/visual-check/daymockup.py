"""하루 주기 목업: daysheet.py 가 만든 시각별 캡처(데스크톱 6 + mobile/ 3)를 폰 프레임과 함께 한 장으로.
python3 scripts/visual-check/daymockup.py .visual-check/<폴더>  → mockup.png · mockup-small.png
"""
import sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]
BG = (241, 238, 232)
def font(sz):
    for f in ["/System/Library/Fonts/AppleSDGothicNeo.ttc", "/System/Library/Fonts/Helvetica.ttc"]:
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()
F1, F2, F3 = font(44), font(26), font(22)
desk = [("0", "00:00", "밤"), ("6.5", "06:30", "아침"), ("12", "12:00", "낮"), ("17.5", "17:30", "노을 직전"), ("18.5", "18:30", "노을"), ("21", "21:00", "밤 조명")]
mob = [("0", "00:00 밤"), ("12", "12:00 낮"), ("18.5", "18:30 노을")]
TW, TH = 960, 600
W = 60 + 3 * (TW + 40) + 20
mh = 820
H = 170 + 2 * (TH + 90) + 90 + mh + 60
S = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(S)
d.text((60, 50), "Aqua · 라군의 하루 (실제 1시간 = 24시간) — 젤리 큐브 뚜껑 목업", font=F1, fill=(29, 27, 24))
d.text((60, 110), "데스크톱 1440×900 · ?hour= 고정 캡처", font=F3, fill=(92, 87, 79))
def card(im, x, y, w, h, r=18):
    im = im.resize((w, h))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    sh = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 16, w + 12, h + 14), r, fill=(0, 0, 0, 38))
    S.paste(sh, (x - 12, y - 12), sh)
    S.paste(im, (x, y), m)
for k, (h, t, p) in enumerate(desk):
    x = 60 + (k % 3) * (TW + 40)
    y = 170 + (k // 3) * (TH + 90)
    card(Image.open(f"{D}/h{h}.png").convert("RGB"), x, y, TW, TH)
    d.text((x + 4, y + TH + 18), t, font=F2, fill=(29, 27, 24))
    d.text((x + 110, y + TH + 21), p, font=F3, fill=(92, 87, 79))
y0 = 170 + 2 * (TH + 90) + 40
d.text((60, y0), "모바일 390×844", font=F3, fill=(92, 87, 79))
pw, ph = 330, 714
for k, (h, t) in enumerate(mob):
    x = 60 + k * (pw + 80)
    y = y0 + 50
    d.rounded_rectangle((x - 14, y - 14, x + pw + 14, y + ph + 14), 48, fill=(29, 27, 24))
    card(Image.open(f"{D}/mobile/h{h}.png").convert("RGB"), x, y, pw, ph, 36)
    d.text((x, y + ph + 30), t, font=F2, fill=(29, 27, 24))
S.save(f"{D}/mockup.png")
S.resize((W // 2, H // 2)).save(f"{D}/mockup-small.png")
print(S.size)
