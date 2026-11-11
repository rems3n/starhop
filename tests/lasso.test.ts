import { describe, expect, it } from 'vitest';
import {
  LASSO_MAX_AREA_RATIO, convexHull, distanceToHull, enclosedArea, lassoIntruderAllowance, lassoNeed, lassoPad, lassoTargetCutoff, meanDirection,
  padHull, paddedHullArea, pointInPolygon, polygonArea, raDecToVec, scoreConstellationLasso, scoreLasso, type LassoOther, type LassoStar, type Pt,
} from '@/astro';
import type { Constellation } from '@/types';
import { loadTestCatalog } from './fixtures/load';

const square = (cx: number, cy: number, half: number): Pt[] => [{ x: cx - half, y: cy - half }, { x: cx + half, y: cy - half }, { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half }];
const circle = (cx: number, cy: number, r: number, n = 48): Pt[] => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
const star = (id: number, x: number, y: number, mag = 2): LassoStar => ({ id, x, y, mag });
const other = (id: number, x: number, y: number, con: string): LassoOther => ({ id, x, y, mag: 3, con });

/** A 7-star "Orion" about 200 px tall centred on (500, 400). */
const ORION: LassoStar[] = [star(1, 440, 300), star(2, 560, 310), star(3, 480, 395), star(4, 500, 400), star(5, 520, 405), star(6, 450, 500), star(7, 570, 490)];
/** A neighbour ("Taurus") up and to the right, well clear of Orion. */
const TAURUS: LassoOther[] = [other(101, 760, 180, 'Tau'), other(102, 800, 220, 'Tau'), other(103, 840, 160, 'Tau'), other(104, 880, 240, 'Tau'), other(105, 780, 120, 'Tau'), other(106, 900, 140, 'Tau')];

describe('geometry helpers', () => {
  it('pointInPolygon: inside, outside, either winding direction', () => {
    const sq = square(0, 0, 10);
    expect(pointInPolygon({ x: 0, y: 0 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 9.9, y: -9.9 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 10.1, y: 0 }, sq)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0 }, [...sq].reverse())).toBe(true);
    expect(pointInPolygon({ x: 0, y: 0 }, sq.slice(0, 2))).toBe(false);
    // concave "C": the notch is outside
    const c: Pt[] = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }, { x: 0, y: 30 }];
    expect(pointInPolygon({ x: 20, y: 15 }, c)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 15 }, c)).toBe(true);
  });

  it('polygonArea and enclosedArea', () => {
    expect(polygonArea(square(5, 5, 10))).toBeCloseTo(400, 9);
    expect(polygonArea([...square(5, 5, 10)].reverse())).toBeCloseTo(400, 9);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    expect(enclosedArea(circle(0, 0, 100, 180))).toBeCloseTo(Math.PI * 1e4, -2);
    // Figure-eight: the shoelace sum cancels to ~0, the enclosed area does not
    const eight: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
    expect(polygonArea(eight)).toBeCloseTo(0, 6);
    expect(enclosedArea(eight)).toBeGreaterThan(4500);
    expect(enclosedArea(eight)).toBeLessThan(5500);
  });

  it('convexHull, including degenerate input', () => {
    const h = convexHull([...square(0, 0, 10), { x: 0, y: 0 }, { x: 3, y: -2 }, { x: 10, y: 0 }]);
    expect(h).toHaveLength(4);
    expect(polygonArea(h)).toBeCloseTo(400, 9);
    expect(convexHull([])).toEqual([]);
    expect(convexHull([{ x: 1, y: 2 }, { x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
    expect(convexHull([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }])).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  });

  it('padding: distanceToHull, padHull and the exact padded area agree', () => {
    const h = convexHull(square(0, 0, 10));
    expect(distanceToHull({ x: 0, y: 0 }, h)).toBe(0);
    expect(distanceToHull({ x: 15, y: 0 }, h)).toBeCloseTo(5, 9);
    expect(distanceToHull({ x: 13, y: 14 }, h)).toBeCloseTo(5, 9);
    for (const pts of [square(0, 0, 10), [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 40, y: 10 }], [{ x: 0, y: 0 }, { x: 60, y: 5 }, { x: 30, y: 9 }]]) {
      const hull = convexHull(pts);
      const loop = padHull(pts, 30, 3);
      expect(polygonArea(loop)).toBeGreaterThan(0.99 * paddedHullArea(hull, 30));
      expect(polygonArea(loop)).toBeLessThanOrEqual(paddedHullArea(hull, 30) + 1e-6);
      for (const p of loop) expect(distanceToHull(p, hull)).toBeCloseTo(30, 6);
      for (const p of pts) expect(pointInPolygon(p, loop)).toBe(true);
    }
    expect(lassoPad(convexHull(square(0, 0, 10)))).toBe(30); // floor
    expect(lassoPad(convexHull(square(0, 0, 500)))).toBeCloseTo(0.15 * 1000 * Math.SQRT2, 6); // 15% of the extent
    expect(lassoPad(convexHull(square(0, 0, 10)), 12)).toBe(12);
  });

  it('need and allowance tables', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 10, 14].map(lassoNeed)).toEqual([1, 2, 2, 3, 4, 5, 5, 6, 7, 10]);
    expect([0, 2, 4, 5, 6, 7, 10].map(lassoIntruderAllowance)).toEqual([2, 2, 2, 2, 3, 3, 5]);
    expect(lassoTargetCutoff([0.2, 0.5, 1.6, 1.7, 3.4, 4.1], 3)).toBe(3);
    expect(lassoTargetCutoff([3.5, 3.7, 4.4, 4.4], 3)).toBe(4.4); // Sagitta under a city sky still has four stars to find
    expect(lassoTargetCutoff([5.1, 5.2], 4)).toBe(5.2);
  });
});

describe('scoreLasso — synthetic cases', () => {
  const base = { targets: ORION, others: TAURUS, targetName: 'Orion', conNames: { Tau: 'Taurus' } };

  it('ok: a loop around the whole figure', () => {
    const r = scoreLasso({ ...base, polygon: circle(505, 400, 150) });
    expect(r).toMatchObject({ correct: true, reason: 'ok', recall: 1, intruders: 0, missedTargets: [] });
    expect(r.enclosedTargets.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.areaRatio).toBeGreaterThan(0.5);
    expect(r.areaRatio).toBeLessThan(2);
    expect(r.message).toBe('Yes — you circled all 7 main stars of Orion.');
  });

  it('ok: 5 of 7 is enough, and direction of drawing does not matter', () => {
    const loop: Pt[] = [{ x: 400, y: 270 }, { x: 600, y: 270 }, { x: 600, y: 440 }, { x: 400, y: 440 }]; // misses the two feet
    const a = scoreLasso({ ...base, polygon: loop }), b = scoreLasso({ ...base, polygon: [...loop].reverse() });
    expect(a).toMatchObject({ correct: true, reason: 'ok' });
    expect(a.recall).toBeCloseTo(5 / 7, 9);
    expect(a.missedTargets.sort()).toEqual([6, 7]);
    expect(a.message).toBe('Good — you got 5 of 7 main stars of Orion.');
    expect(b).toEqual(a);
  });

  it('missed-stars: 4 of 7', () => {
    const r = scoreLasso({ ...base, polygon: [{ x: 400, y: 270 }, { x: 600, y: 270 }, { x: 600, y: 402 }, { x: 400, y: 402 }] });
    expect(r).toMatchObject({ correct: false, reason: 'missed-stars' });
    expect(r.enclosedTargets.sort()).toEqual([1, 2, 3, 4]);
    expect(r.message).toMatch(/You got 4 of 7 main stars of Orion, but you need at least 5\./);
  });

  it('missed-stars: a loop round the neighbour instead', () => {
    const r = scoreLasso({ ...base, polygon: circle(830, 180, 110) });
    expect(r).toMatchObject({ correct: false, reason: 'missed-stars', recall: 0, intruders: 6 });
    expect(r.message).toBe('That loop is around Taurus, not Orion — none of its 7 main stars are inside.');
  });

  it('too-small: a loop round the belt only', () => {
    const r = scoreLasso({ ...base, polygon: circle(500, 400, 32) });
    expect(r).toMatchObject({ correct: false, reason: 'too-small' });
    expect(r.enclosedTargets.sort()).toEqual([3, 4, 5]);
    expect(r.areaRatio).toBeLessThan(0.3);
    expect(r.message).toMatch(/too small.*only 3 of the 7 main stars of Orion/);
  });

  it('too-much-else: all of Orion but most of Taurus as well', () => {
    const r = scoreLasso({ ...base, polygon: [{ x: 400, y: 90 }, { x: 930, y: 90 }, { x: 930, y: 280 }, { x: 620, y: 540 }, { x: 400, y: 540 }] });
    expect(r).toMatchObject({ correct: false, reason: 'too-much-else', recall: 1, intruders: 6 });
    expect(r.message).toBe('You got all 7 main stars of Orion, but the loop also took in most of Taurus.');
  });

  it('too-much-else: a loop around everything on screen', () => {
    const r = scoreLasso({ ...base, polygon: square(600, 350, 1200) });
    expect(r).toMatchObject({ correct: false, reason: 'too-much-else', recall: 1 });
    expect(r.areaRatio).toBeGreaterThan(LASSO_MAX_AREA_RATIO);
  });

  it('too-much-else on area alone: nothing else on screen but a vast loop', () => {
    const r = scoreLasso({ ...base, others: [], polygon: circle(500, 400, 420) });
    expect(r).toMatchObject({ correct: false, reason: 'too-much-else', intruders: 0 });
    expect(r.message).toMatch(/much bigger than the constellation/);
  });

  it('two intruders are forgiven, three are not (with 7 enclosed the allowance is 3; with 5 it is 2)', () => {
    const near = (n: number) => Array.from({ length: n }, (_, i) => other(200 + i, 640, 330 + 40 * i, 'Eri'));
    const loop = [{ x: 400, y: 260 }, { x: 660, y: 260 }, { x: 660, y: 540 }, { x: 400, y: 540 }];
    expect(scoreLasso({ ...base, others: near(3), polygon: loop })).toMatchObject({ correct: true, intruders: 3 });
    expect(scoreLasso({ ...base, others: near(4), polygon: loop })).toMatchObject({ correct: false, reason: 'too-much-else', intruders: 4 });
    const top = [{ x: 400, y: 260 }, { x: 660, y: 260 }, { x: 660, y: 440 }, { x: 400, y: 440 }]; // 5 of 7
    expect(scoreLasso({ ...base, others: near(2), polygon: top })).toMatchObject({ correct: true, intruders: 2 });
    expect(scoreLasso({ ...base, others: near(3), polygon: top })).toMatchObject({ correct: false, reason: 'too-much-else', intruders: 3 });
  });

  it('stars of another constellation inside the target\'s own outline are not held against the learner', () => {
    const inside = [other(300, 500, 350, 'Mon'), other(301, 480, 450, 'Mon'), other(302, 530, 440, 'Mon'), other(303, 510, 330, 'Mon'), other(304, 470, 340, 'Mon')];
    expect(scoreLasso({ ...base, others: inside, polygon: circle(505, 400, 150) })).toMatchObject({ correct: true, intruders: 0 });
  });

  it('invalid: too few points, a tap, or no targets', () => {
    expect(scoreLasso({ ...base, polygon: [] })).toMatchObject({ correct: false, reason: 'invalid' });
    expect(scoreLasso({ ...base, polygon: [{ x: 400, y: 300 }, { x: 600, y: 500 }] })).toMatchObject({ correct: false, reason: 'invalid', recall: 0 });
    expect(scoreLasso({ ...base, polygon: [{ x: 500, y: 400 }, { x: 503, y: 400 }, { x: 502, y: 403 }] })).toMatchObject({ reason: 'invalid' });
    expect(scoreLasso({ ...base, polygon: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 100 }, { x: 900, y: 900 }] })).toMatchObject({ reason: 'invalid' }); // a straight stroke
    expect(scoreLasso({ ...base, polygon: [{ x: NaN, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 9 }] })).toMatchObject({ reason: 'invalid' });
    expect(scoreLasso({ ...base, targets: [], polygon: circle(500, 400, 150) })).toMatchObject({ reason: 'invalid' });
    expect(scoreLasso({ ...base, polygon: [] }).missedTargets).toHaveLength(7);
  });

  it('a tiny but real loop is "too-small", not invalid', () => {
    expect(scoreLasso({ ...base, polygon: circle(500, 400, 8) })).toMatchObject({ correct: false, reason: 'too-small' });
  });

  it('self-intersecting scribbles', () => {
    // A loop that overshoots and crosses itself where the ends meet still counts
    const loop = circle(505, 400, 150, 60);
    const overshoot = [...loop, ...loop.slice(0, 8).map((p) => ({ x: p.x + 6, y: p.y + 4 }))];
    expect(scoreLasso({ ...base, polygon: overshoot })).toMatchObject({ correct: true, reason: 'ok', recall: 1 });
    // A zig-zag across the figure encloses almost nothing
    const zig: Pt[] = Array.from({ length: 12 }, (_, i) => ({ x: i % 2 ? 600 : 400, y: 280 + i * 20 }));
    const z = scoreLasso({ ...base, polygon: zig });
    expect(z.correct).toBe(false);
    // A figure-eight whose two lobes hold the top and the bottom of Orion: both lobes count as enclosed
    const eight: Pt[] = [{ x: 400, y: 270 }, { x: 600, y: 270 }, { x: 400, y: 530 }, { x: 600, y: 530 }];
    const e = scoreLasso({ ...base, polygon: eight });
    expect(Number.isFinite(e.areaRatio)).toBe(true);
    expect(e.areaRatio).toBeGreaterThan(0.1);
    expect(e.enclosedTargets.length + e.missedTargets.length).toBe(7);
  });

  it('small constellations: n ≤ 4 allows one miss but never fewer than two stars', () => {
    const tri = [star(1, 500, 400), star(2, 530, 410), star(3, 515, 440)];
    expect(scoreLasso({ targets: tri, others: [], polygon: circle(515, 405, 28) })).toMatchObject({ correct: true, recall: 2 / 3 });
    expect(scoreLasso({ targets: tri, others: [], polygon: circle(500, 400, 12) }).correct).toBe(false);
    const two = [star(1, 500, 400), star(2, 540, 400)];
    expect(scoreLasso({ targets: two, others: [], polygon: circle(520, 400, 40) })).toMatchObject({ correct: true });
    expect(scoreLasso({ targets: two, others: [], polygon: circle(500, 400, 15) })).toMatchObject({ correct: false });
    // The pixel floor gives a 2-star figure a fair area allowance: a comfortable 70 px loop is fine, 150 px is not
    expect(scoreLasso({ targets: two, others: [], polygon: circle(520, 400, 70) })).toMatchObject({ correct: true });
    expect(scoreLasso({ targets: two, others: [], polygon: circle(520, 400, 150) })).toMatchObject({ correct: false, reason: 'too-much-else' });
    // …and minPadPx tunes that allowance
    expect(scoreLasso({ targets: two, others: [], polygon: circle(520, 400, 150), minPadPx: 80 })).toMatchObject({ correct: true });
  });
});

// ───────────────────────────── Real catalog geometry ─────────────────────────────

const cat = loadTestCatalog();

/** Stereographic projection centred on (ra0, dec0), north up, `scale` px per radian at the centre, screen centre (600, 450). */
function projector(ra0: number, dec0: number, scale: number) {
  const c = raDecToVec(ra0, dec0);
  const east = [-Math.sin((ra0 * Math.PI) / 180), Math.cos((ra0 * Math.PI) / 180), 0];
  const north = [c[1] * east[2] - c[2] * east[1], c[2] * east[0] - c[0] * east[2], c[0] * east[1] - c[1] * east[0]];
  return (ra: number, dec: number) => {
    const v = raDecToVec(ra, dec);
    const d = v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
    const k = (2 * scale) / (1 + d);
    const x = 600 - k * (v[0] * east[0] + v[1] * east[1] + v[2] * east[2]);
    const y = 450 - k * (v[0] * north[0] + v[1] * north[1] + v[2] * north[2]);
    return { x, y, visible: d > -0.5 };
  };
}

describe.runIf(!!cat)('scoreConstellationLasso — real stars', () => {
  const C = cat!;
  const con = (id: string) => C.conById.get(id)!;
  const mainPts = (c: Constellation, limitingMag: number) => {
    const stars = c.mainStars.map((id) => C.starById.get(id)!).filter(Boolean);
    const cut = lassoTargetCutoff(stars.map((s) => s.mag), limitingMag);
    return stars.filter((s) => s.mag <= cut);
  };
  const centre = (c: Constellation) => meanDirection(c.mainStars.map((id) => C.starById.get(id)!));
  /** The "ideal" loop: the padded convex hull of the stars that count, as drawn on a view centred on `view`. */
  const idealLoop = (c: Constellation, project: ReturnType<typeof projector>, limitingMag: number, padScale = 1) => {
    const pts = mainPts(c, limitingMag).map((s) => project(s.ra, s.dec));
    return padHull(pts, lassoPad(convexHull(pts)) * padScale);
  };

  it('every constellation has at least two main stars in the star catalog', () => {
    for (const c of C.constellations) {
      expect(c.mainStars.length, c.id).toBeGreaterThanOrEqual(2);
      for (const id of c.mainStars) expect(C.starById.has(id), `${c.id} ${id}`).toBe(true);
    }
  });

  it('(1) the padded convex hull of the main stars is accepted for all 88, at several zooms and sky brightnesses', () => {
    const failures: string[] = [];
    for (const scale of [350, 800, 1600]) {
      for (const limitingMag of [3.8, 4.8, 6.5]) {
        for (const c of C.constellations) {
          const m = centre(c);
          const project = projector(m.ra, m.dec, scale);
          const r = scoreConstellationLasso({ polygon: idealLoop(c, project, limitingMag), constellation: c, catalog: C, project, limitingMag });
          if (!r.correct || r.recall !== 1) failures.push(`${c.id} scale ${scale} mag ${limitingMag}: ${r.reason} — ${r.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('a loop drawn a quarter more generously than the ideal one is still accepted for the 15 anchor constellations', () => {
    const failures: string[] = [];
    for (const id of ['UMa', 'UMi', 'Cas', 'Ori', 'Tau', 'CMa', 'Gem', 'Leo', 'Boo', 'Vir', 'Sco', 'Lyr', 'Cyg', 'Aql', 'Peg']) {
      const c = con(id), m = centre(c);
      const project = projector(m.ra, m.dec, 800);
      const r = scoreConstellationLasso({ polygon: idealLoop(c, project, 4.8, 1.25), constellation: c, catalog: C, project, limitingMag: 4.8 });
      if (!r.correct) failures.push(`${id}: ${r.message}`);
    }
    expect(failures).toEqual([]);
  });

  it('(2) a loop around Orion + Taurus + Gemini is rejected for "find Orion"', () => {
    const ori = con('Ori'), m = centre(ori);
    const project = projector(m.ra, m.dec, 500);
    const all = ['Ori', 'Tau', 'Gem'].flatMap((id) => con(id).mainStars.map((s) => C.starById.get(s)!)).map((s) => project(s.ra, s.dec));
    const r = scoreConstellationLasso({ polygon: padHull(all, 20), constellation: ori, catalog: C, project, limitingMag: 4.8 });
    expect(r).toMatchObject({ correct: false, reason: 'too-much-else', recall: 1 });
    expect(r.intruders).toBeGreaterThan(8);
    expect(r.message).toMatch(/You got all \d+ main stars of Orion, but the loop also took in most of (Taurus|Gemini)\./);
  });

  it('(3) a loop around only Orion\'s Belt is rejected', () => {
    const ori = con('Ori'), m = centre(ori);
    for (const scale of [500, 1200]) {
      const project = projector(m.ra, m.dec, scale);
      const belt = ['Alnitak', 'Alnilam', 'Mintaka'].map((n) => C.stars.find((s) => s.name === n)!).map((s) => project(s.ra, s.dec));
      const r = scoreConstellationLasso({ polygon: padHull(belt, 14), constellation: ori, catalog: C, project, limitingMag: 4.8 });
      expect(r.correct).toBe(false);
      expect(['too-small', 'missed-stars']).toContain(r.reason);
      expect(r.enclosedTargets).toHaveLength(3);
      expect(r.message).toMatch(/Orion/);
    }
  });

  it('(4) the padded hull of a neighbouring constellation is rejected', () => {
    const pairs: [string, string][] = [
      ['Ori', 'Tau'], ['Tau', 'Ori'], ['Ori', 'Gem'], ['Gem', 'Ori'], ['Tau', 'Aur'], ['Aur', 'Tau'], ['Leo', 'Cnc'], ['Cnc', 'Leo'], ['UMa', 'UMi'], ['UMi', 'UMa'],
      ['Cyg', 'Lyr'], ['Lyr', 'Cyg'], ['Lyr', 'Her'], ['Aql', 'Sge'], ['Sge', 'Aql'], ['Sco', 'Sgr'], ['Sgr', 'Sco'], ['Cas', 'Cep'], ['Cep', 'Cas'], ['And', 'Peg'],
      ['Peg', 'And'], ['Boo', 'CrB'], ['CrB', 'Boo'], ['Vir', 'Leo'], ['CMa', 'Ori'], ['Gem', 'CMi'], ['CMi', 'Gem'], ['Cru', 'Cen'], ['Tri', 'Ari'], ['Ari', 'Tri'],
    ];
    for (const [target, drawn] of pairs) {
      const t = con(target), d = con(drawn), m = centre(t);
      const project = projector(m.ra, m.dec, 600);
      const r = scoreConstellationLasso({ polygon: idealLoop(d, project, 4.8), constellation: t, catalog: C, project, limitingMag: 4.8 });
      expect(r.correct, `find ${target}, drew ${drawn}: ${r.message}`).toBe(false);
    }
  });

  it('(4b) across all 88, circling one of the three nearest neighbours instead is rejected (except figures that sit inside one another)', () => {
    const accepted: string[] = [];
    const centres = new Map(C.constellations.map((c) => [c.id, raDecToVec(centre(c).ra, centre(c).dec)]));
    for (const t of C.constellations) {
      const a = centres.get(t.id)!;
      const near = C.constellations.filter((c) => c.id !== t.id)
        .map((c) => ({ c, d: -(a[0] * centres.get(c.id)![0] + a[1] * centres.get(c.id)![1] + a[2] * centres.get(c.id)![2]) }))
        .sort((x, y) => x.d - y.d).slice(0, 3);
      const m = centre(t);
      const project = projector(m.ra, m.dec, 600);
      for (const { c: d } of near) {
        const r = scoreConstellationLasso({ polygon: idealLoop(d, project, 4.8), constellation: t, catalog: C, project, limitingMag: 4.8 });
        if (r.correct) accepted.push(`${t.id}<-${d.id}`);
      }
    }
    // Known, documented exceptions: none expected. If the data changes, list them in docs/VERIFICATION.md.
    expect(accepted).toEqual([]);
  });

  it('off-screen or unseeable stars: faint main stars are not demanded under a bright sky', () => {
    const uma = con('UMa'), m = centre(uma);
    const project = projector(m.ra, m.dec, 800);
    const cityTargets = mainPts(uma, 3.0);
    expect(cityTargets.length).toBeLessThan(uma.mainStars.length);
    expect(cityTargets.length).toBeGreaterThanOrEqual(4);
    const r = scoreConstellationLasso({ polygon: idealLoop(uma, project, 3.0), constellation: uma, catalog: C, project, limitingMag: 3.0 });
    expect(r.correct).toBe(true);
    expect(r.enclosedTargets.length).toBe(cityTargets.length);
  });
});
