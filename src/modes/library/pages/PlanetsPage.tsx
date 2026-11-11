import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BODY_IDS, getBody, moonPhase, riseSet, visibilityOn } from '@/astro';
import { BODY_KIND } from '@/components/object/describe';
import { formatMag } from '@/lib/format';
import { routes } from '@/lib/routes';
import { formatTime } from '@/lib/time';
import { Loading } from '@/ui';
import type { BodyId, BodyState, RiseSet, VisibilityInfo } from '@/types';
import { LocationLine, Page } from '@/modes/learn/components/common';
import { useLearnEnv } from '@/modes/learn/hooks';
import { heightWords } from '@/modes/learn/logic/tonight';
import { Badge } from '../components/CollectionView';
import { ListHead } from '../components/common';
import { useNarrow } from '../logic/hooks';

interface Row {
  id: BodyId;
  state: BodyState;
  vis: VisibilityInfo;
  rs: RiseSet;
  conName: string;
}

const TONIGHT: Record<string, { label: string; tone: 'good' | 'amber' | 'dim' }> = {
  'all-night': { label: 'All night', tone: 'good' },
  evening: { label: 'Evening', tone: 'good' },
  morning: { label: 'Before dawn', tone: 'amber' },
  'not-visible': { label: 'Not tonight', tone: 'dim' },
};

export default function PlanetsPage() {
  const env = useLearnEnv();
  const narrow = useNarrow();
  const rows = useMemo<Row[] | null>(() => {
    if (!env) return null;
    return BODY_IDS.map((id) => ({
      id,
      state: getBody(id, env.now, env.observer),
      vis: visibilityOn(id, env.nightDate, env.observer),
      rs: riseSet(id, env.nightDate, env.observer),
      conName: '',
    })).map((r) => ({ ...r, conName: env.catalog.conById.get(r.state.con)?.name ?? r.state.con }));
  }, [env]);
  if (!env || !rows) return <Loading />;
  const tz = env.observer.tz;
  const phase = moonPhase(env.now);
  const when = (r: Row) => {
    if (r.id === 'Sun') return 'Daytime';
    if (r.vis.cls === 'not-visible' || !r.vis.bestTime) return r.state.elongation < 15 ? 'Too close to the Sun' : 'Not in a dark sky tonight';
    return `Best ${formatTime(r.vis.bestTime, tz)}, ${heightWords(r.vis.bestAlt, r.vis.bestAz)}`;
  };
  const rise = (r: Row) => (r.rs.circumpolar ? 'Never sets' : r.rs.neverRises ? 'Never rises' : `${formatTime(r.rs.rise, tz)} – ${formatTime(r.rs.set, tz)}`);
  const badge = (r: Row) => (r.id === 'Sun' ? <Badge tone="dim">Daytime</Badge> : <Badge tone={TONIGHT[r.vis.cls].tone}>{TONIGHT[r.vis.cls].label}</Badge>);
  const extra = (r: Row) => (r.id === 'Moon' ? `${phase.name}, ${Math.round(phase.illumination * 100)}% lit` : r.id === 'Sun' ? '' : `${Math.round(r.state.elongation)}° from the Sun`);

  return (
    <Page wide>
      <ListHead title="Sun, Moon and planets" lede="Where each one is today, how bright it is, and whether you can see it tonight." aside={<LocationLine />} />
      <p className="lb-warn">Never look at the Sun directly or through binoculars or a telescope without a certified solar filter.</p>
      {narrow ? (
        <ul className="lb-cards">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={routes.object(`body:${r.id}`)} className="card lb-card">
                <div className="lb-card-head">
                  <strong>{r.id}</strong>
                  <span className="dim">
                    {BODY_KIND[r.id]} · in {r.conName}
                  </span>
                </div>
                <p className="lb-card-text">{when(r)}</p>
                <div className="lb-card-meta">
                  {badge(r)}
                  <span>Magnitude {formatMag(r.state.mag)}</span>
                  {extra(r) && <span>{extra(r)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Tonight</th>
                <th scope="col">When to look</th>
                <th scope="col" className="is-num" title="Lower is brighter">
                  Magnitude
                </th>
                <th scope="col">In</th>
                <th scope="col">Rises – sets</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <Link to={routes.object(`body:${r.id}`)}>{r.id}</Link>
                  </th>
                  <td>{badge(r)}</td>
                  <td>{when(r)}</td>
                  <td className="is-num">{formatMag(r.state.mag)}</td>
                  <td>
                    <Link to={routes.constellation(r.state.con)}>{r.conName}</Link>
                  </td>
                  <td>{rise(r)}</td>
                  <td className="dim">{extra(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dim lb-foot">
        Rise and set times are for the night that starts today. For the year ahead see <Link to={routes.events()}>sky events</Link>.
      </p>
    </Page>
  );
}
