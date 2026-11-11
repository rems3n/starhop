import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { altAzOf, angularSeparation, meanDirection } from '@/astro';
import { asterismById, asterisms } from '@/content';
import { MONTH_NAMES } from '@/lib/time';
import { Chip, Loading, Prose, RichText } from '@/ui';
import type { Highlight, SkyController } from '@/types';
import { Crumbs, Empty, LocationLine, Page, Section, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { showInSky, useLearnEnv, useLearnLocal } from '../hooks';
import { CHART_LAYERS, pickEvening } from '../logic/place';
import { makeScene } from '../logic/scene';
import { routes } from '@/lib/routes';

export default function SignpostPage() {
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
  /** One evening when the pattern and everything its hops point to are above the horizon, if there is one. */
  const base = useMemo(() => {
    if (!a || !env) return null;
    const t = env.catalog.resolve(`asterism:${a.id}`);
    if (!t) return null;
    const stars = a.lines.flat().map((r) => env.catalog.resolve(r)).filter((x) => !!x).map((x) => ({ ra: x!.ra, dec: x!.dec }));
    const when = pickEvening(stars, env.observer, env.now, a.bestMonths, 8);
    const chart = when.from === null;
    const scene = makeScene({ time: when.time, target: `asterism:${a.id}`, fov: Math.min(130, Math.max(60, (t.fov ?? 60) * 1.25)), mount: chart ? 'equatorial' : 'altaz', layers: chart ? CHART_LAYERS : undefined, highlights: figure }, env);
    return { scene, when, chart };
  }, [a, env, figure]);

  useEffect(() => {
    if (!ctl || !a || !base || !env) return;
    const h = hop != null ? a.hops[hop] : null;
    ctl.setHighlights(h ? [...figure.map((f) => ({ ...f, label: undefined }) as Highlight), ...(h.highlights as Highlight[])] : figure);
    if (h) {
      // frame the start and the end of the hop together: aim between them
      const to = env.catalog.resolve(h.to, { date: ctl.getTime(), observer: ctl.getObserver() });
      const from = env.catalog.resolve(`asterism:${a.id}`);
      if (to && from) {
        const mid = meanDirection([from, to]);
        const sep = angularSeparation(from, to);
        void ctl.flyTo(`radec:${mid.ra},${mid.dec}`, { fov: Math.min(140, Math.max(base.scene.view.fov, sep * 1.9 + 30)) });
        setNote(base.scene.view.mount === 'altaz' && belowHorizon(ctl, to) ? `${to.name} is below the horizon at this time; try another season.` : null);
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
        <Link to={routes.asterisms()}>All signposts</Link>
      </Page>
    );
  if (!env || !base) return <Loading />;
  const onTarget = (ref: string) => setNote(showInSky(ctl, env.catalog, ref));
  const whenText = base.chart ? `Never high in the evening from ${env.observer.name}. Shown as a star chart.` : base.when.from === 'tonight' ? 'Shown as it is tonight at 9 pm.' : `Not well placed tonight, so this is a mid-${MONTH_NAMES[(base.when.from as number) - 1]} evening at 9 pm.`;
  const i = asterisms.findIndex((x) => x.id === a.id);
  return (
    <Page wide>
      <Crumbs items={[['Signposts', routes.asterisms()], [a.name]]} />
      <header className="ln-head">
        <h1>{a.name}</h1>
        <p className="ln-lede">{a.summary}</p>
        <div className="ln-chips">
          {a.signpost && <Chip tone="amber">Seasonal signpost</Chip>}
          <Chip>Best in {a.bestMonths.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')}</Chip>
          {a.constellations.map((c) => (
            <Link key={c} to={routes.constellation(c)} className="chip">
              {env.catalog.conById.get(c)?.name ?? c}
            </Link>
          ))}
        </div>
      </header>
      <Split
        sky={
          <SkyStage scene={base.scene} exploreTarget={`asterism:${a.id}`} onController={setCtl} note={note} onReset={() => setHop(null)}>
            <p className="dim ln-small">
              {whenText} <LocationLine />
            </p>
          </SkyStage>
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
        <nav className="ln-prevnext">
          {i > 0 ? <Link to={routes.asterism(asterisms[i - 1].id)}>← {asterisms[i - 1].name}</Link> : <span />}
          {i < asterisms.length - 1 ? <Link to={routes.asterism(asterisms[i + 1].id)}>{asterisms[i + 1].name} →</Link> : <span />}
        </nav>
      </Split>
    </Page>
  );
}

function belowHorizon(c: SkyController, p: { ra: number; dec: number }): boolean {
  return altAzOf(p.ra, p.dec, c.getTime(), c.getObserver()).alt < 0;
}
