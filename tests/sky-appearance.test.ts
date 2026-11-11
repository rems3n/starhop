import { describe, expect, it } from 'vitest';
import { bvToRgb, lightPollution, limitFade, milkyWayVisibility, parseCssColor, starAlpha, starRadius, starZoom, twilightLimit } from '@/sky/color';
import { PICK_RADIUS, PickAccumulator, TIER_BODY, TIER_LABEL, TIER_NAMED, TIER_STAR, choosePick, decimate, pointInPolygon } from '@/sky/pick';
import { circlePoints, densify, formatSeparation, trailLabelPlan } from '@/sky/highlights';
import { unwrapRing } from '@/sky/milkyway';
import { angleBetween, lonLatToVec } from '@/sky/camera';
import { countBelow } from '@/sky/renderer';

describe('star appearance curves', () => {
  it('radius never grows with fainter magnitude and never drops below ~1 px across', () => {
    let prev = Infinity;
    for (let m = -1.5; m <= 8; m += 0.05) {
      const r = starRadius(m);
      expect(r).toBeLessThanOrEqual(prev + 1e-12);
      expect(r * 2 * starZoom(160)).toBeGreaterThanOrEqual(1);
      prev = r;
    }
    expect(starRadius(-1.46)).toBeGreaterThan(starRadius(1) * 1.4);
    expect(starRadius(-1.46)).toBeLessThan(9);
  });
  it('brightness is monotonic and bounded', () => {
    let prev = Infinity;
    for (let m = -1.5; m <= 8; m += 0.1) {
      const a = starAlpha(m);
      expect(a).toBeLessThanOrEqual(prev);
      expect(a).toBeGreaterThan(0.3);
      expect(a).toBeLessThanOrEqual(1);
      prev = a;
    }
  });
  it('limiting magnitude fades rather than pops', () => {
    expect(limitFade(6.0, 6.0)).toBe(0);
    expect(limitFade(5.0, 6.0)).toBe(1);
    const mid = limitFade(5.8, 6.0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
  it('zoom factor is bounded and grows as the field narrows', () => {
    expect(starZoom(10)).toBeGreaterThan(starZoom(100));
    expect(starZoom(1)).toBeLessThanOrEqual(1.9);
    expect(starZoom(160)).toBeGreaterThanOrEqual(0.82);
  });
});

describe('B−V colour', () => {
  it('blue stars are blue, red stars are orange-red, the Sun is near white', () => {
    const rigel = bvToRgb(-0.03), spica = bvToRgb(-0.23), betelgeuse = bvToRgb(1.85), antares = bvToRgb(1.83), sun = bvToRgb(0.65);
    for (const c of [rigel, spica]) {
      expect(c[2]).toBe(1);
      expect(c[0]).toBeLessThan(0.85);
    }
    for (const c of [betelgeuse, antares]) {
      expect(c[0]).toBe(1);
      expect(c[2]).toBeLessThan(0.4);
      expect(c[1]).toBeGreaterThan(c[2]);
      expect(c[1]).toBeLessThan(0.7);
    }
    expect(Math.max(...sun) - Math.min(...sun)).toBeLessThan(0.25);
  });
  it('is continuous, clamped, in range, and defaults sensibly', () => {
    let prev = bvToRgb(-0.4);
    for (let bv = -0.4; bv <= 2.4; bv += 0.01) {
      const c = bvToRgb(bv);
      for (let k = 0; k < 3; k++) {
        expect(c[k]).toBeGreaterThanOrEqual(0);
        expect(c[k]).toBeLessThanOrEqual(1);
        expect(Math.abs(c[k] - prev[k])).toBeLessThan(0.02);
      }
      // redness (R − B) increases monotonically with B−V
      expect(c[0] - c[2]).toBeGreaterThanOrEqual(prev[0] - prev[2] - 1e-9);
      prev = c;
    }
    expect(bvToRgb(-5)).toEqual(bvToRgb(-0.4));
    expect(bvToRgb(9)).toEqual(bvToRgb(2.4));
    expect(bvToRgb(undefined)).toEqual(bvToRgb(0.6));
    expect(bvToRgb(NaN)).toEqual(bvToRgb(0.6));
  });
});

describe('sky brightness rules', () => {
  it('twilight limit: dark sky unlimited, daylight hides every star, monotonic in between', () => {
    expect(twilightLimit(-30)).toBeGreaterThan(8);
    expect(twilightLimit(10)).toBeLessThan(-1.5); // even Sirius is gone
    let prev = Infinity;
    for (let a = -18; a <= 10; a += 0.5) {
      const l = twilightLimit(a);
      expect(l).toBeLessThanOrEqual(prev);
      prev = l;
    }
  });
  it('light pollution and Milky Way follow the limiting magnitude', () => {
    expect(lightPollution(4.5)).toBeGreaterThan(0.95);
    expect(lightPollution(3.8)).toBeGreaterThan(0.95);
    expect(lightPollution(6.5)).toBeLessThan(0.06);
    expect(lightPollution(7.6)).toBe(0);
    expect(milkyWayVisibility(5.0)).toBe(0);
    expect(milkyWayVisibility(4.0)).toBe(0);
    expect(milkyWayVisibility(7.3)).toBe(1);
    expect(milkyWayVisibility(6.0)).toBeGreaterThan(0.2);
  });
});

describe('CSS colour parsing', () => {
  it('reads the token formats used in tokens.css', () => {
    expect(parseCssColor(' rgba(132, 164, 255, 0.5) ', [0, 0, 0, 1])).toEqual([132 / 255, 164 / 255, 1, 0.5]);
    expect(parseCssColor('#f0b45c', [0, 0, 0, 1])).toEqual([240 / 255, 180 / 255, 92 / 255, 1]);
    expect(parseCssColor('#fff', [0, 0, 0, 1])).toEqual([1, 1, 1, 1]);
    expect(parseCssColor('rgb(10 20 30 / 50%)', [0, 0, 0, 1])).toEqual([10 / 255, 20 / 255, 30 / 255, 0.5]);
    expect(parseCssColor('', [0.1, 0.2, 0.3, 0.4])).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(parseCssColor('papayawhip', [0.1, 0.2, 0.3, 0.4])).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});

describe('picking priority', () => {
  it('planets beat named stars beat constellation names beat other stars', () => {
    const all = [
      { tier: TIER_STAR, dist: 1, item: 'faint star' },
      { tier: TIER_LABEL, dist: 0, item: 'constellation' },
      { tier: TIER_NAMED, dist: 9, item: 'named star' },
      { tier: TIER_BODY, dist: 13, item: 'planet' },
    ];
    expect(choosePick(all)).toBe('planet');
    expect(choosePick(all.slice(0, 3))).toBe('named star');
    expect(choosePick(all.slice(0, 2))).toBe('constellation');
    expect(choosePick(all.slice(0, 1))).toBe('faint star');
  });
  it('nearest wins inside a tier; nothing beyond the pick radius; big discs are easier to hit', () => {
    expect(choosePick([{ tier: TIER_NAMED, dist: 8, item: 'a' }, { tier: TIER_NAMED, dist: 3, item: 'b' }])).toBe('b');
    expect(choosePick([{ tier: TIER_STAR, dist: PICK_RADIUS + 0.1, item: 'x' }])).toBeNull();
    expect(choosePick([{ tier: TIER_STAR, dist: PICK_RADIUS, item: 'x' }])).toBe('x');
    expect(choosePick([{ tier: TIER_BODY, dist: 40, radius: 50, item: 'moon' }])).toBe('moon');
    expect(choosePick([])).toBeNull();
  });
  it('the streaming accumulator agrees with choosePick', () => {
    const acc = new PickAccumulator();
    acc.offer(TIER_STAR, 2, 0, 2, 10);
    acc.offer(TIER_NAMED, 12, 0, 2, 11);
    acc.offer(TIER_NAMED, 5, 0, 3, 12);
    acc.offer(TIER_BODY, 30, 0, 1, 13);
    expect(acc.hit).toBe(true);
    expect([acc.kind, acc.index]).toEqual([3, 12]);
    acc.reset();
    expect(acc.hit).toBe(false);
  });
  it('lasso helpers', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon(5, 5, sq)).toBe(true);
    expect(pointInPolygon(15, 5, sq)).toBe(false);
    const many = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: 0 }));
    const d = decimate(many, 300);
    expect(d.length).toBe(300);
    expect(d[0]).toEqual(many[0]);
    expect(d[299]).toEqual(many[999]);
    expect(decimate(sq, 300).length).toBe(4);
  });
});

describe('highlight geometry', () => {
  it('circle points sit at the requested angular radius', () => {
    const c = [0, 0, 0];
    lonLatToVec(37.95, 89.26, c);
    const pts = circlePoints(c, 10);
    for (let i = 0; i < pts.length; i += 3) expect(angleBetween(c[0], c[1], c[2], pts[i], pts[i + 1], pts[i + 2])).toBeCloseTo(10, 9);
  });
  it('densify keeps the end points and limits the step', () => {
    const a = [0, 0, 0], b = [0, 0, 0];
    lonLatToVec(0, 0, a);
    lonLatToVec(90, 0, b);
    const open = densify([a, b], false);
    expect(open.length / 3).toBe(46);
    expect(open[open.length - 2]).toBeCloseTo(1, 12);
    const closed = densify([a, b], true);
    expect(closed.length / 3).toBe(90);
  });
  it('separation labels', () => {
    expect(formatSeparation(25.2)).toBe('25°');
    expect(formatSeparation(4.26)).toBe('4.3°');
    expect(formatSeparation(0.5)).toBe('30′');
  });
  it('trail label plan picks sensible intervals', () => {
    const day = 86400e3;
    expect(trailLabelPlan(0, 12 * 3600e3, 1)).toEqual({ every: 2, mode: 'time' });
    const year = trailLabelPlan(0, 240 * day, 24);
    expect(year.mode).toBe('date');
    expect(240 / year.every).toBeLessThanOrEqual(8);
    expect(trailLabelPlan(0, 10 * day, 24).every).toBe(2);
  });
});

describe('data helpers', () => {
  it('unwrapRing keeps rings continuous across RA 0/360 and detects rings that circle the sky', () => {
    const crossing: [number, number][] = [[350, 0], [5, 0], [5, 10], [350, 10]];
    const u = unwrapRing(crossing);
    expect(u.pts.map((p) => p[0])).toEqual([350, 365, 365, 350]);
    expect(u.winds).toBe(0);
    const around: [number, number][] = Array.from({ length: 36 }, (_, i) => [i * 10, 20] as [number, number]);
    expect(Math.abs(unwrapRing(around).winds)).toBe(1);
  });
  it('countBelow is a correct binary search on sorted magnitudes', () => {
    const m = new Float32Array([-1.4, 0, 0.5, 2, 2, 3.5, 6.4]);
    expect(countBelow(m, -2)).toBe(0);
    expect(countBelow(m, 2)).toBe(3);
    expect(countBelow(m, 2.01)).toBe(5);
    expect(countBelow(m, 99)).toBe(7);
  });
});
