"""Helper — contact sheets for eyeballing the gallery. Usage: sheet.py OUTDIR [cols] [cell] [KEY-prefix ...]"""
import os, sys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4; cell = int(sys.argv[3]) if len(sys.argv) > 3 else 300
want = sys.argv[4:]
img = os.path.join(ROOT, "public/img")
import re
def key(f):
    m = re.match(r"([A-Za-z]+)(\d*)-(\d+)", f); return (m[1], int(m[2] or 0), int(m[3]))
files = sorted((f for f in os.listdir(img) if not want or f.rsplit("-", 1)[0] in want), key=key)
per = cols * 3
os.makedirs(out, exist_ok=True)
for s in range(0, len(files), per):
    sheet = Image.new("RGB", (cols * cell, 3 * (cell + 16)), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files[s:s + per]):
        im = Image.open(os.path.join(img, f)); im.thumbnail((cell - 4, cell - 4))
        x, y = (i % cols) * cell, (i // cols) * (cell + 16)
        sheet.paste(im, (x + (cell - im.width) // 2, y + 16 + (cell - im.height) // 2))
        d.text((x + 4, y + 2), f, fill=(255, 255, 0))
    sheet.save(os.path.join(out, f"sheet-{s // per:02d}.jpg"), quality=80)
    print(os.path.join(out, f"sheet-{s // per:02d}.jpg"), files[s], "…", files[min(s + per, len(files)) - 1])
