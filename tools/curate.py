import os, shutil, json

ROOT = r"D:\codex\dsp-qianxia"
WALL = os.path.join(ROOT, "assets", "wallpapers")
THUMB = os.path.join(ROOT, "assets", "thumbs")
REJ_W = os.path.join(ROOT, "assets", "rejected", "wallpapers")
REJ_T = os.path.join(ROOT, "assets", "rejected", "thumbs")

excluded = """007 020 022 029 040 043
051 052 053 054 055 065 078 079 080 081 082 083 084 088 090 091 092 093 094 095 096
097 098 099 100 101 102 103 104 105 106 107 108 109 110 111 112 113 114 115 116 117 118 119 120 122 123 124 127 128 130 131 132 133 134 135 136 137 138 139 140 141 142 143 144
145 146 147 148 149 150 151 152 154 155 156 157 159 161 162 163 164 165 166 167 169 170 171 172 173 174 176 177 179 180 181 182 183 184 185 186 187 188 189 190 191 192
193 194 195 197 198 199""".split()

os.makedirs(REJ_W, exist_ok=True)
os.makedirs(REJ_T, exist_ok=True)
moved = 0
for f in sorted(os.listdir(WALL)):
    stem, ext = os.path.splitext(f)
    if stem in excluded:
        shutil.move(os.path.join(WALL, f), os.path.join(REJ_W, f))
        t = os.path.join(THUMB, stem + ".webp")
        if os.path.exists(t):
            shutil.move(t, os.path.join(REJ_T, stem + ".webp"))
        moved += 1
print("excluded", moved)
kept = [f for f in os.listdir(WALL) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
print("kept", len(kept))
