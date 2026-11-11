/**
 * The few astronomy calls the sky engine needs, straight from astronomy-engine.
 * (src/astro is the app-wide astronomy module; the engine keeps its own thin layer so it has no
 * dependency on it.)
 */
import * as Astronomy from 'astronomy-engine';
import type { BodyId, Observer } from '@/types';
import { DEG, RAD, type Mat3 } from './camera';

export const BODY_IDS: BodyId[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

const AU_KM = 149597870.7;
/** Mean radii, km (IAU 2015 nominal / NASA fact sheet values) */
const RADIUS_KM: Record<BodyId, number> = {
  Sun: 695700, Moon: 1737.4, Mercury: 2439.7, Venus: 6051.8, Mars: 3389.5, Jupiter: 69911, Saturn: 58232, Uranus: 25362, Neptune: 24622,
};
/** Display colours (0..1) */
export const BODY_COLOR: Record<BodyId, [number, number, number]> = {
  Sun: [1.0, 0.96, 0.84],
  Moon: [0.93, 0.92, 0.88],
  Mercury: [0.8, 0.76, 0.72],
  Venus: [1.0, 0.97, 0.86],
  Mars: [1.0, 0.56, 0.36],
  Jupiter: [0.99, 0.89, 0.73],
  Saturn: [0.96, 0.86, 0.6],
  Uranus: [0.66, 0.9, 0.92],
  Neptune: [0.52, 0.67, 1.0],
};

function aeObserver(o: Observer): Astronomy.Observer {
  return new Astronomy.Observer(o.lat, o.lon, o.elevationM ?? 0);
}

/**
 * J2000 equatorial → local (North, East, Up) rotation for a place and instant, row-major.
 * Built from astronomy-engine's Rotation_EQJ_HOR (precession + nutation + Earth rotation); its horizontal
 * frame is (North, West, Up), so the middle row is negated. No atmospheric refraction.
 */
export function eqjToNeu(date: Date, observer: Observer, out: Mat3): Mat3 {
  const r = Astronomy.Rotation_EQJ_HOR(date, aeObserver(observer)).rot;
  // astronomy-engine stores rot[column][row]
  out[0] = r[0][0]; out[1] = r[1][0]; out[2] = r[2][0];
  out[3] = -r[0][1]; out[4] = -r[1][1]; out[5] = -r[2][1];
  out[6] = r[0][2]; out[7] = r[1][2]; out[8] = r[2][2];
  return out;
}

export interface BodyInfo {
  id: BodyId;
  /** Topocentric J2000 unit vector */
  x: number;
  y: number;
  z: number;
  ra: number;
  dec: number;
  distAu: number;
  mag: number;
  /** Angular radius, degrees */
  radiusDeg: number;
  /** Illuminated fraction 0..1 */
  phase: number;
  /** Angle from the Sun as seen by the observer, degrees */
  elongation: number;
}

export function makeBodies(): BodyInfo[] {
  return BODY_IDS.map((id) => ({ id, x: 1, y: 0, z: 0, ra: 0, dec: 0, distAu: 1, mag: 0, radiusDeg: 0, phase: 1, elongation: 0 }));
}

/** Fill `out` (from makeBodies) with positions for the instant: topocentric J2000 so they line up with the catalog. */
export function computeBodies(date: Date, observer: Observer, out: BodyInfo[]): void {
  const obs = aeObserver(observer);
  const time = Astronomy.MakeTime(date);
  for (const b of out) {
    const eq = Astronomy.Equator(b.id as Astronomy.Body, time, obs, false, true);
    b.ra = eq.ra * 15;
    b.dec = eq.dec;
    const cd = Math.cos(eq.dec * DEG);
    b.x = cd * Math.cos(b.ra * DEG);
    b.y = cd * Math.sin(b.ra * DEG);
    b.z = Math.sin(eq.dec * DEG);
    b.distAu = eq.dist;
    b.radiusDeg = Math.asin(Math.min(1, RADIUS_KM[b.id] / (eq.dist * AU_KM))) * RAD;
    if (b.id === 'Sun') {
      b.mag = -26.74;
      b.phase = 1;
    } else {
      const ill = Astronomy.Illumination(b.id as Astronomy.Body, time);
      b.mag = ill.mag;
      b.phase = ill.phase_fraction;
    }
  }
  const sun = out[0];
  for (const b of out) {
    const dot = Math.min(1, Math.max(-1, b.x * sun.x + b.y * sun.y + b.z * sun.z));
    b.elongation = Math.acos(dot) * RAD;
  }
}

/** Topocentric J2000 position of one body (for trails). */
export function bodyRaDec(id: BodyId, date: Date, observer: Observer): { ra: number; dec: number } {
  const eq = Astronomy.Equator(id as Astronomy.Body, date, aeObserver(observer), false, true);
  return { ra: eq.ra * 15, dec: eq.dec };
}

/** Independent check value: astronomy-engine's own horizontal coordinates of a body (no refraction). */
export function bodyAltAz(id: BodyId, date: Date, observer: Observer): { alt: number; az: number } {
  const obs = aeObserver(observer);
  const eq = Astronomy.Equator(id as Astronomy.Body, date, obs, true, true);
  const h = Astronomy.Horizon(date, obs, eq.ra, eq.dec);
  return { alt: h.altitude, az: h.azimuth };
}

/** Mean obliquity of the ecliptic at J2000, degrees — the ecliptic line is drawn in the J2000 frame. */
export const OBLIQUITY_J2000 = 23.4392911;

/** IAU constellation abbreviation at a J2000 position (astronomy-engine's boundary lookup). */
export function constellationAt(raDeg: number, decDeg: number): string {
  return Astronomy.Constellation((((raDeg % 360) + 360) % 360) / 15, decDeg).symbol;
}
