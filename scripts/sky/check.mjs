// Headless checks for the sky engine: console/WebGL errors, screenshots (docs/sky-shots), correctness.
//   npx vite --port 5199 --strictPort &   then   node scripts/sky/check.mjs
import * as Astronomy from 'astronomy-engine';
import { mkdirSync } from 'node:fs';
import { BROOKLYN, DEFAULT_LAYERS, hideStrip, launch, openHarness, setScene, settle } from './lib.mjs';

const OUT = 'docs/sky-shots';
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const EVENING = '2026-11-10T02:00:00Z'; // 9 pm EST on 9 Nov
const LATE = '2026-11-10T07:20:00Z'; // Orion near the meridian
const NOON = '2026-11-10T17:00:00Z';
const DUSK = '2026-11-09T22:12:00Z'; // about half an hour after sunset

const browser = await launch();
const allErrors = [];
try {
  const { page, errors } = await openHarness(browser);
  allErrors.push(errors);
  const shot = async (name, scene) => {
    if (only && !name.includes(only)) return;
    await setScene(page, { layers: scene.layersAll === undefined ? DEFAULT_LAYERS : undefined, limitingMag: 6.0, inputMode: 'navigate', ...scene });
    await hideStrip(page, true);
    await settle(page, 80);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await hideStrip(page, false);
    console.log(`shot  ${name}`);
  };

  // ───────────── screenshots
  await shot('01-evening-south', { time: EVENING, view: { mount: 'altaz', lon: 180, lat: 30, roll: 0, fov: 100 } });
  await shot('02-orion-lines-names', { time: LATE, view: { mount: 'altaz', lon: 180, lat: 47, fov: 40 } });
  await shot('03-orion-all-layers', { time: LATE, layersAll: true, view: { mount: 'altaz', lon: 180, lat: 47, fov: 40 } });
  await shot('04-daytime', { time: NOON, view: { mount: 'altaz', lon: 180, lat: 25, fov: 100 } });
  await shot('05-twilight', { time: DUSK, view: { mount: 'altaz', lon: 240, lat: 20, fov: 100 } });
  await shot('06-bortle9', { time: LATE, limitingMag: 3.8, view: { mount: 'altaz', lon: 180, lat: 35, fov: 100 } });
  await shot('07-bortle2', { time: LATE, limitingMag: 7.3, view: { mount: 'altaz', lon: 180, lat: 35, fov: 100 } });
  await shot('08-equatorial-roll40', {
    time: LATE, layers: { ...DEFAULT_LAYERS, ground: false, atmosphere: false, horizon: false },
    view: { mount: 'equatorial', lon: 84, lat: 0, roll: 40, fov: 60 },
  });
  await shot('09-highlights-winter', { time: LATE, highlights: 'sample', view: { mount: 'altaz', lon: 175, lat: 45, fov: 110 } });
  await shot('10-highlights-polaris-circle', { time: LATE, highlights: 'sample', view: { mount: 'altaz', lon: 0, lat: 42, fov: 70 } });
  await shot('11-highlights-mars-trail', {
    time: LATE, highlights: 'sample', layers: { ...DEFAULT_LAYERS, ground: false, atmosphere: false, horizon: false },
    view: { mount: 'equatorial', lon: 160, lat: 10, roll: 0, fov: 60 },
  });
  await shot('12-highlights-diurnal-trail', { time: EVENING, highlights: 'sample', view: { mount: 'altaz', lon: 170, lat: 25, fov: 120 } });
  await shot('13-summer-milky-way', { time: '2026-07-15T04:00:00Z', limitingMag: 7.3, view: { mount: 'altaz', lon: 180, lat: 45, fov: 110 } });
  await shot('14-grids-wide', { time: EVENING, layersAll: true, view: { mount: 'altaz', lon: 0, lat: 50, fov: 150 } });
  await shot('15-moon-zoom', { time: '2026-11-17T23:30:00Z', layers: { ...DEFAULT_LAYERS, atmosphere: false, ground: false }, view: { mount: 'altaz', lon: 180, lat: 30, fov: 100 } });
  if (!only || '15-moon-zoom'.includes(only)) {
    await page.evaluate(() => window.__sky.flyTo('body:Moon', { fov: 4, durationMs: 0 }));
    await hideStrip(page, true);
    await settle(page, 150);
    await page.screenshot({ path: `${OUT}/15-moon-zoom.png` });
    await hideStrip(page, false);
  }
  await shot('16-m31-zoom', { time: EVENING, selection: 'dso:M31', view: { mount: 'altaz', lon: 180, lat: 30, fov: 100 } });
  if (!only || '16-m31-zoom'.includes(only)) {
    await page.evaluate(() => window.__sky.flyTo('dso:M31', { fov: 14, durationMs: 0 }));
    await hideStrip(page, true);
    await settle(page, 150);
    await page.screenshot({ path: `${OUT}/16-m31-zoom.png` });
    await hideStrip(page, false);
  }

  // lasso drawn with synthetic pointer events
  if (!only || 'lasso'.includes(only)) {
    await setScene(page, { time: LATE, layers: DEFAULT_LAYERS, limitingMag: 6, inputMode: 'lasso', view: { mount: 'altaz', lon: 183, lat: 44, fov: 60 } });
    await hideStrip(page, true);
    await page.evaluate(() => { window.__skyEvents.length = 0; });
    const cx = 640, cy = 400;
    await page.mouse.move(cx + 190, cy);
    await page.mouse.down();
    for (let i = 1; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 1.92;
      await page.mouse.move(cx + Math.cos(a) * (190 + 25 * Math.sin(a * 3)), cy + Math.sin(a) * (230 + 20 * Math.cos(a * 2)));
    }
    await page.mouse.up();
    await settle(page);
    await page.screenshot({ path: `${OUT}/17-lasso.png` });
    const ev = await page.evaluate(() => window.__skyEvents.filter((e) => e.type === 'lasso'));
    check('lasso event emitted with ≤ 300 CSS-pixel points', ev.length === 1 && ev[0].n >= 10 && ev[0].n <= 300, `${ev.length} event(s), ${ev[0]?.n} points`);
    const before = await page.evaluate(() => window.__sky.getView());
    await page.mouse.move(cx, cy);
    await page.mouse.wheel({ deltaY: -200 });
    await settle(page, 200);
    const after = await page.evaluate(() => window.__sky.getView());
    check('wheel still zooms in lasso mode', after.fov < before.fov, `${before.fov.toFixed(1)}° → ${after.fov.toFixed(1)}°`);
    await page.evaluate(() => { window.__sky.clearLasso(); window.__sky.setInputMode('navigate'); });
    await hideStrip(page, false);
  }

  // ───────────── correctness (observer Brooklyn, 2026-11-10T02:00Z)
  if (!only) {
    const obs = new Astronomy.Observer(BROOKLYN.lat, BROOKLYN.lon, BROOKLYN.elevationM);
    const date = new Date(EVENING);
    const D = Math.PI / 180;
    // Independent reference projection written out here (not imported from the engine).
    const refProject = (az, alt, view, w, h) => {
      const dir = (a, b) => [Math.cos(b * D) * Math.cos(a * D), Math.cos(b * D) * Math.sin(a * D), Math.sin(b * D)]; // N, E, Up
      const f = dir(view.lon, view.lat);
      const up = [-Math.sin(view.lat * D) * Math.cos(view.lon * D), -Math.sin(view.lat * D) * Math.sin(view.lon * D), Math.cos(view.lat * D)];
      const right = [-Math.sin(view.lon * D), Math.cos(view.lon * D), 0]; // east of the view direction
      const v = dir(az, alt);
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const S = h / 2 / Math.tan((view.fov * D) / 4);
      return { x: w / 2 + (dot(v, right) / (1 + dot(v, f))) * S, y: h / 2 - (dot(v, up) / (1 + dot(v, f))) * S, pxPerDeg: (S * Math.PI) / 360 };
    };
    // astronomy-engine's own horizontal coordinates of a fixed J2000 position (via its star + Horizon routines)
    const starAltAz = (raDeg, decDeg, when = date) => {
      Astronomy.DefineStar(Astronomy.Body.Star1, raDeg / 15, decDeg, 1000);
      const eq = Astronomy.Equator(Astronomy.Body.Star1, when, obs, true, false);
      const h = Astronomy.Horizon(when, obs, eq.ra, eq.dec);
      return { az: h.azimuth, alt: h.altitude };
    };
    const POLARIS = { ra: 37.95456, dec: 89.26411 };
    const BETELGEUSE = { ra: 88.79294, dec: 7.40706 };
    const RIGEL = { ra: 78.63447, dec: -8.20164 };

    // Polaris
    const viewN = { mount: 'altaz', lon: 0, lat: 40, roll: 0, fov: 60 };
    await setScene(page, { time: EVENING, layers: DEFAULT_LAYERS, view: viewN });
    const size = await page.evaluate(() => window.__sky.getSize());
    const pol = await page.evaluate((p) => window.__sky.project(p.ra, p.dec), POLARIS);
    const polRef = starAltAz(POLARIS.ra, POLARIS.dec);
    const polPx = refProject(polRef.az, polRef.alt, viewN, size.width, size.height);
    const polErr = Math.hypot(pol.x - polPx.x, pol.y - polPx.y) / polPx.pxPerDeg;
    check('Polaris: project() matches astronomy-engine alt/az', polErr < 0.3 && pol.visible, `error ${polErr.toFixed(4)}° (ref alt ${polRef.alt.toFixed(2)}°, az ${polRef.az.toFixed(2)}°)`);
    const azOff = Math.min(polRef.az, 360 - polRef.az);
    check('Polaris is due north at about the latitude (it sits 0.6–0.7° from the pole)', Math.abs(polRef.alt - BROOKLYN.lat) < 1 && azOff < 1.5, `alt ${polRef.alt.toFixed(2)}° vs lat ${BROOKLYN.lat}°, ${azOff.toFixed(2)}° from north`);
    // The pixel at exactly (az 0, alt = latitude) must unproject to the celestial pole of date (J2000 dec ≈ 89.85°)
    const poleRefPx = refProject(0, BROOKLYN.lat, viewN, size.width, size.height);
    const poleSky = await page.evaluate((p) => window.__sky.unproject(p.x, p.y), poleRefPx);
    check('due north at altitude = latitude unprojects to the celestial pole', poleSky.dec > 89.6, `dec ${poleSky.dec.toFixed(3)}°`);

    // east is left of south
    const viewS = { mount: 'altaz', lon: 180, lat: 30, roll: 0, fov: 100 };
    await setScene(page, { time: EVENING, layers: DEFAULT_LAYERS, view: viewS });
    const left = await page.evaluate((s) => window.__sky.unproject(s.width / 2 - 300, s.height / 2), size);
    const leftAz = starAltAz(left.ra, left.dec).az;
    const rightSky = await page.evaluate((s) => window.__sky.unproject(s.width / 2 + 300, s.height / 2), size);
    const rightAz = starAltAz(rightSky.ra, rightSky.dec).az;
    check('facing south, east (az < 180°) is on the left and west on the right', leftAz < 180 && leftAz > 90 && rightAz > 180 && rightAz < 270, `left az ${leftAz.toFixed(1)}°, right az ${rightAz.toFixed(1)}°`);
    const up = await page.evaluate((s) => window.__sky.unproject(s.width / 2, s.height / 2 - 200), size);
    check('up on screen is higher in the sky', starAltAz(up.ra, up.dec).alt > 30 + 10, `alt ${starAltAz(up.ra, up.dec).alt.toFixed(1)}°`);

    // Orion on the meridian: Betelgeuse upper-left of Rigel
    let best = { alt: -90, t: 0 };
    for (let m = 0; m < 24 * 60; m += 2) {
      const t = new Date(Date.parse('2026-11-10T00:00:00Z') + m * 60000);
      const a = starAltAz(86, 0, t);
      if (a.alt > best.alt) best = { alt: a.alt, t: t.getTime() };
    }
    await setScene(page, { time: new Date(best.t).toISOString(), layers: DEFAULT_LAYERS, view: { mount: 'altaz', lon: 180, lat: 45, roll: 0, fov: 60 } });
    const bet = await page.evaluate((p) => window.__sky.project(p.ra, p.dec), BETELGEUSE);
    const rig = await page.evaluate((p) => window.__sky.project(p.ra, p.dec), RIGEL);
    check('Orion on the meridian: Betelgeuse is upper-left of Rigel', bet.x < rig.x && bet.y < rig.y && bet.visible && rig.visible, `Betelgeuse (${bet.x.toFixed(0)}, ${bet.y.toFixed(0)}), Rigel (${rig.x.toFixed(0)}, ${rig.y.toFixed(0)}) at ${new Date(best.t).toISOString()}`);
    await hideStrip(page, true);
    await settle(page, 60);
    await page.screenshot({ path: `${OUT}/18-orion-meridian.png` });

    // Moon and planets: where the engine draws them vs astronomy-engine's own alt/az
    let worst = 0, worstName = '', picks = 0;
    const bodiesList = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Sun'];
    for (const name of bodiesList) {
      const eqd = Astronomy.Equator(name, date, obs, true, true);
      const hz = Astronomy.Horizon(date, obs, eqd.ra, eqd.dec);
      const view = { mount: 'altaz', lon: hz.azimuth, lat: hz.altitude, roll: 0, fov: 30 };
      await setScene(page, { time: EVENING, layers: { ...DEFAULT_LAYERS, ground: false, atmosphere: false, starNames: false, dsoMarkers: false, constellationNames: false }, view });
      const eqj = Astronomy.Equator(name, date, obs, false, true);
      const p = await page.evaluate((r) => window.__sky.project(r.ra, r.dec), { ra: eqj.ra * 15, dec: eqj.dec });
      const ref = refProject(hz.azimuth, hz.altitude, view, size.width, size.height); // = screen centre
      const err = Math.hypot(p.x - ref.x, p.y - ref.y) / ref.pxPerDeg;
      if (err > worst) { worst = err; worstName = name; }
      // and the drawn disc is really there: clicking the reference pixel must pick this body
      await page.evaluate(() => { window.__skyEvents.length = 0; });
      await page.mouse.click(ref.x, ref.y);
      await settle(page, 30);
      const sel = await page.evaluate(() => window.__skyEvents.filter((e) => e.type === 'select').pop());
      if (sel?.p?.ref === `body:${name}`) picks++;
      else console.log(`  pick at ${name} reference position gave`, sel?.p);
    }
    check('Moon and planets within 0.5° of astronomy-engine horizontal coordinates', worst < 0.5, `worst ${worst.toFixed(4)}° (${worstName})`);
    check('clicking each body at its reference position selects it', picks === bodiesList.length, `${picks}/${bodiesList.length}`);

    // picking: Betelgeuse, a constellation name, empty sky
    await setScene(page, { time: LATE, layers: DEFAULT_LAYERS, view: { mount: 'altaz', lon: 183, lat: 44, roll: 0, fov: 40 } });
    const b2 = await page.evaluate((p) => window.__sky.project(p.ra, p.dec), BETELGEUSE);
    await page.evaluate(() => { window.__skyEvents.length = 0; });
    await page.mouse.click(b2.x + 5, b2.y - 4);
    await settle(page, 30);
    const selB = await page.evaluate(() => window.__skyEvents.pop());
    check('click near Betelgeuse selects it', selB?.p?.name === 'Betelgeuse', JSON.stringify(selB?.p));
    await page.screenshot({ path: `${OUT}/19-selection.png` });

    // flyTo resolves and centres the target; interaction: drag pans, wheel zooms towards the pointer
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const t0 = Date.now();
    await page.evaluate(() => window.__sky.flyTo('star:Vega', { fov: 50 }));
    const flyMs = Date.now() - t0;
    const vega = await page.evaluate(() => window.__sky.project(279.23473, 38.78369));
    check('flyTo animates, resolves and centres the target', Math.hypot(vega.x - size.width / 2, vega.y - size.height / 2) < 2 && flyMs > 500 && flyMs < 3000, `${flyMs} ms, offset ${Math.hypot(vega.x - size.width / 2, vega.y - size.height / 2).toFixed(2)} px`);
    await setScene(page, { time: EVENING, layers: DEFAULT_LAYERS, view: { mount: 'altaz', lon: 180, lat: 30, roll: 0, fov: 100 } });
    const grabSky = await page.evaluate(() => window.__sky.unproject(700, 300));
    await page.mouse.move(700, 300);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(700 - i * 15, 300 + i * 8);
    await new Promise((r) => setTimeout(r, 150)); // pause so no inertia
    await page.mouse.up();
    await settle(page, 80);
    const moved = await page.evaluate((g) => window.__sky.project(g.ra, g.dec), grabSky);
    check('drag pans: the grabbed sky point follows the pointer', Math.hypot(moved.x - 550, moved.y - 380) < 6, `ends at (${moved.x.toFixed(1)}, ${moved.y.toFixed(1)}), pointer at (550, 380)`);
    const horizonLevel = await page.evaluate(() => { const c = window.__sky; const a = c.getView(); return a.roll === 0 && a.mount === 'altaz'; });
    check('altaz mount keeps the horizon level after a drag', horizonLevel);
    const anchor = await page.evaluate(() => window.__sky.unproject(900, 250));
    await page.mouse.move(900, 250);
    await page.mouse.wheel({ deltaY: -300 });
    await settle(page, 600);
    const z = await page.evaluate((g) => ({ p: window.__sky.project(g.ra, g.dec), v: window.__sky.getView() }), anchor);
    check('wheel zooms towards the pointer', z.v.fov < 100 && Math.hypot(z.p.x - 900, z.p.y - 250) < 4, `fov ${z.v.fov.toFixed(1)}°, anchor drift ${Math.hypot(z.p.x - 900, z.p.y - 250).toFixed(2)} px`);
    // idle = no work
    await settle(page, 300);
    const f0 = await page.evaluate(() => window.__skyStats().frames);
    await new Promise((r) => setTimeout(r, 1000));
    const f1 = await page.evaluate(() => window.__skyStats().frames);
    check('idle: no frames are drawn when nothing changes', f1 - f0 === 0, `${f1 - f0} frames in 1 s`);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.close();

  // phone-sized viewport, DPR 2
  if (!only || 'phone'.includes(only)) {
    const phone = await openHarness(browser, { width: 390, height: 844, dpr: 2 });
    allErrors.push(phone.errors);
    await setScene(phone.page, { time: LATE, layers: DEFAULT_LAYERS, limitingMag: 6, view: { mount: 'altaz', lon: 176, lat: 42, roll: 0, fov: 80 } });
    await hideStrip(phone.page, true);
    await settle(phone.page);
    await phone.page.screenshot({ path: `${OUT}/20-phone.png` });
    console.log('shot  20-phone');
    await phone.page.close();
  }

  // StrictMode: exactly one ready, and destroy leaves nothing behind
  if (!only) {
    const s = await openHarness(browser);
    allErrors.push(s.errors);
    const info = await s.page.evaluate(() => ({ ready: window.__skyReady, roots: document.querySelectorAll('.sky-root').length, canvases: document.querySelectorAll('canvas').length }));
    check('StrictMode double-mount: one engine, onReady once', info.ready === 1 && info.roots === 1 && info.canvases === 2, JSON.stringify(info));
    const glErr = await s.page.evaluate(() => window.__skyStats().glErrors);
    check('no WebGL errors reported by gl.getError()', glErr === 0, `${glErr}`);
    await s.page.close();
  }
} finally {
  await browser.close();
}
const errs = allErrors.flat();
check('no console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
