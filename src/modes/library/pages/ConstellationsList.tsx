import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { bestMonths, constellationPoints } from '@/astro';
import { resolveCourse } from '@/content/course';
import { formatMag } from '@/lib/format';
import { MONTH_NAMES } from '@/lib/time';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead, shortMonths } from '../components/common';
import { observerKey, useAllContent, useChunked, useMasteryByCon } from '../logic/hooks';
import { REACH_LABEL, buildConRows, reachOf, type ConRow, type Reach } from '../logic/rows';
import type { FilterSpec, SortSpec } from '../logic/table';

const REACH_TONE: Record<Reach, 'good' | 'amber' | 'dim'> = { yes: 'good', partly: 'amber', never: 'dim' };
const DEFAULT_SORT = { sort: 'name', dir: 'asc' as const };

export default function ConstellationsList() {
  const env = useLearnEnv();
  const content = useAllContent();
  const mastery = useMasteryByCon();
  const lat = env?.observer.lat ?? 0;

  const rows = useMemo(() => {
    if (!env || !content) return null;
    return buildConRows(env.catalog.constellations, env.catalog.starById, new Map(content.map((c) => [c.id, c])));
  }, [env, content]);
  const reach = useMemo(() => new Map((rows ?? []).map((r) => [r.id, reachOf(r.mainDecs, lat)])), [rows, lat]);

  const okey = env ? observerKey(env.observer) : '';
  const cons = env?.catalog.constellations ?? null;
  const months = useChunked(`con-months:${okey}`, cons, (c) => c.id, (c) => bestMonths({ points: constellationPoints(c, env!.catalog) }, env!.observer), { size: 8 });

  const course = useMemo(() => (env ? resolveCourse(env.observer, env.catalog) : null), [env]);
  const groupOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mod of course?.modules ?? [])
      for (const g of mod.groups)
        for (const c of g.constellations) m.set(c, [...(m.get(c) ?? []), `m:${mod.id}`, `g:${mod.id}/${g.id}`]);
    return m;
  }, [course]);
  const moduleOptions = useMemo(
    () =>
      (course?.modules ?? [])
        .filter((m) => m.groups.length)
        .flatMap((m) => [{ value: `m:${m.id}`, label: `Module ${m.number}: ${m.title}` }, ...(m.groups.length > 1 ? m.groups.map((g) => ({ value: `g:${m.id}/${g.id}`, label: `— ${g.title}` })) : [])]),
    [course],
  );

  const filters = useMemo<FilterSpec<ConRow>[]>(() => {
    const f: FilterSpec<ConRow>[] = [
      {
        id: 'visible',
        label: 'Visible from you',
        kind: 'select',
        anyLabel: 'Any',
        options: [
          { value: 'any', label: 'All or part of it' },
          { value: 'yes', label: 'All of it' },
          { value: 'partly', label: 'Only partly' },
          { value: 'never', label: 'Never' },
        ],
        test: (r, v) => {
          const x = reach.get(r.id);
          return v === 'any' ? x !== 'never' : x === v;
        },
      },
      {
        id: 'month',
        label: 'Best in the evening in',
        kind: 'select',
        anyLabel: 'Any month',
        options: MONTH_NAMES.map((n, i) => ({ value: String(i + 1), label: n })),
        test: (r, v) => !!months.get(r.id)?.includes(Number(v)),
      },
      {
        id: 'hemi',
        label: 'Hemisphere',
        kind: 'select',
        anyLabel: 'Both',
        options: [
          { value: 'N', label: 'Northern sky' },
          { value: 'S', label: 'Southern sky' },
        ],
        test: (r, v) => r.hemisphere === v,
      },
      {
        id: 'origin',
        label: 'Origin',
        kind: 'select',
        anyLabel: 'Ancient or modern',
        options: [
          { value: 'ancient', label: 'Ancient' },
          { value: 'modern', label: 'Modern' },
        ],
        test: (r, v) => r.kind === v,
      },
    ];
    if (moduleOptions.length)
      f.push({ id: 'module', label: 'Course module', kind: 'select', anyLabel: 'Any module', options: moduleOptions, test: (r, v) => !!groupOf.get(r.id)?.includes(v) });
    f.push({ id: 'myths', label: 'Has myths', kind: 'toggle', test: (r) => r.myths > 0 });
    return f;
  }, [reach, months, moduleOptions, groupOf]);

  const sorts = useMemo<SortSpec<ConRow>[]>(
    () => [
      { id: 'name', label: 'Name', value: (r) => r.name },
      { id: 'meaning', label: 'Meaning', value: (r) => r.english.replace(/^the /i, '') },
      { id: 'abbr', label: 'Abbreviation', value: (r) => r.id },
      { id: 'size', label: 'Size', value: (r) => r.areaRank },
      { id: 'bright', label: 'Brightest star', value: (r) => r.brightestMag },
      { id: 'months', label: 'Best evenings', value: (r) => firstMonth(months.get(r.id)) },
      { id: 'visible', label: 'Visible from you', value: (r) => ({ yes: 0, partly: 1, never: 2 })[reach.get(r.id) ?? 'never'] },
      { id: 'myths', label: 'Myths', value: (r) => r.myths, firstDir: 'desc' },
      { id: 'mastery', label: 'Your mastery', value: (r) => mastery.get(r.id) ?? null, firstDir: 'desc' },
    ],
    [months, reach, mastery],
  );

  const columns: Column<ConRow>[] = [
    { id: 'name', label: 'Name', sort: 'name', cell: (r) => <Link to={routes.constellation(r.id)}>{r.name}</Link> },
    { id: 'meaning', label: 'Meaning', sort: 'meaning', cell: (r) => r.english },
    { id: 'abbr', label: 'Abbr.', sort: 'abbr', title: 'IAU abbreviation', cell: (r) => r.id },
    { id: 'size', label: 'Size', sort: 'size', num: true, title: 'Rank by area: 1 = largest of the 88', cell: (r) => `${r.areaRank}` },
    { id: 'bright', label: 'Brightest star', sort: 'bright', cell: (r) => (r.brightestMag == null ? '—' : <>{r.brightestName} <span className="dim">{formatMag(r.brightestMag)}</span></>) },
    { id: 'months', label: 'Best evenings', sort: 'months', title: 'Months when it is well placed around 9–10 pm where you are', cell: (r) => monthCell(months.get(r.id)) },
    { id: 'visible', label: 'Visible from you', sort: 'visible', cell: (r) => <ReachBadge reach={reach.get(r.id)!} /> },
    { id: 'hemi', label: 'Sky', title: 'Northern or southern half of the sky', cell: (r) => (r.hemisphere === 'N' ? 'North' : 'South') },
    { id: 'origin', label: 'Origin', cell: (r) => (r.kind === 'ancient' ? 'Ancient' : r.kind === 'modern' ? 'Modern' : '—') },
    { id: 'myths', label: 'Myths', sort: 'myths', num: true, cell: (r) => (r.myths ? <Link to={`${routes.myths()}?con=${r.id}`}>{r.myths}</Link> : <span className="dim">0</span>) },
    { id: 'mastery', label: 'Mastery', sort: 'mastery', num: true, cell: (r) => masteryCell(mastery.get(r.id)) },
  ];

  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead title="Constellations" lede="All 88 constellations, with when and whether you can see each one from where you are." aside={<LocationLine />} />
      <CollectionView
        rows={rows}
        rowKey={(r) => r.id}
        href={(r) => routes.constellation(r.id)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(r) => `${r.name} ${r.english} ${r.id} ${r.genitive} ${r.brightestName}`}
        searchLabel="Search by name, meaning or star"
        noun={['constellation', 'constellations']}
        version={months.version + mastery.size}
        status={!months.done ? 'Working out the best evening months for your location…' : null}
        card={(r) => (
          <>
            <div className="lb-card-head">
              <strong>{r.name}</strong>
              <span className="dim">{r.english}</span>
            </div>
            <div className="lb-card-meta">
              <ReachBadge reach={reach.get(r.id)!} />
              {months.get(r.id)?.length ? <span>Best {shortMonths(months.get(r.id)!)}</span> : null}
              <span>{r.myths ? `${r.myths} ${r.myths === 1 ? 'myth' : 'myths'}` : 'No myths'}</span>
              {mastery.has(r.id) && <span>Mastery {Math.round(mastery.get(r.id)! * 100)}%</span>}
            </div>
          </>
        )}
      />
    </Page>
  );
}

export function ReachBadge({ reach }: { reach: Reach }) {
  return <Badge tone={REACH_TONE[reach]}>{reach === 'yes' ? 'Yes' : reach === 'partly' ? 'Partly' : 'Never'}</Badge>;
}
export { REACH_LABEL };

function firstMonth(m: number[] | undefined): number | null {
  if (!m?.length) return m ? 99 : null;
  // start of the first run (so Dec–Feb sorts as December)
  const set = new Set(m);
  const start = m.find((x) => !set.has(x === 1 ? 12 : x - 1)) ?? m[0];
  return start;
}
function monthCell(m: number[] | undefined) {
  if (!m) return <span className="faint">…</span>;
  if (!m.length) return <span className="dim">Not in the evening</span>;
  return shortMonths(m);
}
export function masteryCell(m: number | undefined) {
  return m == null ? <span className="faint">—</span> : `${Math.round(m * 100)}%`;
}
