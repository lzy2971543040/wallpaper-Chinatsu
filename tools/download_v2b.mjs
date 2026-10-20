// 第二轮（健壮版）：更多关键词，日志落盘，超时保护
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9447;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp3-'));
const OUT_DIR = 'D:\\codex\\dsp-qianxia\\assets\\incoming';
const LOG = 'D:\\codex\\dsp-qianxia\\tools\\v2.log';
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(LOG, '');
const log = (...a) => appendFileSync(LOG, a.join(' ') + '\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) => Promise.race([p, sleep(ms).then(() => { throw new Error('timeout: ' + label); })]);

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
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
      try {
        const msg = JSON.parse(ev.data);
        if (msg.id && c.pending.has(msg.id)) {
          const { resolve, reject } = c.pending.get(msg.id);
          c.pending.delete(msg.id);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
      } catch (e) { log('ws parse err', e.message); }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

const QUERIES = [
  '绝区零 千夏 4k 壁纸',
  '绝区零 千夏 官方壁纸',
  '千夏 旧梦的安可曲',
  '绝区零 千夏 同人图',
  '千夏 妄想天使 壁纸',
  '绝区零 千夏 高清',
  '千夏 绝区零 手机壁纸',
  '绝区零 千夏 海报',
  '千夏 绝区零 全身',
];
const PAGES = [0, 30];

log('start');
await waitPort();
log('port ok');
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
log('cdp ok');

const evalJs = async (expr) => {
  const r = await withTimeout(cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true }), 15000, 'eval');
  return r.result?.value;
};

const seenFile = 'D:\\codex\\dsp-qianxia\\tools\\seen_urls.json';
const seen = new Set(existsSync(seenFile) ? JSON.parse(readFileSync(seenFile, 'utf8')) : []);
const collected = new Map();

for (const q of QUERIES) {
  for (const pn of PAGES) {
    const url = `https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(q)}&pn=${pn}`;
    try {
      await Promise.race([cdp.send('Page.navigate', { url }), sleep(8000)]);
      await sleep(3800);
      for (let s = 0; s < 4; s++) {
        try { await evalJs('window.scrollBy(0, window.innerHeight * 2.2)'); } catch {}
        await sleep(1200);
      }
      const raw = await evalJs(`JSON.stringify([...document.querySelectorAll('img[data-objurl]')].map(i => ({ obj: i.getAttribute('data-objurl'), alt: i.alt })))`);
      const items = JSON.parse(raw || '[]');
      let added = 0;
      for (const it of items) {
        if (!it.obj || seen.has(it.obj) || collected.has(it.obj)) continue;
        collected.set(it.obj, { ...it, query: q });
        added++;
      }
      log(`"${q}" pn=${pn}: +${added} pool=${collected.size}`);
    } catch (e) {
      log(`"${q}" pn=${pn}: ERR ${e.message.slice(0, 80)}`);
    }
  }
}

log('collect done pool=' + collected.size);

const headersFor = (u) => {
  const h = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' };
  if (u.includes('hdslb.com')) h.Referer = 'https://www.bilibili.com/';
  else if (u.includes('sinaimg.cn')) h.Referer = 'https://weibo.com/';
  else if (u.includes('zhimg.com')) h.Referer = 'https://www.zhihu.com/';
  else if (u.includes('xhscdn')) h.Referer = 'https://www.xiaohongshu.com/';
  else if (u.includes('biligame')) h.Referer = 'https://wiki.biligame.com/';
  return h;
};

function probeSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    if (buf.toString('ascii', 12, 16) === 'VP8 ') return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (buf.toString('ascii', 12, 16) === 'VP8L') { const b = buf.readUInt32LE(21); return { type: 'webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

const results = [];
let idx = 0;
for (const [objurl, meta] of collected) {
  idx++;
  try {
    const r = await withTimeout(fetch(objurl, { headers: headersFor(objurl), signal: AbortSignal.timeout(15000) }), 18000, 'fetch');
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const size = probeSize(buf);
    if (!size || buf.length < 40000 || Math.max(size.w, size.h) < 1200) continue;
    const ext = size.type;
    const name = `a${String(results.length + 1).padStart(3, '0')}.${ext}`;
    writeFileSync(join(OUT_DIR, name), buf);
    results.push({ file: name, url: objurl, w: size.w, h: size.h, bytes: buf.length, query: meta.query, alt: meta.alt });
    if (results.length % 5 === 0) log(`saved ${results.length} (${idx}/${collected.size})`);
  } catch {}
}

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(results, null, 2));
writeFileSync(seenFile, JSON.stringify([...seen, ...collected.keys()]));
log(`DONE v2b: ${results.length}`);
edge.kill();
process.exit(0);
