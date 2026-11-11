import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { dateOfSolarLongitudeJ2000, localSolarEclipse, showerNight, showerPeaks, sunLongitudeJ2000, yearEvents } from '@/astro';
import type { SkyEvent } from '@/types';
import { BROOKLYN, SYDNEY, TEST_SHOWERS } from './fixtures/load';

const START = new Date('2026-01-01T05:00:00Z');
const t0 = performance.now();
const events = yearEvents(START, BROOKLYN, TEST_SHOWERS, 24);
const elapsed = performance.now() - t0;
const find = (pred: (e: SkyEvent) => boolean) => events.filter(pred);
const day = (e: SkyEvent) => e.date.toISOString().slice(0, 10);
const minutesFrom = (e: SkyEvent, iso: string) => Math.abs(e.date.getTime() - new Date(iso).getTime()) / 60000;

describe('yearEvents (Brooklyn, 2026–2027)', () => {
  it('is sorted, inside the requested range, and fast', () => {
    for (let i = 1; i < events.length; i++) expect(events[i].date.getTime()).toBeGreaterThanOrEqual(events[i - 1].date.getTime());
    expect(events[0].date.getTime()).toBeGreaterThanOrEqual(START.getTime());
    expect(events[events.length - 1].date.getTime()).toBeLessThan(new Date('2028-01-01T05:00:00Z').getTime());
    expect(elapsed).toBeLessThan(3000);
    const twelve = yearEvents(START, BROOKLYN, TEST_SHOWERS);
    expect(twelve[twelve.length - 1].date.getTime()).toBeLessThan(new Date('2027-01-01T05:00:00Z').getTime());
  });

  it('every event has a title, plain-sentence detail and refs', () => {
    for (const e of events) {
      expect(e.title.length).toBeGreaterThan(5);
      expect(e.detail.length).toBeGreaterThan(40);
      expect(e.detail).not.toMatch(/undefined|NaN|null|Invalid/);
      expect(e.detail.trim().endsWith('.')).toBe(true);
      expect(e.refs.length).toBeGreaterThan(0);
      for (const r of e.refs) expect(r).toMatch(/^(body|radec|con):/);
    }
  });

  // Reference dates: see docs/VERIFICATION.md ("Events") for the independent sources.
  it('Mars opposition on 19 Feb 2027; Jupiter 10 Jan 2026 and 10/11 Feb 2027; Saturn 4 Oct 2026', () => {
    const opp = find((e) => e.kind === 'opposition');
    const of = (b: string) => opp.filter((e) => e.refs[0] === `body:${b}`).map(day);
    expect(of('Mars')).toEqual(['2027-02-19']);
    expect(of('Jupiter')).toEqual(['2026-01-10', '2027-02-11']);
    expect(of('Saturn')).toEqual(['2026-10-04', '2027-10-18']);
    const mars = opp.find((e) => e.refs[0] === 'body:Mars')!;
    expect(mars.visibleHere).toBe(true);
    expect(mars.detail).toMatch(/Leo/);
    expect(mars.detail).toMatch(/highest around 12:\d\d AM/);
    expect(opp.find((e) => e.refs[0] === 'body:Neptune')!.detail).toMatch(/telescope/);
  });

  it('partial lunar eclipse of 28 Aug 2026, seen from Brooklyn late on the 27th', () => {
    const le = find((e) => e.kind === 'lunar-eclipse');
    expect(le.map((e) => `${day(e)} ${e.title}`)).toEqual([
      '2026-03-03 Total lunar eclipse', '2026-08-28 Partial lunar eclipse', '2027-02-20 Penumbral lunar eclipse', '2027-07-18 Penumbral lunar eclipse', '2027-08-17 Penumbral lunar eclipse',
    ]);
    const aug = le[1];
    expect(minutesFrom(aug, '2026-08-28T04:13:00Z')).toBeLessThan(2); // greatest eclipse 04:13 UT (NASA)
    expect(aug.visibleHere).toBe(true);
    expect(aug.detail).toMatch(/10:3\d PM/); // partial phase begins 02:34 UT = 10:34 PM EDT
    expect(aug.detail).toMatch(/12:1\d AM/);
    expect(aug.detail).toMatch(/1:5\d AM/);
    // 3 Mar 2026 total eclipse: Moon sets during totality in New York
    expect(le[0].visibleHere).toBe(true);
    expect(le[0].detail).toMatch(/below the horizon/);
    // 18 Jul 2027 happens at local noon
    expect(le[3].visibleHere).toBe(false);
  });

  it('total solar eclipse of 12 Aug 2026 is a small partial eclipse from New York', () => {
    const se = find((e) => e.kind === 'solar-eclipse');
    expect(se.map((e) => day(e))).toEqual(['2026-02-17', '2026-08-12', '2027-02-06', '2027-08-02']);
    const aug = se[1];
    expect(aug.title).toBe('Total solar eclipse — partial from Brooklyn, NY');
    expect(aug.visibleHere).toBe(true);
    expect(aug.detail).toMatch(/eclipse glasses/);
    const local = localSolarEclipse(new Date('2026-08-12T17:46:00Z'), BROOKLYN)!;
    // Independent local circumstances for New York: begins 1:07 PM, maximum 1:53 PM, ends 2:38 PM EDT, 9% covered
    expect(Math.abs(local.start.getTime() - Date.UTC(2026, 7, 12, 17, 7, 30)) / 60000).toBeLessThan(2);
    expect(Math.abs(local.max.getTime() - Date.UTC(2026, 7, 12, 17, 53, 30)) / 60000).toBeLessThan(2);
    expect(Math.abs(local.end.getTime() - Date.UTC(2026, 7, 12, 18, 38, 30)) / 60000).toBeLessThan(2);
    expect(local.obscuration).toBeGreaterThan(0.08);
    expect(local.obscuration).toBeLessThan(0.105);
    expect(local.kind).toBe('partial');
    for (const other of [se[0], se[2], se[3]]) {
      expect(other.visibleHere).toBe(false);
      expect(other.title).toMatch(/not visible from Brooklyn/);
    }
    expect(localSolarEclipse(new Date('2027-08-02T10:07:00Z'), BROOKLYN)).toBeNull();
  });

  it('meteor showers: J2000 solar longitude → date', () => {
    // Round trip
    for (const lon of [0, 32.3, 140, 262.2, 283.15, 359]) {
      const t = dateOfSolarLongitudeJ2000(lon, 2026);
      expect(t.getUTCFullYear()).toBe(2026);
      expect(Math.abs(((sunLongitudeJ2000(t) - lon + 540) % 360) - 180)).toBeLessThan(1e-5);
    }
    // The equinox of date has moved 0.37° since J2000: astronomy-engine's of-date search lands ~9 h earlier.
    const j2000 = dateOfSolarLongitudeJ2000(262.2, 2026);
    const ofDate = Astronomy.SearchSunLongitude(262.2, new Date('2026-12-01T00:00:00Z'), 30)!.date;
    const hours = (j2000.getTime() - ofDate.getTime()) / 3600000;
    expect(hours).toBeGreaterThan(8);
    expect(hours).toBeLessThan(10);

    const peaks = Object.fromEntries(find((e) => e.kind === 'meteor-shower').map((e) => [`${e.title} ${e.date.getUTCFullYear()}`, e]));
    // IMO/AMS: Perseids 12–13 Aug 2026 (λ☉ 140.0° ≈ 13 Aug 02h UT); Geminids 13–14 Dec 2026 (λ☉ 262.2° ≈ 14 Dec 14h UT)
    expect(minutesFrom(peaks['Perseids meteor shower peak 2026'], '2026-08-13T02:00:00Z')).toBeLessThan(90);
    expect(minutesFrom(peaks['Geminids meteor shower peak 2026'], '2026-12-14T14:00:00Z')).toBeLessThan(90);
    expect(day(peaks['Perseids meteor shower peak 2027'])).toBe('2027-08-13');
    expect(day(peaks['Geminids meteor shower peak 2027'])).toBe('2027-12-14');
    // AMS: "Predictions for 2027 show a peak near 3:30 UT on January 4th" (Quadrantids, λ☉ 283.15°)
    expect(minutesFrom(peaks['Quadrantids meteor shower peak 2027'], '2027-01-04T03:30:00Z')).toBeLessThan(30);
    expect(showerPeaks({ peakSolarLongitude: 283.15 }, new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'))).toHaveLength(1);

    const gem = peaks['Geminids meteor shower peak 2026'];
    expect(gem.visibleHere).toBe(true);
    expect(gem.detail).toMatch(/night of Sun, Dec 13 into the morning of Mon, Dec 14/);
    expect(gem.detail).toMatch(/Gemini/);
    expect(gem.refs).toEqual(['radec:112,33', 'con:Gem']);
    const per26 = peaks['Perseids meteor shower peak 2026'], per27 = peaks['Perseids meteor shower peak 2027'];
    expect(per26.detail).toMatch(/Moon \(\d+% lit\) will not interfere/); // New Moon on 12 Aug 2026
    expect(per27.detail).toMatch(/bright Moon/); // nearly full on 13 Aug 2027
    const n = showerNight(TEST_SHOWERS[2], gem.date, BROOKLYN);
    expect(n.darkHoursUp).toBeGreaterThan(10);
    expect(n.bestAlt).toBeGreaterThan(75);
    // A far-northern radiant never rises in a dark sky from Sydney
    const syd = yearEvents(START, SYDNEY, TEST_SHOWERS).find((e) => e.title.startsWith('Quadrantids'))!;
    expect(syd.visibleHere).toBe(false);
  });

  it('equinoxes, solstices and Moon phases', () => {
    const s = find((e) => e.kind === 'equinox' || e.kind === 'solstice').filter((e) => e.date.getUTCFullYear() === 2026);
    expect(s.map((e) => `${e.title} ${day(e)}`)).toEqual(['March equinox 2026-03-20', 'June solstice 2026-06-21', 'September equinox 2026-09-23', 'December solstice 2026-12-21']);
    expect(minutesFrom(s[0], '2026-03-20T14:46:00Z')).toBeLessThan(3);
    expect(s[3].detail).toMatch(/shortest day/);
    const phases = find((e) => e.kind === 'moon-phase' && e.date.getUTCFullYear() === 2026);
    expect(phases.filter((e) => e.title === 'Full Moon').length).toBe(13); // 2026 has 13 full moons (two in May)
    expect(phases.filter((e) => e.title === 'New Moon').length).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < phases.length; i++) expect(phases[i].title).not.toBe(phases[i - 1].title);
    const full = phases.find((e) => e.title === 'Full Moon' && day(e) === '2026-08-28')!;
    expect(full.detail).toMatch(/rises in the (east|southeast)/);
  });

  it('greatest elongations say evening or morning sky', () => {
    const el = find((e) => e.kind === 'greatest-elongation');
    expect(el.filter((e) => e.refs[0] === 'body:Mercury').length).toBeGreaterThanOrEqual(12);
    const venus = el.filter((e) => e.refs[0] === 'body:Venus');
    expect(venus.map((e) => `${day(e)} ${e.title}`)).toEqual(['2026-08-15 Venus at greatest elongation (evening sky)', '2027-01-03 Venus at greatest elongation (morning sky)']);
    for (const e of el) {
      expect(e.title).toMatch(/\((evening|morning) sky\)/);
      if (e.visibleHere) expect(e.detail).toMatch(e.title.includes('evening') ? /after sunset/ : /before sunrise/);
    }
  });

  it('conjunctions: planet pairs under 2°, Moon pairings under 3° and only when up in a dark or twilight sky', () => {
    const cj = find((e) => e.kind === 'conjunction');
    const moon = cj.filter((e) => e.refs[0] === 'body:Moon'), planets = cj.filter((e) => e.refs[0] !== 'body:Moon');
    expect(moon.length).toBeGreaterThan(10);
    expect(planets.length).toBeGreaterThan(3);
    const obs = new Astronomy.Observer(BROOKLYN.lat, BROOKLYN.lon, 10);
    const altOf = (body: string, t: Date) => {
      const eq = Astronomy.Equator(body as Astronomy.Body, t, obs, true, true);
      return Astronomy.Horizon(t, obs, eq.ra, eq.dec).altitude;
    };
    for (const e of moon) {
      const planet = e.refs[1].slice(5);
      expect(e.visibleHere).toBe(true);
      expect(altOf('Sun', e.date)).toBeLessThan(-3.5);
      expect(altOf('Moon', e.date)).toBeGreaterThan(4.5);
      expect(altOf(planet, e.date)).toBeGreaterThan(4.5);
      const a = Astronomy.Equator(Astronomy.Body.Moon, e.date, obs, false, true).vec, b = Astronomy.Equator(planet as Astronomy.Body, e.date, obs, false, true).vec;
      expect(Astronomy.AngleBetween(a, b)).toBeLessThan(3);
    }
    for (const e of planets) {
      const [a, b] = e.refs.map((r) => r.slice(5) as Astronomy.Body);
      const sep = Astronomy.AngleBetween(Astronomy.GeoVector(a, e.date, true), Astronomy.GeoVector(b, e.date, true));
      expect(sep).toBeLessThan(2);
      expect(Astronomy.AngleFromSun(a, e.date)).toBeGreaterThanOrEqual(15);
      expect(Astronomy.AngleFromSun(b, e.date)).toBeGreaterThanOrEqual(15);
      // it is a true minimum: a day either side they are further apart
      for (const dt of [-86400000, 86400000]) {
        const t = new Date(e.date.getTime() + dt);
        expect(Astronomy.AngleBetween(Astronomy.GeoVector(a, t, true), Astronomy.GeoVector(b, t, true))).toBeGreaterThan(sep);
      }
    }
    // Mars–Jupiter, 15/16 Nov 2026, 1.2° apart in the morning sky
    const mj = planets.find((e) => e.refs.join() === 'body:Mars,body:Jupiter' && day(e) === '2026-11-16')!;
    expect(mj.visibleHere).toBe(true);
    expect(mj.title).toMatch(/1\.2°/);
  });
});
