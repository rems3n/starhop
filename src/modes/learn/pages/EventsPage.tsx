import { useEffect, useMemo, useState } from 'react';
import { getBody, visibilityOn, yearEvents } from '@/astro';
import { showers } from '@/content';
import { formatDate, formatTime } from '@/lib/time';
import { Button, Chip, Loading, Switch } from '@/ui';
import type { Highlight, Observer, SkyEvent, SkyEventKind } from '@/types';
import { LocationLine, Page, Split } from '../components/common';
import { SkyStage } from '../components/SkyStage';
import { useLearnEnv } from '../hooks';
import { makeScene } from '../logic/scene';

const KINDS: { id: string; label: string; kinds: SkyEventKind[] }[] = [
  { id: 'planets', label: 'Oppositions and elongations', kinds: ['opposition', 'greatest-elongation'] },
  { id: 'conjunction', label: 'Conjunctions', kinds: ['conjunction'] },
  { id: 'meteor-shower', label: 'Meteor showers', kinds: ['meteor-shower'] },
  { id: 'eclipse', label: 'Eclipses', kinds: ['lunar-eclipse', 'solar-eclipse'] },
  { id: 'season', label: 'Solstices and equinoxes', kinds: ['equinox', 'solstice'] },
  { id: 'moon', label: 'New and full Moons', kinds: ['moon-phase'] },
];
const KIND_WORD: Record<SkyEventKind, string> = { opposition: 'Opposition', conjunction: 'Conjunction', 'greatest-elongation': 'Greatest elongation', 'meteor-shower': 'Meteor shower', 'lunar-eclipse': 'Lunar eclipse', 'solar-eclipse': 'Solar eclipse', 'moon-phase': 'Moon', equinox: 'Equinox', solstice: 'Solstice' };

const cache = new Map<string, SkyEvent[]>();
const keyOf = (o: Observer, now: Date) => `${o.lat.toFixed(3)},${o.lon.toFixed(3)},${o.tz},${now.toISOString().slice(0, 10)}`;

export default function EventsPage() {
  const env = useLearnEnv();
  const [events, setEvents] = useState<SkyEvent[] | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({ planets: true, conjunction: true, 'meteor-shower': true, eclipse: true, season: true, moon: false });
  const [hereOnly, setHereOnly] = useState(false);
  const [sel, setSel] = useState<SkyEvent | null>(null);

  useEffect(() => {
    if (!env) return;
    const k = keyOf(env.observer, env.now);
    const hit = cache.get(k);
    setSel(null);
    if (hit) return setEvents(hit);
    setEvents(null);
    // a year of events takes a few tenths of a second: let the page paint first
    const id = setTimeout(() => {
      const list = yearEvents(env.now, env.observer, showers);
      cache.set(k, list);
      setEvents(list);
    }, 30);
    return () => clearTimeout(id);
  }, [env]);

  const shown0 = useMemo(() => {
    if (!env) return null;
    if (!sel) return { scene: makeScene({ time: env.now, az: 180, alt: 40, fov: 120 }, env), shifted: false };
    const refs = sel.refs.filter((r) => env.catalog.resolve(r, { date: sel.date, observer: env.observer }));
    const hl: Highlight[] = refs.map((r) => (r.startsWith('radec:') ? { type: 'circle', center: r, radiusDeg: 4, label: 'Radiant: meteors seem to come from here' } : { type: 'object', ref: r, label: true }));
    const wide = sel.kind === 'meteor-shower' || sel.kind === 'equinox' || sel.kind === 'solstice';
    const build = (time: Date) => makeScene({ time, target: refs[0], az: 180, alt: 40, fov: wide ? 110 : 60, highlights: hl, layers: { ecliptic: sel.kind !== 'meteor-shower' } }, env);
    const exact = build(sel.date);
    // Daytime events about the Sun are shown as they happen. Anything else that is below the horizon (or in
    // daylight) at the exact moment is shown at the best time to look on that night instead.
    const sunny = sel.kind === 'solar-eclipse' || sel.kind === 'equinox' || sel.kind === 'solstice';
    const sunUp = getBody('Sun', sel.date, env.observer).alt > -6;
    if (!sunny && exact.target && refs[0] !== 'body:Sun' && (exact.target.alt < 5 || sunUp)) {
      const t = env.catalog.resolve(refs[0], { date: sel.date, observer: env.observer })!;
      const v = visibilityOn(t.body ?? { ra: t.ra, dec: t.dec }, new Date(sel.date.getTime() - 12 * 3600e3), env.observer);
      if (v.bestTime) return { scene: build(v.bestTime), shifted: true };
    }
    return { scene: exact, shifted: false };
  }, [env, sel]);

  if (!env || !shown0) return <Loading />;
  const { scene, shifted } = shown0;
  const tz = env.observer.tz;
  const kinds = new Set(KINDS.filter((k) => on[k.id]).flatMap((k) => k.kinds));
  const shown = (events ?? []).filter((e) => kinds.has(e.kind) && (!hereOnly || e.visibleHere));
  let lastMonth = '';
  const below = sel && scene.target && scene.target.alt < 0;
  return (
    <Page wide>
      <header className="ln-head">
        <h1>The year ahead</h1>
        <p className="ln-lede">What is coming up in the next twelve months, worked out for your location.</p>
        <LocationLine />
        <div className="ln-chips" role="group" aria-label="Kinds of event">
          {KINDS.map((k) => (
            <Button key={k.id} size="sm" pressed={!!on[k.id]} onClick={() => setOn({ ...on, [k.id]: !on[k.id] })}>
              {k.label}
            </Button>
          ))}
        </div>
        <div className="ln-events-switch">
          <Switch checked={hereOnly} onChange={setHereOnly} label={`Only what can be seen from ${env.observer.name}`} />
        </div>
      </header>
      <Split
        sky={
          <SkyStage scene={scene} note={below ? 'This happens below your horizon: the view is aimed at the ground.' : null}>
            <p className="dim ln-small">
              {sel ? (
                <>
                  <strong>{sel.title}</strong> · the sky at {formatTime(scene.time, tz)} on {formatDate(scene.time, tz)}
                  {shifted && ', the best time to look that night'}
                </>
              ) : (
                'The sky right now. Press “Show” on an event to see the sky at that moment.'
              )}
            </p>
          </SkyStage>
        }
      >
        {!events && <p className="dim" role="status">Working out the next twelve months…</p>}
        {events && !shown.length && <p className="dim">No events match these filters.</p>}
        <ol className="ln-events">
          {shown.map((e, i) => {
            const month = formatDate(e.date, tz, { month: 'long', year: 'numeric' });
            const head = month !== lastMonth ? <h3 className="ln-events-month">{month}</h3> : null;
            lastMonth = month;
            return (
              <li key={`${e.kind}${e.date.getTime()}${i}`}>
                {head}
                <article className={`card ln-event${e.visibleHere ? ' is-here' : ''}${sel === e ? ' is-on' : ''}`}>
                  <div className="ln-event-date">
                    <strong>{formatDate(e.date, tz, { day: 'numeric' })}</strong>
                    <span>{formatDate(e.date, tz, { weekday: 'short' })}</span>
                  </div>
                  <div className="grow">
                    <div className="ln-event-top">
                      <h4>{e.title}</h4>
                      <Chip>{KIND_WORD[e.kind]}</Chip>
                      {e.visibleHere ? <Chip tone="good">Visible from here</Chip> : <Chip>Not visible from here</Chip>}
                    </div>
                    <p className="ln-small">{e.detail}</p>
                    <Button size="sm" pressed={sel === e} onClick={() => setSel(sel === e ? null : e)}>
                      {sel === e ? 'Showing' : 'Show the sky then'}
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </Split>
    </Page>
  );
}
