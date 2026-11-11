import { describe, expect, it } from 'vitest';
import { activeCount, fold, matchesText, nextSort, readState, runQuery, sortRows, writeState, type FilterSpec, type SortSpec } from '@/modes/library/logic/table';

interface R { id: string; name: string; mag?: number; con: string; tags: string[] }
const rows: R[] = [
  { id: 'a', name: 'Betelgeuse', mag: 0.45, con: 'Ori', tags: ['red'] },
  { id: 'b', name: 'Rigel', mag: 0.18, con: 'Ori', tags: ['blue'] },
  { id: 'c', name: 'Boötes star', mag: undefined, con: 'Boo', tags: [] },
  { id: 'd', name: 'Vega', mag: 0.03, con: 'Lyr', tags: ['blue', 'white'] },
];
const filters: FilterSpec<R>[] = [
  { id: 'con', label: 'Constellation', kind: 'select', test: (r, v) => r.con === v },
  { id: 'tag', label: 'Tag', kind: 'select', test: (r, v) => r.tags.includes(v) },
  { id: 'view', label: 'View', kind: 'segmented', default: 'top', test: (r, v) => v === 'all' || r.id !== 'c' },
];
const sorts: SortSpec<R>[] = [
  { id: 'name', label: 'Name', value: (r) => r.name },
  { id: 'mag', label: 'Brightness', value: (r) => r.mag },
  { id: 'big', label: 'Big first', value: (r) => r.mag, firstDir: 'desc' },
];
const defaults = { sort: 'name', dir: 'asc' as const };
const text = (r: R) => `${r.name} ${r.con}`;

describe('library table logic', () => {
  it('folds accents and case, matches every word in any order', () => {
    expect(fold('  Boötes  Star ')).toBe('bootes star');
    expect(matchesText('Betelgeuse Ori', 'ori betel')).toBe(true);
    expect(matchesText('Betelgeuse Ori', 'ori rigel')).toBe(false);
    expect(matchesText('anything', '   ')).toBe(true);
  });

  it('sorts with missing values last in both directions and stays stable', () => {
    const s = sorts[1];
    expect(sortRows(rows, s, 'asc').map((r) => r.id)).toEqual(['d', 'b', 'a', 'c']);
    expect(sortRows(rows, s, 'desc').map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(sortRows(rows, undefined, 'asc')).toEqual(rows);
  });

  it('applies search, filters (with defaults) and sort together', () => {
    const st = { q: '', filters: {}, sort: 'name', dir: 'asc' as const };
    // default view=top hides row c
    expect(runQuery(rows, st, { text, filters, sorts }).map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(runQuery(rows, { ...st, filters: { view: 'all' } }, { text, filters, sorts }).map((r) => r.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(runQuery(rows, { ...st, filters: { con: 'Ori', tag: 'blue' } }, { text, filters, sorts }).map((r) => r.id)).toEqual(['b']);
    expect(runQuery(rows, { ...st, q: 'ori', sort: 'mag' }, { text, filters, sorts }).map((r) => r.id)).toEqual(['b', 'a']);
    expect(runQuery(rows, { ...st, q: 'bootes', filters: { view: 'all' } }, { text, filters, sorts }).map((r) => r.id)).toEqual(['c']);
  });

  it('round-trips state through the URL and leaves defaults out', () => {
    const st = { q: 'ori', filters: { con: 'Ori', view: 'top' }, sort: 'mag', dir: 'desc' as const };
    const p = writeState(st, filters, defaults, new URLSearchParams('keep=1&con=Lyr'));
    expect(p.get('keep')).toBe('1');
    expect(p.get('view')).toBeNull(); // equal to default
    expect(p.get('con')).toBe('Ori');
    expect(readState(p, filters, sorts, defaults)).toEqual({ q: 'ori', filters: { con: 'Ori' }, sort: 'mag', dir: 'desc' });
    expect(writeState({ q: '', filters: {}, sort: 'name', dir: 'asc' }, filters, defaults).toString()).toBe('');
  });

  it('falls back on unknown sort ids and uses a sort’s first direction', () => {
    expect(readState(new URLSearchParams('sort=nope'), filters, sorts, defaults)).toMatchObject({ sort: 'name', dir: 'asc' });
    expect(readState(new URLSearchParams('sort=big'), filters, sorts, defaults)).toMatchObject({ sort: 'big', dir: 'desc' });
  });

  it('header clicks flip direction on the same column and start fresh on a new one', () => {
    const st = { q: '', filters: {}, sort: 'name', dir: 'asc' as const };
    expect(nextSort(st, sorts, 'name')).toEqual({ sort: 'name', dir: 'desc' });
    expect(nextSort(st, sorts, 'big')).toEqual({ sort: 'big', dir: 'desc' });
    expect(nextSort(st, sorts, 'mag')).toEqual({ sort: 'mag', dir: 'asc' });
  });

  it('counts active filters, ignoring ones at their default', () => {
    expect(activeCount({ q: ' ', filters: { view: 'top' }, sort: 'name', dir: 'asc' }, filters)).toBe(0);
    expect(activeCount({ q: 'x', filters: { view: 'all', con: 'Ori' }, sort: 'name', dir: 'asc' }, filters)).toBe(3);
  });

  it('is fast enough for 600 rows', () => {
    const many = Array.from({ length: 600 }, (_, i) => ({ id: String(i), name: `Object ${i}`, mag: (i * 7) % 13, con: i % 2 ? 'Ori' : 'Lyr', tags: [] }));
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) runQuery(many, { q: 'obj', filters: { con: 'Ori', view: 'all' }, sort: 'mag', dir: 'asc' }, { text, filters, sorts });
    expect((performance.now() - t0) / 20).toBeLessThan(20);
  });
});
