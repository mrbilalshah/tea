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
