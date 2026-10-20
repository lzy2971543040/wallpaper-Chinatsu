# -*- coding: utf-8 -*-
"""清理缩略图/原图中已不在 data/gallery.js 里的孤儿文件。"""
import os, json

ROOT = r"D:\codex\dsp-qianxia"
raw = open(os.path.join(ROOT, "data", "gallery.js"), encoding="utf-8").read()
payload = json.loads(raw[raw.index("{"): raw.rindex(";")])

keep = set()
for it in payload["items"]:
    keep.add(os.path.basename(it["thumb"]))
    keep.add(os.path.basename(it["src"]))
keep.add(os.path.basename(payload["hero"]))

removed = 0
freed = 0
for sub in ("assets/thumbs", "assets/full"):
    d = os.path.join(ROOT, sub.replace("/", os.sep))
    if not os.path.isdir(d):
        continue
    for name in os.listdir(d):
        if name in keep:
            continue
        p = os.path.join(d, name)
        freed += os.path.getsize(p)
        os.remove(p)
        removed += 1

print("kept:", len(keep), "removed:", removed, "freed: %.1f MB" % (freed / 1048576))
print("thumbs left:", len(os.listdir(os.path.join(ROOT, "assets", "thumbs"))))
print("full left:", len(os.listdir(os.path.join(ROOT, "assets", "full"))))
