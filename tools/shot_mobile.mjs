import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9453;
const profile = mkdtempSync(join(tmpdir(), 'edge-mob-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'D:\\codex\\dsp-qianxia\\tools\\shots';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && c.pending.has(m.id)) { const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } };
    return c;
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp.send('Page.navigate', { url: 'file:///D:/codex/dsp-qianxia/index.html' });
await sleep(3200);

let shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'm-top.png'), Buffer.from(shot.data, 'base64'));

await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0, document.querySelector('#gallery').offsetTop)` });
await sleep(2200);
shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'm-gallery.png'), Buffer.from(shot.data, 'base64'));

// 点击卡片看灯箱在移动端表现
await cdp.send('Runtime.evaluate', { expression: `document.querySelectorAll('.card')[1].click()` });
await sleep(1600);
shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'm-lb.png'), Buffer.from(shot.data, 'base64'));

const info = await cdp.send('Runtime.evaluate', { expression: `JSON.stringify({cols: document.querySelectorAll('.card').length, lb: !document.querySelector('#lightbox').hidden, overflow: getComputedStyle(document.body).overflow})`, returnByValue: true });
console.log('M:', info.result.value);
edge.kill();
process.exit(0);
