import os, json, hashlib, sys
from PIL import Image

ROOT = r"D:\codex\dsp-qianxia"
OFF = os.path.join(ROOT, "assets", "official")
WALL = os.path.join(ROOT, "assets", "wallpapers")
THUMB = os.path.join(ROOT, "assets", "thumbs")
SHEET = os.path.join(ROOT, "tools", "sheets")
for d in (THUMB, SHEET):
    os.makedirs(d, exist_ok=True)

# 1. 修复 official 双后缀
for f in os.listdir(OFF):
    if f.endswith(".png.png"):
        src = os.path.join(OFF, f)
        dst = os.path.join(OFF, f[:-4])
        if not os.path.exists(dst):
            os.rename(src, dst)

def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def avg_color(im):
    small = im.convert("RGB").resize((1, 1), Image.LANCZOS)
    return "#%02x%02x%02x" % small.getpixel((0, 0))

items, seen = [], {}
files = sorted([f for f in os.listdir(WALL) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))])
for f in files:
    p = os.path.join(WALL, f)
    try:
        h = md5(p)
        if h in seen:
            os.remove(p)
            print("dup removed", f, "==", seen[h])
            continue
        seen[h] = f
        im = Image.open(p)
        w, hgt = im.size
        if w < 600 and hgt < 600:
            os.remove(p)
            print("tiny removed", f, w, hgt)
            continue
        tb = os.path.join(THUMB, os.path.splitext(f)[0] + ".webp")
        t = im.convert("RGBA") if im.mode in ("RGBA", "P", "LA") else im.convert("RGB")
        t.thumbnail((720, 720), Image.LANCZOS)
        if t.mode == "RGBA":
            bg = Image.new("RGB", t.size, (255, 255, 255))
            bg.paste(t, mask=t.split()[-1])
            t = bg
        t.save(tb, "WEBP", quality=80, method=4)
        items.append({
            "id": os.path.splitext(f)[0],
            "src": f"assets/wallpapers/{f}",
            "thumb": f"assets/thumbs/{os.path.splitext(f)[0]}.webp",
            "w": w, "h": hgt,
            "bytes": os.path.getsize(p),
            "color": avg_color(im),
        })
    except Exception as e:
        print("ERR", f, e)

print("kept", len(items))

# contact sheet: 每张 8 列，格子 240x240，编号
def make_sheets(items, per_sheet=48, cols=8, cell=232):
    rows = (per_sheet + cols - 1) // cols
    from PIL import ImageDraw
    for si in range(0, len(items), per_sheet):
        batch = items[si:si + per_sheet]
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
                print("sheet err", it["id"], e)
            d.text((c * cell + 4, r * (cell + 18) + cell + 2), it["id"], fill=(200, 200, 210))
        name = os.path.join(SHEET, f"sheet{si // per_sheet + 1}.jpg")
        sheet.save(name, "JPEG", quality=88)
        print("sheet", name)

make_sheets(items)
with open(os.path.join(ROOT, "tools", "raw_items.json"), "w", encoding="utf-8") as fh:
    json.dump(items, fh, ensure_ascii=False, indent=1)
