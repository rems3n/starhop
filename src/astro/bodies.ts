/** Sun, Moon and planets: where they are, how bright, what phase. */
import * as Astronomy from 'astronomy-engine';
import type { BodyId, BodyState, MoonPhase, Observer } from '@/types';
import { RAD, applyMat3, eqjToHorMatrix, fromRotation, horVecToAltAz, norm360, toAstroObserver, vecToRaDec, type RaDec, type Vec3 } from './frames';

export const BODY_IDS: BodyId[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
export const PLANET_IDS: BodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
export const NAKED_EYE_PLANETS: BodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function isBodyId(x: unknown): x is BodyId {
  return typeof x === 'string' && (BODY_IDS as string[]).includes(x);
}

/** astronomy-engine's Body enum uses the same strings as our BodyId. */
export function astroBody(id: BodyId): Astronomy.Body {
  return id as Astronomy.Body;
}

const AU_KM = 149597870.7;
/** Radii in km used for the angular diameter (equatorial for the giant planets). */
export const BODY_RADIUS_KM: Record<BodyId, number> = {
  Sun: 695700, Moon: 1737.4, Mercury: 2439.7, Venus: 6051.8, Mars: 3389.5, Jupiter: 71492, Saturn: 60268, Uranus: 25559, Neptune: 24764,
};

/**
 * Topocentric J2000 vector (AU) from the observer to a body, corrected for light travel time and
 * aberration, so it lines up with the J2000 star catalog as drawn on the sky.
 */
export function bodyVector(id: BodyId, date: Date | Astronomy.AstroTime, observer: Observer): Vec3 {
  const eq = Astronomy.Equator(astroBody(id), date, toAstroObserver(observer), false, true);
  return [eq.vec.x, eq.vec.y, eq.vec.z];
}

/** IAU constellation abbreviation (e.g. "Ser", "CMa") containing a J2000 position. */
export function constellationAt(ra: number, dec: number): string {
  return Astronomy.Constellation(norm360(ra) / 15, dec).symbol;
}

function angleBetween(a: Vec3, b: Vec3): number {
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  return Math.atan2(Math.hypot(cx, cy, cz), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * RAD;
}

/** Everything about one body at one instant for one observer. Altitude is airless (no refraction). */
export function getBody(id: BodyId, date: Date, observer: Observer): BodyState {
  const time = Astronomy.MakeTime(date);
  const hor = fromRotation(Astronomy.Rotation_EQJ_HOR(time, toAstroObserver(observer)));
  return bodyStateWith(id, time, observer, hor, id === 'Sun' ? null : bodyVector('Sun', time, observer));
}

function bodyStateWith(id: BodyId, time: Astronomy.AstroTime, observer: Observer, hor: number[], sunVec: Vec3 | null): BodyState {
  const v = bodyVector(id, time, observer);
  const dist = Math.hypot(v[0], v[1], v[2]);
  const { ra, dec } = vecToRaDec(v);
  const { alt, az } = horVecToAltAz(applyMat3(hor, v));
  const illum = Astronomy.Illumination(astroBody(id), time);
  return {
    id, ra, dec, alt, az,
    mag: illum.mag,
    distAu: dist,
    phase: id === 'Sun' ? 1 : illum.phase_fraction,
    elongation: sunVec ? angleBetween(v, sunVec) : 0,
    angularDiameterArcsec: 2 * Math.asin(Math.min(1, BODY_RADIUS_KM[id] / (dist * AU_KM))) * RAD * 3600,
    con: constellationAt(ra, dec),
  };
}

/** All nine bodies (Sun, Moon, Mercury … Neptune) at one instant. */
export function getBodies(date: Date, observer: Observer): BodyState[] {
  const time = Astronomy.MakeTime(date);
  const hor = fromRotation(Astronomy.Rotation_EQJ_HOR(time, toAstroObserver(observer)));
  const sun = bodyVector('Sun', time, observer);
  return BODY_IDS.map((id) => bodyStateWith(id, time, observer, hor, id === 'Sun' ? null : sun));
}

/** Topocentric J2000 RA/Dec only (cheaper than getBody). */
export function bodyRaDec(id: BodyId, date: Date, observer: Observer): RaDec {
  return vecToRaDec(bodyVector(id, date, observer));
}

/** Half-width, in degrees of phase angle, of the window in which we call the Moon "New", "Full" or a "Quarter" (≈ ±12 hours). */
export const PHASE_NAME_WINDOW_DEG = 6.5;

/**
 * Moon phase. `phaseAngle` is how far the Moon is ahead of the Sun in ecliptic longitude
 * (0 new, 90 first quarter, 180 full, 270 last quarter); `illumination` is the lit fraction 0..1.
 */
export function moonPhase(date: Date): MoonPhase {
  const phaseAngle = norm360(Astronomy.MoonPhase(date));
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
  const w = PHASE_NAME_WINDOW_DEG;
  let name: MoonPhase['name'];
  if (phaseAngle < w || phaseAngle > 360 - w) name = 'New Moon';
  else if (phaseAngle < 90 - w) name = 'Waxing Crescent';
  else if (phaseAngle <= 90 + w) name = 'First Quarter';
  else if (phaseAngle < 180 - w) name = 'Waxing Gibbous';
  else if (phaseAngle <= 180 + w) name = 'Full Moon';
  else if (phaseAngle < 270 - w) name = 'Waning Gibbous';
  else if (phaseAngle <= 270 + w) name = 'Last Quarter';
  else name = 'Waning Crescent';
  return { phaseAngle, illumination, name };
}

let eclCache: { n: number; pts: RaDec[] } | null = null;
/**
 * The ecliptic (the Sun's yearly path) as J2000 points, starting at the March equinox point and
 * running eastward. Returns n + 1 points; the last repeats the first so it can be drawn as a closed line.
 */
export function eclipticPath(n = 180): RaDec[] {
  if (eclCache?.n === n) return eclCache.pts;
  const m = fromRotation(Astronomy.Rotation_ECL_EQJ());
  const pts: RaDec[] = [];
  for (let i = 0; i <= n; i++) {
    const lon = ((i % n) * 2 * Math.PI) / n;
    pts.push(vecToRaDec(applyMat3(m, [Math.cos(lon), Math.sin(lon), 0])));
  }
  eclCache = { n, pts };
  return pts;
}

/** J2000 RA/Dec of a point on the ecliptic at the given J2000 ecliptic longitude/latitude. */
export function eclipticToRaDec(lon: number, lat = 0): RaDec {
  const m = fromRotation(Astronomy.Rotation_ECL_EQJ());
  const cl = Math.cos(lat / RAD);
  return vecToRaDec(applyMat3(m, [cl * Math.cos(lon / RAD), cl * Math.sin(lon / RAD), Math.sin(lat / RAD)]));
}

/** Convenience: alt/az of a topocentric J2000 vector at a time. */
export function altAzOfVector(v: Vec3, date: Date, observer: Observer) {
  return horVecToAltAz(applyMat3(eqjToHorMatrix(date, observer), v));
}
