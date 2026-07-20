// Drives every stage via the window.TTM debug API: asserts win AND fail paths.
// Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/playthrough.mjs
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'test/screenshots');
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ok  ' : '  FAIL') + ' - ' + name + (detail ? '  [' + detail + ']' : ''));
  if (!ok) failures++;
}
async function state() { return page.evaluate(() => window.TTM.state()); }
async function shot(name) { await page.screenshot({ path: shots + '/' + name + '.png' }); }
async function waitResult(timeoutMs = 12000) {
  await page.waitForFunction(() => window.TTM.state().phase === 'result', null, { timeout: timeoutMs });
  return state();
}
async function runStage(id, name, params, expectWin, shotPrefix, midShotAt, timeoutMs) {
  await page.evaluate(id => window.TTM.goto(id), id);
  await page.waitForTimeout(300);
  if (params) await page.evaluate(p => window.TTM.setParams(p), params);
  await page.waitForTimeout(200);
  if (shotPrefix) await shot(shotPrefix + '-build');
  await page.evaluate(() => window.TTM.pressRun());
  if (midShotAt) { await page.waitForTimeout(midShotAt); if (shotPrefix) await shot(shotPrefix + '-running'); }
  const s = await waitResult(timeoutMs || 20000);
  if (shotPrefix) await shot(shotPrefix + '-result');
  check(name, s.result && s.result.win === expectWin, JSON.stringify(s.result && s.result.title));
  return s;
}

await page.goto('file://' + root + '/index.html');
await page.waitForTimeout(800);

// ---------- Stage 1: gears ----------
console.log('Stage 1 — Gear Grinder');
await runStage('gears', 'win with 16-back/24-front', { a: 16, b: 24 }, true, 'stage1', 2000);
await page.evaluate(() => window.TTM.continue_());
await page.waitForTimeout(400);
check('concept card shows', (await state()).screen === 'concept');
await shot('stage1-concept');
await runStage('gears', 'fail: too fast jams (8-back/24-front)', { a: 8, b: 24 }, false, 'stage1-jam', 1800);
await runStage('gears', 'fail: too slow (32-back/8-front)', { a: 32, b: 8 }, false);
await runStage('gears', 'fail: missing gear', { a: 16, b: null }, false);
check('unlocked stage 2', (await state()).unlocked >= 2);

// drag-and-drop through real pointer events
console.log('Stage 1 — real mouse drag');
await page.evaluate(() => { window.TTM.goto('gears'); window.TTM.setParams({}); });
await page.waitForTimeout(300);
const geom = await page.evaluate(() => {
  const s = window.TTM.Game.screen;
  const c = document.querySelector('canvas').getBoundingClientRect();
  const scale = c.width / 960 / (window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio || 1);
  const sc = c.width / 960 / (window.innerWidth ? 1 : 1);
  // logical->client transform: client = rect.left + logical * (rect.width/960)
  const k = c.width / 960;
  const toClient = (x, y) => ({ x: c.left + x * (c.width / 960) * (960 / 960), y: c.top + y * (c.height / 600) });
  const g16 = s.gears.find(g => g.teeth === 16).home;
  const g24 = s.gears.find(g => g.teeth === 24).home;
  return {
    g16: toClient(g16.x, g16.y), g24: toClient(g24.x, g24.y),
    slotA: toClient(s.slotA.x, s.slotA.y), slotB: toClient(s.slotB.x, s.slotB.y)
  };
});
async function dragTo(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}
await dragTo(geom.g16, geom.slotA);
await dragTo(geom.g24, geom.slotB);
const placed = await page.evaluate(() => {
  const s = window.TTM.Game.screen;
  const a = s.gears.find(g => g.loc === 'a'), b = s.gears.find(g => g.loc === 'b');
  return { a: a && a.teeth, b: b && b.teeth };
});
check('mouse drag placed gears', placed.a === 16 && placed.b === 24, JSON.stringify(placed));

// ---------- Stage 2: screw ----------
console.log('Stage 2 — Screw Lift');
await runStage('screw', 'win 45°/medium/×2', { tilt: 45, pitch: 1, speed: 2 }, true, 'stage2', 3000);
await runStage('screw', 'fail: too shallow misses pot', { tilt: 30, pitch: 1, speed: 2 }, false, 'stage2-miss', 3000);
await runStage('screw', 'fail: fast+wide is messy', { tilt: 45, pitch: 2, speed: 3 }, false);
await runStage('screw', 'fail: too slow', { tilt: 45, pitch: 0, speed: 0.5 }, false, null, null, 20000);
check('unlocked stage 3', (await state()).unlocked >= 3);

// ---------- persistence ----------
console.log('Persistence');
await page.reload();
await page.waitForTimeout(800);
check('progress survives reload', (await state()).unlocked >= 2);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
if (errors.length || failures) { console.error('PLAYTHROUGH FAILED'); process.exit(1); }
console.log('PLAYTHROUGH OK');
