// Screenshots of Learn pages into docs/shots/learn. Usage: node scripts/learn/shots.mjs [name-filter…]
import fs from 'node:fs';
import { BASE, launch, openPage, settle } from './lib.mjs';

const OUT = 'docs/shots/learn';
fs.mkdirSync(OUT, { recursive: true });
const click = (text, sel = 'button') => async (page) => {
  await page.evaluate((text, sel) => [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(text))?.click(), text, sel);
};
/** [name, hash, { sky, phone, full, act }] */
const SHOTS = [
  ['home', '/learn', { full: true }],
  ['unit', '/learn/unit/anchor-north', {}],
  ['lessons', '/learn/lessons', {}],
  ['lesson-hand-angles', '/learn/lesson/hand-angles?s=1', { sky: true }],
  ['lesson-nightly-rotation', '/learn/lesson/nightly-rotation?s=0', { sky: true, wait: 1500 }],
  ['lesson-latitude', '/learn/lesson/latitude?s=1', { sky: true }],
  ['lesson-questions', '/learn/lesson/hand-angles?s=4', { act: click('Your little finger', '.mcq-choice') }],
  ['lesson-examples', '/learn/lesson/star-clusters?s=4', { sky: true }],
  ['tonight', '/learn/tonight', { sky: true }],
  ['month-index', '/learn/month', {}],
  ['month', '/learn/month/1', { sky: true, full: true }],
  ['calendar', '/learn/calendar', { wait: 1500 }],
  ['signposts', '/learn/signposts', {}],
  ['signpost-hop', '/learn/signpost/big-dipper', { sky: true, act: click('Pointers to Polaris', '.ln-hop'), wait: 1200 }],
  ['events', '/learn/events', { wait: 2500, act: click('Show', '.ln-event button'), sky: false }],
  ['constellations', '/learn/constellations', {}],
  ['constellation-orion', '/learn/constellation/Ori', { sky: true, full: true, act: click('Read the story') }],
  ['constellation-modern', '/learn/constellation/Sex', { sky: true, full: true }],
  ['constellation-missing', '/learn/constellation/Oct', { sky: true }],
  ['objects', '/learn/objects', {}],
  ['object', `/learn/object/${encodeURIComponent('dso:M42')}`, { sky: true, full: true }],
  ['phone-lesson', '/learn/lesson/hand-angles?s=1', { sky: true, phone: true }],
  ['phone-constellation', '/learn/constellation/Ori', { sky: true, phone: true }],
  ['phone-home', '/learn', { phone: true }],
  ['phone-lesson-text', '/learn/lesson/hand-angles?s=1', { sky: true, phone: true, act: async (page) => page.evaluate(() => document.querySelector('.app-main').scrollTo(0, 700)) }],
  ['phone-constellation-stories', '/learn/constellation/Ori', { sky: true, phone: true, act: async (page) => page.evaluate(() => document.querySelector('.ln-story').scrollIntoView()) }],
  ['phone-calendar', '/learn/calendar', { phone: true, wait: 1500 }],
];

const filters = process.argv.slice(2);
const browser = await launch();
let failed = 0;
for (const [name, hash, o] of SHOTS) {
  if (filters.length && !filters.some((f) => name.includes(f))) continue;
  const { page, errors } = await openPage(browser, o.phone ? { width: 390, height: 844 } : {});
  try {
    await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' });
    if (o.sky) await page.waitForFunction('!!window.__learnSky', { timeout: 60000 });
    else await page.waitForSelector('.ln-page', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page, o.wait ?? 900);
    if (o.act) {
      await o.act(page);
      await settle(page, o.wait ?? 700);
    }
    if (o.full) {
      // the app scrolls inside .app-main; grow the viewport so the whole page is captured
      const h = await page.evaluate(() => document.querySelector('.app-main').scrollHeight + 60);
      await page.setViewport({ width: o.phone ? 390 : 1360, height: Math.min(Math.max(h, 844), 6000), deviceScaleFactor: 1 });
      await settle(page, 600);
    }
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const overflow = await page.evaluate(() => document.querySelector('.app-main').scrollWidth - document.querySelector('.app-main').clientWidth);
    console.log(`${name}: ok${overflow > 1 ? ` (horizontal overflow ${overflow}px)` : ''}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`);
    if (errors.length) failed++;
  } catch (e) {
    failed++;
    console.log(`${name}: FAILED ${e.message}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
