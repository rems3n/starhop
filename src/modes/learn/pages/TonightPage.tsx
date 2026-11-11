import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tonight } from '@/astro';
import { formatDate, formatTime, zonedParts, zonedToUtc } from '@/lib/time';
import { Button, Chip, Loading } from '@/ui';
import type { Highlight, TonightItem } from '@/types';
import { LocationLine, Page, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { useLearnEnv } from '../hooks';
import { eveningOf } from '../logic/place';
import { makeScene } from '../logic/scene';
import { CLASS_LABEL, darknessSentence, groupTonight, moonSentence, placePhrase } from '../logic/tonight';
import { routes } from '@/lib/routes';

const pad = (n: number) => String(n).padStart(2, '0');

export default function TonightPage() {
  const env = useLearnEnv();
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [sel, setSel] = useState<TonightItem | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const date = useMemo(() => {
    if (!env) return null;
    if (!dateStr) return env.nightDate;
    const [y, m, d] = dateStr.split('-').map(Number);
    return zonedToUtc(y, m, d, 12, 0, env.observer.tz);
  }, [env, dateStr]);
  const t = useMemo(() => (env && date ? tonight(date, env.observer, env.catalog) : null), [env, date]);
  const grouped = useMemo(() => (t && env ? groupTonight(t, env.observer.tz) : null), [t, env]);
  const scene = useMemo(() => {
    if (!env || !date || !t) return null;
    if (sel?.visibility.bestTime) {
      const isCon = sel.kind === 'constellation';
      const hl: Highlight[] = isCon ? [{ type: 'constellation', id: sel.ref.slice(4), lines: true, label: true }] : [{ type: 'object', ref: sel.ref, label: true }];
      return makeScene({ time: sel.visibility.bestTime, target: sel.ref, fov: isCon ? Math.max(env.catalog.resolve(sel.ref)?.fov ?? 70, 70) : 80, highlights: hl, layers: { constellationNames: !isCon } }, env);
    }
    const nine = eveningOf(date, env.observer.tz, 21);
    const dusk = t.night.nauticalDusk;
    return makeScene({ time: dusk && dusk > nine ? dusk : nine, az: 180, alt: 40, fov: 120 }, env);
  }, [env, date, t, sel]);

  if (!env || !t || !grouped || !scene || !date) return <Loading />;
  const tz = env.observer.tz;
  const fmt = (d: Date | null) => formatTime(d, tz);
  const p = zonedParts(date, tz);
  const value = dateStr ?? `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const isTonight = !dateStr;

  const row = (it: TonightItem) => (
    <li key={it.ref}>
      <button type="button" className={`ln-tn-row${sel?.ref === it.ref ? ' is-on' : ''}`} aria-pressed={sel?.ref === it.ref} onClick={() => setSel(sel?.ref === it.ref ? null : it)}>
        <strong>{it.name}</strong>
        <span className="dim">{placePhrase(it, tz)}</span>
        <Chip>{CLASS_LABEL[it.visibility.cls]}</Chip>
      </button>
    </li>
  );

  return (
    <Page wide>
      <header className="ln-head">
        <h1>{isTonight ? 'Tonight' : `The night of ${formatDate(date, tz, { weekday: 'long', month: 'long', day: 'numeric' })}`}</h1>
        <div className="row row--wrap">
          <label className="field ln-date">
            <span className="sr-only">Night to look at</span>
            <input className="input" type="date" value={value} onChange={(e) => (setSel(null), setDateStr(e.target.value || null))} />
          </label>
          {!isTonight && (
            <Button size="sm" onClick={() => (setSel(null), setDateStr(null))}>
              Back to tonight
            </Button>
          )}
          <LocationLine />
        </div>
      </header>
      <Split
        sky={
          <SkyStage scene={scene} exploreTarget={sel?.ref}>
            <p className="dim ln-small">
              {sel ? (
                <>
                  Showing <strong>{sel.name}</strong> at its best, {fmt(sel.visibility.bestTime)}.{' '}
                  <Link to={sel.kind === 'constellation' ? routes.constellation(sel.ref.slice(4)) : routes.object(sel.ref)}>Read about {sel.name}</Link>
                </>
              ) : (
                'Looking south once it is dark. Choose anything in the list to see where it will be at its best time.'
              )}
            </p>
          </SkyStage>
        }
      >
        <div className="ln-tn-facts">
          <p>{darknessSentence(t.night, fmt)}</p>
          <p>
            <strong>Moon:</strong> {moonSentence(t.moon.phase.name, t.moon.phase.illumination)}.{' '}
            {t.moon.rise || t.moon.set ? `Rises ${fmt(t.moon.rise)}, sets ${fmt(t.moon.set)}.` : ''}{' '}
            <span className="dim">{t.moon.phase.illumination > 0.6 ? 'Its light will hide the fainter stars while it is up.' : t.moon.phase.illumination < 0.25 ? 'A good dark night for faint things.' : ''}</span>
          </p>
          {t.night.nauticalDawn && (
            <p className="dim">
              The sky starts to brighten at {fmt(t.night.nauticalDawn)}; sunrise is at {fmt(t.night.sunrise)}.
            </p>
          )}
        </div>
        {grouped.groups.map((g) =>
          g.count ? (
            <section key={g.part} className="ln-section">
              <div className="ln-section-head">
                <h3>{g.title}</h3>
                <span className="dim ln-small">best {g.hint}</span>
              </div>
              {g.planets.length > 0 && (
                <>
                  <h5 className="ln-sub">Planets</h5>
                  <ul className="ln-tn-list">{g.planets.map(row)}</ul>
                </>
              )}
              {g.stars.length > 0 && (
                <>
                  <h5 className="ln-sub">Bright stars</h5>
                  <ul className="ln-tn-list">{g.stars.map(row)}</ul>
                </>
              )}
              {g.constellations.length > 0 && (
                <>
                  <h5 className="ln-sub">Constellations</h5>
                  <ul className="ln-tn-list">{g.constellations.map(row)}</ul>
                </>
              )}
            </section>
          ) : null,
        )}
        <section className="ln-section">
          <Button size="sm" aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? 'Hide' : 'Show'} what is not visible this night ({grouped.hidden.planets.length + grouped.hidden.stars.length + grouped.hidden.constellations.length})
          </Button>
          {showHidden && (
            <p className="dim ln-small ln-hidden-list">
              {[...grouped.hidden.planets, ...grouped.hidden.stars, ...grouped.hidden.constellations].map((i) => i.name).join(' · ')}
            </p>
          )}
        </section>
      </Split>
    </Page>
  );
}
