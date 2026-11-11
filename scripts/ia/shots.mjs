// IA/course checks: screenshots + console errors + redirects. `npx vite --port 5231 --strictPort` first.
// Usage: node scripts/ia/shots.mjs [name-filter…]   → docs/shots/ia/
import fs from 'node:fs';
import { launch, openPage, settle } from '../learn/lib.mjs';

const BASE = process.env.IA_URL ?? 'http://localhost:5231/';
const OUT = 'docs/shots/ia';
fs.mkdirSync(OUT, { recursive: true });
const PLACES = {
  ny: { name: 'New York, NY', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  syd: { name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
  uio: { name: 'Quito', lat: -0.18, lon: -78.47, tz: 'America/Guayaquil' },
};
const settings = (place, chosen = true) => JSON.stringify({ state: { observer: PLACES[place], locationChosen: chosen, bortle: 6, redMode: false }, version: 1 });
/** [name, hash, { place, chosen, phone, full, act, wait }] */
const SHOTS = [
  ['learn-home', '/learn', { full: true }],
  ['learn-home-phone', '/learn', { phone: true }],
  ['module-lessons', '/learn/module/how-to-look', { full: true }],
  ['module-starhops', '/learn/module/finding-your-way', {}],
  ['module-anchors-ny', '/learn/module/first-constellations', { full: true }],
  ['module-anchors-syd', '/learn/module/first-constellations', { place: 'syd', full: true }],
  ['module-anchors-uio', '/learn/module/first-constellations', { place: 'uio', full: true }],
  ['module-seasons-syd', '/learn/module/season-by-season', { place: 'syd' }],
  ['module-beyond-ny', '/learn/module/beyond-your-horizon', {}],
  ['lesson-header', '/learn/lesson/hand-angles?s=1', { wait: 2500 }],
  ['lesson-header-phone', '/learn/lesson/hand-angles', { phone: true, wait: 2500 }],
  ['tonight', '/tonight', { wait: 2500 }],
  ['tonight-phone', '/tonight', { phone: true, wait: 2500 }],
  ['month-syd', '/tonight/month/1', { place: 'syd', wait: 2500 }],
  ['calendar-syd', '/tonight/calendar', { place: 'syd', wait: 3000 }],
  ['settings', '/learn', { act: async (p) => p.click('.st-trigger') }],
  ['settings-phone', '/learn', { phone: true, act: async (p) => p.click('.st-trigger') }],
  ['first-run', '/learn', { chosen: false }],
  ['first-run-phone', '/sky', { chosen: false, phone: true, wait: 2500 }],
  ['sky-phone', '/sky', { phone: true, wait: 3000 }],
  ['sky', '/sky', { wait: 3000 }],
];
const REDIRECTS = [
  ['/explore?target=con:Ori&t=2026-01-01T03:00:00.000Z', '/sky?target=con:Ori&t=2026-01-01T03:00:00.000Z'],
  ['/learn/tonight', '/tonight'], ['/learn/month/3', '/tonight/month/3'], ['/learn/month', '/tonight/month'], ['/learn/calendar', '/tonight/calendar'],
  ['/learn/events', '/tonight/events'], ['/learn/constellations', '/library/constellations'], ['/learn/constellation/Ori', '/library/constellation/Ori'],
  ['/learn/objects', '/library/objects'], ['/learn/object/dso%3AM42', '/library/object/dso%3AM42'], ['/learn/signposts', '/library/asterisms'],
  ['/learn/signpost/big-dipper', '/library/asterism/big-dipper'], ['/learn/lessons', '/learn'], ['/learn/unit/anchor-north', '/learn'],
  ['/quiz', '/practice'], ['/quiz/find?con=Ori', '/practice/find?con=Ori'], ['/quiz/unit/anchor-north', '/practice'], ['/quiz/lesson/hand-angles', '/practice/lesson/hand-angles'],
  ['/progress', '/practice/progress'], ['/', '/sky'],
];

const filters = process.argv.slice(2);
const browser = await launch();
let failed = 0;
if (!filters.length || filters.includes('redirects')) {
  const { page } = await openPage(browser);
  await page.evaluateOnNewDocument((s) => localStorage.setItem('starhop.settings.v1', s), settings('ny'));
  for (const [from, to] of REDIRECTS) {
    await page.goto(`${BASE}#${from}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((to) => decodeURIComponent(location.hash) === decodeURIComponent(`#${to}`), { timeout: 8000 }).catch(() => {});
    const got = await page.evaluate(() => location.hash.slice(1));
    const ok = decodeURIComponent(got) === decodeURIComponent(to);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} redirect ${from} → ${got}`);
  }
  await page.close();
}
for (const [name, hash, o] of SHOTS) {
  if (filters.length && !filters.some((f) => name.includes(f))) continue;
  const { page, errors } = await openPage(browser, o.phone ? { width: 390, height: 844 } : { width: 1366, height: 860 });
  await page.evaluateOnNewDocument((s) => localStorage.setItem('starhop.settings.v1', s), settings(o.place ?? 'ny', o.chosen ?? true));
  try {
    await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-main *', { timeout: 30000 });
    await settle(page, o.wait ?? 1200);
    if (o.act) { await o.act(page); await settle(page, 400); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (o.full) {
      const h = await page.evaluate(() => document.querySelector('.app-main').scrollHeight + 60);
      await page.setViewport({ width: o.phone ? 390 : 1366, height: Math.min(h, 6000), deviceScaleFactor: 1 });
      await settle(page, 300);
    }
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const bad = errors.length || overflow;
    if (bad) failed++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${name}${overflow ? ' horizontal overflow' : ''}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
