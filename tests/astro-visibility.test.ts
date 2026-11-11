import { describe, expect, it } from 'vitest';
import {
  altAzOf, bestMonths, clearVisibilityCache, constellationPoints, currentNightDate, eveningSeason, nightWindow, riseSet, seasonOfMonth, tonight,
  upNow, visibilityOn, yearVisibility, type VisTarget,
} from '@/astro';
import { zonedParts, zonedToUtc } from '@/lib/time';
import type { VisibilityClass } from '@/types';
import { BROOKLYN, SYDNEY, TROMSO, loadTestCatalog } from './fixtures/load';

const cat = loadTestCatalog();
const con = (id: string): VisTarget => {
  if (!cat) throw new Error('catalog missing');
  return { points: constellationPoints(cat.conById.get(id)!, cat) };
};
const SIRIUS = { ra: 101.2872, dec: -16.7161 };
const POLARIS = { ra: 37.9546, dec: 89.2641 };
const ACRUX = { ra: 186.6496, dec: -63.0991 };
const year = (t: VisTarget, obs = BROOKLYN) => yearVisibility(t, 2026, obs).map((v) => v.cls);
const hasData = !!cat;

describe('night window', () => {
  it('orders the events of a Brooklyn night and uses the local date', () => {
    const w = nightWindow(new Date('2026-11-11T02:00:00Z'), BROOKLYN); // 21:00 EST on Nov 10
    const seq = [w.sunset, w.civilDusk, w.nauticalDusk, w.astroDusk, w.astroDawn, w.nauticalDawn, w.civilDawn, w.sunrise].map((d) => d!.getTime());
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    expect(zonedParts(w.sunset!, BROOKLYN.tz)).toMatchObject({ month: 11, day: 10, hour: 16 });
    expect(zonedParts(w.sunrise!, BROOKLYN.tz)).toMatchObject({ month: 11, day: 11, hour: 6 });
    // Same local date → same night, whatever the UTC date is
    expect(nightWindow(new Date('2026-11-10T06:00:00Z'), BROOKLYN)).toEqual(w);
    expect(nightWindow(new Date('2026-11-11T04:59:00Z'), BROOKLYN)).toEqual(w);
    expect(nightWindow(new Date('2026-11-11T05:01:00Z'), BROOKLYN).sunset!.getTime()).toBeGreaterThan(w.sunset!.getTime());
  });

  it('is right across both daylight-saving changes', () => {
    // Spring forward: night of Sat Mar 7 2026 (EST) ends Sun Mar 8 (EDT)
    const s = nightWindow(zonedToUtc(2026, 3, 7, 20, 0, BROOKLYN.tz), BROOKLYN);
    expect(zonedParts(s.sunset!, BROOKLYN.tz)).toMatchObject({ day: 7, hour: 17 });
    expect(zonedParts(s.sunrise!, BROOKLYN.tz)).toMatchObject({ day: 8, hour: 7 }); // 7:1x EDT
    expect((s.sunrise!.getTime() - s.sunset!.getTime()) / 3600000).toBeCloseTo(12.4, 0);
    // Fall back: night of Sat Oct 31 2026 (EDT) ends Sun Nov 1 (EST)
    const f = nightWindow(zonedToUtc(2026, 10, 31, 20, 0, BROOKLYN.tz), BROOKLYN);
    expect(zonedParts(f.sunset!, BROOKLYN.tz)).toMatchObject({ day: 31, hour: 17 });
    expect(zonedParts(f.sunrise!, BROOKLYN.tz)).toMatchObject({ month: 11, day: 1, hour: 6 }); // 6:2x EST
    expect((f.sunrise!.getTime() - f.sunset!.getTime()) / 3600000).toBeCloseTo(13.6, 0);
    // The visibility grid follows the same local dates (25-hour window, still classified sensibly)
    expect(visibilityOn(SIRIUS, zonedToUtc(2026, 10, 31, 20, 0, BROOKLYN.tz), BROOKLYN).cls).toBe('morning');
  });

  it('handles the midnight sun and the polar night without throwing', () => {
    const summer = nightWindow(new Date('2026-06-21T12:00:00Z'), TROMSO);
    expect(summer.sunset).toBeNull();
    expect(summer.sunrise).toBeNull();
    expect(summer.astroDusk).toBeNull();
    expect(visibilityOn(POLARIS, new Date('2026-06-21T12:00:00Z'), TROMSO)).toMatchObject({ cls: 'not-visible', bestTime: null, darkHours: 0 });
    const winter = nightWindow(new Date('2026-12-21T12:00:00Z'), TROMSO);
    expect(winter.sunset).toBeNull();
    expect(winter.nauticalDusk).not.toBeNull();
    expect(visibilityOn(POLARIS, new Date('2026-12-21T12:00:00Z'), TROMSO).cls).toBe('all-night');
    // London in June: the Sun sets but it never gets astronomically dark
    const london = nightWindow(new Date('2026-06-21T12:00:00Z'), { name: 'London', lat: 51.5, lon: -0.13, tz: 'Europe/London' });
    expect(london.sunset).not.toBeNull();
    expect(london.astroDusk).toBeNull();
    expect(london.astroDawn).toBeNull();
  });

  it('currentNightDate: after midnight it is still last evening\'s night', () => {
    const lateEvening = zonedToUtc(2026, 11, 10, 23, 0, BROOKLYN.tz), small = zonedToUtc(2026, 11, 11, 2, 0, BROOKLYN.tz), morning = zonedToUtc(2026, 11, 11, 9, 0, BROOKLYN.tz);
    const w = nightWindow(lateEvening, BROOKLYN);
    expect(nightWindow(currentNightDate(lateEvening, BROOKLYN), BROOKLYN)).toEqual(w);
    expect(nightWindow(currentNightDate(small, BROOKLYN), BROOKLYN)).toEqual(w);
    expect(nightWindow(currentNightDate(morning, BROOKLYN), BROOKLYN)).not.toEqual(w);
  });
});

describe('rise / transit / set', () => {
  it('Sirius culminates about 32.6° up from Brooklyn', () => {
    const rs = riseSet(SIRIUS, new Date('2026-01-15T17:00:00Z'), BROOKLYN);
    expect(rs.transitAlt).toBeCloseTo(32.6, 1);
    expect(rs.circumpolar).toBe(false);
    expect(rs.neverRises).toBe(false);
    expect(rs.rise!.getTime()).toBeLessThan(rs.transit!.getTime());
    expect(rs.set!.getTime()).toBeGreaterThan(rs.transit!.getTime());
    // At the transit the star really is due south at that altitude; at rise/set it is on the (refracted) horizon
    const at = altAzOf(SIRIUS.ra, SIRIUS.dec, rs.transit!, BROOKLYN);
    expect(at.az).toBeCloseTo(180, 1);
    expect(at.alt).toBeCloseTo(rs.transitAlt, 2);
    expect(altAzOf(SIRIUS.ra, SIRIUS.dec, rs.rise!, BROOKLYN).alt).toBeCloseTo(-0.567, 1);
    expect(altAzOf(SIRIUS.ra, SIRIUS.dec, rs.set!, BROOKLYN).alt).toBeCloseTo(-0.567, 1);
    expect(zonedParts(rs.transit!, BROOKLYN.tz)).toMatchObject({ day: 15, hour: 22 });
  });

  it('circumpolar and never-rising targets', () => {
    const d = new Date('2026-01-15T17:00:00Z');
    expect(riseSet(POLARIS, d, BROOKLYN)).toMatchObject({ circumpolar: true, neverRises: false, rise: null, set: null });
    expect(riseSet(ACRUX, d, BROOKLYN)).toMatchObject({ circumpolar: false, neverRises: true, rise: null, set: null, transit: null });
    expect(riseSet(ACRUX, d, SYDNEY)).toMatchObject({ circumpolar: true });
    expect(riseSet('Sun', new Date('2026-06-21T12:00:00Z'), TROMSO)).toMatchObject({ circumpolar: true, rise: null, set: null });
    expect(riseSet('Sun', new Date('2026-12-21T12:00:00Z'), TROMSO)).toMatchObject({ neverRises: true, rise: null, set: null });
  });

  it('Sun defaults to the calendar day; planets to the pass belonging to the night', () => {
    const d = zonedToUtc(2026, 11, 10, 21, 0, BROOKLYN.tz);
    const sun = riseSet('Sun', d, BROOKLYN);
    for (const t of [sun.rise, sun.transit, sun.set]) expect(zonedParts(t!, BROOKLYN.tz).day).toBe(10);
    expect(Math.abs(sun.set!.getTime() - nightWindow(d, BROOKLYN).sunset!.getTime())).toBeLessThan(1000);
    const jup = riseSet('Jupiter', d, BROOKLYN); // rises ~11:35 PM on the 10th, transits next morning
    expect(zonedParts(jup.rise!, BROOKLYN.tz)).toMatchObject({ day: 10, hour: 23 });
    expect(jup.rise!.getTime()).toBeLessThan(jup.transit!.getTime());
    expect(jup.transit!.getTime()).toBeLessThan(jup.set!.getTime());
  });
});

describe.runIf(hasData)('visibility through the year (Brooklyn)', () => {
  const vis = (c: VisibilityClass) => c !== 'not-visible';

  it('yearVisibility has 12 entries with coherent fields', () => {
    const y = yearVisibility(con('Ori'), 2026, BROOKLYN);
    expect(y).toHaveLength(12);
    for (const v of y) {
      if (v.cls === 'not-visible') expect(v.bestTime).toBeNull();
      else {
        expect(v.bestTime).toBeInstanceOf(Date);
        expect(v.darkHours).toBeGreaterThanOrEqual(0.75);
        expect(v.bestAlt).toBeGreaterThan(10);
      }
    }
  });

  it('Orion: evening in January, gone in June and July, back before dawn in autumn', () => {
    const y = year(con('Ori'));
    expect(y[0]).toBe('evening');
    expect(y[1]).toBe('evening');
    expect(y[5]).toBe('not-visible');
    expect(y[6]).toBe('not-visible');
    expect(y[8]).toBe('morning');
    const jan = visibilityOn(con('Ori'), zonedToUtc(2026, 1, 15, 12, 0, BROOKLYN.tz), BROOKLYN);
    expect(zonedParts(jan.bestTime!, BROOKLYN.tz).hour).toBeGreaterThanOrEqual(20);
    expect(jan.bestAz).toBeGreaterThan(160);
    expect(jan.bestAz).toBeLessThan(200);
    expect(jan.bestAlt).toBeGreaterThan(40);
  });

  it('Scorpius: evening in July, not visible in December', () => {
    const y = year(con('Sco'));
    expect(y[6]).toBe('evening');
    expect(y[11]).toBe('not-visible');
    expect(y[0]).toBe('not-visible');
    // Antares alone is easier than the whole figure, whose tail scrapes the horizon
    expect(year({ ra: 247.3519, dec: -26.432 })[6]).toBe('evening');
  });

  it('Ursa Major and Cassiopeia are visible every month; Crux never', () => {
    expect(year(con('UMa')).every(vis)).toBe(true);
    expect(year(con('Cas')).every(vis)).toBe(true);
    expect(year(con('Cas')).every((c) => c === 'all-night')).toBe(true);
    expect(year(con('UMi')).every((c) => c === 'all-night')).toBe(true);
    expect(year(con('Cru')).every((c) => c === 'not-visible')).toBe(true);
    expect(year(ACRUX).every((c) => c === 'not-visible')).toBe(true);
  });

  it('Sydney: Crux always visible, Ursa Minor never', () => {
    expect(year(con('Cru'), SYDNEY).every(vis)).toBe(true);
    expect(year(con('UMi'), SYDNEY).every((c) => c === 'not-visible')).toBe(true);
    // Orion is a summer-evening constellation there (January)
    expect(year(con('Ori'), SYDNEY)[0]).not.toBe('not-visible');
    expect(eveningSeason(con('Ori'), SYDNEY, { year: 2026 })).toBe('summer');
  });

  it('evening seasons and best months', () => {
    const y = { year: 2026 };
    expect(eveningSeason(con('Ori'), BROOKLYN, y)).toBe('winter');
    expect(eveningSeason(con('Leo'), BROOKLYN, y)).toBe('spring');
    expect(eveningSeason(con('Sco'), BROOKLYN, y)).toBe('summer');
    expect(eveningSeason(con('Cyg'), BROOKLYN, y)).toBe('summer');
    expect(eveningSeason(con('Peg'), BROOKLYN, y)).toBe('autumn');
    expect(eveningSeason(con('UMi'), BROOKLYN, y)).toBe('all-year');
    expect(eveningSeason(con('Cru'), BROOKLYN, y)).toBe('never');
    expect(eveningSeason('Sun', BROOKLYN, y)).toBe('never');
    expect(eveningSeason('Moon', BROOKLYN, y)).toBe('all-year');
    expect(bestMonths(con('Ori'), BROOKLYN, y)).toEqual(expect.arrayContaining([1, 2]));
    expect(bestMonths(con('Ori'), BROOKLYN, y)).not.toEqual(expect.arrayContaining([6]));
    expect(bestMonths(con('Sco'), BROOKLYN, y).every((m) => m >= 6 && m <= 8)).toBe(true);
    expect(bestMonths(con('Sco'), BROOKLYN, y).length).toBeGreaterThan(0);
    expect(bestMonths(con('Cru'), BROOKLYN, y)).toEqual([]);
    expect(bestMonths(POLARIS, BROOKLYN, y)).toHaveLength(12);
    expect(seasonOfMonth(1, 40)).toBe('winter');
    expect(seasonOfMonth(1, -34)).toBe('summer');
    expect(seasonOfMonth(10, -34)).toBe('spring');
  });

  it('agrees with the catalog season for every ordinary constellation', () => {
    const diff: string[] = [];
    for (const c of cat!.constellations) {
      if (c.season === 'north-circumpolar' || c.season === 'far-south') continue;
      const s = eveningSeason({ points: constellationPoints(c, cat!) }, BROOKLYN, { year: 2026 });
      if (s !== 'never' && s !== c.season) diff.push(`${c.id}: catalog ${c.season}, computed ${s}`);
    }
    expect(diff).toEqual([]);
  });

  it('planets, Moon and Sun', () => {
    const d = zonedToUtc(2026, 11, 10, 12, 0, BROOKLYN.tz);
    expect(visibilityOn('Sun', d, BROOKLYN)).toMatchObject({ cls: 'not-visible', bestTime: null });
    expect(visibilityOn('Saturn', d, BROOKLYN).cls).toBe('evening');
    expect(visibilityOn('Jupiter', d, BROOKLYN).cls).toBe('morning');
    expect(visibilityOn('Venus', d, BROOKLYN).cls).toBe('morning');
    // Two days after New Moon the thin crescent sets in bright twilight: not counted.
    expect(visibilityOn('Moon', d, BROOKLYN).cls).toBe('not-visible');
    // Full Moon (Nov 24 2026): up all night
    expect(visibilityOn('Moon', zonedToUtc(2026, 11, 24, 12, 0, BROOKLYN.tz), BROOKLYN).cls).toBe('all-night');
    // Mars at opposition (Feb 19 2027): all night
    expect(visibilityOn('Mars', zonedToUtc(2027, 2, 19, 12, 0, BROOKLYN.tz), BROOKLYN).cls).toBe('all-night');
  });

  it('tonight() lists everything, sorted by best time, with usable notes', () => {
    const t = tonight(zonedToUtc(2026, 11, 10, 21, 0, BROOKLYN.tz), BROOKLYN, cat!);
    expect(t.constellations).toHaveLength(88);
    expect(t.planets).toHaveLength(7);
    expect(t.brightStars.length).toBeGreaterThan(15);
    expect(t.night).toEqual(nightWindow(zonedToUtc(2026, 11, 10, 21, 0, BROOKLYN.tz), BROOKLYN));
    expect(t.moon.phase.name).toBe('Waxing Crescent');
    for (const list of [t.constellations, t.planets, t.brightStars]) {
      const times = list.map((i) => i.visibility.bestTime?.getTime() ?? Infinity);
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      for (const i of list) expect(i.note).toMatch(i.visibility.cls === 'not-visible' ? /Not visible/ : /Best around \d/);
    }
    const byRef = new Map([...t.constellations, ...t.planets, ...t.brightStars].map((i) => [i.ref, i]));
    expect(byRef.get('con:Cyg')!.visibility.cls).toBe('evening');
    expect(byRef.get('con:Ori')!.visibility.cls).toBe('morning');
    expect(byRef.get('con:Sco')!.visibility.cls).toBe('not-visible');
    expect(byRef.get('con:Cas')!.visibility.cls).toBe('all-night');
    expect(byRef.get('body:Saturn')!.note).toMatch(/south/);
    const sirius = t.brightStars.find((s) => s.name === 'Sirius')!;
    expect(sirius.visibility.cls).toBe('morning');
    expect(sirius.rise).toBeInstanceOf(Date);
  });

  it('upNow() at 9 PM on Nov 10: Cassiopeia and Pegasus up, Scorpius and Crux not', () => {
    const up = upNow(zonedToUtc(2026, 11, 10, 21, 0, BROOKLYN.tz), BROOKLYN, cat!);
    const ids = up.map((u) => u.con);
    for (const id of ['Cas', 'Peg', 'And', 'Cyg', 'UMi', 'Tau']) expect(ids, id).toContain(id);
    for (const id of ['Sco', 'Cru', 'Leo', 'Vir']) expect(ids, id).not.toContain(id);
    for (let i = 1; i < up.length; i++) expect(up[i].alt).toBeLessThanOrEqual(up[i - 1].alt);
    for (const u of up) {
      expect(u.fractionUp).toBeGreaterThan(0);
      expect(u.fractionUp).toBeLessThanOrEqual(1);
    }
  });

  it('the full 88 × 12 calendar computes well under a second', () => {
    clearVisibilityCache();
    const targets = cat!.constellations.map((c) => ({ points: constellationPoints(c, cat!) }));
    const t0 = performance.now();
    const cal = targets.map((t) => yearVisibility(t, 2027, BROOKLYN));
    const cold = performance.now() - t0;
    const t1 = performance.now();
    targets.map((t) => yearVisibility(t, 2027, BROOKLYN));
    const warm = performance.now() - t1;
    expect(cal).toHaveLength(88);
    expect(cold).toBeLessThan(600);
    expect(warm).toBeLessThan(200);
    const t2 = performance.now();
    tonight(new Date('2027-05-05T16:00:00Z'), BROOKLYN, cat!);
    expect(performance.now() - t2).toBeLessThan(300);
  });
});
