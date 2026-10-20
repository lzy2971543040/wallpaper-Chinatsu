// 打开灯箱并截图验证
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9452;
const profile = mkdtempSync(join(tmpdir(), 'edge-lb-'));
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
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 960, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: 'file:///D:/codex/dsp-qianxia/index.html' });
await sleep(3200);

// 打开第 1 张官方图（banner）
await cdp.send('Runtime.evaluate', { expression: `document.querySelectorAll('.card')[1].click()` });
await sleep(2000);
let shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'lb-1.png'), Buffer.from(shot.data, 'base64'));

// 下一张
await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#lbNext').click()` });
await sleep(1600);
shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'lb-2.png'), Buffer.from(shot.data, 'base64'));

const info = await cdp.send('Runtime.evaluate', {
  expression: `JSON.stringify({hidden: document.querySelector('#lightbox').hidden, title: document.querySelector('#lbTitle').textContent, meta: document.querySelector('#lbMeta').textContent, src: document.querySelector('#lbImg').src.split('/').pop(), nat: document.querySelector('#lbImg').naturalWidth})`,
  returnByValue: true,
});
console.log('LB:', info.result.value);
edge.kill();
process.exit(0);
