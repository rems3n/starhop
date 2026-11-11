import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('console', (m) => m.type() === 'log' && console.log('LOG', m.text()));
await p.setViewport({ width: 1280, height: 800 });
await p.goto(`http://localhost:5234/?debug=1#/practice/starhop?hop=${process.env.HOP ?? 'pointers-to-polaris'}`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 4000));
console.log(await p.evaluate(async () => {
  const q = window.__quizQ; const c = window.__quizSky;
  const stars = await fetch('data/stars.json').then((r) => r.json());
  const t = stars.find((s) => 'star:' + s.id === q.target);
  const canvas = [...document.querySelectorAll('.qz-sky canvas')].pop();
  const rect = canvas.getBoundingClientRect();
  const pp = c.project(t.ra, t.dec);
  const el = document.elementFromPoint(rect.left + pp.x, rect.top + pp.y);
  return JSON.stringify({ n: document.querySelectorAll('.qz-sky canvas').length, rect, pp, el: el && (el.tagName + '.' + el.className), view: c.getView() });
}));
await b.close();
