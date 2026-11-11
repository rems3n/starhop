import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { angularSeparation, meanDirection } from '@/astro';
import { asterismById } from '@/content';
import { handSpan } from '@/lib/format';
import { routes } from '@/lib/routes';
import { MONTH_NAMES } from '@/lib/time';
import { Chip, Loading, RichText } from '@/ui';
import type { Highlight, SkyController } from '@/types';
import { Crumbs, Empty, LocationLine, Page, Section, Split } from '@/modes/learn/components/common';
import { showInSky, useLearnEnv } from '@/modes/learn/hooks';
import { CHART_LAYERS, pickEvening } from '@/modes/learn/logic/place';
import { makeScene } from '@/modes/learn/logic/scene';
import { LibSky } from '../components/LibSky';
import { refHref, shortMonths } from '../components/common';
import { hopMonths, hopSuitsHemisphere, stepSpan } from '../logic/rows';
import { getStarhop } from '../logic/starhopData';
import { HEMI_LABEL, METHOD_LABEL } from './StarhopsList';

const AMBER = '#f0b45c';
const DIM = 'rgba(156, 192, 255, 0.45)';
const VEGA = '#9cc0ff';

export default function StarhopPage() {
  const { id = '' } = useParams();
  const hop = getStarhop(id);
  const env = useLearnEnv();
  const [ctl, setCtl] = useState<SkyController | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setStep(null);
    setNote(null);
  }, [id]);

  /** Path positions and canonical refs, the evening to show, and the base highlights. */
  const plan = useMemo(() => {
    if (!hop || !env) return null;
    const pts = hop.path.map((r) => env.catalog.resolve(r)).filter((t): t is NonNullable<typeof t> => !!t);
    if (pts.length < 2) return null;
    const canon = pts.map((t) => t.ref);
    const center = meanDirection(pts);
    const radius = Math.max(...pts.map((p) => angularSeparation(center, p)));
    const fov = Math.min(140, Math.max(30, radius * 2.5 + 14));
    const months = hopSuitsHemisphere(hop, env.observer.lat) ? hopMonths(hop, env.observer.lat) : [];
    const when = pickEvening(pts, env.observer, env.now, months, 12);
    const chart = when.from === null;
    return { pts, canon, center, fov, when, chart };
  }, [hop, env]);

  const highlights = useMemo<Highlight[]>(() => {
    if (!hop || !plan) return [];
    const span = step != null ? stepSpan(hop.steps[step], step, hop.steps.length, plan.canon, (r) => env?.catalog.resolve(r)?.ref ?? null) : null;
    const hl: Highlight[] = [];
    for (const r of [hop.from, hop.to]) {
      const a = r.startsWith('asterism:') ? asterismById.get(r.slice(9)) : null;
      if (a) a.lines.forEach((points, i) => hl.push({ type: 'polyline', points, closed: a.closed && a.lines.length === 1, label: i === 0 ? a.name : undefined, color: VEGA }));
      else hl.push({ type: 'object', ref: r, label: false, color: r === hop.to ? AMBER : VEGA });
    }
    hl.push({ type: 'polyline', points: hop.path, color: span ? DIM : AMBER });
    for (let i = 0; i < hop.path.length - 1; i++) {
      const on = !span || (i >= span[0] && i < span[1]);
      if (span && !on) continue;
      const sep = angularSeparation(plan.pts[i], plan.pts[i + 1]);
      hl.push({ type: 'angle', from: hop.path[i], to: hop.path[i + 1], label: `${Math.round(sep)}°`, color: AMBER });
    }
    return hl;
  }, [hop, plan, step, env]);

  const scene = useMemo(() => {
    if (!hop || !plan || !env) return null;
    return makeScene(
      { time: plan.when.time, target: `radec:${plan.center.ra},${plan.center.dec}`, fov: plan.fov, mount: plan.chart ? 'equatorial' : 'altaz', layers: plan.chart ? { ...CHART_LAYERS, constellationNames: false } : { constellationNames: false }, highlights: [] },
      env,
    );
  }, [hop, plan, env]);

  // highlights and the focused leg
  useEffect(() => {
    if (!ctl || !hop || !plan) return;
    ctl.setHighlights(highlights);
    if (step == null) {
      void ctl.flyTo(`radec:${plan.center.ra},${plan.center.dec}`, { fov: plan.fov });
      return;
    }
    const [a, b] = stepSpan(hop.steps[step], step, hop.steps.length, plan.canon, (r) => env?.catalog.resolve(r)?.ref ?? null);
    const seg = plan.pts.slice(a, b + 1);
    const mid = meanDirection(seg);
    const r = Math.max(...seg.map((p) => angularSeparation(mid, p)));
    void ctl.flyTo(`radec:${mid.ra},${mid.dec}`, { fov: Math.min(plan.fov, Math.max(20, r * 2.6 + 10)) });
  }, [ctl, highlights, step, hop, plan, env, scene]);

  if (!hop)
    return (
      <Page>
        <Empty>There is no star-hop called “{id}”.</Empty>
        <Link to={routes.starhops()}>All star-hops</Link>
      </Page>
    );
  if (!env || !plan || !scene) return <Loading />;
  const onTarget = (ref: string) => setNote(showInSky(ctl, env.catalog, ref));
  const name = (ref: string) => env.catalog.resolve(ref)?.name ?? ref;
  const months = hopSuitsHemisphere(hop, env.observer.lat) ? hopMonths(hop, env.observer.lat) : [];
  const whenText = plan.chart
    ? `This hop never sits well above your horizon in the evening, so it is shown as a star chart.`
    : plan.when.from === 'tonight'
      ? 'Shown as it is tonight at 9 pm.'
      : `Not well placed tonight, so this is a mid-${MONTH_NAMES[(plan.when.from as number) - 1]} evening at 9 pm.`;
  const nexts = hop.next.map((n) => getStarhop(n)).filter((n): n is NonNullable<typeof n> => !!n);

  return (
    <Page wide>
      <Crumbs items={[['Library', routes.library()], ['Star-hops', routes.starhops()], [hop.name]]} />
      <header className="ln-head">
        <h1>{hop.name}</h1>
        <p className="ln-lede">{hop.summary}</p>
        <div className="ln-chips">
          <Chip tone="amber">{hop.rank <= 10 ? `Top 10 · number ${hop.rank}` : `Number ${hop.rank}`}</Chip>
          <Chip>{METHOD_LABEL[hop.method]}</Chip>
          <Chip>{Math.round(hop.distanceDeg)}° from start to finish</Chip>
          <Chip>{HEMI_LABEL[hop.hemisphere]}</Chip>
          <Chip>{months.length ? `Best ${shortMonths(months)} evenings` : 'Not practical from your hemisphere'}</Chip>
        </div>
      </header>
      <Split
        sky={
          <LibSky scene={scene} onController={setCtl} note={note} openTarget={hop.to} label={`${hop.name} drawn on the sky`}>
            <p className="dim ln-small">
              {whenText} <LocationLine />
            </p>
          </LibSky>
        }
      >
        <Section title="Steps">
          <p className="dim">Choose a step to draw just that part of the hop.</p>
          <ol className="lb-steps">
            {hop.steps.map((s, k) => (
              <li
                key={k}
                className={`lb-step${k === step ? ' is-on' : ''}`}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) setStep(k === step ? null : k);
                }}
              >
                <button type="button" className="lb-step-num" aria-pressed={k === step} aria-label={`Step ${k + 1}: show this part on the sky`} onClick={() => setStep(k === step ? null : k)}>
                  {k + 1}
                </button>
                <span className="lb-step-text">
                  <RichText text={s} onTarget={onTarget} />
                </span>
              </li>
            ))}
          </ol>
          {step != null && (
            <button type="button" className="sky-link ln-small" onClick={() => setStep(null)}>
              Show the whole hop
            </button>
          )}
        </Section>
        <div className="lb-actions">
          <Link className="btn btn--primary" to={routes.quiz('starhop', { hop: hop.id })}>
            Practise this hop
          </Link>
        </div>
        <Section title="Start and finish">
          <p>
            From <Link to={refHref(hop.from)}>{name(hop.from)}</Link> to <Link to={refHref(hop.to)}>{name(hop.to)}</Link>: {handSpan(hop.distanceDeg)} in all.
          </p>
          <div className="ln-chips">
            {hop.constellations.map((c) => (
              <Link key={c} to={routes.constellation(c)} className="chip">
                {env.catalog.conById.get(c)?.name ?? c}
              </Link>
            ))}
          </div>
        </Section>
        {nexts.length > 0 && (
          <Section title="Keep going">
            <ul className="lb-linklist">
              {nexts.map((n) => (
                <li key={n.id}>
                  <Link to={routes.starhop(n.id)}>{n.name}</Link> <span className="dim">· {n.summary}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <p className="lb-back">
          <Link to={routes.starhops()}>All star-hops</Link>
        </p>
      </Split>
    </Page>
  );
}
