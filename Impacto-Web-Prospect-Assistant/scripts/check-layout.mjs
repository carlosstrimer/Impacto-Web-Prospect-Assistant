import { spawn } from 'node:child_process';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9227;
const profilePath = join(process.cwd(), '.tmp-layout-check');
const targetUrl = 'http://127.0.0.1:4173/dashboard.html';
const widths = [360, 390, 430, 768, 820, 1024, 1280, 1440, 1920];

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profilePath}`,
  targetUrl
], { stdio: 'ignore', windowsHide: true });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPage() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = pages.find(item => item.type === 'page');
      if (page) return page;
    } catch (_) {}
    await wait(250);
  }
  throw new Error('Chrome DevTools nao ficou disponivel.');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
  }

  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = reject;
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

try {
  const page = await getPage();
  const cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');

  const results = [];
  for (const width of widths) {
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width,
      height: width <= 430 ? 844 : 1000,
      deviceScaleFactor: 1,
      mobile: width <= 430
    });
    await cdp.call('Page.navigate', { url: `${targetUrl}?width=${width}` });
    await wait(650);
    const evaluation = await cdp.call('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const root = document.documentElement;
        const offenders = Array.from(document.querySelectorAll('body *'))
          .map(element => ({
            tag: element.tagName,
            id: element.id || '',
            className: typeof element.className === 'string' ? element.className : '',
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width)
          }))
          .filter(item => item.right > root.clientWidth + 1 || item.width > root.clientWidth + 1)
          .slice(0, 8);
        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          overflow: root.scrollWidth > root.clientWidth,
          offenders
        };
      })()`
    });
    results.push({ requestedWidth: width, ...evaluation.result.value });
  }
  cdp.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.overflow)) process.exitCode = 1;
} finally {
  chrome.kill();
}

