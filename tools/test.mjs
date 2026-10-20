// 交互功能验证
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9455;
const profile = mkdtempSync(join(tmpdir(), 'edge-test-'));
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
const errs = [];
cdp.ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push(m.params.entry.text);
});
await cdp.send('Log.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 960, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url: 'file:///D:/codex/dsp-qianxia/index.html' });
await sleep(3000);

const ev = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

const results = {};
results.initial = await ev(`JSON.stringify({cards: document.querySelectorAll('.card').length, text: document.querySelector('#resultText').textContent})`);

// 点「官方美术」
await ev(`[...document.querySelectorAll('.chip')].find(c=>c.textContent==='官方美术').click()`);
await sleep(1200);
results.official = await ev(`JSON.stringify({cards: document.querySelectorAll('.card').length, text: document.querySelector('#resultText').textContent, badge: document.querySelectorAll('.badge').length})`);

// 再加「4K 超清」（交集）
await ev(`[...document.querySelectorAll('.chip')].find(c=>c.textContent==='4K 超清').click()`);
await sleep(1200);
results.both = await ev(`document.querySelectorAll('.card').length`);

// 回到全部
await ev(`[...document.querySelectorAll('.chip')].find(c=>c.textContent==='全部').click()`);
await sleep(1200);
results.all = await ev(`document.querySelectorAll('.card').length`);

// 搜索 2560
await ev(`(()=>{const el=document.querySelector('#search'); el.value='2560'; el.dispatchEvent(new Event('input'));})()`);
await sleep(1000);
results.search = await ev(`JSON.stringify({cards: document.querySelectorAll('.card').length, text: document.querySelector('#resultText').textContent})`);

// 清空搜索
await ev(`(()=>{const el=document.querySelector('#search'); el.value=''; el.dispatchEvent(new Event('input'));})()`);
await sleep(800);

// 灯箱
await ev(`document.querySelectorAll('.card')[2].click()`);
await sleep(1200);
results.lbOpen = await ev(`JSON.stringify({open: !document.querySelector('#lightbox').hidden, title: document.querySelector('#lbTitle').textContent, tags: document.querySelector('#lbTags').textContent})`);
await ev(`document.querySelector('#lbNext').click()`);
await sleep(600);
results.lbNext = await ev(`document.querySelector('#lbTitle').textContent`);
await ev(`document.querySelector('#lbClose').click()`);
await sleep(400);
results.lbClosed = await ev(`document.querySelector('#lightbox').hidden`);

// 打乱
const before = await ev(`[...document.querySelectorAll('.card')].slice(0,3).map(c=>c.dataset.id).join(',')`);
await ev(`document.querySelector('#shuffleBtn').click()`);
await sleep(1000);
const after = await ev(`[...document.querySelectorAll('.card')].slice(0,3).map(c=>c.dataset.id).join(',')`);
results.shuffle = `${before} -> ${after} (${before !== after ? 'changed' : 'same'})`;

// 无限加载
await ev(`window.scrollTo(0, document.body.scrollHeight)`);
await sleep(1800);
results.afterScroll = await ev(`document.querySelectorAll('.card').length`);

console.log(JSON.stringify(results, null, 1));
console.log('ERRORS:', errs.slice(0, 5).join(' | ') || '(none)');
edge.kill();
process.exit(0);
