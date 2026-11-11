// End-to-end smoke test of the built site: every section at desktop and phone width, for a northern and a southern
// learner. Usage: npm run build && PORT=4998 npm start &  then  node scripts/final/smoke.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:4998/';
const OUT = process.argv[3] ?? 'docs/shots/final';
mkdirSync(OUT, { recursive: true });
const routes = process.env.ROUTES ? process.env.ROUTES.split(',') : ['sky', 'sky?target=con:UMa', 'tonight', 'tonight/month/1', 'tonight/calendar', 'tonight/events',
  'learn', 'learn/module/how-to-look', 'learn/module/finding-your-way', 'learn/module/first-constellations', 'learn/module/season-by-season', 'learn/module/beyond-your-horizon',
  'learn/lesson/dark-adaptation', 'learn/lesson/star-hopping', 'learn/lesson/retrograde-motion', 'learn/lesson/star-colors-and-classes',
  'library', 'library/constellations', 'library/constellation/Ori', 'library/constellation/Cru', 'library/myths', 'library/myth/Ori-scorpion',
  'library/starhops', 'library/starhop/arc-to-arcturus-spica', 'library/asterisms', 'library/asterism/summer-triangle', 'library/stars', 'library/objects',
  'library/object/dso%3AM31', 'library/planets', 'practice', 'practice/find', 'practice/name', 'practice/starhop', 'practice/story?story=Ori-scorpion',
  'practice/module/how-to-look', 'practice/review', 'practice/progress',
  // old links must still land somewhere sensible
  'explore', 'learn/constellation/Ori', 'quiz/find', 'progress'];
const places = {
  north: { name: 'New York, USA', lat: 40.71, lon: -74.01, tz: 'America/New_York' },
  south: { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
};
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;
for (const [who, obs] of Object.entries(places)) {
  for (const vp of [{ width: 1366, height: 860, tag: 'd' }, { width: 390, height: 844, tag: 'm', isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]) {
    if (who === 'south' && vp.tag === 'm') continue;
    const p = await b.newPage();
    await p.setViewport(vp);
    await p.evaluateOnNewDocument((o) => {
      localStorage.setItem('starhop.settings.v1', JSON.stringify({ state: { observer: o, locationChosen: true }, version: 1 }));
    }, obs);
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errs.push(m.text()));
    for (const r of routes) {
      const before = errs.length;
      try {
        await p.goto(`${BASE}#/${r}`, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise((res) => setTimeout(res, 1800));
      } catch (e) { errs.push(`${r}: ${e.message}`); }
      const info = await p.evaluate(() => ({ text: (document.querySelector('main')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 70), overflow: document.documentElement.scrollWidth > window.innerWidth + 1, url: location.hash, brooklyn: /Brooklyn/.test(document.body.innerText) }));
      const bad = errs.length > before || info.overflow || info.text.length < 10 || (info.brooklyn && who === 'south');
      if (bad) failures++;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${who}/${vp.tag} ${r.padEnd(40)} → ${info.url.slice(0, 40).padEnd(40)} ${info.overflow ? '[h-scroll] ' : ''}${info.brooklyn && who === 'south' ? '[Brooklyn] ' : ''}${errs.slice(before).join(' | ').slice(0, 160)}`);
      if (vp.tag === 'm' || who === 'south' || ['learn', 'library/myths', 'library/starhop/arc-to-arcturus-spica', 'learn/lesson/dark-adaptation', 'practice/starhop'].includes(r))
        await p.screenshot({ path: `${OUT}/${who}-${vp.tag}-${r.replace(/[^a-z0-9]+/gi, '_')}.png` });
    }
    await p.close();
  }
}
await b.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall pages ok');
process.exit(failures ? 1 : 0);
