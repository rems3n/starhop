// The assistant with no API key (instant path only): node scripts/final/assistant-nokey.mjs [outDir]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'scripts/final/out';
mkdirSync(out, { recursive: true });
const env = { ...process.env, PORT: '4994' };
delete env.ANTHROPIC_API_KEY;
const server = spawn('node', ['scripts/serve.mjs', 'dist'], { env, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', protocolTimeout: 120000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${detail}` : ''}`); if (!ok) fails++; };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 820, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('starhop.settings.v1', JSON.stringify({ state: { locationChosen: true }, version: 1 })));
  await page.goto('http://localhost:4994/#/sky', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__explore);
  await page.evaluate(() => window.__explore.setTime(new Date('2026-11-12T00:00:00Z')));
  await page.click('.ch-launch');
  await page.waitForSelector('.ch-input');
  const ask = async (text) => {
    const before = await page.$$eval('.ch-msg--assistant', (els) => els.length);
    await page.type('.ch-input', text);
    await page.keyboard.press('Enter');
    await page.waitForFunction((b) => document.querySelectorAll('.ch-msg--assistant').length > b && !document.querySelector('.ch-typing'), { timeout: 30000 }, before);
    await sleep(1500);
    return page.$$eval('.ch-msg--assistant', (els) => els.at(-1).querySelector('.ch-bubble').textContent);
  };
  const hash = () => page.evaluate(() => decodeURIComponent(location.hash).slice(1));
  let r = await ask('show me the cats eye nebula');
  check('"show me the cats eye nebula"', (await hash()).includes('dso:NGC6543') && /Cat's Eye Nebula/.test(r), r);
  r = await ask('show me a photo of the cats eye nebula');
  await sleep(800);
  check('"show me a photo of the cats eye nebula" opens the photo', !!(await page.$('.obj-lightbox')) && /opened its photo/.test(r), r);
  await page.screenshot({ path: `${out}/nokey-photo.png` });
  await page.keyboard.press('Escape');
  await sleep(300);
  if (await page.$('.obj-lightbox')) await page.click('.obj-lightbox');
  for (const [q, re] of [
    ['what is the orion nebula?', /Orion Nebula: .*nebula.*tonight/i],
    ['when can I see Saturn?', /Saturn tonight from Brooklyn/],
    ['how far is the andromeda galaxy', /light-years away/],
    ['how bright is vega', /magnitude/],
    ['how do i find polaris', /Polaris|Dipper|Pointer/i],
    ['show me betelguese', /Betelgeuse/],
    ['is there a lesson on moon phases', /opened the lesson/i],
    ['what is the myth of andromeda', /opened the myth/i],
    ['hey can you bring up the ring nebula for me real quick', /took that as.*Ring Nebula/],
    ['what month is cats eye nebula directly overhead of nyc', /never passes straight overhead from Brooklyn, NY.*9 pm in early August/],
    ['why is the cats eye nebula green', /question for the full assistant/],
    ['why is the sky blue', /question for the full assistant/],
  ]) {
    r = await ask(q);
    check(`"${q}"`, re.test(r), r);
  }
  await page.screenshot({ path: `${out}/nokey-thread.png` });
} finally {
  await browser.close();
  server.kill();
}
console.log(fails ? `\n${fails} FAILED` : '\nAll no-key checks passed');
process.exit(fails ? 1 : 0);
