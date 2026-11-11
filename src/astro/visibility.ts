/**
 * What is up, when, and in which part of the night.
 * The classification rule and every threshold below are documented in docs/ASTRO.md.
 */
import * as Astronomy from 'astronomy-engine';
import type { BodyId, NightWindow, Observer, RiseSet, TonightItem, VisibilityClass, VisibilityInfo, MoonPhase, Constellation, Star } from '@/types';
import { compassWord } from '@/lib/format';
import { formatTime, zonedParts, zonedToUtc } from '@/lib/time';
import { astroBody, bodyVector, isBodyId, moonPhase, PLANET_IDS } from './bodies';
import {
  DEG, RAD, applyMat3, eqjToEqdMatrix, eqjToHorMatrix, fromRotation, localSiderealTimeDeg, makeAltAz, meanDirection, mulMat3, norm360,
  raDecToVec, toAstroObserver, transposeMat3, vecToRaDec, type Mat3, type RaDec, type Vec3,
} from './frames';

// ───────────────────────────── Thresholds (see docs/ASTRO.md) ─────────────────────────────

/** Sun altitude below which the sky counts as dark for stars, constellations, Mars…Neptune. */
export const DARK_SUN_ALT = -12;
/** Sun altitude below which Mercury, Venus and the Moon count as observable (they are bright twilight objects). */
export const TWILIGHT_SUN_ALT = -6;
/** A fixed target (star, constellation point, radiant) is "up" at or above this altitude. */
export const MIN_ALT_FIXED = 10;
/** Planets and the Moon are "up" at or above this altitude. */
export const MIN_ALT_BODY = 5;
/** A constellation is up when at least this fraction of its points is up. */
export const CONSTELLATION_UP_FRACTION = 0.6;
/** Night sampling step. */
export const STEP_MINUTES = 5;
/** Less than this many minutes up-while-dark → not visible. */
export const MIN_VISIBLE_MINUTES = 45;
/** Same, for Mercury and Venus, whose whole apparitions are short twilight windows. */
export const MIN_VISIBLE_MINUTES_INNER = 20;
/** Up for at least this fraction of the dark period → all-night. */
export const ALL_NIGHT_FRACTION = 0.8;
/** The Moon is ignored when less than this fraction of its disc is lit (too close to the Sun to see). */
export const MIN_MOON_ILLUMINATION = 0.01;
/** bestMonths: a month qualifies when the evening altitude reaches this fraction of the year's best evening altitude. */
export const BEST_MONTH_FRACTION = 0.7;
/** eveningSeason: "all-year" when the target is up every evening and never drops below this fraction of its best evening altitude. */
export const ALL_YEAR_FRACTION = 0.6;
/** Local clock times (hours) at which bestMonths judges the sky; moved later to the end of nautical twilight when the sky is not dark yet. */
export const EVENING_HOURS = [21, 22];
/** Local clock times (hours; 24 = midnight) over which eveningSeason judges "the evening sky". */
export const SEASON_EVENING_HOURS = [22, 23, 24];

export type VisTarget = BodyId | RaDec | { points: RaDec[] };

const SIDEREAL_DEG_PER_DAY = 360.98564736629;
const DAY_MS = 86400000;
const STEP_MS = STEP_MINUTES * 60000;

// ───────────────────────────── Local dates ─────────────────────────────

export interface LocalDate { year: number; month: number; day: number }

/** Local calendar date (observer's time zone) of an instant. */
export function localDateOf(date: Date, observer: Pick<Observer, 'tz'>): LocalDate {
  const p = zonedParts(date, observer.tz);
  return { year: p.year, month: p.month, day: p.day };
}

function addDays(d: LocalDate, n: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function localInstant(d: LocalDate, hour: number, minute: number, tz: string): Date {
  return zonedToUtc(d.year, d.month, d.day, hour, minute, tz);
}

function obsKey(o: Observer): string {
  return `${o.lat.toFixed(4)},${o.lon.toFixed(4)},${Math.round(o.elevationM ?? 0)},${o.tz}`;
}

class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V): void {
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
  clear(): void {
    this.map.clear();
  }
}

// ───────────────────────────── Night grid (shared, cached) ─────────────────────────────

/**
 * One night sampled every STEP_MINUTES from local noon to the next local noon:
 * the rotation J2000 → horizon and the Sun's altitude at every sample.
 */
interface NightGrid {
  date: LocalDate;
  observer: Observer;
  t0: number;
  n: number;
  /** n × 9 row-major rotation matrices */
  mats: Float64Array;
  sunAlt: Float64Array;
  tracks: Map<BodyId, Float64Array>;
}

const gridCache = new Lru<NightGrid>(96);

function getGrid(d: LocalDate, observer: Observer): NightGrid {
  const key = `${d.year}-${d.month}-${d.day}|${obsKey(observer)}`;
  let g = gridCache.get(key);
  if (g) return g;
  const start = localInstant(d, 12, 0, observer.tz).getTime();
  const end = localInstant(addDays(d, 1), 12, 0, observer.tz).getTime();
  const n = Math.round((end - start) / STEP_MS) + 1;
  const mats = new Float64Array(n * 9);
  // Exact matrix at the middle of the window; other samples by rotating about the pole of date at the
  // sidereal rate (precession/nutation change by < 0.1″ in 12 h, far below anything we need).
  const mid = Math.floor(n / 2);
  const tMid = new Date(start + mid * STEP_MS);
  const m0 = eqjToHorMatrix(tMid, observer);
  const p = eqjToEqdMatrix(tMid);
  const pT = transposeMat3(p);
  const spin = (deg: number): Mat3 => {
    const a = -deg * DEG;
    const c = Math.cos(a), s = Math.sin(a);
    return mulMat3(pT, mulMat3([c, -s, 0, s, c, 0, 0, 0, 1], p));
  };
  for (let k = 0; k < n; k++) {
    const m = mulMat3(m0, spin(((k - mid) * STEP_MS * SIDEREAL_DEG_PER_DAY) / DAY_MS));
    mats.set(m, k * 9);
  }
  g = { date: d, observer, t0: start, n, mats, sunAlt: new Float64Array(n), tracks: new Map(), };
  const sun = bodyTrack(g, 'Sun');
  for (let k = 0; k < n; k++) g.sunAlt[k] = Math.asin(clamp1(rowZ(mats, k, sun[3 * k], sun[3 * k + 1], sun[3 * k + 2]))) * RAD;
  gridCache.set(key, g);
  return g;
}

function clamp1(x: number): number {
  return x > 1 ? 1 : x < -1 ? -1 : x;
}
function rowZ(mats: Float64Array, k: number, x: number, y: number, z: number): number {
  const o = k * 9;
  return mats[o + 6] * x + mats[o + 7] * y + mats[o + 8] * z;
}
function gridAltAz(g: NightGrid, k: number, v: ArrayLike<number>): { alt: number; az: number } {
  const o = k * 9;
  const m = g.mats;
  const hx = m[o] * v[0] + m[o + 1] * v[1] + m[o + 2] * v[2];
  const hy = m[o + 3] * v[0] + m[o + 4] * v[1] + m[o + 5] * v[2];
  const hz = m[o + 6] * v[0] + m[o + 7] * v[1] + m[o + 8] * v[2];
  return { alt: Math.asin(clamp1(hz)) * RAD, az: norm360(Math.atan2(-hy, hx) * RAD) };
}

/**
 * Topocentric J2000 unit vectors of a body at every grid sample (n × 3). Positions are computed at
 * widely spaced nodes (every 30 min for the Moon, 6 h for the rest) and interpolated linearly.
 */
function bodyTrack(g: NightGrid, id: BodyId): Float64Array {
  let tr = g.tracks.get(id);
  if (tr) return tr;
  tr = new Float64Array(g.n * 3);
  const every = Math.round((id === 'Moon' ? 30 : 360) / STEP_MINUTES);
  let prev: Vec3 | null = null;
  for (let k0 = 0; k0 < g.n - 1 || prev === null; k0 += every) {
    const a: Vec3 = prev ?? unit(bodyVector(id, new Date(g.t0 + k0 * STEP_MS), g.observer));
    const k1 = k0 + every;
    const b = unit(bodyVector(id, new Date(g.t0 + k1 * STEP_MS), g.observer));
    for (let k = k0; k <= Math.min(k1, g.n - 1); k++) {
      const f = (k - k0) / every;
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      const len = Math.hypot(x, y, z);
      tr[3 * k] = x / len; tr[3 * k + 1] = y / len; tr[3 * k + 2] = z / len;
    }
    prev = b;
  }
  g.tracks.set(id, tr);
  return tr;
}
function unit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ───────────────────────────── Night window ─────────────────────────────

const nightCache = new Lru<NightWindow>(400);

/**
 * Sunset, the three dusks, the three dawns and sunrise for the night that BEGINS on the local
 * calendar date of `date` (observer.tz). Any event that does not happen (midnight sun, polar night,
 * bright summer nights at high latitude) is null.
 */
export function nightWindow(date: Date, observer: Observer): NightWindow {
  return nightWindowFor(localDateOf(date, observer), observer);
}

function nightWindowFor(d: LocalDate, observer: Observer): NightWindow {
  const key = `${d.year}-${d.month}-${d.day}|${obsKey(observer)}`;
  const hit = nightCache.get(key);
  if (hit) return hit;
  const obs = toAstroObserver(observer);
  const noon = localInstant(d, 12, 0, observer.tz);
  const sun = Astronomy.Body.Sun;
  const sunset = Astronomy.SearchRiseSet(sun, obs, -1, noon, 1)?.date ?? null;
  const from = sunset ?? noon;
  const down = (alt: number) => Astronomy.SearchAltitude(sun, obs, -1, from, 1, alt)?.date ?? null;
  const civilDusk = down(-6), nauticalDusk = down(-12), astroDusk = down(-18);
  // Dawn events are looked for after the matching dusk, and never later than a day after noon.
  const limit = noon.getTime() + DAY_MS + 3600000;
  const upAfter = (start: Date | null, alt: number | null): Date | null => {
    if (!start) return null;
    const t = alt === null ? Astronomy.SearchRiseSet(sun, obs, +1, start, 1) : Astronomy.SearchAltitude(sun, obs, +1, start, 1, alt);
    return t && t.date.getTime() <= limit ? t.date : null;
  };
  const w: NightWindow = {
    sunset,
    sunrise: upAfter(sunset, null),
    civilDusk, nauticalDusk, astroDusk,
    astroDawn: upAfter(astroDusk, -18),
    nauticalDawn: upAfter(nauticalDusk, -12),
    civilDawn: upAfter(civilDusk, -6),
  };
  nightCache.set(key, w);
  return w;
}

/**
 * The date to pass when you mean "the night I am in": after midnight and before sunrise it is still
 * last evening's night, so this returns yesterday's local noon; otherwise today's.
 */
export function currentNightDate(now: Date, observer: Observer): Date {
  const d = localDateOf(now, observer);
  const p = zonedParts(now, observer.tz);
  if (p.hour < 12) {
    const prev = addDays(d, -1);
    const w = nightWindowFor(prev, observer);
    const end = w.sunrise ?? localInstant(d, 6, 0, observer.tz);
    if (now.getTime() < end.getTime()) return localInstant(prev, 12, 0, observer.tz);
  }
  return localInstant(d, 12, 0, observer.tz);
}

// ───────────────────────────── Rise / transit / set ─────────────────────────────

/** Altitude of the centre of a star at the moment it appears on the horizon (standard refraction of 34′). */
const STAR_HORIZON_ALT = -34 / 60;

function riseSetFixed(t: RaDec, start: number, end: number, mode: 'night' | 'day', observer: Observer): RiseSet {
  const mid = new Date((start + end) / 2);
  const eqd = vecToRaDec(applyMat3(eqjToEqdMatrix(mid), raDecToVec(t.ra, t.dec)));
  const phi = observer.lat * DEG, dec = eqd.dec * DEG;
  const transitAlt = 90 - Math.abs(observer.lat - eqd.dec);
  const cosH = (Math.sin(STAR_HORIZON_ALT * DEG) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  const circumpolar = cosH <= -1, neverRises = cosH >= 1;
  const sidDay = (DAY_MS * 360) / SIDEREAL_DEG_PER_DAY;
  const lst0 = localSiderealTimeDeg(new Date(start), observer.lon);
  const firstTransit = start + (norm360(eqd.ra - lst0) / SIDEREAL_DEG_PER_DAY) * DAY_MS;
  const inWin = (x: number) => x >= start && x < end;
  const pick = (offsetMs: number): Date | null => {
    for (let k = -1; k <= 1; k++) {
      const x = firstTransit + k * sidDay + offsetMs;
      if (inWin(x)) return new Date(x);
    }
    return null;
  };
  if (circumpolar || neverRises) {
    return { rise: null, transit: neverRises ? null : mode === 'night' ? new Date(firstTransit) : pick(0), set: null, transitAlt, circumpolar, neverRises };
  }
  const h = ((Math.acos(cosH) * RAD) / SIDEREAL_DEG_PER_DAY) * DAY_MS;
  if (mode === 'night') {
    return { rise: new Date(firstTransit - h), transit: new Date(firstTransit), set: new Date(firstTransit + h), transitAlt, circumpolar, neverRises };
  }
  return { rise: pick(-h), transit: pick(0), set: pick(h), transitAlt, circumpolar, neverRises };
}

function riseSetBody(id: BodyId, start: number, end: number, mode: 'night' | 'day', observer: Observer): RiseSet {
  const obs = toAstroObserver(observer);
  const body = astroBody(id);
  const s = new Date(start);
  const spanDays = (end - start) / DAY_MS;
  let rise: Date | null, set: Date | null, transit: Date | null;
  if (mode === 'day') {
    rise = Astronomy.SearchRiseSet(body, obs, +1, s, spanDays)?.date ?? null;
    set = Astronomy.SearchRiseSet(body, obs, -1, s, spanDays)?.date ?? null;
    const tr = Astronomy.SearchHourAngle(body, obs, 0, s, +1).time.date;
    transit = tr.getTime() < end ? tr : null;
  } else {
    transit = Astronomy.SearchHourAngle(body, obs, 0, s, +1).time.date;
    rise = Astronomy.SearchRiseSet(body, obs, +1, transit, -1)?.date ?? null;
    set = Astronomy.SearchRiseSet(body, obs, -1, transit, 1)?.date ?? null;
  }
  const refTime = transit ?? Astronomy.SearchHourAngle(body, obs, 0, s, +1).time.date;
  const v = bodyVector(id, refTime, observer);
  const transitAlt = Math.asin(clamp1(applyMat3(eqjToHorMatrix(refTime, observer), unit(v))[2])) * RAD;
  // Only call it circumpolar / never-rising when nothing happens for a whole day around the transit.
  let circumpolar = false, neverRises = false;
  if (!rise && !set) {
    const anyRise = Astronomy.SearchRiseSet(body, obs, +1, new Date(refTime.getTime() - DAY_MS / 2), 1);
    const anySet = Astronomy.SearchRiseSet(body, obs, -1, new Date(refTime.getTime() - DAY_MS / 2), 1);
    if (!anyRise && !anySet) {
      circumpolar = transitAlt > 0;
      neverRises = !circumpolar;
    }
  }
  return { rise, transit, set, transitAlt, circumpolar, neverRises };
}

/**
 * Rise, transit (highest point, due south or north) and set of a body or a fixed J2000 position.
 *
 * window 'night' (default for everything except the Sun): the pass that belongs to the night starting
 * on the local date of `date` — the transit that falls between local noon and the next local noon,
 * the rise before it and the set after it.
 * window 'day' (default for the Sun): the first rise, transit and set between local midnight and the
 * next local midnight (what an almanac prints for that date); null when the event does not occur.
 *
 * Rise/set use the standard definition: refraction 34′; upper limb for the Sun and Moon, centre otherwise.
 * `transitAlt` is the airless altitude at transit.
 */
export function riseSet(target: BodyId | RaDec, date: Date, observer: Observer, opts?: { window?: 'night' | 'day' }): RiseSet {
  const d = localDateOf(date, observer);
  const mode = opts?.window ?? (target === 'Sun' ? 'day' : 'night');
  const hour = mode === 'night' ? 12 : 0;
  const start = localInstant(d, hour, 0, observer.tz).getTime();
  const end = localInstant(addDays(d, 1), hour, 0, observer.tz).getTime();
  return isBodyId(target) ? riseSetBody(target, start, end, mode, observer) : riseSetFixed(target, start, end, mode, observer);
}

// ───────────────────────────── Visibility classification ─────────────────────────────

interface Rule { sunLimit: number; minAlt: number; minMinutes: number }

function ruleFor(target: VisTarget): Rule {
  if (isBodyId(target)) {
    if (target === 'Mercury' || target === 'Venus') return { sunLimit: TWILIGHT_SUN_ALT, minAlt: MIN_ALT_BODY, minMinutes: MIN_VISIBLE_MINUTES_INNER };
    if (target === 'Moon') return { sunLimit: TWILIGHT_SUN_ALT, minAlt: MIN_ALT_BODY, minMinutes: MIN_VISIBLE_MINUTES };
    return { sunLimit: DARK_SUN_ALT, minAlt: MIN_ALT_BODY, minMinutes: MIN_VISIBLE_MINUTES };
  }
  return { sunLimit: DARK_SUN_ALT, minAlt: MIN_ALT_FIXED, minMinutes: MIN_VISIBLE_MINUTES };
}

const NOT_VISIBLE: VisibilityInfo = { cls: 'not-visible', darkHours: 0, bestTime: null, bestAlt: 0, bestAz: 0 };

interface Prepared {
  /** Fixed unit vectors (stars) — empty for a moving body */
  vecs: Vec3[];
  /** Direction used for "how high / where" (mean direction of the points) */
  centre: Vec3 | null;
  body: BodyId | null;
  need: number;
}

function prepare(target: VisTarget): Prepared {
  if (isBodyId(target)) return { vecs: [], centre: null, body: target, need: 1 };
  if ('points' in target) {
    const vecs = target.points.map((p) => raDecToVec(p.ra, p.dec));
    const c = meanDirection(target.points);
    return { vecs, centre: raDecToVec(c.ra, c.dec), body: null, need: Math.max(1, Math.ceil(CONSTELLATION_UP_FRACTION * vecs.length - 1e-9)) };
  }
  const v = raDecToVec(target.ra, target.dec);
  return { vecs: [v], centre: v, body: null, need: 1 };
}

function classify(target: VisTarget, g: NightGrid, rule: Rule = ruleFor(target)): VisibilityInfo {
  if (target === 'Sun') return { ...NOT_VISIBLE };
  const prep = prepare(target);
  if (!prep.body && prep.vecs.length === 0) return { ...NOT_VISIBLE };
  if (prep.body === 'Moon' && moonPhase(new Date(g.t0 + (g.n >> 1) * STEP_MS)).illumination < MIN_MOON_ILLUMINATION) return { ...NOT_VISIBLE };
  const track = prep.body ? bodyTrack(g, prep.body) : null;
  const sinMin = Math.sin(rule.minAlt * DEG);
  let dark = 0, up = 0, firstDark = -1, lastDark = -1, sumK = 0;
  let bestK = -1, bestZ = -2, bestDarkK = -1, bestDarkZ = -2;
  for (let k = 0; k < g.n; k++) {
    if (g.sunAlt[k] >= rule.sunLimit) continue;
    dark++;
    if (firstDark < 0) firstDark = k;
    lastDark = k;
    let isUp: boolean, z: number;
    if (track) {
      z = rowZ(g.mats, k, track[3 * k], track[3 * k + 1], track[3 * k + 2]);
      isUp = z >= sinMin;
    } else {
      let cnt = 0;
      for (const v of prep.vecs) if (rowZ(g.mats, k, v[0], v[1], v[2]) >= sinMin) cnt++;
      isUp = cnt >= prep.need;
      const c = prep.centre as Vec3;
      z = rowZ(g.mats, k, c[0], c[1], c[2]);
    }
    if (z > bestDarkZ) { bestDarkZ = z; bestDarkK = k; }
    if (isUp) {
      up++;
      sumK += k;
      if (z > bestZ) { bestZ = z; bestK = k; }
    }
  }
  if (dark === 0) return { ...NOT_VISIBLE };
  const posAt = (k: number) => gridAltAz(g, k, track ? [track[3 * k], track[3 * k + 1], track[3 * k + 2]] : (prep.centre as Vec3));
  const darkHours = (up * STEP_MINUTES) / 60;
  if (up * STEP_MINUTES < rule.minMinutes) {
    const p = posAt(bestDarkK);
    return { cls: 'not-visible', darkHours, bestTime: null, bestAlt: p.alt, bestAz: p.az };
  }
  let cls: VisibilityClass;
  if (up >= ALL_NIGHT_FRACTION * dark) cls = 'all-night';
  else cls = sumK / up <= (firstDark + lastDark) / 2 ? 'evening' : 'morning';
  const p = posAt(bestK);
  return { cls, darkHours, bestTime: new Date(g.t0 + bestK * STEP_MS), bestAlt: p.alt, bestAz: p.az };
}

/**
 * Classify the night that begins on the local date of `date`:
 * 'all-night' | 'evening' | 'morning' | 'not-visible', with hours up while dark and the best time to look.
 * When not visible, bestTime is null and bestAlt/bestAz give the highest position reached while dark
 * (may be below the horizon; 0/0 when there is no darkness at all).
 */
export function visibilityOn(target: VisTarget, date: Date, observer: Observer): VisibilityInfo {
  return classify(target, getGrid(localDateOf(date, observer), observer));
}

/** Twelve entries, January…December, each evaluated for the night of the 15th. */
export function yearVisibility(target: VisTarget, year: number, observer: Observer): VisibilityInfo[] {
  const out: VisibilityInfo[] = [];
  for (let m = 1; m <= 12; m++) out.push(classify(target, getGrid({ year, month: m, day: 15 }, observer)));
  return out;
}

// ───────────────────────────── Evening sky through the year ─────────────────────────────

interface EveningSample { month: number; grid: NightGrid; ks: number[] }
const eveningCache = new Lru<EveningSample[]>(16);

/** For the 5th, 15th and 25th of every month: the grid samples at 21:00 and 22:00 local, or at the end of nautical twilight if that is later. */
function eveningSamples(year: number, observer: Observer, hours: number[]): EveningSample[] {
  const key = `${year}|${hours.join(',')}|${obsKey(observer)}`;
  let out = eveningCache.get(key);
  if (out) return out;
  out = [];
  for (let month = 1; month <= 12; month++) {
    for (const day of [5, 15, 25]) {
      const d = { year, month, day };
      const g = getGrid(d, observer);
      let firstDark = -1;
      for (let k = 0; k < g.n; k++) if (g.sunAlt[k] < DARK_SUN_ALT) { firstDark = k; break; }
      const ks: number[] = [];
      if (firstDark >= 0) {
        for (const h of hours) {
          let k = Math.round((localInstant(d, h, 0, observer.tz).getTime() - g.t0) / STEP_MS);
          if (k < firstDark) k = firstDark;
          if (k < g.n && g.sunAlt[k] < DARK_SUN_ALT) ks.push(k);
        }
      }
      out.push({ month, grid: g, ks });
    }
  }
  eveningCache.set(key, out);
  return out;
}

/** Evening altitude score for each of the 36 sample dates: altitude (deg) if the target is up, else 0. */
function eveningWeights(target: VisTarget, year: number, observer: Observer, hours: number[]): { month: number; w: number; dark: boolean }[] {
  const prep = prepare(target);
  const rule = ruleFor(target);
  const sinMin = Math.sin(rule.minAlt * DEG);
  return eveningSamples(year, observer, hours).map(({ month, grid, ks }) => {
    let w = 0;
    if (target !== 'Sun') {
      const track = prep.body ? bodyTrack(grid, prep.body) : null;
      for (const k of ks) {
        let z: number, isUp: boolean;
        if (track) {
          z = rowZ(grid.mats, k, track[3 * k], track[3 * k + 1], track[3 * k + 2]);
          isUp = z >= sinMin;
        } else if (prep.centre) {
          let cnt = 0;
          for (const v of prep.vecs) if (rowZ(grid.mats, k, v[0], v[1], v[2]) >= sinMin) cnt++;
          isUp = cnt >= prep.need;
          z = rowZ(grid.mats, k, prep.centre[0], prep.centre[1], prep.centre[2]);
        } else continue;
        if (isUp) w += Math.max(0, Math.asin(clamp1(z)) * RAD) / hours.length;
      }
    }
    return { month, w, dark: ks.length > 0 };
  });
}

function defaultYear(): number {
  return new Date().getUTCFullYear();
}

export type EveningSeason = 'winter' | 'spring' | 'summer' | 'autumn' | 'all-year' | 'never';

/** Meteorological season of a month (1–12). Names are for the observer's hemisphere: December is 'winter' in the north and 'summer' in the south. */
export function seasonOfMonth(month: number, lat: number): 'winter' | 'spring' | 'summer' | 'autumn' {
  const north = (['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'] as const)[month - 1];
  if (lat >= 0) return north;
  return ({ winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' } as const)[north];
}

/**
 * The season in which the target is best placed in the evening sky (around 21:00–22:00 local time,
 * or as soon as it is dark if that is later). Seasons are the observer's own: for southern-hemisphere
 * observers December–February is 'summer'. 'all-year' = up every evening without ever getting low
 * (circumpolar and near the pole); 'never' = never up in the evening from here.
 * Fixed stars give the same answer every year; for planets pass `opts.year` (default: current year).
 * The Moon returns 'all-year' (it visits the evening sky every month); the Sun 'never'.
 */
export function eveningSeason(target: VisTarget, observer: Observer, opts?: { year?: number; hours?: number[] }): EveningSeason {
  if (target === 'Sun') return 'never';
  if (target === 'Moon') return 'all-year';
  const ws = eveningWeights(target, opts?.year ?? defaultYear(), observer, opts?.hours ?? SEASON_EVENING_HOURS);
  const max = Math.max(...ws.map((x) => x.w));
  if (!(max > 0)) return 'never';
  const usable = ws.filter((x) => x.dark);
  if (usable.length > 0 && usable.every((x) => x.w >= ALL_YEAR_FRACTION * max)) return 'all-year';
  const sums: Record<string, number> = { winter: 0, spring: 0, summer: 0, autumn: 0 };
  for (const x of ws) sums[seasonOfMonth(x.month, observer.lat)] += x.w;
  let best: EveningSeason = 'winter';
  for (const s of ['winter', 'spring', 'summer', 'autumn'] as const) if (sums[s] > sums[best]) best = s;
  return best;
}

/**
 * Months (1–12, ascending) in which the target is well placed around 21:00–22:00 local time: up, and at
 * least BEST_MONTH_FRACTION of the best evening altitude it reaches during the year.
 */
export function bestMonths(target: VisTarget, observer: Observer, opts?: { year?: number }): number[] {
  if (target === 'Sun') return [];
  const ws = eveningWeights(target, opts?.year ?? defaultYear(), observer, EVENING_HOURS);
  const max = Math.max(...ws.map((x) => x.w));
  if (!(max > 0)) return [];
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const mine = ws.filter((x) => x.month === m);
    const mean = mine.reduce((s, x) => s + x.w, 0) / mine.length;
    if (mean >= BEST_MONTH_FRACTION * max) out.push(m);
  }
  // A target with a very short season (it barely clears the horizon) still gets its single best month.
  if (!out.length) out.push(ws.reduce((a, b) => (b.w > a.w ? b : a)).month);
  return out;
}

// ───────────────────────────── Tonight ─────────────────────────────

/** The parts of a catalog these functions need (a full `Catalog` from src/data/catalog.ts fits). */
export interface CatalogLike {
  stars: Star[];
  constellations: Constellation[];
  starById: Map<number, Star>;
}

/** Positions used to judge a constellation: its main stars, else its figure stars, else its label anchor. */
export function constellationPoints(c: Constellation, catalog: Pick<CatalogLike, 'starById'>): RaDec[] {
  for (const ids of [c.mainStars, c.figureStars]) {
    const pts: RaDec[] = [];
    for (const id of ids ?? []) {
      const s = catalog.starById.get(id);
      if (s) pts.push({ ra: s.ra, dec: s.dec });
    }
    if (pts.length) return pts;
  }
  return [{ ra: c.ra, dec: c.dec }];
}

/** "low in the southwest", "high in the south", "nearly overhead". */
export function whereWords(alt: number, az: number): string {
  if (alt >= 75) return 'nearly overhead';
  const height = alt >= 50 ? 'high' : alt >= 25 ? 'about halfway up' : 'low';
  return `${height} in the ${compassWord(az)}`;
}

function noteFor(v: VisibilityInfo, tz: string): string {
  if (v.cls === 'not-visible' || !v.bestTime) return 'Not visible tonight.';
  const when = v.cls === 'all-night' ? 'Up all night' : v.cls === 'evening' ? 'Evening sky' : 'Morning sky, before dawn';
  return `${when}. Best around ${formatTime(v.bestTime, tz)}, ${whereWords(v.bestAlt, v.bestAz)}.`;
}

function sortTonight(items: TonightItem[]): TonightItem[] {
  return items.sort((a, b) => {
    const ta = a.visibility.bestTime?.getTime() ?? Infinity;
    const tb = b.visibility.bestTime?.getTime() ?? Infinity;
    return ta !== tb ? ta - tb : a.name.localeCompare(b.name);
  });
}

export interface Tonight {
  night: NightWindow;
  moon: { phase: MoonPhase; rise: Date | null; set: Date | null };
  planets: TonightItem[];
  constellations: TonightItem[];
  brightStars: TonightItem[];
}

/** Bright-star cut-off for `tonight().brightStars`. */
export const BRIGHT_STAR_MAG = 1.5;

/**
 * Everything for the night that begins on the local date of `date`. Each list holds EVERY candidate
 * (7 planets, 88 constellations, stars of magnitude ≤ 1.5): visible ones first, sorted by best time,
 * then the ones with `visibility.cls === 'not-visible'`. Filter on `cls` to show only what is up.
 */
export function tonight(date: Date, observer: Observer, catalog: CatalogLike): Tonight {
  const d = localDateOf(date, observer);
  const g = getGrid(d, observer);
  const night = nightWindowFor(d, observer);
  const mid = new Date(g.t0 + (g.n >> 1) * STEP_MS);
  const moonRs = riseSet('Moon', date, observer);
  const planets = PLANET_IDS.map((id): TonightItem => {
    const visibility = classify(id, g);
    const rs = riseSet(id, date, observer);
    return { ref: `body:${id}`, name: id, kind: 'body', visibility, rise: rs.rise, set: rs.set, note: noteFor(visibility, observer.tz) };
  });
  const constellations = catalog.constellations.map((c): TonightItem => {
    const visibility = classify({ points: constellationPoints(c, catalog) }, g);
    return { ref: `con:${c.id}`, name: c.name, kind: 'constellation', visibility, note: noteFor(visibility, observer.tz) };
  });
  const brightStars: TonightItem[] = [];
  const seenBright: { ra: number; dec: number }[] = [];
  for (const s of catalog.stars) {
    if (s.mag > BRIGHT_STAR_MAG) continue;
    // Skip the fainter component of a close pair (Capella B, α Cen B…): to the eye it is one star.
    if (seenBright.some((b) => Math.abs(b.dec - s.dec) < 0.1 && Math.abs(b.ra - s.ra) * Math.cos((s.dec * Math.PI) / 180) < 0.1)) continue;
    seenBright.push(s);
    const visibility = classify({ ra: s.ra, dec: s.dec }, g);
    const rs = riseSet({ ra: s.ra, dec: s.dec }, date, observer);
    brightStars.push({ ref: `star:${s.id}`, name: s.name ?? s.desig, kind: 'star', visibility, rise: rs.rise, set: rs.set, note: noteFor(visibility, observer.tz) });
  }
  return {
    night,
    moon: { phase: moonPhase(mid), rise: moonRs.rise, set: moonRs.set },
    planets: sortTonight(planets),
    constellations: sortTonight(constellations),
    brightStars: sortTonight(brightStars),
  };
}

/**
 * Constellations with at least one main star above the horizon right now, highest first.
 * alt/az are those of the middle of the main stars; fractionUp is the share of main stars above the horizon.
 */
export function upNow(date: Date, observer: Observer, catalog: CatalogLike): { con: string; alt: number; az: number; fractionUp: number }[] {
  const altAz = makeAltAz(date, observer);
  const out: { con: string; alt: number; az: number; fractionUp: number }[] = [];
  for (const c of catalog.constellations) {
    const pts = constellationPoints(c, catalog);
    let up = 0;
    for (const p of pts) if (altAz(p.ra, p.dec).alt > 0) up++;
    if (!up) continue;
    const m = meanDirection(pts);
    const { alt, az } = altAz(m.ra, m.dec);
    out.push({ con: c.id, alt, az, fractionUp: up / pts.length });
  }
  return out.sort((a, b) => b.alt - a.alt);
}

/** Drop all cached night grids (tests / memory pressure). */
export function clearVisibilityCache(): void {
  gridCache.clear();
  nightCache.clear();
  eveningCache.clear();
}

// Internal hooks for events.ts (same sampling, same thresholds).
export const _internal = { getGrid, classify, bodyTrack, gridAltAz, addDays, localInstant, STEP_MS };
export type { NightGrid, Rule };
