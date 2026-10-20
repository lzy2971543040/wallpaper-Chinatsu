// 用无头 Edge 打开本地页面并截图验证
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9450;
const profile = mkdtempSync(join(tmpdir(), 'edge-shot-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'D:\\codex\\dsp-qianxia\\tools\\shots';
mkdirSync(OUT, { recursive: true });

const url = process.argv[2] || 'file:///D:/codex/dsp-qianxia/index.html';
const tag = process.argv[3] || 'shot';

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1512,960', 'about:blank'], { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('CDP not ready');
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
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

await waitPort();
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 960, deviceScaleFactor: 1, mobile: false });

const logs = [];
cdp.ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled') logs.push('[console] ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('[error] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded') logs.push('[log] ' + m.params.entry.text);
});
await cdp.send('Log.enable');

await cdp.send('Page.navigate', { url });
await sleep(3500);

const info = await cdp.send('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    cards: document.querySelectorAll('.card').length,
    galleryH: document.querySelector('#waterfall').style.height,
    count: document.querySelector('#statCount').textContent,
    imgs: [...document.querySelectorAll('.card img')].slice(0,5).map(i => ({src: i.src.split('/').pop(), w: i.naturalWidth, h: i.naturalHeight})),
    banner: getComputedStyle(document.documentElement).getPropertyValue('--hero-img'),
    failed: [...document.querySelectorAll('.card img')].filter(i => i.complete && i.naturalWidth === 0).length,
  })`, returnByValue: true,
});
console.log('PAGE:', info.result.value);

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, `${tag}-top.png`), Buffer.from(shot.data, 'base64'));

// 滚到画廊
await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0, document.querySelector('#gallery').offsetTop)` });
await sleep(2200);
const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, `${tag}-gallery.png`), Buffer.from(shot2.data, 'base64'));

// 再往下滚
await cdp.send('Runtime.evaluate', { expression: `window.scrollBy(0, 1200)` });
await sleep(1800);
const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, `${tag}-gallery2.png`), Buffer.from(shot3.data, 'base64'));

console.log('LOGS:', logs.slice(0, 20).join(' | ') || '(none)');
edge.kill();
process.exit(0);
