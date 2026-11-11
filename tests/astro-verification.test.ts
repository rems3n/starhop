/**
 * Our numbers against independent references stored in tests/fixtures (see docs/VERIFICATION.md):
 *  - JPL Horizons: apparent RA/Dec, azimuth/elevation, angular diameter, rise/transit/set (scripts/verify/fetch_horizons.py)
 *  - astropy: star altitude/azimuth (scripts/verify/astropy_stars.py)
 * Run with VERIFY_REPORT=1 to print the worst-case table.
 */
import { describe, expect, it } from 'vitest';
import { altAzOf, angularSeparation, applyMat3, eqjToEqdMatrix, getBody, norm180, raDecToVec, riseSet, vecToRaDec } from '@/astro';
import type { BodyId, Observer } from '@/types';
import { BROOKLYN, readFixture } from './fixtures/load';

interface HorizonsFixture {
  positions: { body: BodyId; time: string; raIcrf: number; decIcrf: number; raApp: number; decApp: number; az: number; el: number; angDiamArcsec: number }[];
  riseSet: { body: BodyId; localDate: string; rise: string | null; transit: string | null; set: string | null; transitEl?: number }[];
}
interface AstropyFixture { rows: { site: string; lat: number; lon: number; elevationM: number; time: string; star: string; ra: number; dec: number; alt: number; az: number }[] }

const hz = readFixture<HorizonsFixture>('horizons.json');
const ap = readFixture<AstropyFixture>('astropy-stars.json');
const report: string[] = [];
const say = (s: string) => { report.push(s); if (process.env.VERIFY_REPORT) console.log(s); };

/** Great-circle distance between two alt/az directions, degrees. */
function altAzSep(a: { alt: number; az: number }, b: { alt: number; az: number }): number {
  return angularSeparation({ ra: a.az, dec: a.alt }, { ra: b.az, dec: b.alt });
}

describe('JPL Horizons: Sun, Moon and planets from Brooklyn', () => {
  it('fixture covers 9 bodies × ≥ 5 instants, including Nov 10 2026 21:00 EST and a summer DST date', () => {
    const times = new Set(hz.positions.map((p) => p.time));
    expect(times.size).toBeGreaterThanOrEqual(5);
    expect(times.has('2026-11-11T02:00:00Z')).toBe(true);
    expect(times.has('2026-07-15T01:30:00Z')).toBe(true);
    expect(new Set(hz.positions.map((p) => p.body)).size).toBe(9);
    expect(hz.positions.length).toBe(9 * times.size);
  });

  it('azimuth/elevation within 0.05° (Moon 0.1°)', () => {
    const worst: Record<string, number> = {};
    for (const p of hz.positions) {
      const b = getBody(p.body, new Date(p.time), BROOKLYN);
      const d = altAzSep({ alt: b.alt, az: b.az }, { alt: p.el, az: p.az });
      worst[p.body] = Math.max(worst[p.body] ?? 0, d);
      expect(d, `${p.body} ${p.time}`).toBeLessThan(p.body === 'Moon' ? 0.1 : 0.05);
      expect(Math.abs(b.alt - p.el), `${p.body} ${p.time} elevation`).toBeLessThan(p.body === 'Moon' ? 0.1 : 0.05);
    }
    say(`alt/az worst (deg): ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')}`);
  });

  it('apparent RA/Dec within 0.05° (Moon 0.1°) after rotating our J2000 position to the equinox of date', () => {
    const worst: Record<string, number> = {};
    for (const p of hz.positions) {
      const t = new Date(p.time);
      const b = getBody(p.body, t, BROOKLYN);
      const ofDate = vecToRaDec(applyMat3(eqjToEqdMatrix(t), raDecToVec(b.ra, b.dec)));
      const d = angularSeparation(ofDate, { ra: p.raApp, dec: p.decApp });
      worst[p.body] = Math.max(worst[p.body] ?? 0, d);
      expect(d, `${p.body} ${p.time}`).toBeLessThan(p.body === 'Moon' ? 0.1 : 0.05);
      // and our J2000 position is the astrometric ICRF one plus aberration (≤ 0.006°)
      expect(angularSeparation(b, { ra: p.raIcrf, dec: p.decIcrf })).toBeLessThan(0.012);
    }
    say(`apparent RA/Dec worst (deg): ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(', ')}`);
  });

  it('angular diameters within 1%', () => {
    let worst = 0;
    for (const p of hz.positions) {
      const b = getBody(p.body, new Date(p.time), BROOKLYN);
      const rel = Math.abs(b.angularDiameterArcsec / p.angDiamArcsec - 1);
      worst = Math.max(worst, rel);
      expect(rel, `${p.body} ${p.time}`).toBeLessThan(0.01);
    }
    say(`angular diameter worst relative difference: ${(worst * 100).toFixed(2)}%`);
  });

  it('solar eclipse of 12 Aug 2026: Horizons also has the Moon overlapping the Sun at our local maximum', () => {
    const at = (b: BodyId) => hz.positions.find((p) => p.body === b && p.time === '2026-08-12T17:54:00Z')!;
    const sun = at('Sun'), moon = at('Moon');
    const sep = angularSeparation({ ra: sun.raApp, dec: sun.decApp }, { ra: moon.raApp, dec: moon.decApp }) * 3600;
    const rs = sun.angDiamArcsec / 2, rm = moon.angDiamArcsec / 2;
    expect(sep).toBeLessThan(rs + rm); // discs overlap
    expect(sep).toBeGreaterThan(Math.abs(rs - rm)); // but only partly
    // obscured fraction of the Sun's disc from the reference geometry (two overlapping circles)
    const a = rs * rs * Math.acos((sep * sep + rs * rs - rm * rm) / (2 * sep * rs)) + rm * rm * Math.acos((sep * sep + rm * rm - rs * rs) / (2 * sep * rm))
      - 0.5 * Math.sqrt((-sep + rs + rm) * (sep + rs - rm) * (sep - rs + rm) * (sep + rs + rm));
    const obsc = a / (Math.PI * rs * rs);
    say(`Aug 12 2026 eclipse at Brooklyn 17:54 UT: Horizons geometry gives ${(obsc * 100).toFixed(1)}% of the Sun covered`);
    expect(obsc).toBeGreaterThan(0.085);
    expect(obsc).toBeLessThan(0.105);
  });

  it('rise, transit and set within 2 minutes (Horizons tabulates whole minutes)', () => {
    expect(new Set(hz.riseSet.map((r) => r.localDate)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(hz.riseSet.map((r) => r.body)).size).toBeGreaterThanOrEqual(5);
    let worst = 0, worstWhat = '', n = 0, worstAlt = 0;
    for (const r of hz.riseSet) {
      const [y, m, d] = r.localDate.split('-').map(Number);
      const mine = riseSet(r.body, new Date(Date.UTC(y, m - 1, d, 17)), BROOKLYN, { window: 'day' });
      for (const k of ['rise', 'transit', 'set'] as const) {
        const ref = r[k];
        if (!ref) continue;
        expect(mine[k], `${r.body} ${r.localDate} ${k}`).not.toBeNull();
        // Horizons flags the first whole minute at/after the event, so compare against the minute centre
        const diff = Math.abs(mine[k]!.getTime() - new Date(ref).getTime()) / 60000;
        if (diff > worst) { worst = diff; worstWhat = `${r.body} ${r.localDate} ${k}`; }
        expect(diff, `${r.body} ${r.localDate} ${k}`).toBeLessThan(2);
        n++;
      }
      if (r.transit && r.transitEl !== undefined) {
        // Horizons' value is refracted (≤ 0.03° at these altitudes) and sampled on the whole minute
        worstAlt = Math.max(worstAlt, Math.abs(mine.transitAlt - r.transitEl));
        expect(Math.abs(mine.transitAlt - r.transitEl)).toBeLessThan(0.08);
      }
    }
    expect(n).toBeGreaterThanOrEqual(60);
    say(`rise/transit/set: ${n} events, worst ${worst.toFixed(2)} min (${worstWhat}); transit altitude worst ${worstAlt.toFixed(3)}°`);
  });
});

describe('astropy: fixed-star altitude/azimuth', () => {
  it('10 bright stars × 4 dates within 0.05°', () => {
    expect(ap.rows.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ap.rows.map((r) => r.star)).size).toBe(10);
    let worst = 0, worstWhat = '', worstAlt = 0;
    for (const r of ap.rows) {
      const obs: Observer = { name: r.site, lat: r.lat, lon: r.lon, tz: BROOKLYN.tz, elevationM: r.elevationM };
      const mine = altAzOf(r.ra, r.dec, new Date(r.time), obs);
      const d = altAzSep(mine, r);
      if (d > worst) { worst = d; worstWhat = `${r.star} ${r.time}`; }
      worstAlt = Math.max(worstAlt, Math.abs(mine.alt - r.alt));
      expect(d, `${r.star} ${r.time}`).toBeLessThan(0.05);
      expect(Math.abs(norm180(mine.az - r.az)) * Math.cos((r.alt * Math.PI) / 180)).toBeLessThan(0.05);
    }
    say(`astropy stars: worst ${worst.toFixed(4)}° (${worstWhat}), worst altitude difference ${worstAlt.toFixed(4)}°`);
  });
});
