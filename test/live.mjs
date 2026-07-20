// Verifies the deployed GitHub Pages site end-to-end.
// Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/live.mjs
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(globalRoot + '/playwright'));
}

const URL = process.env.LIVE_URL || 'https://mrbilalshah.github.io/tea/';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'test/screenshots');
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const res = await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
console.log('HTTP', res.status(), URL);
await page.waitForTimeout(2000);

const state = await page.evaluate(() => window.TTM && window.TTM.state());
console.log('state:', JSON.stringify(state));
const sw = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r).catch(() => false));
console.log('service worker registered:', sw);
for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
  const r = await page.request.get(URL + f);
  console.log(f, r.status());
  if (r.status() !== 200) errors.push('asset ' + f + ' -> ' + r.status());
}
await page.screenshot({ path: shots + '/live-title.png' });

// click START via real mouse to prove interactivity on the live build
const startPos = await page.evaluate(() => {
  const c = document.querySelector('canvas').getBoundingClientRect();
  const s = Game.screen.startBtn;
  return { x: c.left + (s.x + s.w / 2) * (c.width / 960), y: c.top + (s.y + s.h / 2) * (c.height / 600) };
});
await page.mouse.click(startPos.x, startPos.y);
await page.waitForTimeout(800);
const mapState = await page.evaluate(() => window.TTM.state());
console.log('after START:', JSON.stringify(mapState));
await page.screenshot({ path: shots + '/live-map.png' });

await browser.close();
if (errors.length || res.status() !== 200 || !state || state.screen !== 'title' || mapState.screen !== 'map' || !sw) {
  console.error('LIVE CHECK FAILED\n' + errors.join('\n'));
  process.exit(1);
}
console.log('LIVE CHECK OK');
