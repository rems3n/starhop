import puppeteer from 'puppeteer-core';
const out = '/tmp/claude-0/-home-claude/98cc43a6-a5f3-5a10-bd68-3e15d7a31fae/scratchpad/final';
const routes = ['explore','explore?target=con:Ori','learn','learn/unit/anchor-winter','learn/lesson/hand-angles','learn/tonight','learn/month/1','learn/calendar','learn/signpost/big-dipper','learn/events','learn/constellations','learn/constellation/Ori','learn/constellation/Cas','learn/constellation/Tel','learn/objects','learn/object/dso%3AM42','quiz','quiz/find?con=Ori','quiz/name','quiz/story?con=Per','quiz/knowledge','quiz/visibility?con=Sco','quiz/object','quiz/review','quiz/unit/anchor-north','progress'];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: 1366, height: 860 });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
for (const r of routes) {
  const before = errs.length;
  await p.goto(`http://localhost:4998/#/${r}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(res => setTimeout(res, 2500));
  const text = await p.evaluate(() => document.querySelector('main')?.innerText.slice(0, 80).replace(/\s+/g,' '));
  const blank = await p.evaluate(() => (document.querySelector('main')?.innerText.trim().length ?? 0) < 20 && !document.querySelector('canvas'));
  console.log((errs.length > before ? 'ERR ' : blank ? 'BLANK ' : 'ok  ') + r.padEnd(32), '|', text);
  await p.screenshot({ path: `${out}/${r.replace(/[^a-z0-9]+/gi,'_')}.png` });
}
console.log('errors:', errs.slice(0, 10));
await b.close();
