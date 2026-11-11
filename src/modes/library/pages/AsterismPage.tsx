/** Asterism / signpost guide (from Learn's SignpostPage), with the library's sky embed and routes. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { altAzOf, angularSeparation, bestMonths, meanDirection } from '@/astro';
import { asterismById, asterisms } from '@/content';
import { routes } from '@/lib/routes';
import { MONTH_NAMES } from '@/lib/time';
import { Chip, Loading, Prose, RichText } from '@/ui';
import type { Highlight, SkyController } from '@/types';
import { Crumbs, Empty, LocationLine, Page, Section, Split } from '@/modes/learn/components/common';
import { showInSky, useLearnEnv, useLearnLocal } from '@/modes/learn/hooks';
import { CHART_LAYERS, pickEvening } from '@/modes/learn/logic/place';
import { makeScene } from '@/modes/learn/logic/scene';
import { LibSky } from '../components/LibSky';
import { shortMonths } from '../components/common';
import { allStarhops } from '../logic/starhopData';

export default function AsterismPage() {
  const { id = '' } = useParams();
  const a = asterismById.get(id);
  const env = useLearnEnv();
  const markSeen = useLearnLocal((s) => s.markAsterismSeen);
  const [hop, setHop] = useState<number | null>(null);
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setHop(null);
    setNote(null);
    if (a) markSeen(a.id);
  }, [a, markSeen]);

  const figure = useMemo<Highlight[]>(() => (a ? a.lines.map((points, i) => ({ type: 'polyline', points, closed: a.closed && a.lines.length === 1, label: i === 0 ? a.name : undefined })) : []), [a]);
  const base = useMemo(() => {
    if (!a || !env) return null;
    const t = env.catalog.resolve(`asterism:${a.id}`);
    if (!t) return null;
    const stars = a.lines.flat().map((r) => env.catalog.resolve(r)).filter((x) => !!x).map((x) => ({ ra: x!.ra, dec: x!.dec }));
    const months = bestMonths({ points: stars }, env.observer);
    const when = pickEvening(stars, env.observer, env.now, months, 8);
    const chart = when.from === null;
    const scene = makeScene({ time: when.time, target: `asterism:${a.id}`, fov: Math.min(130, Math.max(60, (t.fov ?? 60) * 1.25)), mount: chart ? 'equatorial' : 'altaz', layers: chart ? CHART_LAYERS : undefined, highlights: figure }, env);
    return { scene, when, chart, months };
  }, [a, env, figure]);

  useEffect(() => {
    if (!ctl || !a || !base || !env) return;
    const h = hop != null ? a.hops[hop] : null;
    ctl.setHighlights(h ? [...figure.map((f) => ({ ...f, label: undefined }) as Highlight), ...(h.highlights as Highlight[])] : figure);
    if (h) {
      const to = env.catalog.resolve(h.to, { date: ctl.getTime(), observer: ctl.getObserver() });
      const from = env.catalog.resolve(`asterism:${a.id}`);
      if (to && from) {
        const mid = meanDirection([from, to]);
        const sep = angularSeparation(from, to);
        void ctl.flyTo(`radec:${mid.ra},${mid.dec}`, { fov: Math.min(140, Math.max(base.scene.view.fov, sep * 1.9 + 30)) });
        setNote(base.scene.view.mount === 'altaz' && altAzOf(to.ra, to.dec, ctl.getTime(), ctl.getObserver()).alt < 0 ? `${to.name} is below the horizon at this time; try another month.` : null);
      }
    } else {
      void ctl.flyTo(`asterism:${a.id}`, { fov: base.scene.view.fov });
      setNote(null);
    }
  }, [ctl, hop, a, base, env, figure]);

  if (!a)
    return (
      <Page>
        <Empty>There is no star pattern called “{id}”.</Empty>
        <Link to={routes.asterisms()}>All asterisms and signposts</Link>
      </Page>
    );
  if (!env || !base) return <Loading />;
  const onTarget = (ref: string) => setNote(showInSky(ctl, env.catalog, ref));
  const whenText = base.chart ? `Never high in the evening from ${env.observer.name}. Shown as a star chart.` : base.when.from === 'tonight' ? 'Shown as it is tonight at 9 pm.' : `Not well placed tonight, so this is a mid-${MONTH_NAMES[(base.when.from as number) - 1]} evening at 9 pm.`;
  const i = asterisms.findIndex((x) => x.id === a.id);
  const hopsFrom = allStarhops().filter((h) => h.from === `asterism:${a.id}` || h.to === `asterism:${a.id}`);
  return (
    <Page wide>
      <Crumbs items={[['Library', routes.library()], ['Asterisms', routes.asterisms()], [a.name]]} />
      <header className="ln-head">
        <h1>{a.name}</h1>
        <p className="ln-lede">{a.summary}</p>
        <div className="ln-chips">
          {a.signpost && <Chip tone="amber">Seasonal signpost</Chip>}
          <Chip>{base.months.length ? `Best on ${shortMonths(base.months)} evenings` : 'Not in your evening sky'}</Chip>
          {a.constellations.map((c) => (
            <Link key={c} to={routes.constellation(c)} className="chip">
              {env.catalog.conById.get(c)?.name ?? c}
            </Link>
          ))}
        </div>
      </header>
      <Split
        sky={
          <LibSky scene={base.scene} onController={setCtl} note={note} openTarget={`asterism:${a.id}`}>
            <p className="dim ln-small">
              {whenText} <LocationLine />
            </p>
          </LibSky>
        }
      >
        <Section title="How to find it">
          <Prose paragraphs={a.howToFind} onTarget={onTarget} />
        </Section>
        {a.hops.length > 0 && (
          <Section title="Where it points">
            <p className="dim">Choose a hop to draw it on the sky.</p>
            <ol className="ln-hops">
              {a.hops.map((h, k) => (
                <li key={h.title} className={`card${k === hop ? ' is-on' : ''}`}>
                  <button type="button" className="ln-hop" aria-pressed={k === hop} onClick={() => setHop(k === hop ? null : k)}>
                    <span className="ln-step-num">{k + 1}</span>
                    <strong>{h.title}</strong>
                  </button>
                  {k === hop && (
                    <p className="ln-hop-text">
                      <RichText text={h.text} onTarget={onTarget} />
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        )}
        {hopsFrom.length > 0 && (
          <Section title="Star-hops from here">
            <ul className="lb-linklist">
              {hopsFrom.map((h) => (
                <li key={h.id}>
                  <Link to={routes.starhop(h.id)}>{h.name}</Link> <span className="dim">· {h.summary}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <nav className="ln-prevnext">
          {i > 0 ? <Link to={routes.asterism(asterisms[i - 1].id)}>← {asterisms[i - 1].name}</Link> : <span />}
          {i < asterisms.length - 1 ? <Link to={routes.asterism(asterisms[i + 1].id)}>{asterisms[i + 1].name} →</Link> : <span />}
        </nav>
      </Split>
    </Page>
  );
}
