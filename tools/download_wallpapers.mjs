// 从百度图片搜索收集「绝区零·千夏」高清原图并下载
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9445;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
const OUT_DIR = 'D:\\codex\\dsp-qianxia\\assets\\wallpapers';
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('CDP port not ready');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const QUERIES = [
  '千夏 绝区零',
  '绝区零 千夏 壁纸',
  '绝区零 千夏 立绘',
  '千夏 妄想天使',
  '绝区零 千夏 猫娘',
];

await waitPort();
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');

const evalJs = async (expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

const collected = new Map(); // objurl -> {w,h,thumb,from}

for (const q of QUERIES) {
  const url = `https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(q)}`;
  await cdp.send('Page.navigate', { url });
  await sleep(4500);
  for (let s = 0; s < 4; s++) {
    await evalJs('window.scrollBy(0, window.innerHeight * 2.2)');
    await sleep(1600);
  }
  const items = await evalJs(`(() => {
    return [...document.querySelectorAll('img[data-objurl]')].map(i => ({
      obj: i.getAttribute('data-objurl'),
      thumb: i.getAttribute('data-thumbnail-url'),
      w: i.naturalWidth, h: i.naturalHeight,
      alt: i.alt,
    }));
  })()`);
  for (const it of items || []) {
    if (!it.obj || collected.has(it.obj)) continue;
    collected.set(it.obj, { ...it, query: q });
  }
  console.log(`query "${q}": +${items?.length || 0}, total unique ${collected.size}`);
}

console.log('unique candidates:', collected.size);

// 先下载缩略图判断真实尺寸（objurl 的 naturalWidth 是缩略图尺寸，不可信）
const headersFor = (u) => {
  const h = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' };
  if (u.includes('hdslb.com')) h.Referer = 'https://www.bilibili.com/';
  else if (u.includes('sinaimg.cn')) h.Referer = 'https://weibo.com/';
  else if (u.includes('zhimg.com')) h.Referer = 'https://www.zhihu.com/';
  else if (u.includes('xiaohongshu') || u.includes('xhscdn')) h.Referer = 'https://www.xiaohongshu.com/';
  return h;
};

function probeSize(buf) {
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  // WEBP
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    if (buf.toString('ascii', 12, 16) === 'VP8 ') {
      return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (buf.toString('ascii', 12, 16) === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { type: 'webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

const results = [];
let idx = 0;
for (const [objurl, meta] of collected) {
  idx++;
  let res;
  try {
    const r = await fetch(objurl, { headers: headersFor(objurl), signal: AbortSignal.timeout(20000) });
    if (!r.ok) { console.log(`[${idx}] HTTP ${r.status} ${objurl.slice(0, 80)}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const size = probeSize(buf);
    if (!size) { console.log(`[${idx}] not image ${objurl.slice(0, 80)}`); continue; }
    if (buf.length < 30000) { console.log(`[${idx}] too small ${size.w}x${size.h} ${buf.length}B`); continue; }
    if (Math.max(size.w, size.h) < 1100) { console.log(`[${idx}] lowres ${size.w}x${size.h}`); continue; }
    const ext = size.type === 'png' ? 'png' : size.type === 'webp' ? 'webp' : 'jpg';
    const name = `${String(results.length + 1).padStart(3, '0')}.${ext}`;
    writeFileSync(join(OUT_DIR, name), buf);
    results.push({ file: name, url: objurl, w: size.w, h: size.h, bytes: buf.length, query: meta.query, alt: meta.alt });
    console.log(`[${idx}] OK ${name} ${size.w}x${size.h} ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    console.log(`[${idx}] FAIL ${e.message.slice(0, 60)} ${objurl.slice(0, 70)}`);
  }
}

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(results, null, 2));
console.log(`\nDONE: ${results.length} wallpapers saved to ${OUT_DIR}`);
edge.kill();
process.exit(0);
