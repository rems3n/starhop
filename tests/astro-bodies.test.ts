import { describe, expect, it } from 'vitest';
import { BODY_IDS, altAzOf, angularSeparation, constellationAt, eclipticPath, getBodies, getBody, moonPhase } from '@/astro';
import { BROOKLYN, loadTestCatalog } from './fixtures/load';

const T = new Date('2026-11-11T02:00:00Z');

describe('bodies', () => {
  it('returns all nine bodies with consistent fields', () => {
    const all = getBodies(T, BROOKLYN);
    expect(all.map((b) => b.id)).toEqual(BODY_IDS);
    for (const b of all) {
      const single = getBody(b.id, T, BROOKLYN);
      expect(single).toEqual(b);
      // alt/az must agree with the star path applied to the body's own J2000 position
      const h = altAzOf(b.ra, b.dec, T, BROOKLYN);
      expect(h.alt).toBeCloseTo(b.alt, 8);
      expect(b.phase).toBeGreaterThanOrEqual(0);
      expect(b.phase).toBeLessThanOrEqual(1);
      expect(b.con).toMatch(/^[A-Z][A-Za-z]{2}$/);
    }
    const by = Object.fromEntries(all.map((b) => [b.id, b]));
    expect(by.Sun.elongation).toBe(0);
    expect(by.Sun.mag).toBeLessThan(-26);
    expect(by.Sun.angularDiameterArcsec / 3600).toBeCloseTo(0.54, 1);
    expect(by.Moon.angularDiameterArcsec / 3600).toBeGreaterThan(0.48);
    expect(by.Moon.angularDiameterArcsec / 3600).toBeLessThan(0.57);
    expect(by.Venus.mag).toBeLessThan(-3.5);
    expect(by.Jupiter.angularDiameterArcsec).toBeGreaterThan(30);
    expect(by.Neptune.mag).toBeGreaterThan(7);
    expect(by.Mercury.elongation).toBeLessThan(29);
    expect(by.Venus.elongation).toBeLessThan(48);
  });

  it('the Moon is seen from the surface, not the centre of the Earth (parallax)', () => {
    const here = getBody('Moon', T, BROOKLYN);
    const far = getBody('Moon', T, { ...BROOKLYN, lat: -40, lon: 100 });
    const d = angularSeparation(here, far);
    expect(d).toBeGreaterThan(0.3);
    expect(d).toBeLessThan(2.1);
  });

  it('constellation abbreviations match the catalog ids everywhere on the sky', () => {
    const seen = new Set<string>();
    for (let ra = 0; ra < 360; ra += 2) for (let dec = -89; dec <= 89; dec += 2) seen.add(constellationAt(ra, dec));
    expect(seen.size).toBe(88);
    expect(seen.has('Ser')).toBe(true);
    expect(constellationAt(236, 6.4)).toBe('Ser'); // Serpens Caput
    expect(constellationAt(276, -3)).toBe('Ser'); // Serpens Cauda
    expect(constellationAt(83.8, -5.4)).toBe('Ori');
    const cat = loadTestCatalog();
    if (cat) for (const id of seen) expect(cat.conById.has(id), id).toBe(true);
  });

  it('moon phase names and angles', () => {
    // Full Moon of 2026-08-28 (the partial lunar eclipse) and New Moon of 2026-08-12 (the solar eclipse)
    const full = moonPhase(new Date('2026-08-28T04:13:00Z'));
    expect(full.name).toBe('Full Moon');
    expect(full.illumination).toBeGreaterThan(0.99);
    expect(full.phaseAngle).toBeCloseTo(180, 0);
    const neu = moonPhase(new Date('2026-08-12T17:37:00Z'));
    expect(neu.name).toBe('New Moon');
    expect(neu.illumination).toBeLessThan(0.01);
    expect(moonPhase(new Date('2026-08-20T03:00:00Z')).name).toBe('First Quarter');
    expect(moonPhase(new Date('2026-08-16T03:00:00Z')).name).toBe('Waxing Crescent');
    expect(moonPhase(new Date('2026-08-24T03:00:00Z')).name).toBe('Waxing Gibbous');
    expect(moonPhase(new Date('2026-09-01T03:00:00Z')).name).toBe('Waning Gibbous');
    expect(moonPhase(new Date('2026-09-08T03:00:00Z')).name).toBe('Waning Crescent');
  });

  it('ecliptic path: closed, tilted 23.4°, and the Sun lies on it', () => {
    const p = eclipticPath();
    expect(p.length).toBe(181);
    expect(p[0].ra).toBeCloseTo(0, 6);
    expect(p[0].dec).toBeCloseTo(0, 6);
    expect(p[180]).toEqual(p[0]);
    expect(Math.max(...p.map((x) => x.dec))).toBeCloseTo(23.44, 1);
    expect(Math.min(...p.map((x) => x.dec))).toBeCloseTo(-23.44, 1);
    const sun = getBody('Sun', T, BROOKLYN);
    const fine = eclipticPath(1440);
    expect(Math.min(...fine.map((x) => angularSeparation(x, sun)))).toBeLessThan(0.15);
  });
});
