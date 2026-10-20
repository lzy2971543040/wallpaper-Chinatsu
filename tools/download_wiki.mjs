// 下载 biligame wiki 千夏角色页的官方美术图
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HTML = 'D:\\codex\\dsp-qianxia\\tools\\cache\\wiki_qianxia.html';
const OUT = 'D:\\codex\\dsp-qianxia\\assets\\official';
mkdirSync(OUT, { recursive: true });

const html = readFileSync(HTML, 'utf8');
const urls = new Map();
for (const m of html.matchAll(/https:\/\/patchwiki\.biligame\.com\/images\/zzz\/thumb\/([^"'\s]+?)\.(png|jpg|jpeg|webp)\/(\d+)px-([^"'\s]+)/g)) {
  const [, path, ext, , label] = m;
  const original = `https://patchwiki.biligame.com/images/zzz/${path}.${ext}`;
  const name = decodeURIComponent(label);
  const prev = urls.get(original);
  if (!prev || Number(m[3]) > prev.size) urls.set(original, { size: Number(m[3]), name, ext });
}
console.log('candidates:', urls.size);

const wanted = [...urls.entries()].filter(([u, meta]) => /千夏|影画展/.test(meta.name));
console.log('qianxia images:', wanted.length);
for (const [u, meta] of wanted) console.log(meta.size + 'px', meta.name);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const results = [];
let i = 0;
for (const [u, meta] of wanted) {
  i++;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://wiki.biligame.com/' }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) { console.log(i, 'HTTP', r.status, u); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    let ext = meta.ext === 'jpeg' ? 'jpg' : meta.ext;
    const fname = `${String(i).padStart(2, '0')}_${meta.name.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
    writeFileSync(join(OUT, fname), buf);
    results.push({ file: fname, url: u, label: meta.name, bytes: buf.length });
    console.log(i, 'OK', fname, (buf.length / 1024).toFixed(0) + 'KB');
  } catch (e) {
    console.log(i, 'FAIL', e.message.slice(0, 60));
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(results, null, 2));
console.log('done', results.length);
