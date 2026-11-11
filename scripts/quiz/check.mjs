// Headless walk through every quiz screen. Start the dev server first:
//   npx vite --port 5203 --strictPort      then      node scripts/quiz/check.mjs
// Writes screenshots to docs/shots/quiz/ and exits non-zero on any failed expectation or console error.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QUIZ_URL ?? 'http://localhost:5203/';
const OUT = 'docs/shots/quiz';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const fails = [];
const expect = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function newPage(width, height, touch = false) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/favicon\.ico/.test(m.location()?.url ?? '')) return;
    errors.push(`${m.text()} ${m.location()?.url ?? ''}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewport({ width, height, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  return page;
}
async function go(page, route) {
  await page.goto('about:blank');
  await page.goto(`${BASE}?debug=1#${route}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(350);
}
const shot = async (page, name) => { await sleep(300); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const q = (page) => page.evaluate(() => window.__quizQ && JSON.parse(JSON.stringify(window.__quizQ)));
const feedback = (page) => page.$eval('[data-testid="feedback"]', (el) => el.dataset.correct).catch(() => null);
const waitSky = (page) => page.waitForFunction('window.__quizSky && window.__quizSky.getSize().width > 10', { timeout: 60000 });
const text = (page, sel) => page.$eval(sel, (el) => el.textContent).catch(() => null);
const click = async (page, sel) => { await page.waitForSelector(sel, { timeout: 15000 }); await page.click(sel); };

/** Screen-space loop for the current find-it target (padded convex hull of its main stars), or a decoy loop elsewhere. */
async function loopFor(page, conId, decoy) {
  return page.evaluate(async (conId, decoy) => {
    const [cons, stars] = await Promise.all([fetch('data/constellations.json').then((r) => r.json()), fetch('data/stars.json').then((r) => r.json())]);
    const c = window.__quizSky;
    const con = cons.find((x) => x.id === conId);
    const byId = new Map(stars.map((s) => [s.id, s]));
    const canvas = [...document.querySelectorAll('.qz-sky canvas')].pop();
    const rect = canvas.getBoundingClientRect();
    const pts = con.mainStars.map((id) => byId.get(id)).filter(Boolean).map((s) => c.project(s.ra, s.dec));
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    let loop;
    if (decoy) {
      const spots = [[0.14, 0.5], [0.86, 0.5], [0.2, 0.62], [0.8, 0.62], [0.5, 0.6]].map(([fx, fy]) => ({ x: rect.width * fx, y: rect.height * fy }));
      const far = spots.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy))[0];
      loop = Array.from({ length: 24 }, (_, i) => ({ x: far.x + 45 * Math.cos((i / 24) * 6.283), y: far.y + 45 * Math.sin((i / 24) * 6.283) }));
    } else {
      // convex hull (monotone chain), pushed outward from the centroid
      const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower = [], upper = [];
      for (const p of s) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
      for (const p of s.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
      const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      loop = [];
      const grown = hull.map((p) => { const d = Math.hypot(p.x - cx, p.y - cy) || 1; return { x: p.x + ((p.x - cx) / d) * 22, y: p.y + ((p.y - cy) / d) * 22 }; });
      for (let i = 0; i < grown.length; i++) {
        const a = grown[i], b = grown[(i + 1) % grown.length];
        for (let k = 0; k < 6; k++) loop.push({ x: a.x + ((b.x - a.x) * k) / 6, y: a.y + ((b.y - a.y) * k) / 6 });
      }
    }
    const page = loop.map((p) => ({ x: Math.max(rect.left + 2, Math.min(rect.right - 2, p.x + rect.left)), y: Math.max(rect.top + 2, Math.min(rect.bottom - 2, p.y + rect.top)) }));
    // a stroke must begin on the sky itself, not on a floating panel
    const start = page.findIndex((p) => document.elementFromPoint(p.x, p.y) === canvas);
    return { loop: start > 0 ? page.slice(start).concat(page.slice(0, start)) : page, startsOnSky: start >= 0, liveBefore: null };
  }, conId, decoy);
}
async function draw(page, loop, midShot) {
  await page.mouse.move(loop[0].x, loop[0].y);
  await page.mouse.down();
  for (let i = 1; i < loop.length; i++) {
    await page.mouse.move(loop[i].x, loop[i].y, { steps: 2 });
    if (midShot && i === Math.floor(loop.length * 0.6)) await shot(page, midShot);
  }
  await page.mouse.move(loop[0].x, loop[0].y, { steps: 2 });
  await page.mouse.up();
  await sleep(250);
}
async function answerFind(page, correct, midShot) {
  const cur = await q(page);
  const { loop, startsOnSky } = await loopFor(page, cur.conId, !correct);
  expect(startsOnSky, `find ${cur.conId}: loop can start on open sky`);
  await draw(page, loop, midShot);
  const fb = await feedback(page);
  if (fb == null) console.log('   no result:', await text(page, '[data-testid="prompt"]'), JSON.stringify(await page.evaluate(() => [window.__quizSky.getView(), window.__quizSky.getSize()])), JSON.stringify(loop.slice(0, 3)));
  return fb;
}
/** Answer the current question (correctly unless `wrong`). Returns its kind. */
async function answerAny(page, wrong = false) {
  const cur = await q(page);
  if (cur.kind === 'find') {
    await waitSky(page); await sleep(250);
    if (wrong) await click(page, '[data-testid="show-me"]');
    else {
      let fb = await answerFind(page, true);
      expect(fb === 'true', `find ${cur.conId} with a loop round its main stars → correct${fb === 'true' ? '' : ` — ${await text(page, '[data-testid="feedback"]')}`}`);
      if (fb == null) await click(page, '[data-testid="show-me"]');
    }
  } else if (cur.kind === 'name') {
    await waitSky(page);
    if (cur.typed) { await page.type('.qz-type input', wrong ? 'zzz' : cur.answerText); await page.keyboard.press('Enter'); }
    else await page.keyboard.press(String(((cur.choices.indexOf(cur.conId) + (wrong ? 1 : 0)) % cur.choices.length) + 1));
  } else if (cur.kind === 'card') {
    await page.keyboard.press('Space'); await sleep(100); await page.keyboard.press(wrong ? '1' : '3');
  } else {
    if (cur.kind === 'skyobj') await waitSky(page);
    await page.keyboard.press(String(((cur.answerIndex + (wrong ? 1 : 0)) % cur.choices.length) + 1));
  }
  await sleep(150);
  return cur.kind;
}
async function finish(page, { wrongEvery = 0, shots = {} } = {}) {
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    if (await page.$('[data-testid="summary"]')) return seen;
    const cur = await q(page);
    if (!cur) { await sleep(200); continue; }
    if (shots[cur.kind] && !seen.has(cur.kind)) { if (cur.kind !== 'mcq' && cur.kind !== 'card') { await waitSky(page); await sleep(400); } await shot(page, shots[cur.kind]); }
    if (cur.image && shots.image && !seen.has('image')) { seen.add('image'); await sleep(500); await shot(page, shots.image); }
    seen.add(cur.kind);
    await answerAny(page, wrongEvery > 0 && i % wrongEvery === wrongEvery - 1);
    if (shots[`${cur.kind}-answered`] && !seen.has(`${cur.kind}-answered`)) { seen.add(`${cur.kind}-answered`); await shot(page, shots[`${cur.kind}-answered`]); }
    await page.keyboard.press('Enter');
    await sleep(200);
  }
  expect(false, 'session reached its summary');
  return seen;
}
const store = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

// ───────────── desktop
const page = await newPage(1280, 800);
await go(page, '/quiz');
await page.evaluate(() => { localStorage.clear(); });
await go(page, '/quiz');
expect((await text(page, '[data-testid="preset-name"]')) === 'Easy', 'hub shows the matching preset (Easy)');
expect((await text(page, '[data-testid="due-count"]')) === '0', 'hub: nothing due on a fresh profile');
await shot(page, '01-hub');
await page.click('[data-preset="hard"]');
expect((await text(page, '[data-testid="preset-name"]')) === 'Hard', 'one-tap preset: Hard');
await page.click('.qz-diff-switches .switch');
expect((await text(page, '[data-testid="preset-name"]')) === 'Custom', 'changing one setting → Custom');
await page.click('[data-preset="easy"]');

await go(page, '/quiz/review');
expect(!!(await page.$('[data-testid="nothing-due"]')), 'review: "nothing due" on a fresh profile');
await shot(page, '02-review-empty');

// Find it
await go(page, '/quiz/find');
await waitSky(page); await sleep(500);
await shot(page, '03-find-prompt');
expect((await page.$eval('.qz-stage', (el) => el.dataset.tool)) === 'draw', 'find: starts with the Draw tool');
let fb = await answerFind(page, true, '04-find-drawing');
expect(fb === 'true', 'find: loop round the target → correct');
await shot(page, '05-find-correct');
await page.keyboard.press('Enter'); await sleep(400);
expect((await text(page, '[data-testid="progress"]'))?.startsWith('2 /'), 'Enter moves to the next question');
fb = await answerFind(page, false);
expect(fb === 'false', 'find: loop somewhere else → wrong');
await shot(page, '06-find-wrong');
await page.keyboard.press('Enter'); await sleep(400);
// Move tool: dragging pans instead of drawing; Space does the same while held
const v0 = await page.evaluate(() => window.__quizSky.getView());
await page.click('[data-tool="move"]');
await page.mouse.move(640, 420); await page.mouse.down(); await page.mouse.move(540, 400, { steps: 6 }); await page.mouse.up(); await sleep(200);
const v1 = await page.evaluate(() => window.__quizSky.getView());
expect(Math.abs(v1.lon - v0.lon) + Math.abs(v1.lat - v0.lat) > 0.5 && (await feedback(page)) == null, 'find: Move tool pans and does not answer');
await page.click('[data-tool="draw"]');
await page.keyboard.down('Space');
expect((await page.$eval('.qz-stage', (el) => el.dataset.tool)) === 'move', 'find: holding Space switches to move');
await page.keyboard.up('Space');
expect((await page.$eval('.qz-stage', (el) => el.dataset.tool)) === 'draw', 'find: releasing Space returns to draw');
await click(page, '[data-testid="show-me"]');
expect((await feedback(page)) === 'false', 'find: "Show me" reveals and counts as a miss');
await shot(page, '07-find-show-me');
await page.keyboard.press('Enter');
await finish(page);
await shot(page, '08-find-summary');
let prog = await store(page, 'starhop.progress.v1');
expect(Object.keys(prog.state.items).filter((k) => k.startsWith('find:')).length >= 5, 'find answers recorded as find:<Abbr>');

// Name it: pick, then typed
await go(page, '/quiz/name');
await shot(page, '09-name-setup');
await click(page, '[data-testid="start"]');
await waitSky(page); await sleep(500);
await shot(page, '10-name-question');
await answerAny(page);
expect((await feedback(page)) === 'true', 'name: right choice → correct');
await shot(page, '11-name-correct');
await page.keyboard.press('Enter'); await sleep(300);
await answerAny(page, true);
expect((await feedback(page)) === 'false', 'name: wrong choice → wrong');
await go(page, '/quiz/name');
await page.evaluate(() => [...document.querySelectorAll('.segmented button')].find((b) => b.textContent === 'Type it').click());
await click(page, '[data-testid="start"]');
await waitSky(page); await sleep(400);
const typedQ = await q(page);
await page.type('.qz-type input', typedQ.answerText.toUpperCase());
await page.keyboard.press('Enter'); await sleep(200);
expect((await feedback(page)) === 'true', 'name (typed): Latin name in capitals → correct');
await shot(page, '12-name-typed');
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('starhop.quiz.v1')); s.state.nameTyped = false; localStorage.setItem('starhop.quiz.v1', JSON.stringify(s)); });

// Stories
await go(page, '/quiz/story');
await shot(page, '13-story-setup');
await page.evaluate(() => [...document.querySelectorAll('.qz-setup .switch')][2].click());
await click(page, '[data-testid="start"]');
let seen = await finish(page, { wrongEvery: 4, shots: { mcq: '14-story-question', 'mcq-answered': '15-story-answered', card: '16-story-flashcard' } });
expect(seen.has('mcq'), 'story round asked multiple-choice questions');
await shot(page, '17-story-summary');
prog = await store(page, 'starhop.progress.v1');
expect(Object.keys(prog.state.items).some((k) => /^story:[A-Z][A-Za-z]{2}-/.test(k)), 'story answers recorded per myth (story:<storyId>:<qId>)');

// Sky knowledge
await go(page, '/quiz/knowledge');
await shot(page, '18-knowledge-setup');
await click(page, '[data-testid="start"]');
seen = await finish(page, { shots: { mcq: '19-knowledge-question', skyobj: '20-knowledge-planet', 'skyobj-answered': '21-knowledge-planet-answered' } });
await shot(page, '22-knowledge-summary');
prog = await store(page, 'starhop.progress.v1');
expect(Object.values(prog.state.items).some((p) => p.skill === 'visibility' || p.skill === 'knowledge'), 'knowledge answers recorded (vis:/know:)');

// Deep links from Learn: ?con=Abbr
await go(page, '/quiz/visibility?con=Ori');
await sleep(300);
let cq = await q(page);
expect(cq?.itemId === 'vis:Ori', `visibility?con=Ori asks about Orion (${cq?.itemId})`);
await shot(page, '37-visibility-con');
seen = await finish(page);
prog = await store(page, 'starhop.progress.v1');
expect(prog.state.items['vis:Ori']?.skill === 'visibility', 'visibility answers recorded as vis:Ori with skill visibility');
await go(page, '/quiz/visibility');
await click(page, '[data-testid="start"]');
await sleep(300);
cq = await q(page);
expect(cq?.skill === 'visibility', `visibility (no con) asks only visibility questions (${cq?.itemId})`);
await go(page, '/quiz/find?con=Lyr');
await waitSky(page);
cq = await q(page);
expect(cq?.itemId === 'find:Lyr' && (await text(page, '[data-testid="progress"]')) === '1 / 1', 'find?con=Lyr asks only Lyra');
await go(page, '/quiz/name?con=Cyg');
await waitSky(page);
cq = await q(page);
expect(cq?.itemId === 'name:Cyg', 'name?con=Cyg asks only Cygnus');
await go(page, '/quiz/story?con=Ori');
expect(/Orion/.test((await text(page, 'h2')) ?? '') && /from 1 constellations?/.test((await text(page, '[data-testid="story-count"]')) ?? ''), 'story?con=Ori is limited to Orion');

// Objects
await go(page, '/quiz/object');
await shot(page, '23-object-setup');
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('starhop.quiz.v1')); s.state.length = 20; localStorage.setItem('starhop.quiz.v1', JSON.stringify(s)); });
await go(page, '/quiz/object');
await click(page, '[data-testid="start"]');
seen = await finish(page, { wrongEvery: 5, shots: { skyobj: '24-object-ringed', 'skyobj-answered': '25-object-answered', image: '26-object-image', 'mcq-answered': '27-object-image-answered' } });
expect(seen.has('skyobj') && seen.has('mcq'), `object round mixed ringed objects and picture/type questions (${[...seen].join(', ')})`);

// Review: make everything due
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('starhop.progress.v1')); for (const p of Object.values(s.state.items)) p.due = Date.now() - 1000; localStorage.setItem('starhop.progress.v1', JSON.stringify(s)); });
await go(page, '/quiz');
expect(Number(await text(page, '[data-testid="due-count"]')) > 10, 'hub counts due items');
await shot(page, '28-hub-with-progress');
await go(page, '/quiz/review');
await sleep(500);
const first = await q(page);
expect(!!first, 'review starts with a due item');
await shot(page, '29-review');
seen = await finish(page);
expect(seen.size >= 2, `review mixes formats (${[...seen].join(', ')})`);
await shot(page, '30-review-summary');

// Unit quiz to completion
await go(page, '/quiz/unit/anchor-north');
await shot(page, '31-unit-intro');
await click(page, '[data-testid="start"]');
seen = await finish(page);
expect(seen.has('find') && seen.has('name') && seen.has('mcq'), 'unit quiz mixes find, name and reading questions');
await shot(page, '32-unit-result');
prog = await store(page, 'starhop.progress.v1');
expect(prog.state.unitScores['anchor-north'] >= 0.8, `unitScores['anchor-north'] saved (${prog.state.unitScores['anchor-north']})`);
expect(/Passed/.test((await text(page, '[data-testid="unit-verdict"]')) ?? ''), 'unit quiz shows pass against the pass mark');

// Dashboard
await go(page, '/progress');
expect(Number(await text(page, '[data-testid="stat-started"]').then((t) => parseInt(t))) > 5, 'dashboard counts started constellations');
expect((await page.$$('.qz-table tbody tr[data-con]')).length === 88, 'dashboard lists all 88 constellations');
await page.click('tr[data-con="Ori"] .qz-rowbtn');
await shot(page, '33-dashboard');
await page.evaluate(() => document.querySelector('tr[data-con="Ori"]').scrollIntoView({ block: 'start' }));
await shot(page, '34-dashboard-expanded');
await page.select('[data-testid="sort"]', 'weakest');
await shot(page, '35-dashboard-weakest');
await go(page, '/quiz/weakest');
expect(!!(await q(page)), '"Practise weakest" builds a session');

// ───────────── phone (park the desktop tab first: two software-rendered skies at once starve the GPU process)
await page.goto('about:blank');
const phone = await newPage(390, 844, true);
await go(phone, '/quiz');
await shot(phone, '40-phone-hub');
await go(phone, '/quiz/find');
await waitSky(phone); await sleep(600);
await shot(phone, '41-phone-find');
const cur = await q(phone);
const { loop } = await loopFor(phone, cur.conId, false);
await draw(phone, loop, '42-phone-find-drawing');
expect((await feedback(phone)) === 'true', 'phone: find loop → correct');
await shot(phone, '43-phone-find-result');
await go(phone, '/quiz/name');
await phone.click('[data-testid="start"]');
await waitSky(phone); await sleep(500);
await shot(phone, '44-phone-name');
await go(phone, '/progress');
await shot(phone, '45-phone-dashboard');

// reset behind a confirmation (back on the desktop tab, which must be in front to run scripts reliably)
await phone.close();
await page.bringToFront();
await go(page, '/progress');
await page.click('[data-testid="reset"]');
await shot(page, '36-reset-confirm');
await page.click('[data-testid="reset-confirm"]');
prog = await store(page, 'starhop.progress.v1');
expect(Object.keys(prog.state.items).length === 0, 'reset clears progress after confirmation');

await browser.close();
expect(errors.length === 0, `no console errors${errors.length ? `:\n  ${errors.slice(0, 8).join('\n  ')}` : ''}`);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
