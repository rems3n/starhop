/**
 * Coordinate frames: J2000 equatorial (EQJ, what the catalog stores) ⇄ the observer's local horizon.
 *
 * Conventions used by every function here:
 *  - all angles in DEGREES; RA 0..360; azimuth 0 = North, 90 = East; altitude +90 = zenith
 *  - equatorial unit vector: x → RA 0, y → RA 90°, z → north celestial pole
 *  - horizontal unit vector (same as astronomy-engine "HOR"): x = north, y = WEST, z = zenith,
 *    so  az = atan2(−y, x)  and  alt = asin(z)
 *  - Mat3 is 9 numbers, row-major: out[i] = Σ m[3i + j] · v[j]
 */
import * as Astronomy from 'astronomy-engine';
import type { Observer } from '@/types';

export type Mat3 = number[];
export type Vec3 = [number, number, number];
export interface RaDec { ra: number; dec: number }
export interface AltAz { alt: number; az: number }

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Wrap an angle to 0..360. */
export function norm360(a: number): number {
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}
/** Wrap an angle to −180..+180. */
export function norm180(a: number): number {
  const r = norm360(a);
  return r > 180 ? r - 360 : r;
}

/** astronomy-engine observer for one of ours. */
export function toAstroObserver(o: Pick<Observer, 'lat' | 'lon' | 'elevationM'>): Astronomy.Observer {
  return new Astronomy.Observer(o.lat, o.lon, o.elevationM ?? 0);
}

/** astronomy-engine RotationMatrix (rot[column][row]) → row-major Mat3. */
export function fromRotation(r: Astronomy.RotationMatrix): Mat3 {
  const m = r.rot;
  return [m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]];
}

export function transposeMat3(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const o = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return o;
}

/**
 * Rotation that takes a J2000 equatorial unit vector to the local horizontal frame
 * (x = north, y = west, z = zenith) at `date` for `observer`. Includes precession, nutation and
 * Earth rotation (astronomy-engine `Rotation_EQJ_HOR`). No refraction, no aberration.
 */
export function eqjToHorMatrix(date: Date, observer: Observer): Mat3 {
  return fromRotation(Astronomy.Rotation_EQJ_HOR(date, toAstroObserver(observer)));
}

/** Inverse of {@link eqjToHorMatrix}: horizontal (north, west, zenith) → J2000 equatorial. */
export function horToEqjMatrix(date: Date, observer: Observer): Mat3 {
  return transposeMat3(eqjToHorMatrix(date, observer));
}

/** J2000 equatorial → true equator and equinox of date (precession + nutation). Used to compare with "apparent" RA/Dec. */
export function eqjToEqdMatrix(date: Date): Mat3 {
  return fromRotation(Astronomy.Rotation_EQJ_EQD(date));
}

/** Unit vector for RA/Dec in degrees. */
export function raDecToVec(ra: number, dec: number): Vec3 {
  const cd = Math.cos(dec * DEG);
  return [cd * Math.cos(ra * DEG), cd * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}

/** RA/Dec in degrees (RA 0..360) for a vector of any length. */
export function vecToRaDec(v: ArrayLike<number>): RaDec {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return { ra: norm360(Math.atan2(v[1], v[0]) * RAD), dec: Math.asin(Math.max(-1, Math.min(1, v[2] / len))) * RAD };
}

export function applyMat3(m: Mat3, v: ArrayLike<number>): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** Horizontal vector (north, west, zenith) → altitude/azimuth. */
export function horVecToAltAz(h: ArrayLike<number>): AltAz {
  const len = Math.hypot(h[0], h[1], h[2]) || 1;
  return { alt: Math.asin(Math.max(-1, Math.min(1, h[2] / len))) * RAD, az: norm360(Math.atan2(-h[1], h[0]) * RAD) };
}

/** Altitude/azimuth → horizontal unit vector (north, west, zenith). */
export function altAzToHorVec(az: number, alt: number): Vec3 {
  const ca = Math.cos(alt * DEG);
  return [ca * Math.cos(az * DEG), -ca * Math.sin(az * DEG), Math.sin(alt * DEG)];
}

/**
 * How much the atmosphere lifts an object, in degrees, given its true (airless) altitude.
 * Same model as astronomy-engine's "normal" refraction (Sæmundsson/Meeus, 10 °C, 1010 hPa):
 * about 0.57° at the horizon, 0.1° at 10° up, negligible overhead.
 */
export function refractionDeg(trueAlt: number): number {
  return Astronomy.Refraction('normal', trueAlt);
}

/**
 * Altitude and azimuth of a J2000 position. `refraction: true` lifts the altitude by the standard
 * atmospheric refraction (default: off, i.e. geometric "airless" altitude).
 */
export function altAzOf(ra: number, dec: number, date: Date, observer: Observer, opts?: { refraction?: boolean }): AltAz {
  const r = horVecToAltAz(applyMat3(eqjToHorMatrix(date, observer), raDecToVec(ra, dec)));
  if (opts?.refraction) r.alt += refractionDeg(r.alt);
  return r;
}

/** J2000 RA/Dec of a point given by azimuth and (airless) altitude. */
export function raDecOfAltAz(az: number, alt: number, date: Date, observer: Observer): RaDec {
  return vecToRaDec(applyMat3(horToEqjMatrix(date, observer), altAzToHorVec(az, alt)));
}

/**
 * Fast path for many fixed stars at one instant: builds the rotation once and returns a function
 * that costs a handful of multiplications per star. Airless altitude.
 */
export function makeAltAz(date: Date, observer: Observer): (ra: number, dec: number) => AltAz {
  const m = eqjToHorMatrix(date, observer);
  return (ra, dec) => {
    const cd = Math.cos(dec * DEG);
    const x = cd * Math.cos(ra * DEG);
    const y = cd * Math.sin(ra * DEG);
    const z = Math.sin(dec * DEG);
    const hx = m[0] * x + m[1] * y + m[2] * z;
    const hy = m[3] * x + m[4] * y + m[5] * z;
    const hz = m[6] * x + m[7] * y + m[8] * z;
    return { alt: Math.asin(Math.max(-1, Math.min(1, hz))) * RAD, az: norm360(Math.atan2(-hy, hx) * RAD) };
  };
}

/** Angle between two sky positions in degrees (accurate for tiny and huge separations alike). */
export function angularSeparation(a: RaDec, b: RaDec): number {
  const va = raDecToVec(a.ra, a.dec);
  const vb = raDecToVec(b.ra, b.dec);
  const cx = va[1] * vb[2] - va[2] * vb[1];
  const cy = va[2] * vb[0] - va[0] * vb[2];
  const cz = va[0] * vb[1] - va[1] * vb[0];
  return Math.atan2(Math.hypot(cx, cy, cz), va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]) * RAD;
}

/**
 * Direction from one position to another, measured at `from`: 0 = toward celestial north,
 * 90 = toward increasing RA (east on the sky), 0..360.
 */
export function positionAngle(from: RaDec, to: RaDec): number {
  const dra = (to.ra - from.ra) * DEG;
  const d1 = from.dec * DEG;
  const d2 = to.dec * DEG;
  return norm360(Math.atan2(Math.sin(dra) * Math.cos(d2), Math.cos(d1) * Math.sin(d2) - Math.sin(d1) * Math.cos(d2) * Math.cos(dra)) * RAD);
}

/** Local apparent sidereal time in degrees (0..360): the RA (of date) currently on the meridian. */
export function localSiderealTimeDeg(date: Date, lonDeg: number): number {
  return norm360(Astronomy.SiderealTime(date) * 15 + lonDeg);
}

/** Mean direction of a set of positions (null vector → first point). */
export function meanDirection(points: RaDec[]): RaDec {
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    const v = raDecToVec(p.ra, p.dec);
    x += v[0]; y += v[1]; z += v[2];
  }
  if (Math.hypot(x, y, z) < 1e-9) return points[0] ?? { ra: 0, dec: 0 };
  return vecToRaDec([x, y, z]);
}
