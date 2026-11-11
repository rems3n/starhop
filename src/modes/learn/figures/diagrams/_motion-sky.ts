/**
 * Shared geometry for the "motion" unit diagrams (nightly rotation, circumpolar, seasons, latitude).
 * Not a diagram itself: the registry only picks up *.tsx files in this folder.
 * Angles in degrees. Azimuth 0 = N, 90 = E. Hour angle H grows westward (0 = on the meridian).
 */
import * as Astronomy from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import type { Observer } from '@/types';

/** The learner's saved location (name, lat, lon, tz). Diagrams default to it. */
export function useObserver(): Observer {
  return useSettings((s) => s.observer);
}
/** Minutes that the zone `tz` is ahead of UTC at instant `t`. */
export function tzOffsetMin(t: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
    const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
    return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(t / 60000) * 60000) / 60000);
  } catch {
    return 0;
  }
}
/** The instant when the clock in `tz` reads y-m-d h:00 (month 1–12). Falls back to UTC for an unknown zone. */
export function localDate(y: number, m: number, d: number, h: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h);
  let t = guess - tzOffsetMin(guess, tz) * 60000;
  t = guess - tzOffsetMin(t, tz) * 60000;
  return new Date(t);
}
/** +1 for the northern hemisphere (and the equator), −1 for the southern. */
export const hemi = (lat: number) => (lat < 0 ? -1 : 1);
/** Short place name from settings ("Brooklyn, NY" → "Brooklyn, NY"; empty → "your location"). */
export const placeName = (o: Observer) => o.name?.trim() || 'your location';

const D = Math.PI / 180;
export const sind = (a: number) => Math.sin(a * D);
export const cosd = (a: number) => Math.cos(a * D);
export const tand = (a: number) => Math.tan(a * D);
export const asind = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / D;
export const acosd = (x: number) => Math.acos(Math.max(-1, Math.min(1, x))) / D;
export const atan2d = (y: number, x: number) => Math.atan2(y, x) / D;
export const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const wrap360 = (a: number) => ((a % 360) + 360) % 360;
export const wrap180 = (a: number) => wrap360(a + 180) - 180;

/** Local horizon unit vector (east, north, up) of a star at hour angle `ha` and declination `dec`, seen from latitude `lat`. */
export function hadecToEnu(ha: number, dec: number, lat: number): [number, number, number] {
  const xm = cosd(dec) * cosd(ha); // toward the meridian point of the celestial equator
  const yw = cosd(dec) * sind(ha); // toward the west point
  const z = sind(dec); // toward the celestial pole
  return [-yw, z * cosd(lat) - xm * sind(lat), z * sind(lat) + xm * cosd(lat)];
}
export function enuToAltAz(v: [number, number, number]) {
  return { alt: asind(v[2]), az: wrap360(atan2d(v[0], v[1])) };
}
export function hadecToAltAz(ha: number, dec: number, lat: number) {
  return enuToAltAz(hadecToEnu(ha, dec, lat));
}
export function altAzToEnu(az: number, alt: number): [number, number, number] {
  return [cosd(alt) * sind(az), cosd(alt) * cosd(az), sind(alt)];
}
/** Hour angle / declination of a horizon direction. */
export function altAzToHaDec(az: number, alt: number, lat: number) {
  const [e, n, u] = altAzToEnu(az, alt);
  const z = n * cosd(lat) + u * sind(lat);
  const xm = u * cosd(lat) - n * sind(lat);
  return { ha: atan2d(-e, xm), dec: asind(z) };
}

/** Hours per day a star is above the (airless, flat) horizon. */
export function hoursAbove(dec: number, lat: number): number {
  const c = -tand(lat) * tand(dec);
  if (c <= -1) return 24;
  if (c >= 1) return 0;
  return (2 * acosd(c)) / 15;
}
/** Highest altitude (upper culmination) and the side of the sky it happens on. */
export function culmination(dec: number, lat: number): { alt: number; side: 'south' | 'north' | 'overhead' } {
  const alt = 90 - Math.abs(lat - dec);
  return { alt, side: Math.abs(lat - dec) < 0.05 ? 'overhead' : dec < lat ? 'south' : 'north' };
}
/** Lowest altitude (lower culmination); negative = below the horizon. */
export const lowestAlt = (dec: number, lat: number) => Math.abs(lat + dec) - 90;

/**
 * Stereographic projection of the local sky centred on (azC, altC), horizon kept level.
 * Returns [x, y, depth] where depth = cos(angle from the centre) (−1 at the antipode).
 */
export function makeStereo(azC: number, altC: number, k: number, cx: number, cy: number) {
  const c = altAzToEnu(azC, altC);
  const r: [number, number, number] = [cosd(azC), -sind(azC), 0];
  // up = r × c
  const u: [number, number, number] = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]];
  return (v: [number, number, number]): [number, number, number] => {
    const dc = v[0] * c[0] + v[1] * c[1] + v[2] * c[2];
    const f = (2 * k) / (1 + Math.max(dc, -0.98));
    return [cx + f * (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]), cy - f * (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]), dc];
  };
}

/** Precession J2000 → equator of date, as a function on (ra, dec). */
export function precessor(date: Date) {
  const rot = Astronomy.Rotation_EQJ_EQD(date);
  return (ra: number, dec: number) => {
    const v = Astronomy.RotateVector(rot, new Astronomy.Vector(cosd(dec) * cosd(ra), cosd(dec) * sind(ra), sind(dec), Astronomy.MakeTime(date)));
    return { ra: wrap360(atan2d(v.y, v.x)), dec: asind(v.z) };
  };
}
/** Local apparent sidereal time in degrees. */
export const lstDeg = (date: Date, lon: number) => wrap360(Astronomy.SiderealTime(date) * 15 + lon);

export const fmtLat = (lat: number) => (Math.abs(lat) < 0.05 ? '0° (equator)' : `${Math.abs(lat).toFixed(1)}° ${lat > 0 ? 'N' : 'S'}`);
export const fmtDeg = (a: number, digits = 1) => `${a.toFixed(digits)}°`;

/** Reference places for the latitude figures (latitudes from Wikipedia, rounded to 0.1°). The learner's own place is added at runtime. */
export const PLACES = [
  { id: 'pole', label: 'North Pole', lat: 90 },
  { id: 'tromso', label: 'Tromsø', lat: 69.6 },
  { id: 'equator', label: 'Equator', lat: 0 },
  { id: 'sydney', label: 'Sydney', lat: -33.9 },
  { id: 'spole', label: 'South Pole', lat: -90 },
] as const;
/** Preset buttons: "You" (from settings) first, then the reference places. */
export function placeOptions(o: Observer) {
  return [{ value: 'you', label: `You (${fmtLat(o.lat)})`, lat: o.lat }, ...PLACES.map((p) => ({ value: p.id as string, label: p.label, lat: p.lat as number }))];
}
export const placeOf = (lat: number, opts: { value: string; lat: number }[]) => opts.find((p) => Math.abs(p.lat - lat) < 0.05)?.value ?? 'custom';

/** Compass name for an azimuth. */
export function compass(az: number): string {
  const n = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return n[Math.round(wrap360(az) / 45) % 8];
}

/** SVG path through points, breaking the line where `ok` is false or the jump is too big. */
export function polyPath(pts: ([number, number] | null)[], maxJump = 80): string {
  let d = '';
  let prev: [number, number] | null = null;
  for (const p of pts) {
    if (!p) { prev = null; continue; }
    if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) <= maxJump) d += ` L${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    else d += ` M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    prev = p;
  }
  return d.trim();
}

/** Simple monospace-free text width estimate for layout (Figtree ~0.55 em per char). */
export const textW = (s: string, size = 14) => s.length * size * 0.55;
