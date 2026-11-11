// Headless walk through Explore mode. Start the dev server first: `npx vite --port 5201 --strictPort`
// Usage: node scripts/explore/check.mjs [only-step-substring]
// Writes screenshots to docs/shots/explore/ and exits non-zero on a failed assertion or any console error.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.EXPLORE_URL ?? 'http://localhost:5201/';
const OUT = 'docs/shots/explore';
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(hash = '#/explore', { width = 1280, height = 800, mobile = false, storage } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    if (/favicon\.ico/.test(url)) return;
    errors.push(`${m.text()} ${url}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // A fixed evening so the screenshots are repeatable: 9 pm in Brooklyn, 10 Nov 2026, clock paused.
  await page.evaluateOnNewDocument((storage) => {
    localStorage.clear();
    if (storage) localStorage.setItem('starhop.settings.v1', storage);
  }, storage ?? null);
  await page.goto(BASE + hash, { waitUntil: 'networkidle0' });
  await page.waitForFunction('!!window.__explore', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { window.__explore.setTimeRate(0); window.__explore.setTime(new Date('2026-11-11T02:00:00Z')); });
  await sleep(1500);
  return page;
}
const shot = async (page, name) => { await sleep(350); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  shot ${name}.png`); };
const text = (page, sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
const clickText = async (page, sel, t) => {
  const ok = await page.evaluate((sel, t) => { const el = [...document.querySelectorAll(sel)].find((e) => (e.innerText || e.getAttribute('aria-label') || '').includes(t)); if (el) el.click(); return !!el; }, sel, t);
  if (!ok) failures.push(`click: no ${sel} with "${t}"`);
  await sleep(250);
};
const search = async (page, q) => {
  await page.keyboard.press('/');
  await page.keyboard.type(q, { delay: 15 });
  await sleep(300);
};
const pick = async (page, q) => { await search(page, q); await page.keyboard.press('Enter'); await sleep(1300); };
const step = async (name, fn) => { if (only && !name.includes(only)) return; console.log(name); try { await fn(); } catch (e) { failures.push(`${name}: ${e.message}`); console.log('  ERROR', e.message); } };

await step('desktop', async () => {
  const page = await open();
  check((await text(page, '.ex-time-clock')).includes('9:00 PM'), 'time bar shows 9:00 PM local');
  check(/Looking S, 32° up/.test(await text(page, '.ex-readout')), 'readout says where the view points');
  await shot(page, '01-first-load');

  await search(page, 'Orion Nebula');
  check((await text(page, '.ex-search-results')).includes('Orion Nebula'), 'search lists the Orion Nebula');
  await shot(page, '02-search-results');
  await page.keyboard.press('Enter');
  await sleep(1300);
  check((await text(page, '.obj-title')) === 'Orion Nebula', 'Enter selects the Orion Nebula');
  check(page.url().includes('target=dso%3AM42'), 'URL carries the selection');
  await shot(page, '03-search-selected-m42');

  await pick(page, 'Betelgeuse');
  const star = await text(page, '.ex-info');
  check(/Red supergiant star/.test(star) && /Orion/.test(star), 'star panel: kind in plain words + constellation');
  check(/How to find it/.test(star) && /When it is visible/.test(star) && /What you need/.test(star), 'star panel has all sections');
  await shot(page, '04-info-star-betelgeuse');
  await page.$eval('.ex-info-body', (e) => e.scrollTo(0, e.scrollHeight));
  await shot(page, '04b-info-star-scrolled');

  await pick(page, 'M13');
  const dso = await text(page, '.ex-info');
  check(/Globular cluster/.test(dso) && /Binoculars/.test(dso), 'DSO panel: type + equipment');
  check(await page.$('.obj-vis-strip li.is-current') !== null, 'year strip marks the current month');
  await shot(page, '05-info-dso-m13');
  await page.$eval('.ex-info-body', (e) => e.scrollTo(0, e.scrollHeight));
  await shot(page, '05b-info-dso-scrolled');
  if (await page.$('.obj-thumb-btn')) {
    await page.click('.obj-thumb-btn');
    await sleep(600);
    check(/Photograph|False colour|Artist|Simulation/.test(await text(page, '.obj-lightbox')) && /Licence/.test(await text(page, '.obj-lightbox')), 'lightbox shows kind badge, credit and licence');
    await shot(page, '05c-lightbox');
    await page.keyboard.press('Escape');
    await sleep(200);
    check(await page.$('.obj-lightbox') === null && await page.$('.ex-info') !== null, 'Esc closes the lightbox only');
  }

  await pick(page, 'Jupiter');
  const planet = await text(page, '.ex-info');
  check(/gas giant/.test(planet) && /AU/.test(planet) && /Phase/.test(planet), 'planet panel: phase, distance in AU');
  await shot(page, '06-info-planet-jupiter');

  await pick(page, 'Orion');
  const con = await text(page, '.ex-info');
  check(/Constellation — the Hunter/.test(con) && /Quiz me/.test(con), 'constellation panel with Quiz me');
  await shot(page, '07-info-constellation-orion');
  await page.keyboard.press('Escape');
  await sleep(200);
  check(await page.$('.ex-info') === null, 'Esc closes the info panel');

  await clickText(page, '.ex-tool', 'Layers');
  check((await page.$$('.ex-layers input[role=switch]')).length === 13, 'layers panel has a switch for all 13 layers');
  await clickText(page, '.ex-layers .switch', 'Equatorial grid');
  await clickText(page, '.ex-layers .switch', 'Boundaries');
  check(await page.evaluate(() => window.__explore.getLayers().equatorialGrid && JSON.parse(localStorage.getItem('starhop.settings.v1')).state.layers.equatorialGrid), 'layer switch reaches the engine and is saved');
  await shot(page, '08-layers-panel');
  await clickText(page, '.ex-layers .switch', 'Equatorial grid');
  await clickText(page, '.ex-layers .switch', 'Boundaries');

  await clickText(page, '.ex-tool', 'Bortle');
  const setBortle = (n) => page.$eval('.ex-light .slider', (el, n) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(n)); el.dispatchEvent(new Event('input', { bubbles: true })); }, n);
  const count = async () => Number(((await text(page, '.ex-light-count')).match(/([\d,]+) stars/) ?? [])[1]?.replace(/,/g, ''));
  await setBortle(9); await sleep(900);
  const n9 = await count();
  check(Math.abs(await page.evaluate(() => window.__explore.getLimitingMag()) - 3.8) < 1e-6, 'Bortle 9 sets limiting magnitude 3.8');
  await shot(page, '09-bortle-9');
  await clickText(page, '.ex-light .btn', 'Compare');
  await sleep(1500);
  const n2 = await count();
  check(/Bortle 2/.test(await text(page, '.ex-light-head')) && n2 > n9 * 8, `compare flips to Bortle 2 (${n9} → ${n2} stars)`);
  await shot(page, '10-bortle-2');
  await clickText(page, '.ex-light .btn', 'Back to Bortle 9');
  check(/Bortle 9/.test(await text(page, '.ex-light-head')), 'compare flips back');
  await setBortle(6);
  await clickText(page, '.ex-tool', 'Bortle');

  await page.select('.ex-time-unit select', 'month');
  await page.click('.ex-time [aria-label="Forward one month"]');
  await sleep(700);
  const clock = await text(page, '.ex-time-clock');
  check(/9:00 PM/.test(clock) && /Dec 10, 2026/.test(clock), `month step keeps the clock time (${clock.replace(/\n/g, ' ')})`);
  await page.click('.ex-time [aria-label="Faster"]');
  check(/1 minute per second/.test(await text(page, '.ex-time-rate')), 'faster → 1 minute per second');
  await sleep(1200);
  check(await page.evaluate(() => window.__explore.getTimeRate()) === 60, 'engine runs at 60×');
  await page.click('.ex-time [aria-label="Pause"]');
  check(await page.evaluate(() => window.__explore.getTimeRate()) === 0 && /Paused/.test(await text(page, '.ex-time-rate')), 'pause stops the clock');
  await shot(page, '11-time-after-month-step');
  await page.click('.ex-time-clock');
  await sleep(300);
  await shot(page, '11b-time-picker');
  await page.keyboard.press('Escape');

  await page.click('.ex-view [aria-label="Face east"]');
  await sleep(500);
  check(/Looking E,/.test(await text(page, '.ex-readout')), 'face east');
  await page.click('.ex-view [aria-label="Controls help"]');
  await shot(page, '12-help');
  await page.keyboard.press('Escape');

  await clickText(page, '.ex-tool', 'Brooklyn');
  await sleep(300);
  await page.type('.ex-loc input[type=search]', 'trom');
  await sleep(200);
  check((await text(page, '.ex-loc-list')).includes('Tromsø'), 'city search finds Tromsø without the ø');
  await shot(page, '13-location-dialog');
  await clickText(page, '.ex-loc-city', 'Tromsø');
  await sleep(800);
  check((await text(page, '.ex-tools')).includes('Tromsø') && Math.abs(await page.evaluate(() => window.__explore.getObserver().lat) - 69.6492) < 1e-3, 'location saved and sent to the engine');
  await page.close();
});

await step('deeplink', async () => {
  const page = await open('#/explore?target=dso:M31&fps=1');
  await sleep(1200);
  check((await text(page, '.obj-title')) === 'Andromeda Galaxy', '?target=dso:M31 selects the Andromeda Galaxy');
  await page.click('.ex-info [aria-label="Centre in the sky"]');
  await sleep(1200);
  const p = await page.evaluate(() => { const c = window.__explore; const s = c.getSize(); const q = c.project(10.6848, 41.2691); return [q.x / s.width, q.y / s.height]; });
  check(Math.abs(p[0] - 0.5) < 0.05 && Math.abs(p[1] - 0.5) < 0.05, 'and centres it');
  check(/Needs a dark sky/.test(await text(page, '.ex-info')), 'large galaxy carries the dark-sky caveat');
  check(/fps/.test(await text(page, '.ex-readout')), '?fps=1 shows the frame rate');
  await shot(page, '14-deeplink-m31');
  // below the horizon → hint
  await pick(page, 'Antares');
  check(/below the horizon/.test(await text(page, '.ex-hint')), 'below-horizon hint appears for Antares in November');
  await shot(page, '15-below-horizon-hint');
  await page.close();
});

await step('phone', async () => {
  const page = await open('#/explore', { width: 390, height: 844, mobile: true });
  await shot(page, '20-phone-first-load');
  await page.evaluate(() => { location.hash = '#/explore?target=star:Vega'; });
  await sleep(1500);
  check((await text(page, '.obj-title')) === 'Vega', 'phone: target selected');
  await shot(page, '21-phone-info-peek');
  await clickText(page, '.ex-info-grip', 'Show details');
  await sleep(300);
  const r = await page.$eval('.ex-info', (e) => e.getBoundingClientRect().height / window.innerHeight);
  check(r > 0.3 && r < 0.66, `phone: sheet leaves the sky visible (${(r * 100).toFixed(0)}% of the screen)`);
  await shot(page, '22-phone-info-sheet');
  await page.$eval('.ex-info-body', (e) => e.scrollTo(0, 520));
  await shot(page, '22b-phone-info-sheet-scrolled');
  await page.click('.ex-info [aria-label="Close"]');
  await page.click('.ex-time-more');
  await shot(page, '23-phone-time-more');
  await page.click('.ex-time-more');
  await clickText(page, '.ex-tool', 'Layers');
  await shot(page, '24-phone-layers');
  await clickText(page, '.ex-tool', 'Layers');
  await clickText(page, '.ex-tool', 'Brooklyn');
  await sleep(300);
  await shot(page, '25-phone-location');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, 'phone: no horizontal overflow');
  await page.close();
});

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? ':\n    ' + [...new Set(errors)].join('\n    ') : ''}`);
if (failures.length) { console.log(`\n${failures.length} FAILED`); process.exit(1); }
console.log('\nAll Explore checks passed.');
