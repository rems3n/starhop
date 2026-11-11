/** Visibility calendar: rows, filters, sorting, and chunked computation. Pure (the chunk runner takes a scheduler). */
import type { ResolvedCourse } from '@/content/course';
import type { BodyId, Constellation, VisibilityClass } from '@/types';
import { routes } from '@/lib/routes';

export type CalTarget = BodyId | { points: { ra: number; dec: number }[] };

export interface CalRow {
  key: string;
  kind: 'constellation' | 'planet';
  id: string;
  name: string;
  sub: string;
  href: string;
  /** Evening group for the learner's location ("dec-feb" … "circumpolar", or "beyond" when it never rises) */
  group?: string;
  /** Course module that teaches it (anchors / seasons / beyond module id) */
  moduleId?: string;
  anchor: boolean;
  target: CalTarget;
}

export const CAL_PLANETS: BodyId[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

/** Evening groups in display order, with titles (hemisphere-neutral; from the resolved course). */
export function groupOrder(course: ResolvedCourse): { id: string; title: string }[] {
  const seen = new Map<string, string>();
  for (const id of ['dec-feb', 'mar-may', 'jun-aug', 'sep-nov', 'circumpolar', 'beyond'])
    for (const m of course.modules) for (const g of m.groups) if (g.id === id && !seen.has(id)) seen.set(id, g.id === 'beyond' ? 'Never rises from here' : g.title);
  return [...seen].map(([id, title]) => ({ id, title }));
}

export function buildCalendarRows(constellations: Constellation[], course: ResolvedCourse, pointsOf: (c: Constellation) => { ra: number; dec: number }[]): CalRow[] {
  const where = new Map<string, { group: string; moduleId: string; anchor: boolean }>();
  for (const m of course.modules) for (const g of m.groups) for (const c of g.constellations) where.set(c, { group: g.id, moduleId: m.id, anchor: m.kind === 'anchors' });
  const rows: CalRow[] = CAL_PLANETS.map((b) => ({ key: `body:${b}`, kind: 'planet', id: b, name: b, sub: 'planet', href: routes.object(`body:${b}`), anchor: false, target: b }));
  for (const c of constellations) {
    const w = where.get(c.id);
    rows.push({ key: `con:${c.id}`, kind: 'constellation', id: c.id, name: c.name, sub: c.english, href: routes.constellation(c.id), group: w?.group, moduleId: w?.moduleId, anchor: !!w?.anchor, target: { points: pointsOf(c) } });
  }
  return rows;
}

export type CalFilter = 'all' | 'anchors' | 'planets' | `group:${string}` | `module:${string}`;

export function filterRows(rows: CalRow[], filter: CalFilter): CalRow[] {
  if (filter === 'all') return rows;
  if (filter === 'anchors') return rows.filter((r) => r.anchor);
  if (filter === 'planets') return rows.filter((r) => r.kind === 'planet');
  if (filter.startsWith('group:')) return rows.filter((r) => r.group === filter.slice(6));
  if (filter.startsWith('module:')) return rows.filter((r) => r.moduleId === filter.slice(7));
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

export type CalGroupBy = 'none' | 'season' | 'module';

export interface CalGroup {
  id: string;
  title: string;
  rows: CalRow[];
}

/** Planets always form their own group at the top; constellations are grouped by evening months or by course module. */
export function groupRows(rows: CalRow[], by: CalGroupBy, course: ResolvedCourse): CalGroup[] {
  const planets = rows.filter((r) => r.kind === 'planet');
  const cons = rows.filter((r) => r.kind === 'constellation');
  const groups: CalGroup[] = [];
  if (planets.length) groups.push({ id: 'planets', title: 'Planets', rows: planets });
  if (by === 'none') {
    if (cons.length) groups.push({ id: 'constellations', title: 'Constellations', rows: cons });
  } else if (by === 'season') {
    for (const g of groupOrder(course)) {
      const list = cons.filter((r) => r.group === g.id);
      if (list.length) groups.push({ id: `group:${g.id}`, title: g.title, rows: list });
    }
  } else {
    for (const m of course.modules) {
      const list = cons.filter((r) => r.moduleId === m.id);
      if (list.length) groups.push({ id: `module:${m.id}`, title: `Module ${m.number}: ${m.title}`, rows: list });
    }
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
