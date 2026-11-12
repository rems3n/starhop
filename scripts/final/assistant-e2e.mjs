// End-to-end check of the assistant against a scripted stand-in for the model API.
//   npm run build && node scripts/final/assistant-e2e.mjs [outDir]
// Starts the mock upstream, the real server (scripts/serve.mjs) and a headless browser.
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'scripts/final/out';
mkdirSync(out, { recursive: true });
const seen = [];
let n = 0;
const tool = (name, input) => ({ type: 'tool_use', id: `toolu_${++n}`, name, input });
const say = (text) => ({ type: 'text', text });

function script(body) {
  const last = body.messages.at(-1);
  const text = last.content.find((b) => b.type === 'text')?.text?.toLowerCase() ?? '';
  const results = last.content.filter((b) => b.type === 'tool_result').map((b) => JSON.parse(b.content));
  if (results.length) {
    const search = results.find((r) => r.results);
    if (search) return [tool('app_open', { path: search.results[0].path })];
    const shown = results.find((r) => r.shown);
    return [say(shown ? `Here is ${shown.shown}, ${shown.where}.` : 'Done.')];
  }
  if (text.includes('seven sisters')) return [tool('sky_show', { target: 'Pleiades' }), tool('sky_set_layers', { constellation_figures: true })];
  if (text.includes('no, i meant')) return [tool('sky_show', { target: 'Alcyone' })];
  if (text.includes('sydney')) return [tool('sky_set_location', { city: 'Sydney' }), tool('sky_set_time', { time: '2026-12-25T22:00' })];
  if (text.includes('lesson')) return [tool('app_search', { query: 'moon phases' })];
  if (text.includes('nonsense')) return [tool('sky_show', { target: 'zzzzqqq' })];
  return [say('I can help with the sky.')];
}

const mock = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw);
    seen.push({ headers: req.headers, body });
    const content = script(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ content, stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn' }));
  });
}).listen(4996);

const server = spawn('node', ['scripts/serve.mjs', 'dist'], { env: { ...process.env, PORT: '4995', ANTHROPIC_API_KEY: 'test-key', STARHOP_AI_PER_MINUTE: '500', STARHOP_AI_BASE_URL: 'http://localhost:4996' }, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', protocolTimeout: 120000, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const fails = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(viewport, tag) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => localStorage.setItem('starhop.settings.v1', JSON.stringify({ state: { locationChosen: true }, version: 1 })));
  await page.goto('http://localhost:4995/#/library', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ch-launch');
  await page.screenshot({ path: `${out}/assistant-${tag}-closed.png` });
  await page.click('.ch-launch');
  await page.waitForSelector('.ch-input');
  await page.screenshot({ path: `${out}/assistant-${tag}-empty.png` });
  const ask = async (text) => {
    const before = await page.$$eval('.ch-msg--assistant', (els) => els.length);
    await page.type('.ch-input', text);
    await page.keyboard.press('Enter');
    await page.waitForFunction((b) => document.querySelectorAll('.ch-msg--assistant').length > b && !document.querySelector('.ch-typing'), { timeout: 30000 }, before);
    await sleep(1800);
    return page.$$eval('.ch-msg--assistant', (els) => ({ text: els.at(-1).querySelector('.ch-bubble').textContent, actions: [...els.at(-1).querySelectorAll('.ch-actions li')].map((l) => l.textContent) }));
  };
  const layers = () => page.evaluate(() => JSON.parse(localStorage.getItem('starhop.settings.v1')).state.layers);
  const hash = () => page.evaluate(() => decodeURIComponent(location.hash).slice(1));
  const centre = () => page.evaluate(() => { const c = window.__explore; const s = c.getSize(); return c.unproject(s.width / 2, s.height / 2); });
  const calls0 = seen.length;

  // instant path, from a non-sky page. Pin the map clock (7 pm on 11 Nov in Brooklyn) so the run is repeatable.
  await page.goto('http://localhost:4995/#/sky', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__explore);
  await page.evaluate(() => { window.__explore.setTime(new Date('2026-11-12T00:00:00Z')); });
  let r = await ask('show me orion');
  check(`${tag}: "show me orion" selects Orion`, (await hash()).includes('target=con:Ori'), await hash());
  const c = await centre();
  check(`${tag}: view is centred on Orion`, c && Math.abs(c.ra - 83) < 12 && Math.abs(c.dec - 2) < 12, JSON.stringify(c));
  check(`${tag}: reply names Orion`, /Orion/.test(r.text) && r.actions.some((a) => a.includes('Orion')), r.text);

  check(`${tag}: Orion was below the horizon, so the clock moved and a notice says so`, /moved the clock/.test(r.text) && (await page.$eval('.ex-notice', (e) => e.textContent)).includes('Showing tonight at'), r.text);
  const alt = await page.evaluate(() => window.__explore.getView().lat);
  check(`${tag}: Orion is now above the horizon`, alt > 20, `alt ${alt}`);
  await page.screenshot({ path: `${out}/assistant-${tag}-orion.png` });
  r = await ask('show me crux');
  const atlas = await page.evaluate(() => ({ v: window.__explore.getView().mount, ground: window.__explore.getLayers().ground, notice: document.querySelector('.ex-notice')?.textContent, bar: !!document.querySelector('.ex-atlas-note'), pressed: document.querySelector('.ex-mode [aria-pressed=true]')?.textContent }));
  check(`${tag}: Crux never rises here, so the map switches to the atlas`, atlas.v === 'equatorial' && atlas.ground === false && atlas.bar && atlas.pressed === 'Atlas' && /never rises/.test(atlas.notice ?? ''), JSON.stringify(atlas));
  await page.screenshot({ path: `${out}/assistant-${tag}-atlas.png` });
  await page.click('.ch-undo');
  await sleep(700);
  const back = await page.evaluate(() => ({ v: window.__explore.getView().mount, ground: window.__explore.getLayers().ground, pressed: document.querySelector('.ex-mode [aria-pressed=true]')?.textContent }));
  check(`${tag}: Undo returns to the live sky`, back.v === 'altaz' && back.ground === true && back.pressed === 'Live sky', JSON.stringify(back));
  r = await ask('turn off lines');
  check(`${tag}: "turn off lines" turns the layer off`, (await layers()).constellationLines === false, r.text);
  check(`${tag}: no model call for plain commands`, seen.length === calls0);
  await page.click('.ch-undo');
  await sleep(400);
  check(`${tag}: Undo turns lines back on`, (await layers()).constellationLines === true);

  // model path
  r = await ask('show me the seven sisters with pictures');
  check(`${tag}: model request selects the Pleiades and turns figures on`, (await hash()).includes('target=dso:M45') && (await layers()).constellationArt === true, `${await hash()} ${r.text}`);
  check(`${tag}: two actions listed`, r.actions.length === 2, r.actions.join(' | '));
  r = await ask('no, I meant the star Alcyone');
  check(`${tag}: correction re-targets to Alcyone`, /target=star:/.test(await hash()) && /Alcyone/.test(r.text), `${await hash()} ${r.text}`);
  const corr = seen.at(-1).body;
  check(`${tag}: correction request carries the earlier turns and local commands`, JSON.stringify(corr.messages).includes('seven sisters') && JSON.stringify(corr.messages).includes('local_'));
  check(`${tag}: request carries context, tools and the key`, /map_time/.test(corr.system.at(-1).text) && corr.tools.length === 10 && seen.at(-1).headers['x-api-key'] === 'test-key');

  const offsetBefore = await page.evaluate(() => window.__explore.getTime().getTime() - Date.now());
  r = await ask('show the sky from sydney at christmas');
  const st = await page.evaluate(() => ({ obs: JSON.parse(localStorage.getItem('starhop.settings.v1')).state.observer, t: window.__explore.getTime().toISOString(), rate: window.__explore.getTimeRate() }));
  check(`${tag}: location and time change together`, st.obs.name.startsWith('Sydney') && st.t.startsWith('2026-12-25T11:00') && st.rate === 0, JSON.stringify(st));
  await page.click('.ch-undo');
  await sleep(600);
  const st2 = await page.evaluate(() => ({ obs: JSON.parse(localStorage.getItem('starhop.settings.v1')).state.observer.name, rate: window.__explore.getTimeRate(), dt: window.__explore.getTime().getTime() - Date.now() }));
  check(`${tag}: Undo restores location and the live clock`, st2.obs.startsWith('Brooklyn') && st2.rate === 1 && Math.abs(st2.dt - offsetBefore) < 5000, JSON.stringify(st2));

  r = await ask('is there a lesson on moon phases');
  check(`${tag}: finds and opens a lesson`, (await hash()).startsWith('/learn/lesson/'), await hash());
  r = await ask('nonsense object please');
  check(`${tag}: unknown object is reported, not invented`, r.actions.length === 0, r.text);
  await page.screenshot({ path: `${out}/assistant-${tag}-thread.png` });
  check(`${tag}: no page errors`, errors.length === 0, errors.join('; '));
  await page.close();
}

try {
  await run({ width: 1360, height: 820, deviceScaleFactor: 1 }, 'desktop');
  await run({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'phone');
  // endpoint guards
  const bad = await fetch('http://localhost:4995/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'system', content: 'x' }] }) });
  check('server rejects a forged conversation', bad.status === 400);
  const status = await (await fetch('http://localhost:4995/api/chat/status')).json();
  check('status reports enabled', status.enabled === true);
} finally {
  await browser.close();
  server.kill();
  mock.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nAll assistant checks passed');
process.exit(fails.length ? 1 : 0);
