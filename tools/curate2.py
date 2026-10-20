import os, shutil

ROOT = r"D:\codex\dsp-qianxia"
INC = os.path.join(ROOT, "assets", "incoming")
REJ = os.path.join(ROOT, "assets", "rejected2")
os.makedirs(REJ, exist_ok=True)

keep = set("""a001 a002 a007 a008 a010 a011 a012 a015 a016 a019 a023 a031 a036 a037 a039 a042 a047
a055 a062 a063 a065 a066 a068 a069 a070 a072 a086
a101 a102 a103 a104 a107 a109 a115 a116 a117""".split())

moved = 0
for f in sorted(os.listdir(INC)):
    if not f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        continue
    stem = os.path.splitext(f)[0]
    if stem not in keep:
        shutil.move(os.path.join(INC, f), os.path.join(REJ, f))
        moved += 1
print("moved out", moved)
print("kept", len([f for f in os.listdir(INC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]))
