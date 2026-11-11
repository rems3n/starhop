import { describe, expect, it } from 'vitest';
import { constellationPoints, yearVisibility } from '@/astro';
import pathJson from '@/content/path.json';
import type { PathUnit } from '@/content/schema';
import type { VisibilityClass } from '@/types';
import { buildCalendarRows, chunk, filterRows, groupRows, runChunked, sortRows, visibilitySortKey, type YearClasses } from '@/modes/learn/logic/calendar';
import { BROOKLYN } from './fixtures/load';
import { learnCatalog } from './learn-catalog';

const cat = learnCatalog();
const units = pathJson as PathUnit[];
const rows = buildCalendarRows(cat.constellations, units, (c) => constellationPoints(c, cat));
const E: VisibilityClass = 'evening', M: VisibilityClass = 'morning', A: VisibilityClass = 'all-night', N: VisibilityClass = 'not-visible';

describe('calendar rows', () => {
  it('has 7 planets then the 88 constellations, with links and path units', () => {
    expect(rows.length).toBe(95);
    expect(rows.slice(0, 7).map((r) => r.id)).toEqual(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
    expect(rows[0]).toMatchObject({ kind: 'planet', key: 'body:Mercury', target: 'Mercury', href: '/learn/object/body%3AMercury' });
    const ori = rows.find((r) => r.id === 'Ori')!;
    expect(ori).toMatchObject({ kind: 'constellation', key: 'con:Ori', name: 'Orion', href: '/learn/constellation/Ori', season: 'winter', unitId: 'anchor-winter', anchor: true });
    expect((ori.target as { points: unknown[] }).points.length).toBeGreaterThan(3);
    expect(rows.filter((r) => r.kind === 'constellation').every((r) => !!r.unitId)).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(95);
  });
  it('filters by anchors, planets, season and unit', () => {
    expect(filterRows(rows, 'all').length).toBe(95);
    expect(filterRows(rows, 'anchors').length).toBe(15);
    expect(filterRows(rows, 'planets').length).toBe(7);
    expect(filterRows(rows, 'season:winter').every((r) => r.season === 'winter')).toBe(true);
    expect(filterRows(rows, 'unit:anchor-north').map((r) => r.id).sort()).toEqual(['Cas', 'UMa', 'UMi']);
  });
  it('groups with planets first, then seasons in sky order or path units in path order', () => {
    const bySeason = groupRows(rows, 'season', units);
    expect(bySeason.map((g) => g.id)).toEqual(['planets', 'season:north-circumpolar', 'season:winter', 'season:spring', 'season:summer', 'season:autumn', 'season:far-south']);
    expect(bySeason.reduce((n, g) => n + g.rows.length, 0)).toBe(95);
    const byUnit = groupRows(rows, 'unit', units);
    expect(byUnit[1]).toMatchObject({ id: 'unit:anchor-north', title: units[0].title });
    expect(byUnit.length).toBe(units.length + 1);
    expect(groupRows(filterRows(rows, 'anchors'), 'none', units).map((g) => g.id)).toEqual(['constellations']);
  });
});

describe('sorting by when visible', () => {
  it('orders by the middle of the evening season; all-year first, never last', () => {
    const winter: YearClasses = [E, E, E, N, N, N, N, N, M, M, A, A];
    const summer: YearClasses = [N, N, M, M, A, E, E, E, E, N, N, N];
    const always: YearClasses = Array(12).fill(A);
    const never: YearClasses = Array(12).fill(N);
    const morningOnly: YearClasses = [N, N, M, M, N, N, N, N, N, N, N, N];
    expect(visibilitySortKey(always)).toBe(-1);
    expect(visibilitySortKey(never)).toBe(1000);
    expect(visibilitySortKey(morningOnly)).toBe(500);
    expect(visibilitySortKey(undefined)).toBe(9999);
    expect(visibilitySortKey(summer)).toBeCloseTo(6, 0); // July
    const kWinter = visibilitySortKey(winter); // centred on about New Year
    expect(kWinter > 11.4 || kWinter < 0.6).toBe(true);
    // starting the year in September puts winter before summer
    expect(visibilitySortKey(winter, 9)).toBeLessThan(visibilitySortKey(summer, 9));
  });
  it('sorts real rows: Ursa Minor before Leo before Lyra before Pegasus, far south last', () => {
    const classes = new Map<string, YearClasses>();
    for (const r of rows.filter((x) => x.kind === 'constellation')) classes.set(r.key, yearVisibility(r.target, 2026, BROOKLYN).map((v) => v.cls));
    const order = sortRows(rows.filter((r) => r.kind === 'constellation'), 'when', classes).map((r) => r.id);
    const at = (id: string) => order.indexOf(id);
    expect(at('UMi')).toBeLessThan(at('Leo'));
    expect(at('Leo')).toBeLessThan(at('Lyr'));
    expect(at('Lyr')).toBeLessThan(at('Peg'));
    expect(at('Peg')).toBeLessThan(at('Cru'));
    expect(at('Oct')).toBeGreaterThan(70);
    const byName = sortRows(rows, 'name', classes).map((r) => r.name);
    expect(byName[0]).toBe('Andromeda');
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
  });
});

describe('chunked computation', () => {
  it('chunks a list', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
  it('does a few items per turn, reports progress, and yields between batches', () => {
    const queue: (() => void)[] = [];
    const seen: number[] = [];
    const progress: number[] = [];
    runChunked([1, 2, 3, 4, 5, 6, 7], 3, (n) => seen.push(n), (d) => progress.push(d), (cb) => queue.push(cb));
    expect(seen).toEqual([]); // nothing happens synchronously
    queue.shift()!();
    expect(seen).toEqual([1, 2, 3]);
    queue.shift()!();
    queue.shift()!();
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(progress).toEqual([3, 6, 7]);
    expect(queue.length).toBe(0);
  });
  it('stops when cancelled', () => {
    const queue: (() => void)[] = [];
    const seen: number[] = [];
    const cancel = runChunked([1, 2, 3, 4], 2, (n) => seen.push(n), () => undefined, (cb) => queue.push(cb));
    queue.shift()!();
    cancel();
    queue.shift()?.();
    expect(seen).toEqual([1, 2]);
  });
  it('the whole grid for Brooklyn computes within budget', () => {
    const t0 = performance.now();
    for (const r of rows) yearVisibility(r.target, 2027, BROOKLYN);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});
