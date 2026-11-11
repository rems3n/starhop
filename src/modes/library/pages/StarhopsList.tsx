import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Starhop } from '@/content';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead, shortMonths } from '../components/common';
import { currentMonth } from '../logic/hooks';
import { TOP_N, hemisphereOf, hopMonths, hopSuitsHemisphere, hopUsableNow } from '../logic/rows';
import { allStarhops } from '../logic/starhopData';
import type { FilterSpec, SortSpec } from '../logic/table';
import { MONTH_NAMES } from '@/lib/time';

export const METHOD_LABEL: Record<Starhop['method'], string> = { line: 'Line', arc: 'Arc', triangle: 'Triangle', shape: 'Shape' };
export const HEMI_LABEL: Record<Starhop['hemisphere'], string> = { N: 'Northern', S: 'Southern', both: 'Both hemispheres' };
const DEFAULT_SORT = { sort: 'rank', dir: 'asc' as const };

export default function StarhopsList() {
  const env = useLearnEnv();
  const rows = allStarhops();
  const lat = env?.observer.lat ?? 0;
  const month = env ? currentMonth(env.observer) : 1;
  const name = (ref: string) => env?.catalog.resolve(ref)?.name ?? ref.replace(/^\w+:/, '');

  const filters = useMemo<FilterSpec<Starhop>[]>(() => {
    const cons = [...new Set(rows.flatMap((h) => h.constellations))].map((c) => [c, env?.catalog.conById.get(c)?.name ?? c] as const).sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { id: 'view', label: 'Which hops', kind: 'segmented', default: 'top', options: [{ value: 'top', label: `Top ${TOP_N}` }, { value: 'all', label: `All ${rows.length}` }], test: (h, v) => v === 'all' || h.rank <= TOP_N },
      { id: 'now', label: `Usable on ${MONTH_NAMES[month - 1]} evenings from you`, kind: 'toggle', test: (h) => hopUsableNow(h, lat, month) },
      {
        id: 'hemi',
        label: 'Hemisphere',
        kind: 'select',
        anyLabel: 'Any',
        options: [
          { value: 'mine', label: `Works from your hemisphere` },
          { value: 'N', label: 'Northern' },
          { value: 'S', label: 'Southern' },
          { value: 'both', label: 'Both' },
        ],
        test: (h, v) => (v === 'mine' ? hopSuitsHemisphere(h, lat) : h.hemisphere === v),
      },
      { id: 'method', label: 'Method', kind: 'select', anyLabel: 'Any method', options: (['line', 'arc', 'triangle', 'shape'] as const).map((m) => ({ value: m, label: METHOD_LABEL[m] })), test: (h, v) => h.method === v },
      { id: 'con', label: 'Constellation', kind: 'select', anyLabel: 'Any constellation', options: cons.map(([value, label]) => ({ value, label })), test: (h, v) => h.constellations.includes(v) },
    ];
  }, [rows, env, lat, month]);

  const sorts = useMemo<SortSpec<Starhop>[]>(
    () => [
      { id: 'rank', label: 'Popularity', value: (h) => h.rank },
      { id: 'name', label: 'Name', value: (h) => h.name.replace(/^the /i, '') },
      { id: 'dist', label: 'Distance', value: (h) => h.distanceDeg },
    ],
    [],
  );

  const columns: Column<Starhop>[] = [
    { id: 'rank', label: '#', sort: 'rank', num: true, title: '1 = the most widely taught', cell: (h) => h.rank },
    { id: 'name', label: 'Star-hop', sort: 'name', cell: (h) => <Link to={routes.starhop(h.id)}>{h.name}</Link> },
    { id: 'route', label: 'From → to', cell: (h) => `${name(h.from)} → ${name(h.to)}` },
    { id: 'method', label: 'Method', cell: (h) => METHOD_LABEL[h.method] },
    { id: 'dist', label: 'Distance', sort: 'dist', num: true, cell: (h) => `${Math.round(h.distanceDeg)}°` },
    { id: 'months', label: 'Best evenings for you', cell: (h) => (hopSuitsHemisphere(h, lat) && hopMonths(h, lat).length ? shortMonths(hopMonths(h, lat)) : <span className="dim">Not from your hemisphere</span>) },
    { id: 'now', label: 'Now', cell: (h) => (hopUsableNow(h, lat, month) ? <Badge tone="good">Usable now</Badge> : <span className="faint">—</span>) },
  ];

  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead
        title="Star-hops"
        lede={`Ways to get from stars you know to the ones you don't. Start with the top ${TOP_N}, the hops taught in almost every guide, then try the rest. Each one can be practised as a quiz.`}
        aside={<LocationLine prefix={`Months are for the ${hemisphereOf(lat) === 'N' ? 'northern' : 'southern'} hemisphere, from`} />}
      />
      <div className="lb-actions lb-actions--top">
        <Link className="btn btn--primary" to={routes.quiz('starhop')}>
          Quiz me on star-hops
        </Link>
      </div>
      <CollectionView
        rows={rows}
        rowKey={(h) => h.id}
        href={(h) => routes.starhop(h.id)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(h) => `${h.name} ${h.summary} ${name(h.from)} ${name(h.to)} ${h.constellations.map((c) => env.catalog.conById.get(c)?.name ?? c).join(' ')}`}
        searchLabel="Search star-hops"
        noun={['star-hop', 'star-hops']}
        empty={
          rows.length ? undefined : (
            <p className="lb-empty dim">The star-hop library is being written. Check back soon.</p>
          )
        }
        card={(h) => (
          <>
            <div className="lb-card-head">
              <strong>
                <span className="lb-rank">{h.rank}</span> {h.name}
              </strong>
              <span className="dim">
                {name(h.from)} → {name(h.to)} · {METHOD_LABEL[h.method]} · {Math.round(h.distanceDeg)}°
              </span>
            </div>
            <p className="lb-card-text">{h.summary}</p>
            <div className="lb-card-meta">
              {hopUsableNow(h, lat, month) ? <Badge tone="good">Usable now</Badge> : null}
              {hopSuitsHemisphere(h, lat) && hopMonths(h, lat).length ? <span>Best {shortMonths(hopMonths(h, lat))}</span> : <span>Not from your hemisphere</span>}
            </div>
          </>
        )}
      />
    </Page>
  );
}
