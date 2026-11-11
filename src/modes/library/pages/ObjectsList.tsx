import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { visibilityOn } from '@/astro';
import { blurbRefs } from '@/content';
import { formatAngularSize, formatMag, EQUIPMENT_LABEL } from '@/lib/format';
import { routes } from '@/lib/routes';
import { EquipChip, Loading } from '@/ui';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { DSO_KIND } from '@/components/object/describe';
import type { Equipment } from '@/types';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead } from '../components/common';
import { observerKey, useChunked } from '../logic/hooks';
import { DSO_GROUP_LABEL, EQUIP_RANK, MIN_ALT, buildDsoRows, maxAltitude, type DsoGroup, type DsoRow } from '../logic/rows';
import type { FilterSpec, SortSpec } from '../logic/table';
import { formatLy, visibilityFilter } from './shared';

const DEFAULT_SORT = { sort: 'cat', dir: 'asc' as const };

export default function ObjectsList() {
  const env = useLearnEnv();
  const [params] = useSearchParams();
  const rows = useMemo(() => {
    if (!env) return null;
    const written = new Set(blurbRefs.map((r) => env.catalog.resolve(r)?.ref).filter((r): r is string => !!r));
    return buildDsoRows(env.catalog.dsos, (c) => env.catalog.conById.get(c)?.name ?? c, (ref) => env.catalog.imagesFor(ref).length > 0, written);
  }, [env]);
  const lat = env?.observer.lat ?? 0;
  const wantTonight = params.get('visible') === 'tonight';
  const tonight = useChunked(`dso-tonight:${env ? observerKey(env.observer) : ''}:${env?.nightDate.toDateString()}`, rows, (r) => r.ref, (r) => visibilityOn({ ra: env!.catalog.dsoById.get(r.ref.slice(4))!.ra, dec: r.dec }, env!.nightDate, env!.observer).cls, { enabled: wantTonight, size: 60 });

  const filters = useMemo<FilterSpec<DsoRow>[]>(() => {
    const cons = [...new Map((rows ?? []).map((r) => [r.con, r.conName]))].sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { id: 'cat', label: 'Catalogue', kind: 'segmented', default: '', options: [{ value: '', label: 'All' }, { value: 'messier', label: 'Messier' }, { value: 'caldwell', label: 'Caldwell' }, { value: 'other', label: 'Other' }], test: (r, v) => r.catalogue === v },
      { id: 'type', label: 'Type', kind: 'select', anyLabel: 'Any type', options: (Object.keys(DSO_GROUP_LABEL) as DsoGroup[]).map((g) => ({ value: g, label: DSO_GROUP_LABEL[g] })), test: (r, v) => r.group === v },
      { id: 'equip', label: 'Equipment', kind: 'select', anyLabel: 'Any equipment', options: [{ value: 'naked-eye', label: 'Naked eye' }, { value: 'binoculars', label: 'Up to binoculars' }, { value: 'small-telescope', label: 'Up to a small telescope' }], test: (r, v) => EQUIP_RANK[r.equip] <= EQUIP_RANK[v as Equipment] },
      { id: 'con', label: 'Constellation', kind: 'select', anyLabel: 'Any constellation', options: cons.map(([value, label]) => ({ value, label })), test: (r, v) => r.con === v },
      visibilityFilter<DsoRow>((r) => maxAltitude(r.dec, lat) >= MIN_ALT, (r) => tonight.get(r.ref)),
      { id: 'img', label: 'Has a picture', kind: 'toggle', test: (r) => r.hasImage },
    ];
  }, [rows, lat, tonight]);

  const sorts = useMemo<SortSpec<DsoRow>[]>(
    () => [
      { id: 'cat', label: 'Catalogue number', value: (r) => (r.messier ? r.messier : r.caldwell ? 1000 + r.caldwell : null) },
      { id: 'name', label: 'Name', value: (r) => r.name ?? `~${r.label}` },
      { id: 'type', label: 'Type', value: (r) => DSO_KIND[r.type].label },
      { id: 'con', label: 'Constellation', value: (r) => r.conName },
      { id: 'mag', label: 'Brightness', value: (r) => r.mag },
      { id: 'size', label: 'Size', value: (r) => r.sizeArcmin, firstDir: 'desc' },
      { id: 'dist', label: 'Distance', value: (r) => r.distLy },
      { id: 'equip', label: 'Equipment', value: (r) => EQUIP_RANK[r.equip] * 100 + (r.mag ?? 50) },
    ],
    [],
  );

  const columns: Column<DsoRow>[] = [
    { id: 'id', label: 'Object', sort: 'cat', cell: (r) => <Link to={routes.object(r.ref)}>{r.label}</Link> },
    { id: 'name', label: 'Name', sort: 'name', cell: (r) => r.name ?? <span className="faint">—</span> },
    { id: 'type', label: 'Type', sort: 'type', cell: (r) => DSO_KIND[r.type].label },
    { id: 'con', label: 'Constellation', sort: 'con', cell: (r) => r.conName },
    { id: 'mag', label: 'Mag.', sort: 'mag', num: true, title: 'Magnitude: lower is brighter', cell: (r) => formatMag(r.mag) },
    { id: 'size', label: 'Size', sort: 'size', num: true, cell: (r) => (r.sizeArcmin ? formatAngularSize(r.sizeArcmin) : '—') },
    { id: 'dist', label: 'Distance', sort: 'dist', num: true, cell: (r) => formatLy(r.distLy) },
    { id: 'equip', label: 'Equipment', sort: 'equip', cell: (r) => EQUIPMENT_LABEL[r.equip] },
    { id: 'more', label: 'Extras', cell: (r) => <span className="lb-extras">{r.hasImage && <Badge>Picture</Badge>}{r.hasWriteup && <Badge tone="good">Write-up</Badge>}</span> },
  ];

  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead title="Deep-sky objects" lede="Clusters, nebulae and galaxies: the Messier and Caldwell lists and hundreds more, with what you need to see each one." aside={<LocationLine />} />
      <CollectionView
        rows={rows}
        rowKey={(r) => r.ref}
        href={(r) => routes.object(r.ref)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(r) => `${r.ids} ${r.name ?? ''} ${DSO_KIND[r.type].label} ${r.conName}`}
        searchLabel="Search by name or number (M31, NGC 869…)"
        noun={['object', 'objects']}
        version={tonight.version}
        status={wantTonight && !tonight.done ? 'Working out tonight’s sky…' : null}
        card={(r) => (
          <>
            <div className="lb-card-head">
              <strong>
                {r.label}
                {r.name && <> · {r.name}</>}
              </strong>
              <span className="dim">
                {DSO_KIND[r.type].label} in {r.conName}
              </span>
            </div>
            <div className="lb-card-meta">
              <EquipChip equip={r.equip} />
              {r.mag != null && <span>Magnitude {formatMag(r.mag)}</span>}
              {r.hasImage && <Badge>Picture</Badge>}
              {r.hasWriteup && <Badge tone="good">Write-up</Badge>}
            </div>
          </>
        )}
      />
    </Page>
  );
}
