import os, json
from PIL import Image, ImageDraw

ROOT = r"D:\codex\dsp-qianxia"
DATA = os.path.join(ROOT, "data", "gallery.js")
OUT = os.path.join(ROOT, "tools", "sheets3")
os.makedirs(OUT, exist_ok=True)

raw = open(DATA, encoding="utf-8").read()
payload = json.loads(raw[raw.index("{"): raw.rindex(";")])
items = payload["items"]
print("items", len(items))

cols, cell, per = 8, 232, 48
rows = (per + cols - 1) // cols
for si in range(0, len(items), per):
    batch = items[si:si + per]
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    for i, it in enumerate(batch):
        r, c = divmod(i, cols)
        try:
            im = Image.open(os.path.join(ROOT, it["thumb"])).convert("RGB")
            im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
            x = c * cell + (cell - im.width) // 2
            y = r * (cell + 18) + (cell - im.height) // 2
            sheet.paste(im, (x, y))
        except Exception as e:
            print("err", it["id"], e)
        d.text((c * cell + 4, r * (cell + 18) + cell + 2), it["id"], fill=(200, 200, 210))
    name = os.path.join(OUT, f"final{si // per + 1}.jpg")
    sheet.save(name, "JPEG", quality=88)
    print("saved", name)
