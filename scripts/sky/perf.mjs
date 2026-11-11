// Performance measurements for the sky engine (see docs/SKY.md "Performance").
//   npx vite --port 5199 --strictPort &   then   node scripts/sky/perf.mjs
// Software GL (SwiftShader) in a sandbox says little about a laptop GPU, so this reports three things
// separately: (a) main-thread CPU per frame from a Chrome trace, (b) draw calls / vertices per frame,
// (c) the frame rate actually reached under SwiftShader, for reference only.
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULT_LAYERS, hideStrip, launch, openHarness, setScene, settle } from './lib.mjs';

const TRACE = `${process.env.SKY_TRACE_DIR ?? tmpdir()}/sky-perf-trace.json`;
const browser = await launch();
const out = [];
try {
  for (const cfg of [
    { name: '9k stars (limiting mag 6.5), default layers', limitingMag: 6.5, layers: DEFAULT_LAYERS },
    { name: '26k stars (limiting mag 7.6), default layers', limitingMag: 7.6, layers: DEFAULT_LAYERS },
    { name: '26k stars, every layer on + sample highlights', limitingMag: 7.6, layersAll: true, highlights: 'sample' },
  ]) {
    const { page, errors } = await openHarness(browser, { width: 1280, height: 800, dpr: 1, reducedMotion: false });
    await setScene(page, { time: '2026-11-10T07:20:00Z', view: { mount: 'altaz', lon: 180, lat: 40, roll: 0, fov: 90 }, ...cfg });
    await hideStrip(page, true);
    await settle(page, 800);
    const scripted = (seconds) => page.evaluate((seconds) => new Promise((resolve) => {
      const c = window.__sky;
      const t0 = performance.now();
      const frameMs = [], glMs = [], ovMs = [];
      let maxDraw = 0, maxVerts = 0;
      function tick(now) {
        const t = (now - t0) / 1000;
        if (t >= seconds) {
          resolve({ frameMs, glMs, ovMs, maxDraw, maxVerts, seconds: t });
          return;
        }
        c.setView({ lon: 180 + 70 * Math.sin(t * 0.9), lat: 40 + 25 * Math.sin(t * 1.3), fov: 55 + 40 * Math.sin(t * 1.7) });
        const s = window.__skyStats();
        frameMs.push(s.lastFrameMs); glMs.push(s.glMs); ovMs.push(s.overlayMs);
        maxDraw = Math.max(maxDraw, s.drawCalls);
        maxVerts = Math.max(maxVerts, s.vertices);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }), seconds);
    await scripted(2); // warm-up: label atlas filled, shaders compiled, faint stars uploaded
    const before = await page.evaluate(() => window.__skyStats());
    const run = await scripted(5); // untraced: frame rate and in-page timings without tracing overhead
    const after = await page.evaluate(() => window.__skyStats());
    const frames = after.frames - before.frames;
    const tb = await page.evaluate(() => window.__skyStats());
    await page.tracing.start({ path: TRACE, categories: ['devtools.timeline'] });
    await scripted(5); // traced: main-thread task breakdown
    await page.tracing.stop();
    const tFrames = (await page.evaluate(() => window.__skyStats())).frames - tb.frames;
    // main-thread time: top-level tasks on the renderer main thread during the run
    const trace = JSON.parse(readFileSync(TRACE, 'utf8'));
    const events = trace.traceEvents;
    const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
    const onMain = (e) => main && e.pid === main.pid && e.tid === main.tid && e.ph === 'X';
    const sum = (names) => events.filter((e) => onMain(e) && names.includes(e.name)).reduce((a, e) => a + (e.dur ?? 0), 0) / 1000;
    const script = sum(['FunctionCall', 'EvaluateScript', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'RunMicrotasks']);
    const rafOnly = sum(['FireAnimationFrame']);
    const layout = sum(['Layout', 'UpdateLayoutTree', 'PrePaint', 'Paint', 'Layerize', 'Commit']);
    const gc = sum(['MinorGC', 'MajorGC']);
    const sorted = [...run.frameMs].sort((a, b) => a - b);
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const row = {
      scenario: cfg.name,
      frames,
      starsDrawn: after.starsDrawn + (cfg.limitingMag > 6.5 ? after.faintLoaded : 0),
      'rAF script ms/frame (trace)': +(rafOnly / tFrames).toFixed(2),
      'layout+paint ms/frame (trace)': +(layout / tFrames).toFixed(2),
      'GC ms/frame (trace)': +(gc / tFrames).toFixed(3),
      'engine frame ms median (performance.now)': +sorted[Math.floor(sorted.length / 2)].toFixed(2),
      '  of which WebGL calls ms (median)': +med(run.glMs).toFixed(2),
      '  of which 2D overlay ms (median)': +med(run.ovMs).toFixed(2),
      'engine frame ms p95': +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      'draw calls/frame (max)': run.maxDraw,
      'vertices/frame (max)': run.maxVerts,
      'SwiftShader fps reached': +(frames / run.seconds).toFixed(1),
      allScriptMs: +script.toFixed(0),
      errors: errors.length,
    };
    out.push(row);
    console.log(row);
    await page.close();
  }
} finally {
  await browser.close();
  rmSync(TRACE, { force: true });
}
const bad = out.filter((r) => r.errors > 0);
process.exit(bad.length ? 1 : 0);
