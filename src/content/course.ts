/**
 * Resolves the course for a learner's location (owner: IA/course engineer; see docs/briefs/v2.md).
 *
 * The lesson modules are fixed; the three constellation modules are worked out for the learner's latitude:
 *
 * - **Prominence** of a constellation = the summed brightness (flux, 10^(−0.4·mag)) of the five brightest stars
 *   of its figure (`mainStars`, else `figureStars`). A magnitude-0 star counts 1, a magnitude-2.5 star 0.1, so the
 *   score rewards figures with one brilliant star or several bright ones, which is what makes a pattern easy to pick
 *   out. A bonus (+0.3) goes to compact, distinctive figures — four stars brighter than magnitude 3.0 within 10° of
 *   their centre — because a tight shape of several bright stars (Cassiopeia's W, the Southern Cross, the Teapot,
 *   Orion's belt-and-shoulders) is recognisable at a glance where a sprawling one of equal light (Eridanus, Hydra)
 *   is not. A figure with fewer than three stars brighter than magnitude 4.0 is a lone star or a pair rather than a
 *   pattern (Canis Minor), so its score is halved.
 * - **Rises usefully**: some part of the figure culminates ≥ 15° above the horizon. (Every right ascension
 *   culminates in darkness at some time of year at any latitude with dark nights, so culmination is the test.)
 * - **Anchors** (module "anchors"): the 15 most prominent constellations that are *well placed*: the figure's
 *   centre culminates ≥ 25° up AND it is visible in the evening (`yearVisibility` class "evening" or "all-night")
 *   in at least 2 months.
 * - **Seasons**: every other constellation that rises usefully, grouped by its best evening month
 *   (circular mean of `bestMonths`) into December–February … September–November evenings, plus a
 *   "Circumpolar: visible all year" group (in the evening sky in all 12 months, or `eveningSeason` = all-year).
 *   Most prominent first.
 * - **Beyond**: constellations that never rise usefully from this latitude.
 * - **Star-hops**: hops whose hemisphere fits the observer (N above ~15°N, S below ~15°S, both near the equator
 *   or when the hop is marked "both") and that have at least one usable evening month, by rank.
 */
import type { Catalog } from '@/data/catalog';
import type { Observer } from '@/types';
import { bestMonths, constellationPoints, eveningSeason, meanDirection, yearVisibility } from '@/astro';
import { courseModules, starhops, type CourseModule } from './index';

export interface ConstellationGroup {
  /** e.g. "dec-feb" */
  id: string;
  /** e.g. "December–February evenings" (hemisphere-neutral) */
  title: string;
  /** Months (1–12) in which this group is best placed in the evening at the learner's latitude */
  months: number[];
  /** IAU abbreviations, most prominent first */
  constellations: string[];
}

export interface ResolvedModule extends CourseModule {
  /** anchors / seasons / beyond: constellation groups for this location; lessons modules: [] */
  groups: ConstellationGroup[];
  /** starhops modules: star-hop ids practicable from this location, best first */
  starhopIds: string[];
}

export interface ResolvedCourse {
  observerKey: string;
  modules: ResolvedModule[];
  /** Every constellation id in the course (anchors + seasons [+ beyond]) */
  allConstellations: string[];
}

/** Rules (exported for tests and docs). */
export const ANCHOR_COUNT = 15;
export const ANCHOR_MIN_CULMINATION = 25;
export const ANCHOR_MIN_EVENING_MONTHS = 2;
/**
 * A low but famous figure still qualifies when its centre gets at least 12° up and its brightest star at least
 * 20° (e.g. Scorpius from 40°N: centre ~16°, Antares ~23°), so the classic low southern summer figures stay in.
 */
export const ANCHOR_LOW_CENTRE_MIN = 12;
export const ANCHOR_LOW_BRIGHTEST_MIN = 20;
export const RISES_MIN_ALT = 15;
export const COMPACT_RADIUS_DEG = 10;
export const COMPACT_MAG = 3.0;
export const COMPACT_BONUS = 0.3;
/** A figure needs at least this many stars brighter than PATTERN_MAG to be a pattern rather than a lone star or a pair. */
export const PATTERN_MIN_STARS = 3;
export const PATTERN_MAG = 4.0;
/** Fixed year for the (year-independent) star computations so results are stable. */
const YEAR = 2025;

export const SEASON_GROUPS: { id: string; title: string; months: number[] }[] = [
  { id: 'dec-feb', title: 'December–February evenings', months: [12, 1, 2] },
  { id: 'mar-may', title: 'March–May evenings', months: [3, 4, 5] },
  { id: 'jun-aug', title: 'June–August evenings', months: [6, 7, 8] },
  { id: 'sep-nov', title: 'September–November evenings', months: [9, 10, 11] },
];
export const CIRCUMPOLAR_GROUP = { id: 'circumpolar', title: 'Circumpolar: visible all year', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };

export const observerKey = (o: Pick<Observer, 'lat' | 'lon'>) => `${o.lat.toFixed(1)},${o.lon.toFixed(1)}`;

const DEG = Math.PI / 180;
function sep(a: { ra: number; dec: number }, b: { ra: number; dec: number }): number {
  const c = Math.sin(a.dec * DEG) * Math.sin(b.dec * DEG) + Math.cos(a.dec * DEG) * Math.cos(b.dec * DEG) * Math.cos((a.ra - b.ra) * DEG);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}

/** Brightness score of a constellation's figure (see header). */
export function prominence(con: Catalog['constellations'][number], catalog: Pick<Catalog, 'starById'>): number {
  const ids = con.mainStars?.length ? con.mainStars : con.figureStars;
  const stars = (ids ?? []).map((id) => catalog.starById.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const top = stars.sort((a, b) => a.mag - b.mag).slice(0, 5);
  if (!top.length) return 0;
  let score = top.reduce((s, x) => s + Math.pow(10, -0.4 * x.mag), 0);
  const four = top.slice(0, 4);
  const c = meanDirection(four.map((s) => ({ ra: s.ra, dec: s.dec })));
  if (four.length === 4 && four.every((s) => s.mag < COMPACT_MAG && sep(s, c) <= COMPACT_RADIUS_DEG)) score += COMPACT_BONUS;
  if (top.filter((s) => s.mag < PATTERN_MAG).length < PATTERN_MIN_STARS) score /= 2;
  return score;
}

/** Culmination altitude (deg) of a point at declination `dec` seen from latitude `lat`. */
export const culmination = (dec: number, lat: number) => 90 - Math.abs(lat - dec);

/** Month (1–12) at the circular centre of a set of months. */
function centreMonth(months: number[]): number {
  if (!months.length) return 1;
  let x = 0, y = 0;
  for (const m of months) {
    x += Math.cos(((m - 1) / 12) * 2 * Math.PI);
    y += Math.sin(((m - 1) / 12) * 2 * Math.PI);
  }
  const a = Math.atan2(y, x);
  return (Math.round((a / (2 * Math.PI)) * 12 + 12) % 12) + 1;
}

export interface ConstellationPlacement {
  id: string;
  prominence: number;
  culmination: number;
  /** Culmination altitude of the constellation's brightest star */
  brightestCulmination: number;
  risesUsefully: boolean;
  eveningMonths: number;
  bestMonths: number[];
  circumpolar: boolean;
  /** Group id (season or circumpolar); '' when it never rises usefully */
  group: string;
}

/** Per-constellation facts for one observer (used by resolveCourse and its tests). */
export function placeConstellations(observer: Observer, catalog: Catalog): ConstellationPlacement[] {
  return catalog.constellations.map((con) => {
    const pts = constellationPoints(con, catalog);
    const centre = meanDirection(pts);
    const culm = culmination(centre.dec, observer.lat);
    const rises = Math.max(...pts.map((p) => culmination(p.dec, observer.lat))) >= RISES_MIN_ALT;
    let eveningMonths = 0, best: number[] = [], circumpolar = false, group = '';
    if (rises) {
      const target = { points: pts };
      eveningMonths = yearVisibility(target, YEAR, observer).filter((v) => v.cls === 'evening' || v.cls === 'all-night').length;
      best = bestMonths(target, observer, { year: YEAR });
      circumpolar = eveningMonths === 12 || eveningSeason(target, observer, { year: YEAR }) === 'all-year';
      const m = centreMonth(best);
      group = circumpolar ? CIRCUMPOLAR_GROUP.id : SEASON_GROUPS.find((g) => g.months.includes(m))!.id;
    }
    const brightest = catalog.starById.get(con.brightest);
    const brightestCulm = brightest ? culmination(brightest.dec, observer.lat) : culm;
    return { id: con.id, prominence: prominence(con, catalog), culmination: culm, brightestCulmination: brightestCulm, risesUsefully: rises, eveningMonths, bestMonths: best, circumpolar, group };
  });
}

function groupsOf(list: ConstellationPlacement[]): ConstellationGroup[] {
  const order = [...SEASON_GROUPS, CIRCUMPOLAR_GROUP];
  return order
    .map((g) => ({ ...g, constellations: list.filter((p) => p.group === g.id).sort((a, b) => b.prominence - a.prominence).map((p) => p.id) }))
    .filter((g) => g.constellations.length > 0);
}

/** Star-hops usable from this latitude, best rank first. */
export function starhopsFor(lat: number): string[] {
  const zone: 'N' | 'S' | 'both' = lat > 15 ? 'N' : lat < -15 ? 'S' : 'both';
  return starhops
    .filter((h) => {
      const months = zone === 'N' ? h.monthsNorth : zone === 'S' ? h.monthsSouth : [...h.monthsNorth, ...h.monthsSouth];
      if (!months.length) return false;
      return zone === 'both' || h.hemisphere === 'both' || h.hemisphere === zone;
    })
    .map((h) => h.id);
}

const memo = new Map<string, ResolvedCourse>();

export function resolveCourse(observer: Observer, catalog: Catalog): ResolvedCourse {
  const key = observerKey(observer);
  const hit = memo.get(key);
  if (hit) return hit;
  const placed = placeConstellations(observer, catalog);
  const anchors = placed
    .filter((p) => p.risesUsefully && p.eveningMonths >= ANCHOR_MIN_EVENING_MONTHS && (p.culmination >= ANCHOR_MIN_CULMINATION || (p.culmination >= ANCHOR_LOW_CENTRE_MIN && p.brightestCulmination >= ANCHOR_LOW_BRIGHTEST_MIN)))
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, ANCHOR_COUNT);
  const anchorIds = new Set(anchors.map((a) => a.id));
  const seasons = placed.filter((p) => p.risesUsefully && !anchorIds.has(p.id));
  const beyond = placed.filter((p) => !p.risesUsefully).sort((a, b) => b.prominence - a.prominence);
  const hops = starhopsFor(observer.lat);
  const modules: ResolvedModule[] = courseModules.map((raw) => {
    // course.json omits defaulted fields (zod defaults are not applied to the raw JSON import)
    const m: CourseModule = { ...raw, lessons: raw.lessons ?? [], optional: raw.optional ?? false };
    if (m.kind === 'anchors') return { ...m, groups: groupsOf(anchors), starhopIds: [] };
    if (m.kind === 'seasons') return { ...m, groups: groupsOf(seasons), starhopIds: [] };
    if (m.kind === 'beyond')
      return { ...m, groups: beyond.length ? [{ id: 'beyond', title: 'Never above your horizon', months: [], constellations: beyond.map((p) => p.id) }] : [], starhopIds: [] };
    if (m.kind === 'starhops') return { ...m, groups: [], starhopIds: hops.slice(0, m.starhopCount ?? hops.length) };
    return { ...m, groups: [], starhopIds: [] };
  });
  const allConstellations = modules.flatMap((m) => m.groups.flatMap((g) => g.constellations));
  const out: ResolvedCourse = { observerKey: key, modules, allConstellations };
  if (memo.size > 20) memo.clear();
  memo.set(key, out);
  return out;
}
