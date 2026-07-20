// Smoke test: load the game via file://, assert zero page/console errors, screenshot the title.
// Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/smoke.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(globalRoot + '/playwright'));
}
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'test/screenshots');
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('file://' + root + '/index.html');
await page.waitForTimeout(1500);

const state = await page.evaluate(() => window.TTM && window.TTM.state());
console.log('state:', JSON.stringify(state));
await page.screenshot({ path: shots + '/title.png' });

// visit the map too
await page.evaluate(() => window.TTM.goto('map'));
await page.waitForTimeout(600);
await page.screenshot({ path: shots + '/map.png' });

// portrait phone: game renders rotated 90° and input maps through the rotation
const pctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true
});
const portrait = await pctx.newPage();
portrait.on('pageerror', e => errors.push('portrait pageerror: ' + e.message));
await portrait.goto('file://' + root + '/index.html');
await portrait.waitForTimeout(1000);
const pInfo = await portrait.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { rotated: view.rotated, cssW: r.width, cssH: r.height, scale: view.scale,
    screen: window.TTM.state().screen };
});
console.log('portrait:', JSON.stringify(pInfo));
if (!pInfo.rotated) errors.push('portrait: expected rotated render');
if (pInfo.cssH <= pInfo.cssW) errors.push('portrait: canvas should be taller than wide');
if (pInfo.screen !== 'title') errors.push('portrait: game not running (screen=' + pInfo.screen + ')');
await portrait.screenshot({ path: shots + '/portrait.png' });
// tap START through the rotated input mapping: client = (left + cssW - y*s, top + x*s)
const tap = await portrait.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  const b = Game.screen.startBtn;
  const lx = b.x + b.w / 2, ly = b.y + b.h / 2;
  return { x: r.left + r.width - ly * view.scale, y: r.top + lx * view.scale };
});
await portrait.touchscreen.tap(tap.x, tap.y);
await portrait.waitForTimeout(700);
const pAfter = await portrait.evaluate(() => window.TTM.state().screen);
console.log('portrait after tap START:', pAfter);
if (pAfter !== 'map') errors.push('portrait: rotated tap on START did not open the map (got ' + pAfter + ')');
await pctx.close();

// landscape phone: small scale, touch drag places a gear (hit-slop path)
const lctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true
});
const landscape = await lctx.newPage();
landscape.on('pageerror', e => errors.push('landscape pageerror: ' + e.message));
await landscape.goto('file://' + root + '/index.html');
await landscape.waitForTimeout(800);
await landscape.evaluate(() => { window.TTM.goto('gears'); window.TTM.setParams({}); });
await landscape.waitForTimeout(400);
const geom = await landscape.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  const s = window.TTM.Game.screen;
  const to = (x, y) => ({ x: r.left + x * view.scale, y: r.top + y * view.scale });
  return { g16: to(s.gears.find(g => g.teeth === 16).home.x, s.gears.find(g => g.teeth === 16).home.y),
    slotA: to(s.slotA.x, s.slotA.y), scale: view.scale };
});
console.log('landscape scale:', geom.scale.toFixed(2));
if (geom.scale >= 1) errors.push('landscape phone should be scaled down');
await landscape.mouse.move(geom.g16.x, geom.g16.y);
await landscape.mouse.down();
await landscape.mouse.move((geom.g16.x + geom.slotA.x) / 2, (geom.g16.y + geom.slotA.y) / 2, { steps: 4 });
await landscape.mouse.move(geom.slotA.x, geom.slotA.y, { steps: 4 });
await landscape.mouse.up();
const placedA = await landscape.evaluate(() => {
  const g = window.TTM.Game.screen.gears.find(g => g.loc === 'a');
  return g && g.teeth;
});
console.log('landscape drag placed:', placedA);
if (placedA !== 16) errors.push('landscape phone drag failed to place gear (got ' + placedA + ')');
await landscape.screenshot({ path: shots + '/mobile-landscape.png' });
await lctx.close();

// served over HTTP: PWA assets resolve and the service worker registers
const { spawn } = await import('child_process');
const server = spawn('npx', ['http-server', '-p', '8412', '-s'], { cwd: root, stdio: 'ignore' });
try {
  const http = await browser.newPage();
  // wait for the server to come up (cold npx can be slow)
  for (let i = 0; ; i++) {
    try { await http.goto('http://localhost:8412/index.html', { timeout: 2000 }); break; }
    catch (e) { if (i > 15) throw e; await new Promise(r => setTimeout(r, 700)); }
  }
  http.on('pageerror', e => errors.push('http pageerror: ' + e.message));
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
    const res = await http.goto('http://localhost:8412/' + f);
    if (!res || res.status() !== 200) errors.push('asset not served: ' + f);
  }
  await http.goto('http://localhost:8412/index.html');
  await http.waitForTimeout(1500);
  const sw = await http.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r));
  if (!sw) errors.push('service worker did not register over http');
  await http.close();
} finally {
  server.kill();
}

await browser.close();

if (errors.length) {
  console.error('FAIL — errors:\n' + errors.join('\n'));
  process.exit(1);
}
if (!state || state.screen !== 'title') {
  console.error('FAIL — expected title screen, got ' + JSON.stringify(state));
  process.exit(1);
}
console.log('SMOKE OK');
