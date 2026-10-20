import os
from PIL import Image, ImageDraw

ROOT = r"D:\codex\dsp-qianxia"
INC = os.path.join(ROOT, "assets", "incoming3")
OUT = os.path.join(ROOT, "tools", "sheets4")
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(INC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
print("files", len(files))

cols, cell, per = 8, 232, 48
rows = (per + cols - 1) // cols
for si in range(0, len(files), per):
    batch = files[si:si + per]
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(batch):
        r, c = divmod(i, cols)
        try:
            im = Image.open(os.path.join(INC, f)).convert("RGB")
            im.thumbnail((cell - 6, cell - 6), Image.LANCZOS)
            x = c * cell + (cell - im.width) // 2
            y = r * (cell + 18) + (cell - im.height) // 2
            sheet.paste(im, (x, y))
        except Exception as e:
            print("err", f, e)
        d.text((c * cell + 4, r * (cell + 18) + cell + 2), os.path.splitext(f)[0], fill=(200, 200, 210))
    name = os.path.join(OUT, f"b{si // per + 1}.jpg")
    sheet.save(name, "JPEG", quality=88)
    print("saved", name)
