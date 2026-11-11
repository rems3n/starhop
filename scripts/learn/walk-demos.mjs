// Walk every demo step of every lesson in the real app and check what the engine ends up showing.
// Usage: node scripts/learn/walk-demos.mjs [lessonId…]     (dev server on :5202)
import fs from 'node:fs';
import path from 'node:path';
import { goto, launch, openPage, settle } from './lib.mjs';

const dir = 'src/content/lessons';
const only = process.argv.slice(2);
const lessons = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((l) => !only.length || only.includes(l.id));

const browser = await launch();
const { page, errors } = await openPage(browser);
const findings = [];
let steps = 0;

for (const lesson of lessons) {
  for (let s = 0; s < lesson.sections.length; s++) {
    const demo = lesson.sections[s].demo;
    if (!demo) continue;
    for (let d = 0; d < demo.steps.length; d++) {
      const where = `${lesson.id} · section ${s + 1} "${demo.title}" · step ${d + 1}`;
      const before = errors.length;
      if (d === 0) {
        await page.evaluate(() => { delete window.__learnSky; delete window.__learnScene; });
        await goto(page, `/learn/lesson/${lesson.id}?s=${s}`, { sky: true });
      } else {
        // later steps: press the real "Next step" button
        await page.evaluate(() => { window.__prevScene = window.__learnScene; [...document.querySelectorAll('.ln-demo-caption button')].find((b) => b.textContent === 'Next step').click(); });
        await page.waitForFunction('window.__learnScene !== window.__prevScene', { timeout: 20000 });
        await settle(page);
      }
      const step = demo.steps[d];
      const r = await page.evaluate((expect) => {
        const c = window.__learnSky, sc = window.__learnScene;
        const out = { problems: sc.problems, notes: [] };
        const v = c.getView(), L = c.getLayers();
        const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol || Math.abs(Math.abs(a - b) - 360) <= tol;
        if (Math.abs(c.getTime().getTime() - sc.time.getTime()) > Math.abs(sc.rate || 0) * 5000 + 1000) out.notes.push('engine time differs from scene');
        if (c.getTimeRate() !== sc.rate) out.notes.push(`rate ${c.getTimeRate()} != ${sc.rate}`);
        if (c.getObserver().lat !== sc.observer.lat || c.getObserver().tz !== sc.observer.tz) out.notes.push('observer not applied');
        if (v.mount !== sc.view.mount || (!sc.rate && (!near(v.lon, sc.view.lon) || !near(v.lat, sc.view.lat))) || !near(v.fov, sc.view.fov)) out.notes.push(`view not applied (${JSON.stringify(v)} vs ${JSON.stringify(sc.view)})`);
        for (const k of Object.keys(sc.layers)) if (L[k] !== sc.layers[k]) out.notes.push(`layer ${k} not applied`);
        if (c.getLimitingMag() !== sc.limitingMag) out.notes.push('limiting magnitude not applied');
        if (expect.fov && sc.view.fov !== expect.fov) out.notes.push('fov differs from step');
        if (expect.mount && sc.view.mount !== expect.mount) out.notes.push('mount differs from step');
        out.target = sc.target ? { ...sc.target, p: c.project(sc.target.ra, sc.target.dec) } : null;
        out.size = c.getSize();
        out.ground = L.ground;
        out.nHighlights = sc.highlights.length;
        out.marksOn = sc.marks.filter((m) => c.project(m.ra, m.dec).visible).length;
        out.marks = sc.marks.length;
        out.clock = document.querySelector('.ln-stage-clock')?.textContent;
        out.caption = document.querySelector('.ln-demo-text')?.textContent;
        out.controls = [...document.querySelectorAll('.ln-controls .ln-control')].length;
        return out;
      }, { fov: step.view?.fov, mount: step.view?.mount });
      steps++;
      const bad = [];
      for (const p of r.problems) bad.push(p);
      for (const n of r.notes) bad.push(n);
      if (r.caption !== step.caption.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\*([^*\n]+)\*/g, '$1')) bad.push('caption on screen differs');
      if (step.view?.target) {
        if (!r.target) bad.push('target did not resolve');
        else {
          const c = { x: r.size.width / 2, y: r.size.height / 2 };
          if (!step.rate && Math.hypot(r.target.p.x - c.x, r.target.p.y - c.y) > 3) bad.push(`target not centred (${r.target.p.x.toFixed(0)},${r.target.p.y.toFixed(0)})`);
          if (r.ground && r.target.alt < 0) bad.push(`CONTENT: target ${step.view.target} is ${r.target.alt.toFixed(1)}° below the horizon (ground on)`);
          else if (!r.target.p.visible && !step.rate) bad.push('target not visible on screen');
        }
      }
      if (!r.nHighlights) bad.push('CONTENT: no highlights in this step');
      else if (r.marks && !r.marksOn && !step.rate) bad.push(`CONTENT: none of the ${r.marks} highlighted targets is on screen`);
      else if (r.marks && r.marksOn < r.marks / 2 && !step.rate) bad.push(`CONTENT (minor): only ${r.marksOn} of ${r.marks} highlighted targets on screen`);
      for (const e of errors.slice(before)) bad.push(`console ${e}`);
      if (bad.length) findings.push({ where, bad, clock: r.clock });
      process.stdout.write(bad.length ? 'x' : '.');
    }
  }
}
console.log(`\n${steps} demo steps in ${lessons.length} lessons walked; ${findings.length} with findings`);
for (const f of findings) console.log(`- ${f.where} [${f.clock}]\n    ${f.bad.join('\n    ')}`);
await browser.close();
process.exit(findings.some((f) => f.bad.some((b) => !b.startsWith('CONTENT'))) ? 1 : 0);
