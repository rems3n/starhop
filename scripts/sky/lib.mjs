// Shared helpers for the headless sky checks. Usage: start `npx vite --port 5199 --strictPort` first.
import puppeteer from 'puppeteer-core';

export const URL = process.env.SKY_URL ?? 'http://localhost:5199/sky-dev.html';
export const BROOKLYN = { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York', elevationM: 10 };

export async function launch() {
  return puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

/** Open the harness; collects console errors (incl. the engine's WebGL error reports) into `errors`. */
export async function openHarness(browser, { width = 1280, height = 800, dpr = 1, reducedMotion = true } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url ?? '';
    // not the engine's business: the browser asking for a favicon, optional data files that are not built yet
    if (/favicon\.ico|data\/images\.json/.test(url)) return;
    errors.push(`${m.text()} ${url}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  if (reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__sky && window.__skyReady >= 1', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { page, errors };
}

/** Wait until the engine has drawn whatever was last asked of it. */
export async function settle(page, ms = 120) {
  await page.evaluate((ms) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, ms)))), ms);
}

export async function hideStrip(page, hide = true) {
  await page.evaluate((hide) => { document.getElementById('strip').style.display = hide ? 'none' : 'grid'; }, hide);
}

/** Apply a scene: plain data only (dates as ISO strings). */
export async function setScene(page, s) {
  await page.evaluate((s) => {
    const c = window.__sky;
    const all = (v) => Object.fromEntries(Object.keys(c.getLayers()).map((k) => [k, v]));
    if (s.inputMode) c.setInputMode(s.inputMode);
    c.clearLasso();
    c.setTimeRate(s.timeRate ?? 0);
    if (s.time) c.setTime(new Date(s.time));
    if (s.layersAll !== undefined) c.setLayers(all(s.layersAll));
    if (s.layers) c.setLayers(s.layers);
    if (s.limitingMag !== undefined) c.setLimitingMag(s.limitingMag);
    if (s.view) c.setView(s.view);
    c.setHighlights(s.highlights === 'sample' ? window.__SAMPLE : s.highlights ?? []);
    c.setSelection(s.selection ?? null);
  }, s);
  await settle(page, s.limitingMag > 6.5 ? 700 : 150);
}

export const DEFAULT_LAYERS = {
  constellationLines: true, constellationBoundaries: false, constellationNames: true, starNames: true, dsoMarkers: true, planets: true,
  ecliptic: false, equatorialGrid: false, azimuthalGrid: false, horizon: true, ground: true, atmosphere: true, milkyWay: true,
};
