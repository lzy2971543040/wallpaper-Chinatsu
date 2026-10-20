import os, json, hashlib, shutil, re
from PIL import Image

ROOT = r"D:\codex\dsp-qianxia"
ASSETS = os.path.join(ROOT, "assets")
SRC_DIRS = [
    (os.path.join(ASSETS, "official"), True, "off"),
    (os.path.join(ASSETS, "wallpapers"), False, ""),
    (os.path.join(ASSETS, "incoming"), False, ""),
    (os.path.join(ASSETS, "incoming3"), False, ""),
]
THUMB = os.path.join(ASSETS, "thumbs")
DATA_DIR = os.path.join(ROOT, "data")
os.makedirs(THUMB, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# 官方图转英文文件名，方便引用
OFF_TITLES = {
    1: "千夏影画展示 Banner01",
    2: "千夏影画展示 Banner02",
    3: "千夏影画展示 Banner03",
    4: "角色立绘 · 千夏（官方介绍 2）",
    5: "代理人档案 · 千夏 01",
    6: "代理人档案 · 千夏 02",
    7: "角色立绘 · 千夏（官方介绍）",
    8: "生贺图 · 千夏 2026",
}
OFF_MAP = {}
off_dir = os.path.join(ASSETS, "official")
for f in sorted(os.listdir(off_dir)):
    if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        continue
    m = re.match(r"^official-(\d+)$", os.path.splitext(f)[0])
    if m:
        OFF_MAP[f] = (int(m.group(1)), OFF_TITLES.get(int(m.group(1)), os.path.splitext(f)[0]))
    elif f.split("_")[0].isdigit():
        OFF_MAP[f] = (int(f.split("_")[0]), OFF_TITLES.get(int(f.split("_")[0]), os.path.splitext(f)[0]))

def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def avg_color(im):
    small = im.convert("RGB").resize((1, 1), Image.LANCZOS)
    return "#%02x%02x%02x" % small.getpixel((0, 0))

def make_thumb(im, out_path, box=760):
    t = im.convert("RGBA") if im.mode in ("RGBA", "P", "LA") else im.convert("RGB")
    t.thumbnail((box, box), Image.LANCZOS)
    if t.mode == "RGBA":
        bg = Image.new("RGB", t.size, (12, 15, 21))
        bg.paste(t, mask=t.split()[-1])
        t = bg
    t.save(out_path, "WEBP", quality=82, method=4)

seen = {}
items = []
zero = 0

for src_dir, is_official, _ in SRC_DIRS:
    if not os.path.isdir(src_dir):
        continue
    files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".webp")))
    for f in files:
        p = os.path.join(src_dir, f)
        try:
            h = md5(p)
            if h in seen:
                continue
            with Image.open(p) as raw:
                w, hh = raw.size
                color = avg_color(raw)
            if max(w, hh) < 1000:
                continue
            seen[h] = f
            stem = os.path.splitext(f)[0]
            title = ""
            if is_official:
                idx, base = OFF_MAP[f]
                new_name = f"official-{idx:02d}"
                ext = "png"
                dst = os.path.join(off_dir, f"{new_name}.{ext}")
                if os.path.abspath(dst) != os.path.abspath(p):
                    os.replace(p, dst)
                p = dst
                stem = new_name
                src_rel = f"assets/official/{new_name}.{ext}"
                title = base
            else:
                src_rel = os.path.relpath(p, ROOT).replace("\\", "/")
            thumb_name = stem + ".webp"
            with Image.open(p) as raw2:
                make_thumb(raw2, os.path.join(THUMB, thumb_name))

            ratio = w / hh
            tags = []
            if is_official:
                tags.append("official")
            if max(w, hh) >= 2560:
                tags.append("ultra")
            if ratio >= 1.25:
                tags.append("landscape")
            elif ratio <= 0.8:
                tags.append("portrait")
            else:
                tags.append("square")
            if is_official and "banner" in title.lower():
                tags.append("banner")

            items.append({
                "id": stem,
                "title": title,
                "src": src_rel,
                "thumb": f"assets/thumbs/{thumb_name}",
                "w": w, "h": hh,
                "bytes": os.path.getsize(p),
                "color": color,
                "tags": tags,
            })
        except Exception as e:
            print("ERR", f, e)

# 排序：官方在前，然后按长边降序
items.sort(key=lambda x: (0 if "official" in x["tags"] else 1, -max(x["w"], x["h"])))

hero = next((i["src"] for i in items if "official" in i["tags"] and "banner" in i["tags"]), "")
if not hero:
    hero = next((i["src"] for i in items if "official" in i["tags"]), "")

payload = {"hero": hero, "items": items}
with open(os.path.join(DATA_DIR, "gallery.js"), "w", encoding="utf-8") as fh:
    fh.write("window.GALLERY = ")
    json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")

print("items:", len(items))
print("official:", sum(1 for i in items if "official" in i["tags"]))
print("ultra:", sum(1 for i in items if "ultra" in i["tags"]))
print("landscape:", sum(1 for i in items if "landscape" in i["tags"]))
print("portrait:", sum(1 for i in items if "portrait" in i["tags"]))
print("hero:", hero)
