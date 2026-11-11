import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { visibilityOn } from '@/astro';
import { blurbRefs } from '@/content';
import { formatMag } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { Badge, CollectionView, type Column } from '../components/CollectionView';
import { ListHead } from '../components/common';
import { observerKey, useChunked } from '../logic/hooks';
import { MAG_BANDS, MIN_ALT, SPECTRAL_LETTERS, buildStarRows, magBand, maxAltitude, type StarRow } from '../logic/rows';
import type { FilterSpec, SortSpec } from '../logic/table';
import { formatLy, visibilityFilter } from './shared';

const DEFAULT_SORT = { sort: 'mag', dir: 'asc' as const };

export default function StarsList() {
  const env = useLearnEnv();
  const [params] = useSearchParams();
  const rows = useMemo(() => {
    if (!env) return null;
    const written = new Set(blurbRefs.map((r) => env.catalog.resolve(r)?.ref).filter((r): r is string => !!r));
    return buildStarRows(env.catalog.stars, (c) => env.catalog.conById.get(c)?.name ?? c, written);
  }, [env]);
  const lat = env?.observer.lat ?? 0;
  const wantTonight = params.get('visible') === 'tonight';
  const tonight = useChunked(`star-tonight:${env ? observerKey(env.observer) : ''}:${env?.nightDate.toDateString()}`, rows, (r) => r.ref, (r) => visibilityOn({ ra: env!.catalog.starById.get(r.id)!.ra, dec: r.dec }, env!.nightDate, env!.observer).cls, { enabled: wantTonight, size: 60 });

  const filters = useMemo<FilterSpec<StarRow>[]>(() => {
    const cons = [...new Map((rows ?? []).map((r) => [r.con, r.conName]))].sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { id: 'mag', label: 'Brightness', kind: 'select', anyLabel: 'Any brightness', options: MAG_BANDS.map((b) => ({ value: b.value, label: `Magnitude ${b.label.toLowerCase()}` })), test: (r, v) => magBand(r.mag) === v },
      { id: 'class', label: 'Colour (spectral class)', kind: 'select', anyLabel: 'Any colour', options: SPECTRAL_LETTERS.map((l) => ({ value: l, label: `${l} · ${({ O: 'blue', B: 'blue-white', A: 'white', F: 'yellow-white', G: 'yellow', K: 'orange', M: 'red' } as const)[l]}` })), test: (r, v) => r.spLetter === v },
      { id: 'con', label: 'Constellation', kind: 'select', anyLabel: 'Any constellation', options: cons.map(([value, label]) => ({ value, label })), test: (r, v) => r.con === v },
      visibilityFilter<StarRow>((r) => maxAltitude(r.dec, lat) >= MIN_ALT, (r) => tonight.get(r.ref)),
      { id: 'writeup', label: 'Has a write-up', kind: 'toggle', test: (r) => r.hasWriteup },
    ];
  }, [rows, lat, tonight]);

  const sorts = useMemo<SortSpec<StarRow>[]>(
    () => [
      { id: 'name', label: 'Name', value: (r) => r.title },
      { id: 'con', label: 'Constellation', value: (r) => r.conName },
      { id: 'mag', label: 'Brightness', value: (r) => r.mag },
      { id: 'class', label: 'Spectral class', value: (r) => (r.spLetter ? SPECTRAL_LETTERS.indexOf(r.spLetter as (typeof SPECTRAL_LETTERS)[number]) : null) },
      { id: 'dist', label: 'Distance', value: (r) => r.distLy },
    ],
    [],
  );

  const columns: Column<StarRow>[] = [
    { id: 'name', label: 'Name', sort: 'name', cell: (r) => <Link to={routes.object(r.ref)}>{r.title}</Link> },
    { id: 'desig', label: 'Designation', cell: (r) => (r.proper ? r.desig : <span className="dim">—</span>) },
    { id: 'con', label: 'Constellation', sort: 'con', cell: (r) => r.conName },
    { id: 'mag', label: 'Magnitude', sort: 'mag', num: true, title: 'Lower is brighter', cell: (r) => formatMag(r.mag) },
    { id: 'class', label: 'Colour', sort: 'class', cell: (r) => (r.colour ? <>{cap(r.colour)} {r.sp && <span className="dim">{r.sp.split(/\s|\+/)[0]}</span>}</> : <span className="dim">—</span>) },
    { id: 'dist', label: 'Distance', sort: 'dist', num: true, cell: (r) => formatLy(r.distLy) },
    { id: 'writeup', label: 'Write-up', cell: (r) => (r.hasWriteup ? <Badge tone="good">Yes</Badge> : <span className="faint">—</span>) },
  ];

  if (!env) return <Loading />;
  return (
    <Page wide>
      <ListHead title="Stars" lede="Every star with a proper name, and every lettered star brighter than magnitude 3.5." aside={<LocationLine />} />
      <CollectionView
        rows={rows}
        rowKey={(r) => r.ref}
        href={(r) => routes.object(r.ref)}
        columns={columns}
        filters={filters}
        sorts={sorts}
        defaultSort={DEFAULT_SORT}
        searchText={(r) => `${r.title} ${r.desig} ${greekWords(r.desig)} ${r.conName} ${r.con}`}
        searchLabel="Search by name or designation"
        noun={['star', 'stars']}
        version={tonight.version}
        status={wantTonight && !tonight.done ? 'Working out tonight’s sky…' : null}
        card={(r) => (
          <>
            <div className="lb-card-head">
              <strong>{r.title}</strong>
              <span className="dim">
                {r.proper ? `${r.desig} · ` : ''}
                {r.conName}
              </span>
            </div>
            <div className="lb-card-meta">
              <span>Magnitude {formatMag(r.mag)}</span>
              {r.colour && <span>{cap(r.colour)}</span>}
              {r.distLy != null && <span>{formatLy(r.distLy)}</span>}
              {r.hasWriteup && <Badge tone="good">Write-up</Badge>}
            </div>
          </>
        )}
      />
    </Page>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const GREEK: Record<string, string> = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega' };
/** "α Ori" → "alpha" so typing "alpha ori" finds it */
function greekWords(desig: string): string {
  return [...desig].map((c) => GREEK[c] ?? '').join(' ');
}
