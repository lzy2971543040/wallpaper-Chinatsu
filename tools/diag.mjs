import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9451;
const profile = mkdtempSync(join(tmpdir(), 'edge-diag-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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
const failed = [];
cdp.ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Network.loadingFailed') failed.push(m.params.errorText);
});
await cdp.send('Network.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 960, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: 'file:///D:/codex/dsp-qianxia/index.html' });
await sleep(3000);

const r = await cdp.send('Runtime.evaluate', {
  expression: `(() => {
    const rect = (s) => { const e = document.querySelector(s); if (!e) return 'missing'; const b = e.getBoundingClientRect(); return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)}; };
    const cs = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : 'missing'; };
    return JSON.stringify({
      vh: innerHeight, scrollY,
      hero: rect('.hero'), inner: rect('.hero-inner'), title: rect('.hero-title'), kicker: rect('.hero-kicker'), stats: rect('.hero-stats'),
      heroMinH: cs('.hero', 'minHeight'), heroDisplay: cs('.hero', 'display'),
      bg: cs('.hero-bg', 'backgroundImage'), bgOp: cs('.hero-bg', 'opacity'),
      titleColor: cs('.hero-title', 'color'), titleBg: cs('.hero-title', 'backgroundImage'), titleFont: cs('.hero-title', 'fontSize'),
      toolbar: rect('.toolbar'),
    });
  })()`, returnByValue: true,
});
console.log(r.result.value);
console.log('FAILED:', failed.join(', ') || '(none)');
edge.kill();
process.exit(0);
