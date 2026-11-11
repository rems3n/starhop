import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ObjectInfo } from '@/components/object';
import { Loading } from '@/ui';
import type { SkyController } from '@/types';
import { Crumbs, Empty, Page, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { showInSky, useLearnEnv } from '../hooks';
import { placeTarget } from '../logic/place';
import { routes } from '@/lib/routes';

export default function ObjectPage() {
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
  if (!target || !placed)
    return (
      <Page>
        <Empty>Nothing in the catalog matches “{ref}”.</Empty>
        <Link to={routes.objects()}>Browse objects</Link>
      </Page>
    );
  if (target.kind === 'constellation' && target.constellation)
    return (
      <Page>
        <p>
          {target.name} is a constellation. <Link to={routes.constellation(target.constellation.id)}>Open its page</Link>
        </p>
      </Page>
    );
  return (
    <Page wide>
      <Crumbs items={[['Objects', routes.objects()], [target.name]]} />
      <Split
        sky={
          <SkyStage
            scene={placed.scene}
            exploreTarget={ref}
            onController={(c) => {
              setCtl(c);
              if (c) c.on('time', setTime);
            }}
            onReset={() => setNote(null)}
            note={note ?? (placed.mode === 'chart' ? `Not in tonight's sky from ${env.observer.name}. Shown as a star chart, north up.` : null)}
          >
            <p className="dim ln-small">{placed.mode === 'sky' ? 'Shown at its best time tonight. Scroll to zoom in.' : 'Scroll to zoom in.'}</p>
          </SkyStage>
        }
      >
        <div className="ln-objectinfo">
          <ObjectInfo targetRef={ref} observer={env.observer} date={time ?? placed.scene.time} variant="page" onTarget={(r) => setNote(showInSky(ctl, env.catalog, r))} />
        </div>
      </Split>
    </Page>
  );
}
