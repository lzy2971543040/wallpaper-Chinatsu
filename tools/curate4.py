import os, shutil

ROOT = r"D:\codex\dsp-qianxia"
INC = os.path.join(ROOT, "assets", "incoming3")
REJ = os.path.join(ROOT, "assets", "rejected4")
os.makedirs(REJ, exist_ok=True)

keep = set("""b001 b002 b003 b004 b005 b006 b007 b009 b015 b018
b050 b051 b052 b056 b058 b062 b063 b064 b066 b067 b068 b069 b070 b072 b073 b075 b086 b087 b092 b095
b097 b101 b102 b103""".split())

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
