"""DPR 2 캡처에서 산호 군락 3곳을 잘라 한 시트로. usage: python3 zoom.py <in2x.png> <out.png> [sandbar|shore|deep ...]"""
import sys
from PIL import Image
CROPS = {
    "sandbar": (1250, 1100, 1750, 1400),
    "shore": (1080, 740, 1480, 1000),
    "deep": (560, 840, 920, 1100),
}
src, out = sys.argv[1], sys.argv[2]
names = sys.argv[3:] or list(CROPS)
im = Image.open(src)
tiles = [im.crop(CROPS[n]).resize((CROPS[n][2] - CROPS[n][0]) * 2 // 1 and ((CROPS[n][2] - CROPS[n][0]) * 2, (CROPS[n][3] - CROPS[n][1]) * 2), Image.LANCZOS) for n in names]
W = sum(t.width for t in tiles) + 10 * (len(tiles) - 1)
H = max(t.height for t in tiles)
sheet = Image.new("RGB", (W, H), "white")
x = 0
for t in tiles:
    sheet.paste(t, (x, 0))
    x += t.width + 10
sheet.save(out)
print(out, sheet.size)
