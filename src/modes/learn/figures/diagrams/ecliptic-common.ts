/**
 * Shared helpers for the ecliptic-unit diagrams (zodiac, planets, Moon, eclipses, meteors).
 * Not a diagram itself: the registry only picks up *.tsx files.
 * All positions come from astronomy-engine; the zodiac spans below were computed with it too
 * (see docs/content-notes/figures-ecliptic.md).
 */
import * as A from 'astronomy-engine';
import { useSettings } from '@/store/settings';
import type { Observer } from '@/types';

/** The learner's saved location (name, lat, lon, tz). Figures must compute from this, never from a fixed city. */
export const useObserver = (): Observer => useSettings((s) => s.observer);
export const astroObs = (o: Observer) => new A.Observer(o.lat, o.lon, o.elevationM ?? 0);
/** Short place name for labels ("Brooklyn" from "Brooklyn, NY") */
export const placeName = (o: Observer) => o.name.split(',')[0];
export const isSouth = (o: Observer) => o.lat < 0;

/**
 * Where the Sun's path (the ecliptic) crosses the IAU constellation boundaries, as J2000 ecliptic longitudes.
 * Computed by stepping the Sun through 2027 with Astronomy.Constellation(). Each entry runs from `from` to the next entry.
 */
export const ZODIAC: { abbr: string; name: string; from: number; days: number }[] = [
  { abbr: 'Psc', name: 'Pisces', from: 351.8, days: 37 },
  { abbr: 'Ari', name: 'Aries', from: 28.8, days: 26 },
  { abbr: 'Tau', name: 'Taurus', from: 53.6, days: 38 },
  { abbr: 'Gem', name: 'Gemini', from: 90.2, days: 29 },
  { abbr: 'Cnc', name: 'Cancer', from: 118.1, days: 21 },
  { abbr: 'Leo', name: 'Leo', from: 138.2, days: 37 },
  { abbr: 'Vir', name: 'Virgo', from: 174.0, days: 45 },
  { abbr: 'Lib', name: 'Libra', from: 217.9, days: 23 },
  { abbr: 'Sco', name: 'Scorpius', from: 241.1, days: 6 },
  { abbr: 'Oph', name: 'Ophiuchus', from: 247.6, days: 19 },
  { abbr: 'Sgr', name: 'Sagittarius', from: 266.4, days: 32 },
  { abbr: 'Cap', name: 'Capricornus', from: 299.8, days: 28 },
  { abbr: 'Aqr', name: 'Aquarius', from: 327.7, days: 24 },
];
export const norm360 = (d: number) => ((d % 360) + 360) % 360;
export const norm180 = (d: number) => {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
};
/** Span of zodiac constellation i: [from, to) in degrees, `to` may exceed 360. */
export function zodiacSpan(i: number): [number, number] {
  const a = ZODIAC[i].from;
  let b = ZODIAC[(i + 1) % ZODIAC.length].from;
  if (b <= a) b += 360;
  return [a, b];
}
export function zodiacAt(lon: number) {
  const l = norm360(lon);
  for (let i = 0; i < ZODIAC.length; i++) {
    const [a, b] = zodiacSpan(i);
    if ((l >= a && l < b) || (l + 360 >= a && l + 360 < b)) return ZODIAC[i];
  }
  return ZODIAC[0];
}

const ROT = A.Rotation_EQJ_ECL();
/** Geocentric J2000 ecliptic coordinates (degrees, AU) of a body, with aberration. */
export function geoEcl(body: A.Body, date: Date) {
  const v = A.GeoVector(body, date, true);
  const s = A.SphereFromVector(A.RotateVector(ROT, v));
  return { lon: s.lon, lat: s.lat, dist: s.dist };
}
/** Heliocentric J2000 ecliptic rectangular coordinates (AU). */
export function helioXY(body: A.Body, date: Date) {
  const v = A.RotateVector(ROT, A.HelioVector(body, date));
  return { x: v.x, y: v.y, z: v.z };
}
/** J2000 ecliptic longitude/latitude of a J2000 RA (deg) / Dec (deg) position. */
export function eqToEcl(raDeg: number, decDeg: number) {
  const v = A.VectorFromSphere(new A.Spherical(decDeg, raDeg, 1), new A.AstroTime(0));
  const s = A.SphereFromVector(A.RotateVector(ROT, v));
  return { lon: s.lon, lat: s.lat };
}

/** Date in 2027 (UTC noon) for day-of-year d (0 = Jan 1). */
export const dayOf2027 = (d: number) => new Date(Date.UTC(2027, 0, 1, 17) + Math.round(d) * 86400000);

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** Format a date in the learner's time zone. */
export function tzFormat(tz: string, date: Date, opts: Intl.DateTimeFormatOptions) {
  const k = tz + JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });
    }
    fmtCache.set(k, f);
  }
  return f.format(date);
}
export const fmtDay = (tz: string, d: Date) => tzFormat(tz, d, { month: 'short', day: 'numeric' });
export const fmtTime = (tz: string, d: Date) => tzFormat(tz, d, { hour: 'numeric', minute: '2-digit' });
/** Hours since local midnight in time zone tz (DST aware) */
export function localHours(tz: string, d: Date) {
  const s = tzFormat(tz, d, { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const m = s.match(/(\d+):(\d+)/);
  return m ? (Number(m[1]) % 24) + Number(m[2]) / 60 : 0;
}
/** UTC offset of zone tz at date d, in hours */
export function tzOffsetHours(tz: string, d: Date) {
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;
  let off = localHours(tz, d) - utcH;
  if (off > 14) off -= 24;
  if (off < -12) off += 24;
  return off;
}
/** The instant of local clock time `hour` on the calendar day of `d` in zone tz */
export function atLocal(tz: string, d: Date, hour: number) {
  const ymd = tzFormat(tz, d, { year: 'numeric', month: '2-digit', day: '2-digit' }).match(/(\d+)\/(\d+)\/(\d+)/);
  const [mo, da, yr] = ymd ? [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])] : [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCFullYear()];
  const guess = new Date(Date.UTC(yr, mo - 1, da) + hour * 3600000);
  return new Date(guess.getTime() - tzOffsetHours(tz, guess) * 3600000);
}

/**
 * The Sun at the learner's location on a calendar day: midday altitude, sunrise, sunset, hours of daylight.
 * `polar` is 'day' (midnight Sun) or 'night' (polar night) when there is no rise/set that day.
 */
export function sunDay(o: Observer, day: Date) {
  const obs = astroObs(o);
  const start = atLocal(o.tz, day, 0);
  const transit = A.SearchHourAngle(A.Body.Sun, obs, 0, start, +1);
  const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, start, 1);
  const set = A.SearchRiseSet(A.Body.Sun, obs, -1, rise ?? start, 1);
  let hours = rise && set ? (set.date.getTime() - rise.date.getTime()) / 3600000 : NaN;
  let polar: 'day' | 'night' | null = null;
  if (!rise || !set || hours < 0) {
    polar = transit.hor.altitude > 0 ? 'day' : 'night';
    hours = polar === 'day' ? 24 : 0;
  }
  return { noonAlt: transit.hor.altitude, noon: transit.time.date, rise: rise?.date, set: set?.date, hours, polar };
}

/**
 * SVG path for a lit sphere (Moon or planet phase) of radius r at (cx, cy).
 * (sx, sy): unit 2-D direction on the page toward the Sun. k: cosine of the phase angle,
 * +1 = fully lit face toward the viewer (full), −1 = lit face turned away (new).
 */
export function litPath(cx: number, cy: number, r: number, sx: number, sy: number, k: number) {
  const th = Math.atan2(sy, sx);
  const p1 = [cx + r * Math.cos(th - Math.PI / 2), cy + r * Math.sin(th - Math.PI / 2)];
  const p2 = [cx + r * Math.cos(th + Math.PI / 2), cy + r * Math.sin(th + Math.PI / 2)];
  const rot = (th * 180) / Math.PI;
  const b = Math.max(0.001, Math.abs(k) * r);
  // Outer edge: half circle on the Sun's side (p1 → p2 through the Sun side).
  // Inner edge (terminator): half ellipse back from p2 to p1, bulging toward the Sun (crescent) or away (gibbous).
  const sweepTerm = k < 0 ? 0 : 1;
  return `M ${p1[0]} ${p1[1]} A ${r} ${r} 0 0 1 ${p2[0]} ${p2[1]} A ${b} ${r} ${rot} 0 ${sweepTerm} ${p1[0]} ${p1[1]} Z`;
}

/** Month names for the solstices/equinoxes: the same words work in both hemispheres. */
export const SEASON_POINTS = ['the March equinox', 'the June solstice', 'the September equinox', 'the December solstice'];
/** Season name at the learner's latitude for a month index 0–11 (meteorological seasons; tropics get none). */
export function seasonName(o: Observer, month: number) {
  if (Math.abs(o.lat) < 23.4) return null;
  const north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][month];
  if (o.lat >= 0) return north;
  return { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[north] ?? null;
}
const hFmt = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1} h` : `${hh} h ${String(mm).padStart(2, '0')} min`;
};
export const fmtHours = hFmt;
