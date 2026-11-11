/**
 * The library's reusable database view: search box, filters, sort, result count, a table on desktop and
 * cards on a phone. All query state lives in the URL (q, sort, dir and one parameter per filter), so a
 * filtered list can be bookmarked or shared. Long lists are shown 100 rows at a time.
 */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Segmented, Switch } from '@/ui';
import { activeCount, filterValue, nextSort, readState, runQuery, writeState, type FilterSpec, type QueryState, type SortDir, type SortSpec } from '../logic/table';
import { useNarrow } from '../logic/hooks';

export interface Column<R> {
  id: string;
  label: string;
  cell: (r: R) => ReactNode;
  /** Id of the SortSpec this column header sorts by */
  sort?: string;
  /** Right-align numbers */
  num?: boolean;
  /** Short help shown as the header's title */
  title?: string;
}

export interface CollectionViewProps<R> {
  rows: R[] | null;
  rowKey: (r: R) => string;
  href: (r: R) => string;
  columns: Column<R>[];
  filters: FilterSpec<R>[];
  sorts: SortSpec<R>[];
  defaultSort: { sort: string; dir: SortDir };
  searchText: (r: R) => string;
  searchLabel: string;
  card: (r: R) => ReactNode;
  noun: [string, string];
  /** Shown above the results, e.g. "Working out best months for your location…" */
  status?: ReactNode;
  /** Bumps when lazily computed values change, so the query re-runs */
  version?: number;
  pageSize?: number;
  /** Extra controls placed at the start of the filter row */
  lead?: ReactNode;
  /** Shown instead of the generic "nothing matches" line */
  empty?: ReactNode;
}

export function CollectionView<R>(p: CollectionViewProps<R>) {
  const [params, setParams] = useSearchParams();
  const narrow = useNarrow();
  const navigate = useNavigate();
  const pageSize = p.pageSize ?? 100;
  const state = useMemo(() => readState(params, p.filters, p.sorts, p.defaultSort), [params, p.filters, p.sorts, p.defaultSort]);
  const set = (patch: Partial<QueryState>) => setParams(writeState({ ...state, ...patch, filters: { ...state.filters, ...patch.filters } }, p.filters, p.defaultSort, params), { replace: true });
  const results = useMemo(() => (p.rows ? runQuery(p.rows, state, { text: p.searchText, filters: p.filters, sorts: p.sorts }) : null), [p.rows, state, p.searchText, p.filters, p.sorts, p.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [limit, setLimit] = useState(pageSize);
  const qs = params.toString();
  useEffect(() => setLimit(pageSize), [qs, pageSize]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active = activeCount(state, p.filters);
  const searchId = useId();
  const sortSpec = p.sorts.find((s) => s.id === state.sort);

  const shown = results?.slice(0, limit) ?? [];
  const count = results ? (
    <p className="lb-count" role="status" aria-live="polite">
      {results.length === p.rows!.length ? `${results.length} ${results.length === 1 ? p.noun[0] : p.noun[1]}` : `${results.length} of ${p.rows!.length} ${p.noun[1]}`}
      {sortSpec && <span className="dim"> · sorted by {sortSpec.label.toLowerCase()}{state.dir === 'desc' ? ', reversed' : ''}</span>}
    </p>
  ) : null;

  return (
    <div className="lb-collection">
      <div className="lb-toolbar">
        <label className="lb-search" htmlFor={searchId}>
          <span className="sr-only">{p.searchLabel}</span>
          <input id={searchId} className="input" type="search" placeholder={p.searchLabel} value={state.q} onChange={(e) => set({ q: e.target.value })} autoComplete="off" />
        </label>
        {narrow && (
          <Button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            Filters{active - (state.q.trim() ? 1 : 0) > 0 ? ` (${active - (state.q.trim() ? 1 : 0)})` : ''}
          </Button>
        )}
      </div>
      {(!narrow || filtersOpen) && (
        <div className="lb-filters">
          {p.lead}
          {p.filters.map((f) => (
            <FilterControl key={f.id} f={f} value={filterValue(state, f)} onChange={(v) => set({ filters: { [f.id]: v } })} />
          ))}
          {narrow && (
            <label className="field lb-field">
              Sort by
              <select className="select" value={`${state.sort}:${state.dir}`} onChange={(e) => {
                const [sort, dir] = e.target.value.split(':');
                set({ sort, dir: dir as SortDir });
              }}>
                {p.sorts.flatMap((s) => {
                  const first = s.firstDir ?? 'asc';
                  const other = first === 'asc' ? 'desc' : 'asc';
                  return [
                    <option key={`${s.id}:${first}`} value={`${s.id}:${first}`}>{s.label}</option>,
                    <option key={`${s.id}:${other}`} value={`${s.id}:${other}`}>{s.label}, reversed</option>,
                  ];
                })}
              </select>
            </label>
          )}
          {active > 0 && (
            <Button size="sm" variant="quiet" className="lb-clear" onClick={() => setParams(writeState({ q: '', filters: {}, sort: state.sort, dir: state.dir }, p.filters, p.defaultSort, params), { replace: true })}>
              Clear filters
            </Button>
          )}
        </div>
      )}
      {p.status && <div className="lb-status dim">{p.status}</div>}
      {count}
      {!results && <p className="dim">Loading…</p>}
      {results && !results.length && (p.empty ?? <p className="lb-empty dim">Nothing matches. Try fewer filters or a shorter search.</p>)}
      {results && results.length > 0 &&
        (narrow ? (
          <ul className="lb-cards">
            {shown.map((r) => (
              <li key={p.rowKey(r)}>
                <Link to={p.href(r)} className="card lb-card">
                  {p.card(r)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="lb-table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  {p.columns.map((c) => {
                    const on = c.sort && c.sort === state.sort;
                    return (
                      <th key={c.id} scope="col" className={c.num ? 'is-num' : undefined} aria-sort={on ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined} title={c.title}>
                        {c.sort ? (
                          <button type="button" className={`lb-sort${on ? ' is-on' : ''}`} onClick={() => set(nextSort(state, p.sorts, c.sort!))}>
                            {c.label}
                            <span aria-hidden className="lb-sort-arrow">{on ? (state.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={p.rowKey(r)}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a,button')) return;
                      navigate(p.href(r));
                    }}
                  >
                    {p.columns.map((c, i) =>
                      i === 0 ? (
                        <th key={c.id} scope="row">
                          {c.cell(r)}
                        </th>
                      ) : (
                        <td key={c.id} className={c.num ? 'is-num' : undefined}>
                          {c.cell(r)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {results && results.length > limit && (
        <div className="lb-more">
          <Button onClick={() => setLimit(limit + pageSize)}>Show {Math.min(pageSize, results.length - limit)} more</Button>
          <span className="dim">
            Showing {limit} of {results.length}
          </span>
        </div>
      )}
    </div>
  );
}

function FilterControl<R>({ f, value, onChange }: { f: FilterSpec<R>; value: string; onChange: (v: string) => void }) {
  const listId = useId();
  switch (f.kind) {
    case 'toggle':
      return (
        <div className="lb-toggle">
          <Switch checked={value === '1'} onChange={(on) => onChange(on ? '1' : '')} label={f.label} />
        </div>
      );
    case 'segmented':
      return <Segmented label={f.label} value={value} options={(f.options ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={onChange} />;
    case 'text':
      return (
        <label className="field lb-field">
          {f.label}
          <input className="input" type="search" list={listId} value={value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
          <datalist id={listId}>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value} />
            ))}
          </datalist>
        </label>
      );
    default:
      return (
        <label className="field lb-field">
          {f.label}
          <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
            {f.default == null && <option value="">{f.anyLabel ?? 'Any'}</option>}
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
  }
}

/** Small "yes/partly/never" badge with text (never colour alone). */
export function Badge({ tone, children }: { tone?: 'good' | 'amber' | 'bad' | 'dim'; children: ReactNode }) {
  return <span className={`lb-badge${tone ? ` lb-badge--${tone}` : ''}`}>{children}</span>;
}
