// Renders the four Sunset City screenshots with headless Chrome.
//
// Chrome's --screenshot flag writes an image the size of the *window*, and Chrome's
// window is always 87 pixels taller than the page it reports (window.innerHeight),
// so --screenshot cannot produce an exact 1280x800 frame: either the bottom of the
// picture is cut off or an 87 pixel strip of page background is appended. Over the
// DevTools protocol the viewport is set exactly (Emulation.setDeviceMetricsOverride)
// and the frame is clipped to it, so the picture is the game's own 1280x800 canvas
// with nothing cropped and nothing added.
//
// Usage: node shots-src/capture.mjs [outDir]
//   outDir defaults to ./screenshots.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CHROME = '/home/lex/.openclaw/browser/chrome-137/chrome-linux64/chrome';
const PORT = 19222;
const WIDTH = 1280;
const HEIGHT = 800;
// The scorer's own caps for the pictures: at most four of them, each under
// 256 KiB, long edge at most 1280 and short edge at least 480.
const MAX_BYTES = 262144;

// Each pose: the page in shots-src/ and the ?shot= value the game reads.
const SHOTS = [
  { page: '1-start.html', query: '?shot=start&seed=1', out: '1-start.jpg' },
  { page: '2-play.html', query: '?shot=play&seed=1', out: '2-play.jpg' },
  { page: '3-end.html', query: '?shot=end&seed=1', out: '3-end.jpg' },
  { page: '4-mission.html', query: '?shot=mission&seed=1', out: '4-mission.jpg' },
];

const outDir = resolve(process.argv[2] ?? join(ROOT, 'screenshots'));
mkdirSync(outDir, { recursive: true });

// The bytes handed in across all four shots, so the run ends with its own total
// and a runaway picture is caught at capture time rather than at submission.
let shotBytes = 0;

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(ROOT, 'shots-src', '.chrome-profile')}`,
  'about:blank',
], { stdio: 'ignore' });

/** Waits for the debugger endpoint and returns the browser's websocket URL. */
async function debuggerUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const body = await res.json();
      if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error('chrome did not expose a debugger endpoint');
}

/** A minimal DevTools client over one websocket. */
class Client {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.watchers = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method) {
        for (const w of this.watchers) {
          if (w.sessionId === msg.sessionId || w.sessionId === null) w.fn(msg.method, msg.params);
        }
        return;
      }
      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      if (msg.error) slot.reject(new Error(msg.error.message));
      else slot.resolve(msg.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  watch(sessionId, fn) {
    this.watchers.push({ fn, sessionId });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new Client(ws)));
    ws.addEventListener('error', reject);
  });
}

const browser = await connect(await debuggerUrl());
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

await browser.send('Page.enable', {}, sessionId);
await browser.send('Runtime.enable', {}, sessionId);
await browser.send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);

for (const shot of SHOTS) {
  const errors = [];
  browser.watch(sessionId, (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
      errors.push(params.exceptionDetails?.exception?.description ?? 'exception');
    }
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      errors.push(params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  await browser.send('Page.navigate', { url: `file://${join(HERE, shot.page)}${shot.query}` }, sessionId);

  // Wait until the game has painted its first frame.
  let painted = false;
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    const probe = await browser.send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.getElementById('game');
        if (!c) return 'no canvas';
        const d = c.getContext('2d').getImageData(600, 300, 1, 1).data;
        return d[0] + ',' + d[1] + ',' + d[2];
      })()`,
      returnByValue: true,
    }, sessionId);
    const value = probe.result?.value;
    if (typeof value === 'string' && value !== 'no canvas' && value !== '0,0,0') {
      painted = true;
      break;
    }
  }
  if (!painted) throw new Error(`${shot.page} never drew a frame`);

  const result = await browser.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 88,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
  }, sessionId);

  const buffer = Buffer.from(result.data, 'base64');
  if (buffer.length > MAX_BYTES) {
    throw new Error(`${shot.out} is ${buffer.length} bytes, over the ${MAX_BYTES} the scorer allows`);
  }
  writeFileSync(join(outDir, shot.out), buffer);
  shotBytes += buffer.length;
  console.log(`${shot.out}: ${buffer.length} bytes` + (errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''));
}

console.log(`${SHOTS.length} shots, ${shotBytes} bytes total (cap: ${MAX_BYTES * SHOTS.length} across the set)`);

await browser.send('Target.closeTarget', { targetId });
chrome.kill('SIGTERM');
await sleep(300);
chrome.kill('SIGKILL');
