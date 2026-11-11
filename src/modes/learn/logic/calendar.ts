/** Visibility calendar: rows, filters, sorting, and chunked computation. Pure (the chunk runner takes a scheduler). */
import type { PathUnit } from '@/content/schema';
import { ANCHORS, type BodyId, type Constellation, type Season, type VisibilityClass } from '@/types';

export type CalTarget = BodyId | { points: { ra: number; dec: number }[] };

export interface CalRow {
  key: string;
  kind: 'constellation' | 'planet';
  id: string;
  name: string;
  sub: string;
  href: string;
  season?: Season;
  unitId?: string;
  anchor: boolean;
  target: CalTarget;
}

export const CAL_PLANETS: BodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

export const SEASON_LABEL: Record<Season, string> = {
  winter: 'Winter evenings',
  spring: 'Spring evenings',
  summer: 'Summer evenings',
  autumn: 'Autumn evenings',
  'north-circumpolar': 'Around the north pole',
  'far-south': 'Far south',
};
export const SEASON_ORDER: Season[] = ['north-circumpolar', 'winter', 'spring', 'summer', 'autumn', 'far-south'];

export function buildCalendarRows(
  constellations: Constellation[],
  units: PathUnit[],
  pointsOf: (c: Constellation) => { ra: number; dec: number }[],
): CalRow[] {
  const unitOf = new Map<string, string>();
  for (const u of units) for (const c of u.constellations) if (!unitOf.has(c)) unitOf.set(c, u.id);
  const anchors = new Set<string>(ANCHORS);
  const rows: CalRow[] = CAL_PLANETS.map((b) => ({ key: `body:${b}`, kind: 'planet', id: b, name: b, sub: 'planet', href: `/learn/object/${encodeURIComponent(`body:${b}`)}`, anchor: false, target: b }));
  for (const c of constellations) {
    rows.push({ key: `con:${c.id}`, kind: 'constellation', id: c.id, name: c.name, sub: c.english, href: `/learn/constellation/${c.id}`, season: c.season, unitId: unitOf.get(c.id), anchor: anchors.has(c.id), target: { points: pointsOf(c) } });
  }
  return rows;
}

export type CalFilter = 'all' | 'anchors' | 'planets' | `season:${Season}` | `unit:${string}`;

export function filterRows(rows: CalRow[], filter: CalFilter): CalRow[] {
  if (filter === 'all') return rows;
  if (filter === 'anchors') return rows.filter((r) => r.anchor);
  if (filter === 'planets') return rows.filter((r) => r.kind === 'planet');
  if (filter.startsWith('season:')) return rows.filter((r) => r.season === filter.slice(7));
  if (filter.startsWith('unit:')) return rows.filter((r) => r.unitId === filter.slice(5));
  return rows;
}

export type YearClasses = VisibilityClass[];

/**
 * Where in the year a row's evening season sits, for "sort by when visible": the circular middle of
 * its evening / all-night months (1..12), starting the year at `startMonth`. All-year rows come first,
 * rows never visible last.
 */
export function visibilitySortKey(classes: YearClasses | undefined, startMonth = 1): number {
  if (!classes) return 9999;
  const good = classes.map((c, i) => (c === 'evening' || c === 'all-night' ? i : -1)).filter((i) => i >= 0);
  if (good.length === 12) return -1;
  if (!good.length) {
    const anyMorning = classes.some((c) => c === 'morning');
    return anyMorning ? 500 : 1000;
  }
  let x = 0, y = 0;
  for (const i of good) {
    x += Math.cos((i / 12) * 2 * Math.PI);
    y += Math.sin((i / 12) * 2 * Math.PI);
  }
  const mid = ((Math.atan2(y, x) / (2 * Math.PI)) * 12 + 12) % 12; // 0..12, 0 = mid-January
  return (mid - (startMonth - 1) + 12) % 12;
}

export type CalSort = 'name' | 'when';

export function sortRows(rows: CalRow[], sort: CalSort, classes: Map<string, YearClasses>, startMonth = 1): CalRow[] {
  const out = rows.slice();
  if (sort === 'name') return out.sort((a, b) => a.name.localeCompare(b.name));
  return out.sort((a, b) => visibilitySortKey(classes.get(a.key), startMonth) - visibilitySortKey(classes.get(b.key), startMonth) || a.name.localeCompare(b.name));
}

export type CalGroupBy = 'none' | 'season' | 'unit';

export interface CalGroup {
  id: string;
  title: string;
  rows: CalRow[];
}

/** Planets always form their own group at the top; constellations are grouped as asked. */
export function groupRows(rows: CalRow[], by: CalGroupBy, units: PathUnit[]): CalGroup[] {
  const planets = rows.filter((r) => r.kind === 'planet');
  const cons = rows.filter((r) => r.kind === 'constellation');
  const groups: CalGroup[] = [];
  if (planets.length) groups.push({ id: 'planets', title: 'Planets', rows: planets });
  if (by === 'none') {
    if (cons.length) groups.push({ id: 'constellations', title: 'Constellations', rows: cons });
  } else if (by === 'season') {
    for (const s of SEASON_ORDER) {
      const g = cons.filter((r) => r.season === s);
      if (g.length) groups.push({ id: `season:${s}`, title: SEASON_LABEL[s], rows: g });
    }
  } else {
    for (const u of units) {
      const g = cons.filter((r) => r.unitId === u.id);
      if (g.length) groups.push({ id: `unit:${u.id}`, title: u.title, rows: g });
    }
    const rest = cons.filter((r) => !r.unitId);
    if (rest.length) groups.push({ id: 'unit:none', title: 'Not on the path', rows: rest });
  }
  return groups;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += Math.max(1, size)) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Compute `fn` for every item a few at a time, yielding to the browser between batches so the page
 * stays responsive. Returns a cancel function.
 */
export function runChunked<T>(items: T[], size: number, fn: (item: T) => void, onBatch: (done: number) => void, schedule: (cb: () => void) => void = (cb) => setTimeout(cb, 0)): () => void {
  let cancelled = false;
  const batches = chunk(items, size);
  let i = 0;
  let done = 0;
  const step = () => {
    if (cancelled || i >= batches.length) return;
    for (const it of batches[i]) fn(it);
    done += batches[i].length;
    i++;
    onBatch(done);
    if (i < batches.length) schedule(step);
  };
  schedule(step);
  return () => {
    cancelled = true;
  };
}

export const CLASS_SHORT: Record<VisibilityClass, string> = { evening: 'Evening', morning: 'Morning', 'all-night': 'All night', 'not-visible': 'Not visible' };
