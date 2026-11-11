import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { bestMonths } from '@/astro';
import { asterisms, type Asterism } from '@/content';
import { MONTH_NAMES } from '@/lib/time';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead, plain, shortMonths } from '../components/common';
import { observerKey, useChunked } from '../logic/hooks';
import { reachOf, type Reach } from '../logic/rows';
import type { FilterSpec, SortSpec } from '../logic/table';
import { ReachBadge } from './ConstellationsList';

interface Row {
  a: Asterism;
  decs: number[];
  points: { ra: number; dec: number }[];
}
const DEFAULT_SORT = { sort: 'name', dir: 'asc' as const };

export default function AsterismsList() {
  const env = useLearnEnv();
  const rows = useMemo<Row[] | null>(() => {
    if (!env) return null;
    return asterisms.map((a) => {
      const points = [...new Set(a.lines.flat())].map((r) => env.catalog.resolve(r)).filter((t) => !!t).map((t) => ({ ra: t!.ra, dec: t!.dec }));
      return { a, points, decs: points.map((p) => p.dec) };
    });
  }, [env]);
  const lat = env?.observer.lat ?? 0;
  const reach = useMemo(() => new Map((rows ?? []).map((r) => [r.a.id, reachOf(r.decs, lat)] as [string, Reach])), [rows, lat]);
  const months = useChunked(`ast-months:${env ? observerKey(env.observer) : ''}`, rows, (r) => r.a.id, (r) => bestMonths({ points: r.points }, env!.observer), { size: 6 });
  const conName = (c: string) => env?.catalog.conById.get(c)?.name ?? c;

  const filters = useMemo<FilterSpec<Row>[]>(
    () => [
      { id: 'kind', label: 'Kind', kind: 'segmented', default: '', options: [{ value: '', label: 'All' }, { value: 'signpost', label: 'Seasonal signposts' }, { value: 'asterism', label: 'Other patterns' }], test: (r, v) => (v === 'signpost' ? r.a.signpost : !r.a.signpost) },
      { id: 'visible', label: 'Visible from you', kind: 'select', anyLabel: 'Any', options: [{ value: 'any', label: 'All or part of it' }, { value: 'yes', label: 'All of it' }, { value: 'never', label: 'Never' }], test: (r, v) => (v === 'any' ? reach.get(r.a.id) !== 'never' : reach.get(r.a.id) === v) },
      { id: 'month', label: 'Best in the evening in', kind: 'select', anyLabel: 'Any month', options: MONTH_NAMES.map((n, i) => ({ value: String(i + 1), label: n })), test: (r, v) => !!months.get(r.a.id)?.includes(Number(v)) },
    ],
    [reach, months],
  );
  const sorts = useMemo<SortSpec<Row>[]>(
    () => [
      { id: 'name', label: 'Name', value: (r) => r.a.name.replace(/^the /i, '') },
      { id: 'hops', label: 'Hops', value: (r) => r.a.hops.length, firstDir: 'desc' },
    ],
    [],
  );
  const columns: Column<Row>[] = [
    { id: 'name', label: 'Name', sort: 'name', cell: (r) => <Link to={routes.asterism(r.a.id)}>{r.a.name}</Link> },
    { id: 'kind', label: 'Kind', cell: (r) => (r.a.signpost ? <Badge tone="amber">Signpost</Badge> : 'Asterism') },
    { id: 'cons', label: 'In', cell: (r) => r.a.constellations.map(conName).join(', ') },
    { id: 'months', label: 'Best evenings', cell: (r) => (months.get(r.a.id) ? shortMonths(months.get(r.a.id)!) || <span className="dim">Not in the evening</span> : <span className="faint">…</span>) },
    { id: 'visible', label: 'Visible from you', cell: (r) => <ReachBadge reach={reach.get(r.a.id)!} /> },
    { id: 'hops', label: 'Hops', sort: 'hops', num: true, cell: (r) => r.a.hops.length || <span className="dim">0</span> },
    { id: 'summary', label: 'About', cell: (r) => <span className="lb-clamp lb-clamp--wide">{plain(r.a.summary)}</span> },
  ];
  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead title="Asterisms and signposts" lede="Star patterns that are not constellations but are easier to spot. The seasonal signposts are the starting points for star-hopping in each part of the year." aside={<LocationLine />} />
      <CollectionView
        rows={rows}
        rowKey={(r) => r.a.id}
        href={(r) => routes.asterism(r.a.id)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(r) => `${r.a.name} ${r.a.constellations.map(conName).join(' ')} ${plain(r.a.summary)}`}
        searchLabel="Search star patterns"
        noun={['pattern', 'patterns']}
        version={months.version}
        card={(r) => (
          <>
            <div className="lb-card-head">
              <strong>{r.a.name}</strong>
              <span className="dim">{r.a.constellations.map(conName).join(', ')}</span>
            </div>
            <p className="lb-card-text">{plain(r.a.summary)}</p>
            <div className="lb-card-meta">
              {r.a.signpost && <Badge tone="amber">Signpost</Badge>}
              <ReachBadge reach={reach.get(r.a.id)!} />
              {months.get(r.a.id)?.length ? <span>Best {shortMonths(months.get(r.a.id)!)}</span> : null}
            </div>
          </>
        )}
      />
    </Page>
  );
}
