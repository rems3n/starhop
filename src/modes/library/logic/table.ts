/**
 * Pure query logic for the library's database views: text search, filters, sort, and the
 * URL encoding that makes a filtered list linkable. No React, no DOM. Tested in tests/library-table.test.ts.
 */

export type SortDir = 'asc' | 'desc';
export type SortValue = string | number | null | undefined;

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec<R> {
  /** URL parameter name. Must not be q, sort or dir. */
  id: string;
  label: string;
  /** select = drop-down; segmented = a few buttons; toggle = on/off switch ("1"); text = free text with suggestions */
  kind: 'select' | 'segmented' | 'toggle' | 'text';
  options?: FilterOption[];
  /** Value used when the URL has none (omitted from the URL when equal). Default: '' (= no filter). */
  default?: string;
  /** Wording of the "no filter" choice in a select, e.g. "Any constellation" */
  anyLabel?: string;
  placeholder?: string;
  /** Does the row pass when this filter has `value`? Only called for non-empty values. */
  test: (row: R, value: string) => boolean;
}

export interface SortSpec<R> {
  id: string;
  label: string;
  value: (row: R) => SortValue;
  /** Direction used when the learner first picks this sort */
  firstDir?: SortDir;
}

export interface QueryState {
  q: string;
  filters: Record<string, string>;
  sort: string;
  dir: SortDir;
}

export interface QueryDefaults {
  sort: string;
  dir: SortDir;
}

const RESERVED = new Set(['q', 'sort', 'dir']);

/** Lower-case, strip accents, unify dashes/quotes, squeeze spaces. "Alnitak" ≈ "alnitak", "Boötes" ≈ "bootes". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every word of the query must appear somewhere in the haystack (any order). Empty query matches. */
export function matchesText(haystack: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const h = fold(haystack);
  return q.split(' ').every((w) => h.includes(w));
}

/** Ascending comparison; null/undefined/NaN always last regardless of direction (handled by caller). */
function cmp(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}
const missing = (v: SortValue) => v == null || v === '' || (typeof v === 'number' && !isFinite(v));

export function sortRows<R>(rows: R[], spec: SortSpec<R> | undefined, dir: SortDir): R[] {
  if (!spec) return rows.slice();
  const keyed = rows.map((r, i) => ({ r, i, v: spec.value(r) }));
  keyed.sort((x, y) => {
    const mx = missing(x.v);
    const my = missing(y.v);
    if (mx || my) return mx === my ? x.i - y.i : mx ? 1 : -1;
    const c = cmp(x.v, y.v);
    return (dir === 'asc' ? c : -c) || x.i - y.i;
  });
  return keyed.map((k) => k.r);
}

export function filterValue<R>(state: QueryState, f: FilterSpec<R>): string {
  return state.filters[f.id] ?? f.default ?? '';
}

/** Search, then every active filter, then sort. Stable. */
export function runQuery<R>(rows: R[], state: QueryState, opts: { text: (r: R) => string; filters: FilterSpec<R>[]; sorts: SortSpec<R>[] }): R[] {
  const active = opts.filters.map((f) => [f, filterValue(state, f)] as const).filter(([, v]) => v !== '');
  const q = fold(state.q);
  const words = q ? q.split(' ') : [];
  const out = rows.filter((r) => {
    if (words.length) {
      const h = fold(opts.text(r));
      if (!words.every((w) => h.includes(w))) return false;
    }
    return active.every(([f, v]) => f.test(r, v));
  });
  return sortRows(out, opts.sorts.find((s) => s.id === state.sort), state.dir);
}

/** Read the query state from the URL. Unknown filter ids are ignored; unknown sort ids fall back to the default. */
export function readState<R>(params: URLSearchParams, filters: FilterSpec<R>[], sorts: SortSpec<R>[], defaults: QueryDefaults): QueryState {
  const fs: Record<string, string> = {};
  for (const f of filters) {
    const v = params.get(f.id);
    if (v != null) fs[f.id] = v;
  }
  const sortParam = params.get('sort');
  const sort = sortParam && sorts.some((s) => s.id === sortParam) ? sortParam : defaults.sort;
  const dirParam = params.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : sort === defaults.sort ? defaults.dir : sorts.find((s) => s.id === sort)?.firstDir ?? 'asc';
  return { q: params.get('q') ?? '', filters: fs, sort, dir };
}

/**
 * Write the query state into URL parameters, leaving out anything equal to its default so a plain list has a
 * plain URL. Parameters that belong to someone else (not q/sort/dir/a filter id) are kept.
 */
export function writeState<R>(state: QueryState, filters: FilterSpec<R>[], defaults: QueryDefaults, base?: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  const own = new Set([...RESERVED, ...filters.map((f) => f.id)]);
  if (base) for (const [k, v] of base) if (!own.has(k)) out.append(k, v);
  if (state.q.trim()) out.set('q', state.q);
  for (const f of filters) {
    const v = state.filters[f.id];
    if (v != null && v !== (f.default ?? '')) out.set(f.id, v);
  }
  if (state.sort !== defaults.sort || state.dir !== defaults.dir) {
    out.set('sort', state.sort);
    out.set('dir', state.dir);
  }
  return out;
}

/** Number of filters (and search) that differ from their defaults. */
export function activeCount<R>(state: QueryState, filters: FilterSpec<R>[]): number {
  return (state.q.trim() ? 1 : 0) + filters.filter((f) => (state.filters[f.id] ?? f.default ?? '') !== (f.default ?? '')).length;
}

/** Clicking a column header: same column flips the direction, a new column starts at its first direction. */
export function nextSort<R>(state: QueryState, sorts: SortSpec<R>[], id: string): Pick<QueryState, 'sort' | 'dir'> {
  if (state.sort === id) return { sort: id, dir: state.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: id, dir: sorts.find((s) => s.id === id)?.firstDir ?? 'asc' };
}

export function assertFilterIds<R>(filters: FilterSpec<R>[]): void {
  for (const f of filters) if (RESERVED.has(f.id)) throw new Error(`Filter id "${f.id}" is reserved`);
}
