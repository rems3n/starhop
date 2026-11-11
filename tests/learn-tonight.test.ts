import { describe, expect, it } from 'vitest';
import { constellationPoints, tonight } from '@/astro';
import type { TonightItem, VisibilityClass } from '@/types';
import { buildFigure } from '@/modes/learn/logic/figure';
import { eveningOf, pickEvening, placeTarget } from '@/modes/learn/logic/place';
import { aroundTime, darknessSentence, groupTonight, heightWords, moonSentence, nightPartOf, placePhrase } from '@/modes/learn/logic/tonight';
import { BROOKLYN } from './fixtures/load';
import { learnCatalog } from './learn-catalog';

const cat = learnCatalog();
const tz = BROOKLYN.tz;
const item = (name: string, kind: TonightItem['kind'], cls: VisibilityClass, iso: string | null, alt = 40, az = 180): TonightItem => ({
  ref: `x:${name}`, name, kind, visibility: { cls, darkHours: 3, bestTime: iso ? new Date(iso) : null, bestAlt: alt, bestAz: az },
});

describe('plain-language phrases', () => {
  it('names the part of the night by the local clock', () => {
    expect(nightPartOf(new Date('2026-11-10T23:00:00Z'), tz)).toBe('early-evening'); // 6 pm
    expect(nightPartOf(new Date('2026-11-11T02:29:00Z'), tz)).toBe('early-evening'); // 9:29 pm
    expect(nightPartOf(new Date('2026-11-11T02:30:00Z'), tz)).toBe('late-evening');
    expect(nightPartOf(new Date('2026-11-11T05:00:00Z'), tz)).toBe('after-midnight'); // midnight
    expect(nightPartOf(new Date('2026-11-11T08:59:00Z'), tz)).toBe('after-midnight');
    expect(nightPartOf(new Date('2026-11-11T09:00:00Z'), tz)).toBe('before-dawn'); // 4 am
  });
  it('rounds times to the half hour', () => {
    expect(aroundTime(new Date('2026-11-11T02:10:00Z'), tz)).toBe('around 9 pm');
    expect(aroundTime(new Date('2026-11-11T02:20:00Z'), tz)).toBe('around 9:30 pm');
    expect(aroundTime(new Date('2026-11-11T04:50:00Z'), tz)).toBe('around midnight');
    expect(aroundTime(new Date('2026-11-11T10:40:00Z'), tz)).toBe('around 5:30 am');
    expect(aroundTime(new Date('2026-11-11T17:05:00Z'), tz)).toBe('around noon');
  });
  it('describes height and direction', () => {
    expect(heightWords(60, 135)).toBe('high in the southeast');
    expect(heightWords(30, 270)).toBe('halfway up in the west');
    expect(heightWords(12, 5)).toBe('low in the north');
    expect(heightWords(80, 90)).toBe('nearly overhead');
    expect(placePhrase(item('a', 'star', 'evening', '2026-11-11T02:00:00Z', 62, 140), tz)).toBe('high in the southeast around 9 pm');
    expect(placePhrase(item('a', 'star', 'not-visible', null), tz)).toBe('not visible tonight');
  });
  it('writes the darkness and Moon lines', () => {
    const f = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : '—');
    const d = (h: string) => new Date(`2026-11-10T${h}:00Z`);
    expect(darknessSentence({ sunset: d('21:42'), sunrise: null, civilDusk: null, nauticalDusk: d('22:44'), astroDusk: d('23:15'), astroDawn: null, nauticalDawn: null, civilDawn: null }, f)).toBe('The Sun sets at 21:42. The sky is dark enough for stars by 22:44 and fully dark at 23:15.');
    expect(darknessSentence({ sunset: null, sunrise: null, civilDusk: null, nauticalDusk: null, astroDusk: null, astroDawn: null, nauticalDawn: null, civilDawn: null }, f)).toMatch(/does not rise/);
    expect(darknessSentence({ sunset: d('21:42'), sunrise: d('03:00'), civilDusk: null, nauticalDusk: null, astroDusk: null, astroDawn: null, nauticalDawn: null, civilDawn: null }, f)).toMatch(/never gets fully dark/);
    expect(moonSentence('Waxing Gibbous', 0.823)).toBe('Waxing gibbous, 82% lit');
  });
});

describe('grouping tonight', () => {
  it('puts each visible thing in the part of the night when it is best, and hides the rest', () => {
    const g = groupTonight(
      {
        planets: [item('Saturn', 'body', 'evening', '2026-11-11T01:00:00Z'), item('Jupiter', 'body', 'morning', '2026-11-11T10:30:00Z'), item('Mercury', 'body', 'not-visible', null)],
        brightStars: [item('Vega', 'star', 'evening', '2026-11-10T23:00:00Z'), item('Sirius', 'star', 'morning', '2026-11-11T07:30:00Z'), item('Capella', 'star', 'all-night', '2026-11-11T07:00:00Z', 85)],
        constellations: [item('Pegasus', 'constellation', 'evening', '2026-11-11T00:30:00Z'), item('Orion', 'constellation', 'morning', '2026-11-11T06:40:00Z'), item('Crux', 'constellation', 'not-visible', null), item('Cetus', 'constellation', 'evening', '2026-11-11T03:10:00Z')],
      },
      tz,
    );
    const by = Object.fromEntries(g.groups.map((x) => [x.part, x]));
    expect(by['early-evening'].planets.map((i) => i.name)).toEqual(['Saturn']);
    expect(by['early-evening'].stars.map((i) => i.name)).toEqual(['Vega']);
    expect(by['early-evening'].constellations.map((i) => i.name)).toEqual(['Pegasus']);
    expect(by['late-evening'].constellations.map((i) => i.name)).toEqual(['Cetus']);
    expect(by['after-midnight'].stars.map((i) => i.name)).toEqual(['Capella', 'Sirius']);
    expect(by['after-midnight'].constellations.map((i) => i.name)).toEqual(['Orion']);
    expect(by['before-dawn'].planets.map((i) => i.name)).toEqual(['Jupiter']);
    expect(g.groups.map((x) => x.count)).toEqual([3, 1, 3, 1]);
    expect(g.hidden.planets.map((i) => i.name)).toEqual(['Mercury']);
    expect(g.hidden.constellations.map((i) => i.name)).toEqual(['Crux']);
  });
  it('accounts for every candidate of a real night exactly once', () => {
    const t = tonight(new Date('2026-11-11T01:00:00Z'), BROOKLYN, cat);
    const g = groupTonight(t, tz);
    const placed = g.groups.reduce((n, x) => n + x.count, 0);
    const hidden = g.hidden.planets.length + g.hidden.stars.length + g.hidden.constellations.length;
    expect(placed + hidden).toBe(t.planets.length + t.brightStars.length + t.constellations.length);
    const all = g.groups.flatMap((x) => x.constellations.map((i) => i.name));
    expect(all).toContain('Pegasus');
    expect(g.hidden.constellations.map((i) => i.name)).toContain('Crux');
    for (const grp of g.groups) for (const list of [grp.planets, grp.stars, grp.constellations]) for (let i = 1; i < list.length; i++) expect(list[i].visibility.bestTime!.getTime()).toBeGreaterThanOrEqual(list[i - 1].visibility.bestTime!.getTime());
  });
});

describe('choosing when to show something', () => {
  const now = new Date('2026-11-11T01:00:00Z');
  const ctx = { observer: BROOKLYN, bortle: 6, now, resolve: cat.resolve };
  const pts = (id: string) => constellationPoints(cat.conById.get(id)!, cat);
  it('shows the real sky at the best time when the target is up tonight', () => {
    const p = placeTarget('con:Peg', { points: pts('Peg') }, now, ctx, { fov: 70 });
    expect(p.mode).toBe('sky');
    expect(p.scene.view.mount).toBe('altaz');
    expect(p.scene.time).toEqual(p.visibility.bestTime);
    expect(p.scene.target!.alt).toBeGreaterThan(30);
    expect(p.scene.layers.ground).toBe(true);
  });
  it('falls back to a horizon-free chart for something that never rises here', () => {
    const p = placeTarget('con:Cru', { points: pts('Cru') }, now, ctx);
    expect(p.mode).toBe('chart');
    expect(p.scene.view.mount).toBe('equatorial');
    expect(p.scene.layers).toMatchObject({ ground: false, horizon: false, atmosphere: false });
    expect(p.scene.view.lat).toBeLessThan(-50);
  });
  it('picks tonight when it works, otherwise a preferred month, otherwise gives up', () => {
    const star = (r: string) => {
      const t = cat.resolve(r)!;
      return { ra: t.ra, dec: t.dec };
    };
    expect(pickEvening([star('star:Polaris')], BROOKLYN, now, [4]).from).toBe('tonight');
    const orion = pickEvening([star('star:Betelgeuse'), star('star:Rigel')], BROOKLYN, now, [1, 2]); // Orion is not up at 9 pm in mid-November
    expect(orion.from).toBe(1);
    expect(eveningOf(orion.time, BROOKLYN.tz).getTime()).toBe(orion.time.getTime());
    expect(pickEvening([star('star:Acrux')], BROOKLYN, now, [5]).from).toBeNull();
  });
});

describe('stick figures', () => {
  it('fits the figure in the box, north up and east to the left', () => {
    const ori = cat.conById.get('Ori')!;
    const f = buildFigure(ori.lines, 72, 8);
    expect(f.d.startsWith('M')).toBe(true);
    expect(f.dots.length).toBeGreaterThan(6);
    for (const p of f.dots) {
      expect(p.x).toBeGreaterThanOrEqual(7.9);
      expect(p.x).toBeLessThanOrEqual(64.1);
      expect(p.y).toBeGreaterThanOrEqual(7.9);
      expect(p.y).toBeLessThanOrEqual(64.1);
    }
    // two points: B is north-east of A → drawn above and to the left
    const two = buildFigure([[[80, 0], [85, 5]]], 100, 10);
    expect(two.dots[1].x).toBeLessThan(two.dots[0].x);
    expect(two.dots[1].y).toBeLessThan(two.dots[0].y);
  });
  it('handles a figure across RA 0h and an empty one', () => {
    const f = buildFigure([[[359, 10], [1, 12]]], 60, 6);
    expect(Math.abs(f.dots[0].x - f.dots[1].x)).toBeLessThanOrEqual(48.1);
    expect(f.dots.every((p) => isFinite(p.x) && isFinite(p.y))).toBe(true);
    expect(buildFigure([], 60)).toEqual({ d: '', dots: [], size: 60 });
  });
});
