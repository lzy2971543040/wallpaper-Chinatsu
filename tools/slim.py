# -*- coding: utf-8 -*-
"""把画廊原图统一转成 WebP（长边 <= 2560），并更新 data/gallery.js。
不删除旧文件，由调用方确认后再删。"""
import os, json
from PIL import Image

ROOT = r"D:\codex\dsp-qianxia"
DATA = os.path.join(ROOT, "data", "gallery.js")
OUT = os.path.join(ROOT, "assets", "full")
os.makedirs(OUT, exist_ok=True)

MAX = 2560

raw = open(DATA, encoding="utf-8").read()
payload = json.loads(raw[raw.index("{"): raw.rindex(";")])

def convert(fp, dst, quality):
    with Image.open(fp) as im:
        im.load()
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        out = im.convert("RGBA") if has_alpha else im.convert("RGB")
        w, h = out.size
        scale = min(1.0, MAX / max(w, h))
        if scale < 1.0:
            out = out.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        out.save(dst, "WEBP", quality=quality, method=6)
        return out.size

before = 0
after = 0
for it in payload["items"]:
    src = os.path.join(ROOT, it["src"].replace("/", os.sep))
    before += os.path.getsize(src)
    is_off = str(it["id"]).startswith("official-")
    dst = os.path.join(OUT, "%s.webp" % it["id"])
    nw, nh = convert(src, dst, 92 if is_off else 88)
    size = os.path.getsize(dst)
    after += size
    it["src"] = "assets/full/%s.webp" % it["id"]
    it["w"], it["h"], it["bytes"] = nw, nh, size

# hero 指向 official-01
hero = payload.get("hero", "")
if hero:
    hid = os.path.splitext(os.path.basename(hero))[0]
    payload["hero"] = "assets/full/%s.webp" % hid

with open(DATA, "w", encoding="utf-8") as f:
    f.write("window.GALLERY = " + json.dumps(payload, ensure_ascii=False) + ";\n")

print("items:", len(payload["items"]))
print("originals: %.1f MB -> webp: %.1f MB" % (before / 1048576, after / 1048576))
print("hero:", payload["hero"])
