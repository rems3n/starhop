import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
  altAzOf, angularSeparation, applyMat3, eqjToHorMatrix, horToEqjMatrix, localSiderealTimeDeg, makeAltAz, mulMat3, norm180,
  positionAngle, raDecOfAltAz, raDecToVec, refractionDeg, vecToRaDec,
} from '@/astro';
import { BROOKLYN, SYDNEY } from './fixtures/load';

const T = new Date('2026-11-11T02:00:00Z');

describe('frames', () => {
  it('raDec ⇄ vector round-trips', () => {
    for (const [ra, dec] of [[0, 0], [83.8, -5.4], [359.9, 89], [180, -89.5], [271.3, 45]]) {
      const r = vecToRaDec(raDecToVec(ra, dec));
      expect(norm180(r.ra - ra)).toBeCloseTo(0, 9);
      expect(r.dec).toBeCloseTo(dec, 9);
    }
  });

  it('eqj→hor and hor→eqj are inverse rotations', () => {
    const m = mulMat3(eqjToHorMatrix(T, BROOKLYN), horToEqjMatrix(T, BROOKLYN));
    [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(m[i]).toBeCloseTo(v, 12));
  });

  it('altAz ⇄ raDec round-trips for both hemispheres', () => {
    for (const obs of [BROOKLYN, SYDNEY]) {
      for (const [ra, dec] of [[101.287, -16.716], [279.23, 38.78], [37.95, 89.26], [10, -70]]) {
        const h = altAzOf(ra, dec, T, obs);
        const back = raDecOfAltAz(h.az, h.alt, T, obs);
        expect(angularSeparation(back, { ra, dec })).toBeLessThan(1e-8);
      }
    }
  });

  it('axis convention: x = north, y = west, z = zenith; azimuth 90 = east', () => {
    const m = eqjToHorMatrix(T, BROOKLYN);
    const east = raDecOfAltAz(90, 0, T, BROOKLYN);
    const h = applyMat3(m, raDecToVec(east.ra, east.dec));
    expect(h[0]).toBeCloseTo(0, 9);
    expect(h[1]).toBeCloseTo(-1, 9);
    const zen = raDecOfAltAz(0, 90, T, BROOKLYN);
    expect(applyMat3(m, raDecToVec(zen.ra, zen.dec))[2]).toBeCloseTo(1, 9);
    // The zenith's declination of date equals the latitude (J2000 dec differs only by precession).
    expect(Math.abs(zen.dec - BROOKLYN.lat)).toBeLessThan(0.2);
  });

  it('matches astronomy-engine Horizon() for of-date coordinates', () => {
    const obs = new Astronomy.Observer(BROOKLYN.lat, BROOKLYN.lon, BROOKLYN.elevationM ?? 0);
    for (const [ra, dec] of [[101.287, -16.716], [279.23, 38.78], [213.9, 19.18]]) {
      const v = raDecToVec(ra, dec);
      const eqd = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(T), new Astronomy.Vector(v[0], v[1], v[2], Astronomy.MakeTime(T))));
      const ref = Astronomy.Horizon(T, obs, eqd.ra, eqd.dec);
      const mine = altAzOf(ra, dec, T, BROOKLYN);
      expect(mine.alt).toBeCloseTo(ref.altitude, 6);
      expect(norm180(mine.az - ref.azimuth)).toBeCloseTo(0, 6);
    }
  });

  it('makeAltAz equals altAzOf', () => {
    const f = makeAltAz(T, BROOKLYN);
    for (let i = 0; i < 50; i++) {
      const ra = (i * 37.7) % 360, dec = ((i * 13.3) % 170) - 85;
      const a = f(ra, dec), b = altAzOf(ra, dec, T, BROOKLYN);
      expect(a.alt).toBeCloseTo(b.alt, 10);
      expect(norm180(a.az - b.az)).toBeCloseTo(0, 9);
    }
  });

  it('Polaris sits at about the latitude, due north', () => {
    for (const t of ['2026-01-15T03:00:00Z', '2026-07-15T03:00:00Z', '2026-11-11T09:00:00Z']) {
      const p = altAzOf(37.9546, 89.2641, new Date(t), BROOKLYN);
      expect(Math.abs(p.alt - BROOKLYN.lat)).toBeLessThan(1);
      expect(Math.abs(norm180(p.az))).toBeLessThan(1.5);
    }
  });

  it('refraction lifts objects near the horizon by about half a degree', () => {
    expect(refractionDeg(0)).toBeGreaterThan(0.4);
    expect(refractionDeg(0)).toBeLessThan(0.65);
    expect(refractionDeg(45)).toBeLessThan(0.03);
    const a = altAzOf(101.287, -16.716, T, BROOKLYN), b = altAzOf(101.287, -16.716, T, BROOKLYN, { refraction: true });
    expect(b.alt).toBeGreaterThanOrEqual(a.alt);
  });

  it('angular separation and position angle', () => {
    expect(angularSeparation({ ra: 10, dec: 0 }, { ra: 25, dec: 0 })).toBeCloseTo(15, 9);
    expect(angularSeparation({ ra: 0, dec: 89 }, { ra: 180, dec: 89 })).toBeCloseTo(2, 9);
    expect(angularSeparation({ ra: 50, dec: 20 }, { ra: 50, dec: 20 })).toBe(0);
    // Betelgeuse – Rigel ≈ 18.6°
    expect(angularSeparation({ ra: 88.793, dec: 7.407 }, { ra: 78.634, dec: -8.202 })).toBeCloseTo(18.6, 1);
    expect(positionAngle({ ra: 10, dec: 0 }, { ra: 10, dec: 5 })).toBeCloseTo(0, 6);
    expect(positionAngle({ ra: 10, dec: 0 }, { ra: 11, dec: 0 })).toBeCloseTo(90, 6);
    expect(positionAngle({ ra: 10, dec: 0 }, { ra: 10, dec: -5 })).toBeCloseTo(180, 6);
    expect(positionAngle({ ra: 10, dec: 0 }, { ra: 9, dec: 0 })).toBeCloseTo(270, 6);
  });

  it('local sidereal time: an object on the meridian has RA (of date) = LST', () => {
    const lst = localSiderealTimeDeg(T, BROOKLYN.lon);
    const south = raDecOfAltAz(180, 30, T, BROOKLYN);
    // J2000 RA vs of-date LST differ by precession (≈ 0.34° by 2026)
    expect(Math.abs(norm180(south.ra - lst))).toBeLessThan(0.5);
    expect(norm180(localSiderealTimeDeg(T, 0) - lst)).toBeCloseTo(-BROOKLYN.lon, 9);
  });
});
