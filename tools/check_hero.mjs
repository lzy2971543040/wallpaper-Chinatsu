// 检查 hero 背景是否加载
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9462;
const profile = mkdtempSync(join(tmpdir(), 'edge-hero-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Page.navigate', { url: 'file:///D:/codex/dsp-qianxia/index.html' });
await sleep(2500);

const expr = `JSON.stringify({
  bg: getComputedStyle(document.querySelector('.hero-bg')).backgroundImage.slice(0, 130),
  heroH: document.querySelector('.hero-bg').offsetHeight,
  thumbOk: [...document.querySelectorAll('.card img')].filter(i => i.naturalWidth > 0).length,
  thumbTotal: document.querySelectorAll('.card img').length
})`;
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(r.result.value);
edge.kill();
process.exit(0);
