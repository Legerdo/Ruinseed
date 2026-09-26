// Headless screenshot + scripted interaction runner (development only). Screenshots go to tools/shots/.
// Usage: node shot.mjs jobs/sizes.json   or   node shot.mjs --q "scene=fonttest" --w 1280 --h 720 --out font.png --wait 800
// Job fields: name, page (default dev.html), q (URL query), w, h, dpr, init (script run before page scripts),
// waitFor, wait, actions[] of { type: eval | wait | waitFor | key | press | click | reload | shot }.
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const shotsDir = path.join(here, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

// CHROME_PATH overrides; otherwise the usual Chrome/Edge install locations on Windows, macOS and Linux
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'
].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error('Chrome 또는 Edge를 찾지 못했습니다. CHROME_PATH 환경 변수로 실행 파일 경로를 지정하세요.'); process.exit(1); }

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1]; i++; }
    else o._ = argv[i];
  }
  return o;
}

async function runJob(browser, job) {
  const context = await browser.newContext({ viewport: { width: job.w || 1280, height: job.h || 720 }, deviceScaleFactor: job.dpr || 1 });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || job.verbose) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  if (job.init) await page.addInitScript(job.init);
  // dev.html carries the test scenes and automation hooks; set "page": "index.html" to test the real build
  const url = pathToFileURL(path.join(root, job.page || 'dev.html')).href + (job.q ? '?' + job.q : '');
  await page.goto(url);
  await page.waitForFunction(() => window.RS_READY || window.RS_ERROR, null, { timeout: 60000 }).catch(() => logs.push('[timeout] RS_READY'));
  if (job.waitFor) await page.waitForFunction(job.waitFor, null, { timeout: job.waitForTimeout || 90000 }).catch(() => logs.push('[timeout] ' + job.waitFor));
  if (job.wait) await page.waitForTimeout(job.wait);
  const results = [];
  for (const a of job.actions || []) {
    if (a.type === 'wait') await page.waitForTimeout(a.ms);
    else if (a.type === 'waitFor') await page.waitForFunction(a.code, null, { timeout: a.timeout || 90000 }).catch(() => logs.push('[timeout] ' + a.code));
    else if (a.type === 'eval') { const r = await page.evaluate(a.code).catch((e) => 'EVAL ERROR: ' + e.message); if (r !== undefined) results.push(r); }
    else if (a.type === 'reload') { await page.reload(); await page.waitForFunction(() => window.RS_READY || window.RS_ERROR, null, { timeout: 60000 }).catch(() => logs.push('[timeout] RS_READY after reload')); }
    else if (a.type === 'key') { await page.keyboard.down(a.key); await page.waitForTimeout(a.ms || 80); await page.keyboard.up(a.key); }
    else if (a.type === 'press') { await page.keyboard.press(a.key); }
    else if (a.type === 'click') { await page.mouse.click(a.x, a.y); }
    else if (a.type === 'shot') { await page.screenshot({ path: path.join(shotsDir, a.name) }); results.push('shot ' + a.name); }
  }
  if (job.out) await page.screenshot({ path: path.join(shotsDir, job.out) });
  const err = await page.evaluate(() => window.RS_ERROR || null).catch(() => null);
  if (err) logs.push('[RS_ERROR] ' + err);
  await context.close();
  return { name: job.name || job.out, logs, results };
}

const args = parseArgs(process.argv.slice(2));
let jobs;
if (args._ && args._.endsWith('.json')) jobs = JSON.parse(fs.readFileSync(path.resolve(args._), 'utf8').replace(/^\uFEFF/, ''));
else jobs = [{ q: args.q || '', w: +(args.w || 1280), h: +(args.h || 720), out: args.out || 'shot.png', wait: +(args.wait || 800), waitFor: args.waitFor, dpr: +(args.dpr || 1) }];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
for (const job of jobs) {
  const t0 = Date.now();
  const r = await runJob(browser, job);
  console.log(`== ${r.name} (${Date.now() - t0} ms)`);
  for (const l of r.logs) console.log('   ' + l);
  for (const x of r.results) console.log('   => ' + (typeof x === 'string' ? x : JSON.stringify(x)));
}
await browser.close();
