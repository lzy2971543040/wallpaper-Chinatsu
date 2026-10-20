import os, json, shutil

ROOT = r"D:\codex\dsp-qianxia"
DATA = os.path.join(ROOT, "data", "gallery.js")
REJ = os.path.join(ROOT, "assets", "rejected3")
os.makedirs(REJ, exist_ok=True)

drop = set("""019 070 073 077 087 059 a068 a072 a070 a047 a066
064 067 068 069 074 075 086 089 a055 063 061
085 a015 a086 045 a019""".split())

raw = open(DATA, encoding="utf-8").read()
payload = json.loads(raw[raw.index("{"): raw.rindex(";")])
items = payload["items"]

moved = 0
for it in items:
    if it["id"] not in drop:
        continue
    for key in ("src", "thumb"):
        p = os.path.join(ROOT, it[key].replace("/", os.sep))
        if os.path.exists(p):
            dst = os.path.join(REJ, os.path.basename(p))
            shutil.move(p, dst)
    moved += 1
print("dropped", moved)
