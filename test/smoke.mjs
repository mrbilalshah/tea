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

// portrait phones get a rotate prompt (game paused, no errors)
const portrait = await browser.newPage({ viewport: { width: 500, height: 800 } });
portrait.on('pageerror', e => errors.push('portrait pageerror: ' + e.message));
await portrait.goto('file://' + root + '/index.html');
await portrait.waitForTimeout(800);
await portrait.screenshot({ path: shots + '/portrait.png' });
await portrait.close();

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
