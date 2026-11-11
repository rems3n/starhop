/**
 * The sky calendar: oppositions, elongations, conjunctions, eclipses, seasons, Moon phases and
 * meteor-shower peaks for one observer, each with a plain-language "when and where to look".
 */
import * as Astronomy from 'astronomy-engine';
import type { BodyId, Observer, SkyEvent } from '@/types';
import type { MeteorShower } from '@/content/schema';
import { compassWord } from '@/lib/format';
import { formatDate, formatTime } from '@/lib/time';
import { NAKED_EYE_PLANETS, PLANET_IDS, astroBody, bodyVector, constellationAt, moonPhase } from './bodies';
import { RAD, applyMat3, eqjToHorMatrix, horVecToAltAz, norm180, norm360, raDecToVec, type Vec3 } from './frames';
import { DARK_SUN_ALT, TWILIGHT_SUN_ALT, _internal, localDateOf, nightWindow, riseSet, whereWords, type NightGrid } from './visibility';

const { getGrid, bodyTrack, gridAltAz, addDays, STEP_MS } = _internal;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

/** Planet–planet conjunctions are listed when the two come closer than this (degrees)… */
export const CONJUNCTION_MAX_SEP = 2;
/** …and both are at least this far from the Sun (degrees). */
export const CONJUNCTION_MIN_ELONGATION = 15;
/** Moon–planet pairings are listed when closer than this (degrees) as seen from the observer while both are up. */
export const MOON_PLANET_MAX_SEP = 3;
/** Sun altitude limit for "a dark or twilight sky" in Moon–planet pairings. */
export const PAIRING_SUN_ALT = -4;
/** Minimum altitude of both objects for a pairing or conjunction to count as visible. */
export const PAIRING_MIN_ALT = 5;
/** A meteor shower counts as visible here when its radiant is above the horizon in a dark sky for at least this many hours. */
export const SHOWER_MIN_HOURS = 1;

// ───────────────────────────── small helpers ─────────────────────────────

function sepDeg(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0];
  return Math.atan2(Math.hypot(cx, cy, cz), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * RAD;
}
function geo(id: BodyId, t: Date | Astronomy.AstroTime): Vec3 {
  const v = Astronomy.GeoVector(astroBody(id), t, true);
  return [v.x, v.y, v.z];
}
function altAzBody(id: BodyId, date: Date, observer: Observer) {
  return horVecToAltAz(applyMat3(eqjToHorMatrix(date, observer), bodyVector(id, date, observer)));
}
function conName(v: ArrayLike<number>): string {
  const ra = norm360(Math.atan2(v[1], v[0]) * RAD);
  const dec = Math.asin(v[2] / Math.hypot(v[0], v[1], v[2])) * RAD;
  return Astronomy.Constellation(ra / 15, dec).name;
}
function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}
function fmtSep(deg: number): string {
  return deg < 0.95 ? `${deg.toFixed(1)}°` : `${deg.toFixed(deg < 3 ? 1 : 0)}°`;
}
/** How to picture a small angle. */
function sepWords(deg: number): string {
  if (deg < 0.7) return 'about the width of the full Moon or less';
  if (deg < 1.5) return 'about a little-finger width at arm\'s length';
  if (deg < 2.6) return 'about two finger-widths at arm\'s length';
  return 'about three finger-widths at arm\'s length';
}
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** The grid (noon → noon) that contains an instant. */
function gridAt(t: number, observer: Observer): NightGrid {
  return getGrid(localDateOf(new Date(t - 12 * HOUR_MS), observer), observer);
}
function trackVec(g: NightGrid, id: BodyId, k: number): Vec3 {
  const tr = bodyTrack(g, id);
  return [tr[3 * k], tr[3 * k + 1], tr[3 * k + 2]];
}

interface Look { time: Date; sep: number; alt: number; az: number }

/**
 * Among the samples of one night where the Sun is below `sunLimit` and both bodies are above `minAlt`,
 * return the one that minimises `score` (default: their separation).
 */
function bestLookInGrid(g: NightGrid, a: BodyId, b: BodyId, sunLimit: number, minAlt: number, tFrom: number, tTo: number, prefer: 'closest' | 'highest'): Look | null {
  let best: Look | null = null;
  let bestScore = Infinity;
  for (let k = 0; k < g.n; k++) {
    const t = g.t0 + k * STEP_MS;
    if (t < tFrom || t > tTo || g.sunAlt[k] >= sunLimit) continue;
    const va = trackVec(g, a, k), vb = trackVec(g, b, k);
    const pa = gridAltAz(g, k, va), pb = gridAltAz(g, k, vb);
    if (pa.alt < minAlt || pb.alt < minAlt) continue;
    const sep = sepDeg(va, vb);
    const score = prefer === 'closest' ? sep : -Math.min(pa.alt, pb.alt);
    if (score < bestScore) {
      bestScore = score;
      // Report the direction of the lower (harder) object so "where to look" is honest.
      const low = pa.alt <= pb.alt ? pa : pb;
      best = { time: new Date(t), sep, alt: low.alt, az: low.az };
    }
  }
  return best;
}

// ───────────────────────────── Sun longitude (J2000) ─────────────────────────────

/**
 * The Sun's ecliptic longitude referred to the J2000.0 equinox, in degrees. Meteor-shower tables (IMO)
 * use this; astronomy-engine's own `SunPosition`/`SearchSunLongitude` use the equinox OF DATE, which by
 * 2026 differs by 0.37° — about nine hours of solar motion.
 */
export function sunLongitudeJ2000(date: Date): number {
  const v = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), Astronomy.GeoVector(Astronomy.Body.Sun, date, true));
  return norm360(Math.atan2(v.y, v.x) * RAD);
}

/** The instant in (roughly) calendar year `year` when the Sun reaches J2000 ecliptic longitude `lon`. */
export function dateOfSolarLongitudeJ2000(lon: number, year: number): Date {
  // First guess from a uniform Sun starting at the March equinox, then Newton steps.
  let t = Date.UTC(year, 2, 20, 12) + (norm360(lon) / 360) * 365.2422 * DAY_MS;
  if (t >= Date.UTC(year + 1, 0, 1)) t -= 365.2422 * DAY_MS;
  for (let i = 0; i < 6; i++) t += (norm180(lon - sunLongitudeJ2000(new Date(t))) / 0.985647) * DAY_MS;
  return new Date(t);
}

// ───────────────────────────── Event builders ─────────────────────────────

function oppositions(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const id of ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as BodyId[]) {
    let cursor = start;
    for (let guard = 0; guard < 20; guard++) {
      const t = Astronomy.SearchRelativeLongitude(astroBody(id), 0, cursor).date;
      if (t >= end) break;
      const rs = riseSet(id, new Date(t.getTime() - 12 * HOUR_MS), o);
      const mag = Astronomy.Illumination(astroBody(id), t).mag;
      const con = conName(geo(id, t));
      const visibleHere = rs.transitAlt >= 10;
      let detail = `${id} is opposite the Sun in the sky, so it rises around sunset, is up all night and sets around sunrise. It is at its closest and brightest for this apparition (magnitude ${mag.toFixed(1)}), in ${con}. `;
      if (rs.transit) {
        const p = altAzBody(id, rs.transit, o);
        detail += visibleHere
          ? `From ${o.name} it is highest around ${formatTime(rs.transit, o.tz)}, ${whereWords(p.alt, p.az)} (${Math.round(p.alt)}° up). Any night within a few weeks of this date is nearly as good.`
          : `From ${o.name} it never gets higher than ${Math.round(rs.transitAlt)}°, so it is hard or impossible to see.`;
      }
      if (id === 'Uranus') detail += ' Uranus is at the very edge of naked-eye visibility; binoculars and a chart are needed.';
      if (id === 'Neptune') detail += ' Neptune is far too faint for the naked eye; a telescope is needed.';
      out.push({ kind: 'opposition', date: t, title: `${id} at opposition`, detail, refs: [`body:${id}`], visibleHere });
      cursor = new Date(t.getTime() + 30 * DAY_MS);
    }
  }
  return out;
}

function elongations(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const id of ['Mercury', 'Venus'] as BodyId[]) {
    let cursor = new Date(start.getTime() - 2 * DAY_MS);
    for (let guard = 0; guard < 30; guard++) {
      const e = Astronomy.SearchMaxElongation(astroBody(id), cursor);
      const t = e.time.date;
      cursor = new Date(t.getTime() + 5 * DAY_MS);
      if (t < start) continue;
      if (t >= end) break;
      const evening = e.visibility === 'evening';
      // Evening: dusk of the local date. Morning: dawn of the local date = end of the night that began the day before.
      const nw = evening ? nightWindow(t, o) : nightWindow(new Date(t.getTime() - DAY_MS), o);
      const when = evening ? nw.civilDusk : nw.civilDawn;
      let detail = `${id} is at its greatest angle from the Sun (${Math.round(e.elongation)}°) in the ${evening ? 'evening' : 'morning'} sky — the best time in this appearance to spot it. `;
      let visibleHere = false;
      if (when) {
        const p = altAzBody(id, when, o);
        visibleHere = p.alt >= PAIRING_MIN_ALT;
        const edge = evening ? nw.sunset : nw.sunrise;
        detail += visibleHere
          ? `From ${o.name}, look ${whereWords(p.alt, p.az)} around ${formatTime(when, o.tz)} (about ${edge ? Math.round(Math.abs(when.getTime() - edge.getTime()) / 60000) : 30} minutes ${evening ? 'after sunset' : 'before sunrise'}), when it is ${Math.round(p.alt)}° above the horizon. You need a clear, low ${compassWord(p.az)} horizon.`
          : `From ${o.name} it is only ${Math.round(p.alt)}° above the ${compassWord(p.az)} horizon at ${formatTime(when, o.tz)} when the sky starts to get ${evening ? 'dark' : 'light'}, so it is very hard to see this time.`;
      } else {
        detail += `From ${o.name} the sky does not get dark enough on this date.`;
      }
      out.push({ kind: 'greatest-elongation', date: t, title: `${id} at greatest elongation (${evening ? 'evening' : 'morning'} sky)`, detail, refs: [`body:${id}`], visibleHere });
    }
  }
  return out;
}

function goldenMin(f: (t: number) => number, a: number, b: number, tolMs = 60000): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = f(c), fd = f(d);
  while (b - a > tolMs) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}

function planetConjunctions(start: Date, end: Date, o: Observer, daily: Map<BodyId, Vec3[]>, t0: number, nDays: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (let i = 0; i < PLANET_IDS.length; i++) {
    for (let j = i + 1; j < PLANET_IDS.length; j++) {
      const a = PLANET_IDS[i], b = PLANET_IDS[j];
      const va = daily.get(a) as Vec3[], vb = daily.get(b) as Vec3[];
      const s = (k: number) => sepDeg(va[k], vb[k]);
      for (let k = 1; k < nDays - 1; k++) {
        const sk = s(k);
        if (sk > CONJUNCTION_MAX_SEP + 1.5 || !(sk <= s(k - 1) && sk < s(k + 1))) continue;
        const tMin = goldenMin((t) => sepDeg(geo(a, new Date(t)), geo(b, new Date(t))), t0 + (k - 1) * DAY_MS, t0 + (k + 1) * DAY_MS);
        const when = new Date(tMin);
        if (when < start || when >= end) continue;
        const ga = geo(a, when), gb = geo(b, when);
        const minSep = sepDeg(ga, gb);
        if (minSep >= CONJUNCTION_MAX_SEP) continue;
        const sun = geo('Sun', when);
        const elong = Math.min(sepDeg(ga, sun), sepDeg(gb, sun));
        if (elong < CONJUNCTION_MIN_ELONGATION) continue;
        const faint = [a, b].filter((x) => x === 'Uranus' || x === 'Neptune');
        const sunLimit = faint.length ? DARK_SUN_ALT : TWILIGHT_SUN_ALT;
        // Nearest night on which both are up in a dark enough sky.
        let look: Look | null = null;
        const g0 = gridAt(tMin, o);
        for (const off of [0, -1, 1]) {
          look = bestLookInGrid(getGrid(addDays(g0.date, off), o), a, b, sunLimit, PAIRING_MIN_ALT, -Infinity, Infinity, 'highest');
          if (look) break;
        }
        let detail = `${a} and ${b} pass ${fmtSep(minSep)} apart (${sepWords(minSep)}), in ${conName(ga)}; closest around ${formatDate(when, o.tz, { month: 'short', day: 'numeric' })}, ${formatTime(when, o.tz)}. They only look close together — ${b} is far behind ${a} in space. `;
        if (look) {
          detail += `From ${o.name}, look ${whereWords(look.alt, look.az)} around ${formatTime(look.time, o.tz)} on ${formatDate(look.time, o.tz, { weekday: 'short', month: 'short', day: 'numeric' })}; they will be ${fmtSep(look.sep)} apart then.`;
        } else {
          detail += `From ${o.name} the pair is not above the horizon in a dark enough sky around this date.`;
        }
        if (faint.length) detail += ` ${faint.join(' and ')} ${faint.length > 1 ? 'are' : 'is'} too faint for the naked eye — use binoculars or a telescope.`;
        out.push({ kind: 'conjunction', date: when, title: `${a} and ${b} close together (${fmtSep(minSep)})`, detail, refs: [`body:${a}`, `body:${b}`], visibleHere: !!look });
      }
    }
  }
  return out;
}

function moonPairings(start: Date, end: Date, o: Observer, daily: Map<BodyId, Vec3[]>, t0: number, nDays: number): SkyEvent[] {
  const out: SkyEvent[] = [];
  const eclLon = (v: Vec3) => {
    const e = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), new Astronomy.Vector(v[0], v[1], v[2], Astronomy.MakeTime(new Date(t0))));
    return Math.atan2(e.y, e.x) * RAD;
  };
  const moon: Vec3[] = [];
  for (let k = 0; k < nDays; k++) {
    const m = Astronomy.GeoMoon(new Date(t0 + k * DAY_MS));
    moon.push([m.x, m.y, m.z]);
  }
  const moonLon = moon.map(eclLon);
  for (const id of NAKED_EYE_PLANETS) {
    const pv = daily.get(id) as Vec3[];
    const diff = pv.map((v, k) => norm180(moonLon[k] - eclLon(v)));
    for (let k = 0; k < nDays - 1; k++) {
      if (!(diff[k] < 0 && diff[k + 1] >= 0 && diff[k + 1] - diff[k] < 30)) continue;
      const tc = t0 + (k + diff[k] / (diff[k] - diff[k + 1])) * DAY_MS;
      const mv = Astronomy.GeoMoon(new Date(tc));
      if (sepDeg([mv.x, mv.y, mv.z], geo(id, new Date(tc))) > MOON_PLANET_MAX_SEP + 2.5) continue;
      let best: Look | null = null;
      const seen = new Set<NightGrid>();
      for (const t of [tc - 9 * HOUR_MS, tc + 9 * HOUR_MS]) {
        const g = gridAt(t, o);
        if (seen.has(g)) continue;
        seen.add(g);
        const look = bestLookInGrid(g, 'Moon', id, PAIRING_SUN_ALT, PAIRING_MIN_ALT, tc - 14 * HOUR_MS, tc + 14 * HOUR_MS, 'closest');
        if (look && (!best || look.sep < best.sep)) best = look;
      }
      if (!best || best.sep >= MOON_PLANET_MAX_SEP) continue;
      if (best.time < start || best.time >= end) continue;
      const ph = moonPhase(best.time);
      const detail = `The ${ph.name.toLowerCase()} (${pct(ph.illumination)} lit) is ${fmtSep(best.sep)} from ${id} — ${sepWords(best.sep)}. From ${o.name}, look ${whereWords(best.alt, best.az)} around ${formatTime(best.time, o.tz)} on ${formatDate(best.time, o.tz, { weekday: 'short', month: 'short', day: 'numeric' })}. ${id} is the bright "star" next to the Moon that does not twinkle much.`;
      out.push({ kind: 'conjunction', date: best.time, title: `Moon near ${id} (${fmtSep(best.sep)})`, detail, refs: ['body:Moon', `body:${id}`], visibleHere: true });
    }
  }
  return out;
}

function lunarEclipses(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  let e = Astronomy.SearchLunarEclipse(new Date(start.getTime() - DAY_MS));
  for (let guard = 0; guard < 20 && e.peak.date < end; guard++, e = Astronomy.NextLunarEclipse(e.peak)) {
    const peak = e.peak.date;
    if (peak < start) continue;
    const at = (min: number) => new Date(peak.getTime() + min * 60000);
    const up = (t: Date) => altAzBody('Moon', t, o).alt > 0;
    const umbral = e.kind !== Astronomy.EclipseKind.Penumbral;
    const span = umbral ? e.sd_partial : e.sd_penum;
    let anyUp = false;
    for (let m = -span; m <= span; m += 10) if (up(at(m))) { anyUp = true; break; }
    const visibleHere = umbral ? anyUp : up(peak);
    const tm = (t: Date) => `${formatTime(t, o.tz)}${up(t) ? '' : ' (Moon below the horizon here)'}`;
    const p = altAzBody('Moon', peak, o);
    const day = formatDate(peak, o.tz, { weekday: 'short', month: 'short', day: 'numeric' });
    let detail: string;
    if (e.kind === Astronomy.EclipseKind.Total) {
      detail = `The full Moon passes completely into the Earth's shadow and turns a dim copper-red. Times for ${o.name}: the shadow's first bite at ${tm(at(-e.sd_partial))}, totality from ${tm(at(-e.sd_total))} to ${tm(at(e.sd_total))} (deepest at ${formatTime(peak, o.tz)} on ${day}), shadow gone by ${tm(at(e.sd_partial))}.`;
    } else if (e.kind === Astronomy.EclipseKind.Partial) {
      detail = `Part of the full Moon passes through the Earth's dark shadow; at most ${pct(e.obscuration)} of the Moon's disc is covered. Times for ${o.name}: the shadow's first bite at ${tm(at(-e.sd_partial))}, deepest at ${tm(peak)} on ${day}, shadow gone by ${tm(at(e.sd_partial))}.`;
    } else {
      detail = `The full Moon passes through the faint outer part of the Earth's shadow only. At best one edge of the Moon looks slightly dusky around ${tm(peak)} on ${day}; many people notice nothing. Runs from ${tm(at(-e.sd_penum))} to ${tm(at(e.sd_penum))}.`;
    }
    detail += visibleHere
      ? ` At the deepest point the Moon is ${p.alt > 0 ? `${whereWords(p.alt, p.az)} (${Math.round(p.alt)}° up)` : 'below the horizon, so only part of the eclipse can be seen from here'}. Safe to watch with the naked eye.`
      : ` Not visible from ${o.name}: the Moon is below the horizon while it happens.`;
    out.push({ kind: 'lunar-eclipse', date: peak, title: `${cap(e.kind)} lunar eclipse`, detail, refs: ['body:Moon'], visibleHere });
  }
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function latLonWords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}`;
}

/** Local circumstances of the solar eclipse whose global peak is `peak`, or null if the Sun is not eclipsed above this observer's horizon. */
export function localSolarEclipse(peak: Date, observer: Observer): { kind: string; obscuration: number; start: Date; max: Date; end: Date; maxAlt: number; maxAz: number; startAlt: number; endAlt: number } | null {
  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.elevationM ?? 0);
  const l = Astronomy.SearchLocalSolarEclipse(new Date(peak.getTime() - 2 * DAY_MS), obs);
  if (Math.abs(l.peak.time.date.getTime() - peak.getTime()) > 8 * HOUR_MS) return null;
  if (!(l.obscuration > 0)) return null;
  if (l.partial_begin.altitude <= 0 && l.peak.altitude <= 0 && l.partial_end.altitude <= 0) return null;
  const p = altAzBody('Sun', l.peak.time.date, observer);
  return {
    kind: l.kind, obscuration: l.obscuration, start: l.partial_begin.time.date, max: l.peak.time.date, end: l.partial_end.time.date,
    maxAlt: p.alt, maxAz: p.az, startAlt: l.partial_begin.altitude, endAlt: l.partial_end.altitude,
  };
}

function solarEclipses(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  let e = Astronomy.SearchGlobalSolarEclipse(new Date(start.getTime() - DAY_MS));
  for (let guard = 0; guard < 20 && e.peak.date < end; guard++, e = Astronomy.NextGlobalSolarEclipse(e.peak)) {
    const peak = e.peak.date;
    if (peak < start) continue;
    const local = localSolarEclipse(peak, o);
    const day = formatDate(peak, o.tz, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    let detail = e.kind === Astronomy.EclipseKind.Total
      ? 'The Moon passes exactly in front of the Sun. Along a narrow track on the Earth the Sun is completely hidden for a few minutes'
      : e.kind === Astronomy.EclipseKind.Annular
        ? 'The Moon passes in front of the Sun but looks slightly too small to cover it, leaving a ring of sunlight along a narrow track on the Earth'
        : 'The Moon covers part of the Sun; nowhere on Earth sees it fully covered';
    if (e.latitude !== undefined && e.longitude !== undefined && e.kind !== Astronomy.EclipseKind.Partial) detail += ` (centred near ${latLonWords(e.latitude, e.longitude)} at greatest eclipse)`;
    detail += `. Greatest eclipse is at ${formatTime(peak, o.tz)} ${o.name} time on ${day}. `;
    let title = `${cap(e.kind)} solar eclipse`;
    if (local) {
      const lk = local.kind === e.kind ? local.kind : `${local.kind}`;
      title += local.kind === e.kind && e.kind !== Astronomy.EclipseKind.Partial ? ` — ${lk} from ${o.name}` : ` — partial from ${o.name}`;
      detail += `From ${o.name} it is a ${local.kind} eclipse: the Moon covers at most ${local.obscuration < 0.01 ? 'less than 1%' : pct(local.obscuration)} of the Sun's disc. It starts at ${formatTime(local.start, o.tz)}${local.startAlt <= 0 ? ' (before sunrise here)' : ''}, is greatest at ${formatTime(local.max, o.tz)}${local.maxAlt > 0 ? ` with the Sun ${whereWords(local.maxAlt, local.maxAz)} (${Math.round(local.maxAlt)}° up)` : ' (Sun below the horizon here)'}, and ends at ${formatTime(local.end, o.tz)}${local.endAlt <= 0 ? ' (after sunset here)' : ''}. Never look at the Sun without certified eclipse glasses or a proper solar filter — sunglasses are not safe.`;
    } else {
      title += ` (not visible from ${o.name})`;
      detail += `Not visible from ${o.name}: the Moon's shadow misses this location, or the Sun is below the horizon.`;
    }
    out.push({ kind: 'solar-eclipse', date: local ? local.max : peak, title, detail, refs: ['body:Sun', 'body:Moon'], visibleHere: !!local });
  }
  return out;
}

function seasons(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  const north = o.lat >= 0;
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    const s = Astronomy.Seasons(y);
    const list: [Date, 'equinox' | 'solstice', string, string][] = [
      [s.mar_equinox.date, 'equinox', 'March equinox', `The Sun crosses the celestial equator heading north. Day and night are close to equal everywhere, and ${north ? 'spring' : 'autumn'} begins in the ${north ? 'northern' : 'southern'} hemisphere. The Sun rises due east and sets due west.`],
      [s.jun_solstice.date, 'solstice', 'June solstice', `The Sun reaches its northernmost point in the sky: the ${north ? 'longest day and shortest night' : 'shortest day and longest night'} of the year here, and the start of astronomical ${north ? 'summer' : 'winter'}.`],
      [s.sep_equinox.date, 'equinox', 'September equinox', `The Sun crosses the celestial equator heading south. Day and night are close to equal everywhere, and ${north ? 'autumn' : 'spring'} begins in the ${north ? 'northern' : 'southern'} hemisphere. The Sun rises due east and sets due west.`],
      [s.dec_solstice.date, 'solstice', 'December solstice', `The Sun reaches its southernmost point in the sky: the ${north ? 'shortest day and longest night' : 'longest day and shortest night'} of the year here, and the start of astronomical ${north ? 'winter' : 'summer'}.`],
    ];
    for (const [t, kind, title, text] of list) {
      if (t < start || t >= end) continue;
      const rs = riseSet('Sun', t, o);
      const sunTimes = rs.rise && rs.set ? ` In ${o.name} the Sun rises at ${formatTime(rs.rise, o.tz)} and sets at ${formatTime(rs.set, o.tz)} that day, reaching ${Math.round(rs.transitAlt)}° at midday.` : '';
      out.push({ kind, date: t, title, detail: `${text} The exact moment is ${formatTime(t, o.tz)} on ${formatDate(t, o.tz, { month: 'short', day: 'numeric' })}.${sunTimes}`, refs: ['body:Sun'], visibleHere: true });
    }
  }
  return out;
}

function moonPhases(start: Date, end: Date, o: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  let mq = Astronomy.SearchMoonQuarter(start);
  for (let guard = 0; guard < 400 && mq.time.date < end; guard++, mq = Astronomy.NextMoonQuarter(mq)) {
    const t = mq.time.date;
    if (mq.quarter === 0) {
      out.push({
        kind: 'moon-phase', date: t, title: 'New Moon',
        detail: `The Moon is between us and the Sun (exactly new at ${formatTime(t, o.tz)} on ${formatDate(t, o.tz, { month: 'short', day: 'numeric' })}) and cannot be seen. The nights around this date have no moonlight — the best time of the month for faint stars, the Milky Way and deep-sky objects. Look for a thin crescent low in the west after sunset two or three days later.`,
        refs: ['body:Moon'], visibleHere: false,
      });
    } else if (mq.quarter === 2) {
      const rs = riseSet('Moon', new Date(t.getTime() - 12 * HOUR_MS), o);
      const riseAz = rs.rise ? altAzBody('Moon', rs.rise, o).az : 90;
      const con = conName(geo('Moon', t));
      out.push({
        kind: 'moon-phase', date: t, title: 'Full Moon',
        detail: `The Moon is opposite the Sun and fully lit (exactly full at ${formatTime(t, o.tz)} on ${formatDate(t, o.tz, { month: 'short', day: 'numeric' })}), in ${con}. ${rs.rise ? `From ${o.name} it rises in the ${compassWord(riseAz)} around ${formatTime(rs.rise, o.tz)}, close to sunset, ` : 'It '}is up all night${rs.transit ? ` and is highest around ${formatTime(rs.transit, o.tz)} (${Math.round(rs.transitAlt)}° up)` : ''}. Bright moonlight hides faint stars for a few nights either side.`,
        refs: ['body:Moon'], visibleHere: true,
      });
    }
  }
  return out;
}

/** Peak instants of one shower between two dates (usually one per year). */
export function showerPeaks(shower: Pick<MeteorShower, 'peakSolarLongitude'>, start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let y = start.getUTCFullYear() - 1; y <= end.getUTCFullYear(); y++) {
    const t = dateOfSolarLongitudeJ2000(shower.peakSolarLongitude, y);
    if (t >= start && t < end && !out.some((x) => Math.abs(x.getTime() - t.getTime()) < 30 * DAY_MS)) out.push(t);
  }
  return out;
}

/** Radiant and Moon circumstances for the night (local noon → noon) that contains a shower's peak. */
export function showerNight(shower: Pick<MeteorShower, 'radiant'>, peak: Date, observer: Observer): {
  nightOf: Date; darkHoursUp: number; from: Date | null; to: Date | null; best: Date | null; bestAlt: number; bestAz: number; moonIllumination: number; moonUpFraction: number;
} {
  const g = gridAt(peak.getTime(), observer);
  const v = raDecToVec(shower.radiant.ra, shower.radiant.dec);
  let n = 0, first = -1, last = -1, bestK = -1, bestAlt = -90, moonUp = 0;
  const moon = bodyTrack(g, 'Moon');
  for (let k = 0; k < g.n; k++) {
    if (g.sunAlt[k] >= DARK_SUN_ALT) continue;
    const p = gridAltAz(g, k, v);
    if (p.alt <= 0) continue;
    n++;
    if (first < 0) first = k;
    last = k;
    if (p.alt > bestAlt) { bestAlt = p.alt; bestK = k; }
    if (gridAltAz(g, k, [moon[3 * k], moon[3 * k + 1], moon[3 * k + 2]]).alt > 0) moonUp++;
  }
  const at = (k: number) => new Date(g.t0 + k * STEP_MS);
  const mid = at(bestK >= 0 ? bestK : g.n >> 1);
  return {
    nightOf: new Date(g.t0), darkHoursUp: (n * STEP_MS) / HOUR_MS, from: first >= 0 ? at(first) : null, to: last >= 0 ? at(last) : null,
    best: bestK >= 0 ? at(bestK) : null, bestAlt: bestK >= 0 ? bestAlt : 0, bestAz: bestK >= 0 ? gridAltAz(g, bestK, v).az : 0,
    moonIllumination: moonPhase(mid).illumination, moonUpFraction: n ? moonUp / n : 0,
  };
}

function meteorShowers(start: Date, end: Date, o: Observer, showers: MeteorShower[]): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const s of showers) {
    for (const peak of showerPeaks(s, start, end)) {
      const n = showerNight(s, peak, o);
      const visibleHere = n.darkHoursUp >= SHOWER_MIN_HOURS;
      const con = Astronomy.Constellation(norm360(s.radiant.ra) / 15, s.radiant.dec);
      const eve = formatDate(n.nightOf, o.tz, { weekday: 'short', month: 'short', day: 'numeric' });
      const morn = formatDate(new Date(n.nightOf.getTime() + DAY_MS), o.tz, { weekday: 'short', month: 'short', day: 'numeric' });
      let detail = `The ${s.name} are expected to peak around ${formatTime(peak, o.tz)} on ${formatDate(peak, o.tz, { month: 'short', day: 'numeric' })}. `;
      if (visibleHere && n.from && n.to && n.best) {
        detail += `Best night from ${o.name}: the night of ${eve} into the morning of ${morn}. The meteors seem to streak away from a point in ${con.name} (the radiant), which is above the horizon in a dark sky from ${formatTime(n.from, o.tz)} to ${formatTime(n.to, o.tz)} (${n.darkHoursUp.toFixed(1)} hours) and highest around ${formatTime(n.best, o.tz)}, ${whereWords(n.bestAlt, n.bestAz)}. The hours around then are best. You do not need to stare at the radiant — lie back and watch a wide patch of sky. `;
        const moonPct = pct(n.moonIllumination);
        if (n.moonIllumination < 0.15 || n.moonUpFraction < 0.1) detail += `The Moon (${moonPct} lit) will not interfere. `;
        else if (n.moonIllumination < 0.5 || n.moonUpFraction < 0.5) detail += `The Moon (${moonPct} lit) is up for part of that time and will hide some of the fainter meteors. `;
        else detail += `A bright Moon (${moonPct} lit) is up for most of that time and will hide all but the brighter meteors. `;
        detail += `Under a perfectly dark sky with the radiant overhead the rate can reach about ${Math.round(s.zhr)} an hour; expect far fewer under city lights.`;
      } else {
        detail += `From ${o.name} the radiant (in ${con.name}) is hardly or never above the horizon while the sky is dark around the peak, so few or no meteors can be seen.`;
      }
      out.push({ kind: 'meteor-shower', date: peak, title: `${s.name} meteor shower peak`, detail, refs: [`radec:${s.radiant.ra},${s.radiant.dec}`, `con:${constellationAt(s.radiant.ra, s.radiant.dec)}`], visibleHere });
    }
  }
  return out;
}

/**
 * Every listed event between `start` and `start + months`, sorted by date, with location-specific
 * descriptions. See docs/ASTRO.md for what is included and the thresholds.
 */
export function yearEvents(start: Date, observer: Observer, showers: MeteorShower[], months = 12): SkyEvent[] {
  const end = addMonths(start, months);
  // Daily geocentric planet positions, shared by the conjunction searches.
  const t0 = start.getTime() - 2 * DAY_MS;
  const nDays = Math.ceil((end.getTime() - t0) / DAY_MS) + 3;
  const daily = new Map<BodyId, Vec3[]>();
  for (const id of PLANET_IDS) {
    const arr: Vec3[] = [];
    for (let k = 0; k < nDays; k++) arr.push(geo(id, new Date(t0 + k * DAY_MS)));
    daily.set(id, arr);
  }
  const events = [
    ...oppositions(start, end, observer),
    ...elongations(start, end, observer),
    ...planetConjunctions(start, end, observer, daily, t0, nDays),
    ...moonPairings(start, end, observer, daily, t0, nDays),
    ...lunarEclipses(start, end, observer),
    ...solarEclipses(start, end, observer),
    ...seasons(start, end, observer),
    ...moonPhases(start, end, observer),
    ...meteorShowers(start, end, observer, showers),
  ];
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
