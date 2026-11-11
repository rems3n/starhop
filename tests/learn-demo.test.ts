import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { altAzOf } from '@/astro';
import { demoSchema, type DemoStep, type Lesson } from '@/content/schema';
import { zonedParts } from '@/lib/time';
import { BORTLE, type Highlight } from '@/types';
import { observerAtLatitude, latitudeLabel, scrubRange, scrubTime, scrubValue, shiftLocalDays, shiftLocalMonths } from '@/modes/learn/logic/controls';
import { DEMO_LAYERS, highlightRefs, makeScene, normaliseHighlights, resolveDemoStep, type SceneContext } from '@/modes/learn/logic/scene';
import { BROOKLYN } from './fixtures/load';
import { learnCatalog } from './learn-catalog';

const cat = learnCatalog();
const NOW = new Date('2026-11-11T01:30:00Z'); // 20:30 EST, Nov 10
const ctx: SceneContext = { observer: BROOKLYN, bortle: 6, now: NOW, resolve: cat.resolve };
const SYDNEY = { name: 'Sydney, Australia', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' };
const step = (s: Partial<DemoStep>): DemoStep => ({ caption: 'A caption for the test.', ...s });

describe('demo step → scene', () => {
  it('uses the documented defaults when a step gives only a caption', () => {
    const s = resolveDemoStep(step({}), ctx);
    expect(s.observer).toEqual(BROOKLYN);
    expect(zonedParts(s.time, BROOKLYN.tz)).toMatchObject({ year: 2026, month: 11, day: 10, hour: 21, minute: 0 });
    expect(s.rate).toBe(0);
    expect(s.view).toEqual({ mount: 'altaz', lon: 180, lat: 35, roll: 0, fov: 100 });
    expect(s.layers).toEqual(DEMO_LAYERS);
    expect(s.layers).toMatchObject({ constellationLines: true, constellationNames: true, starNames: true, planets: true, horizon: true, ground: true, atmosphere: true, milkyWay: true, constellationBoundaries: false, equatorialGrid: false, azimuthalGrid: false, ecliptic: false, dsoMarkers: false });
    expect(s.bortle).toBe(6);
    expect(s.limitingMag).toBe(BORTLE[5].limitingMag);
    expect(s.highlights).toEqual([]);
    expect(s.problems).toEqual([]);
  });

  it('does not inherit anything from an earlier step', () => {
    const a = resolveDemoStep(step({ bortle: 2, layers: { ecliptic: true }, view: { az: 0, alt: 60, fov: 40 }, rate: 3600, time: 'month:4 02:00' }), ctx);
    expect(a).toMatchObject({ bortle: 2, limitingMag: 7.3, rate: 3600, view: { lon: 0, lat: 60, fov: 40 } });
    expect(a.layers.ecliptic).toBe(true);
    const b = resolveDemoStep(step({}), ctx);
    expect(b).toMatchObject({ bortle: 6, rate: 0, view: { lon: 180, lat: 35, fov: 100 } });
    expect(b.layers.ecliptic).toBe(false);
  });

  it('parses every kind of time spec in the step observer’s zone', () => {
    expect(resolveDemoStep(step({ time: 'now' }), ctx).time).toEqual(NOW);
    expect(resolveDemoStep(step({ time: 'month:4 21:00' }), ctx).time.toISOString()).toBe('2026-04-16T01:00:00.000Z'); // EDT
    expect(resolveDemoStep(step({ time: '2027-01-05 06:15' }), ctx).time.toISOString()).toBe('2027-01-05T11:15:00.000Z');
    const syd = resolveDemoStep(step({ observer: SYDNEY, time: 'tonight 21:00' }), ctx);
    expect(syd.observer).toEqual(SYDNEY);
    // 01:30 UTC on Nov 11 is already Nov 11 in Sydney
    expect(zonedParts(syd.time, SYDNEY.tz)).toMatchObject({ month: 11, day: 11, hour: 21 });
    expect(resolveDemoStep(step({ observer: 'user' }), ctx).observer).toEqual(BROOKLYN);
  });

  it('centres an alt-az view on a target where it is at that time and place', () => {
    const s = resolveDemoStep(step({ time: 'month:1 21:00', view: { target: 'con:Ori', fov: 50 } }), ctx);
    const t = cat.resolve('con:Ori')!;
    const aa = altAzOf(t.ra, t.dec, s.time, BROOKLYN);
    expect(s.view.mount).toBe('altaz');
    expect(s.view.lon).toBeCloseTo(aa.az, 6);
    expect(s.view.lat).toBeCloseTo(aa.alt, 6);
    expect(s.view.fov).toBe(50);
    expect(s.target).toMatchObject({ ref: 'con:Ori', name: 'Orion' });
    expect(s.target!.alt).toBeGreaterThan(30);
    expect(s.target!.az).toBeGreaterThan(120);
    expect(s.target!.az).toBeLessThan(200);
  });

  it('keeps the default 100° field when a target is given without fov', () => {
    expect(resolveDemoStep(step({ view: { target: 'star:Vega' } }), ctx).view.fov).toBe(100);
  });

  it('uses RA/Dec for the equatorial mount, for targets and for az/alt', () => {
    const s = resolveDemoStep(step({ view: { target: 'star:Betelgeuse', mount: 'equatorial', fov: 30 } }), ctx);
    expect(s.view).toMatchObject({ mount: 'equatorial', fov: 30 });
    expect(s.view.lon).toBeCloseTo(88.79, 1);
    expect(s.view.lat).toBeCloseTo(7.41, 1);
    const z = resolveDemoStep(step({ view: { az: 0, alt: 90, mount: 'equatorial' } }), ctx);
    expect(z.view.lat).toBeCloseTo(BROOKLYN.lat, 0); // the zenith's declination is the latitude
  });

  it('resolves moving targets at the step time', () => {
    const a = resolveDemoStep(step({ time: '2027-01-01 21:00', view: { target: 'body:Moon', mount: 'equatorial' } }), ctx);
    const b = resolveDemoStep(step({ time: '2027-01-08 21:00', view: { target: 'body:Moon', mount: 'equatorial' } }), ctx);
    expect(Math.abs(a.view.lon - b.view.lon)).toBeGreaterThan(30);
  });

  it('maps every Bortle class to its limiting magnitude', () => {
    for (const b of BORTLE) expect(resolveDemoStep(step({ bortle: b.n }), ctx).limitingMag).toBe(b.limitingMag);
    expect(resolveDemoStep(step({}), { ...ctx, bortle: 9 }).limitingMag).toBe(3.8);
  });

  it('passes highlights through and turns trail times into instants at the observer', () => {
    const hl: Highlight[] = [
      { type: 'angle', from: 'star:Dubhe', to: 'star:Merak', label: '5°' },
      { type: 'trail', ref: 'body:Sun', from: '2026-12-21 09:00', to: '2026-12-21 15:00', stepHours: 0.5, frame: 'horizon' },
    ];
    const s = resolveDemoStep(step({ highlights: hl }), ctx);
    expect(s.highlights[0]).toEqual(hl[0]);
    expect(s.highlights[1]).toMatchObject({ type: 'trail', ref: 'body:Sun', from: '2026-12-21T14:00:00.000Z', to: '2026-12-21T20:00:00.000Z', stepHours: 0.5, frame: 'horizon' });
    const syd = normaliseHighlights(hl, SYDNEY)[1] as Extract<Highlight, { type: 'trail' }>;
    expect(syd.from).toBe('2026-12-20T22:00:00.000Z');
    expect(s.marks.map((m) => m.ref)).toEqual(['star:Dubhe', 'star:Merak', 'body:Sun']);
  });

  it('reports unknown references instead of throwing', () => {
    const s = resolveDemoStep(step({ view: { target: 'star:Nonesuch' }, highlights: [{ type: 'object', ref: 'dso:M9999' }] }), ctx);
    expect(s.problems).toEqual(['unknown view target star:Nonesuch', 'unknown highlight target dso:M9999']);
    expect(s.view).toMatchObject({ lon: 180, lat: 35 });
  });

  it('lists the refs of every highlight type', () => {
    expect(highlightRefs({ type: 'constellation', id: 'Ori' })).toEqual(['con:Ori']);
    expect(highlightRefs({ type: 'polyline', points: ['star:Vega', 'star:Deneb'] })).toEqual(['star:Vega', 'star:Deneb']);
    expect(highlightRefs({ type: 'circle', center: 'point:ncp', radiusDeg: 40 })).toEqual(['point:ncp']);
    expect(highlightRefs({ type: 'label', at: 'altaz:180,10', text: 'x' })).toEqual(['altaz:180,10']);
  });

  it('makeScene clamps and normalises the camera', () => {
    const s = makeScene({ time: NOW, az: -90, alt: 120, fov: 500 }, ctx);
    expect(s.view).toMatchObject({ lon: 270, lat: 90, fov: 160 });
  });
});

describe('every authored demo step resolves', () => {
  const dir = path.resolve(__dirname, '../src/content/lessons');
  const lessons = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Lesson);
  it('has lessons to check', () => expect(lessons.length).toBeGreaterThan(10));
  for (const l of lessons) {
    it(l.id, () => {
      for (const sec of l.sections) {
        if (!sec.demo) continue;
        const demo = demoSchema.parse(sec.demo);
        for (const st of demo.steps) {
          const s = resolveDemoStep(st, ctx);
          expect(s.problems, `${l.id} "${demo.title}"`).toEqual([]);
          expect(isFinite(s.view.lon) && isFinite(s.view.lat)).toBe(true);
          if (st.view?.target) expect(s.target?.ref).toBe(st.view.target);
          if (st.view?.fov) expect(s.view.fov).toBe(st.view.fov);
          expect(s.highlights.length).toBe(st.highlights?.length ?? 0);
        }
      }
    });
  }
});

describe('demo controls', () => {
  const tz = BROOKLYN.tz;
  it('± day keeps the clock time across a daylight-saving change', () => {
    const t = new Date('2027-03-14T02:00:00Z'); // 21:00 EST on Mar 13, the evening before clocks go forward
    const next = shiftLocalDays(t, 1, tz);
    expect(zonedParts(next, tz)).toMatchObject({ month: 3, day: 14, hour: 21, minute: 0 });
    expect(next.getTime() - t.getTime()).toBe(23 * 3600e3);
    expect(shiftLocalDays(next, -1, tz)).toEqual(t);
    expect(zonedParts(shiftLocalDays(t, 7, tz), tz)).toMatchObject({ day: 20, hour: 21 });
  });
  it('± month keeps the day and clock time, clamps short months and rolls the year', () => {
    const t = new Date('2027-01-16T02:00:00Z'); // Jan 15, 21:00
    expect(zonedParts(shiftLocalMonths(t, 1, tz), tz)).toMatchObject({ year: 2027, month: 2, day: 15, hour: 21 });
    expect(zonedParts(shiftLocalMonths(t, -1, tz), tz)).toMatchObject({ year: 2026, month: 12, day: 15, hour: 21 });
    expect(zonedParts(shiftLocalMonths(t, 6, tz), tz)).toMatchObject({ month: 7, day: 15, hour: 21 });
    const jan31 = new Date('2027-02-01T02:00:00Z');
    expect(zonedParts(shiftLocalMonths(jan31, 1, tz), tz)).toMatchObject({ month: 2, day: 28, hour: 21 });
  });
  it('time scrub covers 4 pm to 8 am around an evening or small-hours step', () => {
    const eve = scrubRange(new Date('2027-01-16T02:00:00Z'), tz); // 21:00 Jan 15
    expect(zonedParts(eve.start, tz)).toMatchObject({ day: 15, hour: 16 });
    expect(zonedParts(eve.end, tz)).toMatchObject({ day: 16, hour: 8 });
    expect(eve.minutes).toBe(960);
    const small = scrubRange(new Date('2027-01-16T08:00:00Z'), tz); // 03:00 Jan 16
    expect(small.start).toEqual(eve.start);
    const t = new Date('2027-01-16T02:00:00Z');
    expect(scrubValue(t, eve)).toBe(300);
    expect(scrubTime(300, eve)).toEqual(t);
    expect(scrubValue(new Date(eve.end.getTime() + 3600e3), eve)).toBe(960);
    expect(scrubValue(new Date(eve.start.getTime() - 3600e3), eve)).toBe(0);
  });
  it('time scrub covers the whole day for a daytime step', () => {
    const day = scrubRange(new Date('2026-06-21T16:00:00Z'), tz); // noon
    expect(zonedParts(day.start, tz)).toMatchObject({ day: 21, hour: 0 });
    expect(day.minutes).toBe(1440);
  });
  it('latitude slider moves the observer only in latitude', () => {
    const o = observerAtLatitude(BROOKLYN, -33.6);
    expect(o).toMatchObject({ lat: -33.6, lon: BROOKLYN.lon, tz: BROOKLYN.tz, name: 'Latitude 34°S' });
    expect(observerAtLatitude(BROOKLYN, 120).lat).toBe(90);
    expect(observerAtLatitude(BROOKLYN, BROOKLYN.lat).name).toBe(BROOKLYN.name);
    expect(latitudeLabel(0.2)).toBe('the equator (0°)');
    expect(latitudeLabel(90)).toBe('the North Pole (90°N)');
  });
});
