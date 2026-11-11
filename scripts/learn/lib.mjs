// Shared helpers for the Learn headless checks. Start the dev server first: `npx vite --port 5202 --strictPort`.
import puppeteer from 'puppeteer-core';

export const BASE = process.env.LEARN_URL ?? 'http://localhost:5202/';

export async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

export async function openPage(browser, { width = 1360, height = 860 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warn') return;
    const url = m.location()?.url ?? '';
    const text = m.text();
    if (/favicon\.ico/.test(url) || /React Router Future Flag|Download the React DevTools|GPU stall|WebGL.*software|GroupMarkerNotSet/i.test(text)) return;
    errors.push(`${m.type()}: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  return { page, errors };
}

export async function goto(page, hash, { sky = false } = {}) {
  await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((h) => { if (location.hash !== `#${h}`) location.hash = h; }, hash);
  if (sky) await waitSky(page);
  else await page.waitForSelector('.ln-page', { timeout: 30000 });
  await settle(page);
}

export async function waitSky(page) {
  await page.waitForFunction('!!window.__learnSky && !!window.__learnScene', { timeout: 60000 });
  await settle(page);
}

export async function settle(page, ms = 200) {
  await page.evaluate((ms) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, ms)))), ms);
}
