// 用无头 Edge + CDP 探索百度图片结果页的大图地址
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 60; i++) {
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

const q = process.argv[2] || '千夏 绝区零';
const encoded = encodeURIComponent(q);
const url = `https://image.baidu.com/search/index?tn=baiduimage&word=${encoded}`;

const ver = await waitPort();
console.log('browser:', ver.Browser);
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Page.navigate', { url });
await sleep(6000);

const evalJs = async (expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

// 滚动一次触发懒加载
await evalJs('window.scrollTo(0, 1200)');
await sleep(2500);

const info = await evalJs(`(() => {
  const imgs = [...document.querySelectorAll('img')].filter(i => i.src && i.src.includes('baidu.com/it/u='));
  return { count: imgs.length, sample: imgs.slice(0, 3).map(i => ({src: i.src.slice(0,120), parent: i.parentElement?.className, gp: i.parentElement?.parentElement?.className, outer: i.outerHTML.slice(0,200)})) };
})()`);
console.log(JSON.stringify(info, null, 2));

// 尝试点击第一张结果图，看浮层大图
await evalJs(`(() => {
  const img = [...document.querySelectorAll('img')].find(i => i.src && i.src.includes('baidu.com/it/u='));
  if (img) img.click();
  return !!img;
})()`);
await sleep(3000);

const big = await evalJs(`(() => {
  const cands = [...document.querySelectorAll('img')].map(i => i.src).filter(s => s && !s.startsWith('data:'));
  const layers = [...document.querySelectorAll('[class*=img]')].map(e => e.className).slice(0, 20);
  return { url: location.href.slice(0, 300), imgs: cands.slice(0, 10), layers };
})()`);
console.log(JSON.stringify(big, null, 2));

edge.kill();
process.exit(0);
