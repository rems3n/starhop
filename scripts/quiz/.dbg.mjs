import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('console', (m) => m.type() === 'log' && console.log('LOG', m.text()));
await p.setViewport({ width: +(process.env.W ?? 1366), height: +(process.env.H ?? 860), isMobile: !!process.env.M, hasTouch: !!process.env.M });
await p.goto(`http://localhost:5234/?debug=1#/practice/starhop?hop=${process.env.HOP ?? 'pointers-to-polaris'}`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 4000));
console.log(await p.evaluate(() => { const c = window.__quizSky; const q = window.__quizQ; return JSON.stringify({ view: c.getView(), size: c.getSize(), q: { path: q.path, start: q.start }, merak: c.project(165.46, 56.38), un: c.unproject(683, 400) }); }));
await b.close();
