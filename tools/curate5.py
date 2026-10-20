import os, json, shutil

ROOT = r"D:\codex\dsp-qianxia"
DATA = os.path.join(ROOT, "data", "gallery.js")
REJ = os.path.join(ROOT, "assets", "rejected5")
os.makedirs(REJ, exist_ok=True)

drop = set("b015 b073 a031 a007 015 b097 b101".split())

raw = open(DATA, encoding="utf-8").read()
payload = json.loads(raw[raw.index("{"): raw.rindex(";")])
moved = 0
for it in payload["items"]:
    if it["id"] not in drop:
        continue
    for key in ("src", "thumb"):
        p = os.path.join(ROOT, it[key].replace("/", os.sep))
        if os.path.exists(p):
            shutil.move(p, os.path.join(REJ, os.path.basename(p)))
    moved += 1
print("dropped", moved)
