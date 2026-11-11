/** Star / deep-sky object / planet page (from Learn's ObjectPage), with the library's sky embed and routes. */
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ObjectInfo } from '@/components/object';
import { routes } from '@/lib/routes';
import { Loading } from '@/ui';
import type { SkyController } from '@/types';
import { Crumbs, Empty, Page, Split } from '@/modes/learn/components/common';
import { showInSky, useLearnEnv } from '@/modes/learn/hooks';
import { placeTarget } from '@/modes/learn/logic/place';
import { LibSky } from '../components/LibSky';

export default function ObjectDetail() {
  const { ref = '' } = useParams();
  const env = useLearnEnv();
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const target = useMemo(() => env?.catalog.resolve(ref, { date: env.now, observer: env.observer }) ?? null, [env, ref]);
  const placed = useMemo(() => {
    if (!env || !target) return null;
    const fov = target.kind === 'dso' ? Math.max(25, target.fov ?? 25) : target.fov ?? 50;
    return placeTarget(ref, target.body ?? { ra: target.ra, dec: target.dec }, env.nightDate, env, { fov, highlights: [{ type: 'object', ref, label: true }], layers: { dsoMarkers: true } });
  }, [env, target, ref]);
  if (!env) return <Loading />;
  if (target?.kind === 'constellation' && target.constellation) return <Navigate to={routes.constellation(target.constellation.id)} replace />;
  if (target?.kind === 'asterism') return <Navigate to={routes.asterism(target.ref.slice(9))} replace />;
  if (!target || !placed)
    return (
      <Page>
        <Empty>Nothing in the catalog matches “{ref}”.</Empty>
        <Link to={routes.library()}>Back to the library</Link>
      </Page>
    );
  const back: [string, string] = target.kind === 'star' ? ['Stars', routes.stars()] : target.kind === 'body' ? ['Planets', routes.planets()] : ['Deep sky', routes.objects()];
  return (
    <Page wide>
      <Crumbs items={[['Library', routes.library()], back, [target.name]]} />
      <Split
        sky={
          <LibSky
            scene={placed.scene}
            openTarget={ref}
            onController={(c) => {
              setCtl(c);
              if (c) c.on('time', setTime);
            }}
            note={note ?? (placed.mode === 'chart' ? `Not in tonight's sky from ${env.observer.name}. Shown as a star chart, north up.` : null)}
          >
            <p className="dim ln-small">{placed.mode === 'sky' ? 'Shown at its best time tonight. Scroll or pinch to zoom in.' : 'Scroll or pinch to zoom in.'}</p>
          </LibSky>
        }
      >
        <div className="ln-objectinfo">
          <ObjectInfo targetRef={ref} observer={env.observer} date={time ?? placed.scene.time} variant="page" onTarget={(r) => setNote(showInSky(ctl, env.catalog, r))} />
        </div>
      </Split>
    </Page>
  );
}
