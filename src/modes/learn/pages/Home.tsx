import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { tonight } from '@/astro';
import { pathUnits } from '@/content';
import { formatTime } from '@/lib/time';
import { UNIT_PASS_SCORE } from '@/store/progress';
import { Chip, Loading, Meter } from '@/ui';
import { LocationLine, Page } from '../components/common';
import { useLearnEnv, usePathNames, useProgressLike } from '../hooks';
import { STAGE_TITLES, pathOverview, type PathOverview } from '../logic/path';
import { moonSentence, placePhrase } from '../logic/tonight';

const STEP_VERB = { lesson: 'Lesson', constellation: 'Constellation', asterism: 'Star pattern', quiz: 'Quiz' } as const;

const REFERENCE: [string, string, string][] = [
  ['/learn/tonight', 'Tonight', 'What is up after dark, and when to look'],
  ['/learn/month', 'Monthly sky guides', 'A tour of each month’s evening sky'],
  ['/learn/calendar', 'Visibility calendar', 'When every constellation and planet can be seen'],
  ['/learn/signposts', 'Seasonal signposts', 'Five big patterns that point to everything else'],
  ['/learn/events', 'Events this year', 'Oppositions, meteor showers, eclipses'],
  ['/learn/constellations', 'All 88 constellations', 'Find them, learn their stories'],
  ['/learn/objects', 'Objects', 'Clusters, nebulae, galaxies, planets'],
  ['/learn/lessons', 'All lessons', 'Skills, how the sky moves, what things are'],
];

export default function Home() {
  const env = useLearnEnv();
  const progress = useProgressLike();
  const names = usePathNames(env?.catalog ?? null);
  const overview = useMemo(() => pathOverview(pathUnits, progress, names, UNIT_PASS_SCORE), [progress, names]);
  if (!env) return <Loading />;
  const cur = overview.current;
  return (
    <Page>
      <header className="ln-hero">
        <div>
          <h1>Learn the night sky</h1>
          <p className="ln-lede">One short step at a time: a skill, a constellation, a story. Start with the bright anchors, then fill in the rest.</p>
        </div>
        {cur ? (
          <Link className="ln-continue" to={cur.step.href}>
            <span className="dim">{overview.units.some((u) => u.summary.started) ? 'Continue' : 'Start here'} · {cur.unit.title}</span>
            <strong>
              {STEP_VERB[cur.step.kind]}: {cur.step.title}
            </strong>
            <span className="btn btn--primary">{cur.step.kind === 'quiz' ? 'Take the quiz' : 'Continue'}</span>
          </Link>
        ) : (
          <div className="ln-continue">
            <strong>You have passed every unit.</strong>
            <Link className="btn btn--primary" to="/quiz">
              Keep it fresh with a quiz
            </Link>
          </div>
        )}
      </header>

      <div className="ln-home-grid">
        <div>
          {[1, 2, 3].map((stage) => (
            <StageBlock key={stage} stage={stage} overview={overview} />
          ))}
        </div>
        <aside className="ln-home-side">
          <TonightCard />
          <div className="ln-ref">
            <h4>Reference</h4>
            {REFERENCE.map(([to, title, sub]) => (
              <Link key={to} to={to} className="ln-ref-link">
                <strong>{title}</strong>
                <span className="dim">{sub}</span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}

function StageBlock({ stage, overview }: { stage: number; overview: PathOverview }) {
  const units = overview.units.filter((u) => u.unit.stage === stage);
  if (!units.length) return null;
  return (
    <section className="ln-stage-block">
      <div className="ln-stage-head">
        <h2>
          <span className="ln-stage-num">{stage}</span> {STAGE_TITLES[stage].title}
        </h2>
        <p className="dim">{STAGE_TITLES[stage].blurb}</p>
      </div>
      <ol className="ln-units">
        {units.map(({ unit, summary, state, next }) => (
          <li key={unit.id} className={`ln-unit is-${state}`}>
            <div className="ln-unit-rail" aria-hidden>
              <span>{state === 'passed' ? '✓' : ''}</span>
            </div>
            <div className="card ln-unit-card">
              <div className="ln-unit-top">
                <Link to={`/learn/unit/${unit.id}`} className="ln-unit-title">
                  {unit.title}
                </Link>
                {state === 'passed' && <Chip tone="good">Passed</Chip>}
                {state === 'current' && <Chip tone="amber">You are here</Chip>}
                {state === 'up-next' && <Chip>Up next</Chip>}
                {state === 'later' && <Chip>Later</Chip>}
              </div>
              <p className="dim ln-unit-blurb">{unit.blurb}</p>
              <Meter value={summary.fraction} label={`${unit.title}: progress`} />
              <div className="ln-unit-stats dim">
                {summary.lessonsTotal > 0 && (
                  <span>
                    {summary.lessonsDone}/{summary.lessonsTotal} lessons
                  </span>
                )}
                <span>
                  {summary.consSeen}/{summary.consTotal} constellations
                </span>
                <span>Quiz: {summary.score == null ? 'not taken' : `${Math.round(summary.score * 100)}%`}</span>
              </div>
              <div className="row row--wrap">
                {next && (
                  <Link to={next.href} className={`btn btn--sm${state === 'current' ? ' btn--primary' : ''}`}>
                    {summary.started ? 'Continue' : state === 'current' ? 'Start' : 'Skip ahead'}: {next.title}
                  </Link>
                )}
                <Link to={`/learn/unit/${unit.id}`} className="btn btn--sm btn--quiet">
                  See the unit
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TonightCard() {
  const env = useLearnEnv();
  const t = useMemo(() => (env ? tonight(env.nightDate, env.observer, env.catalog) : null), [env]);
  if (!env || !t) return null;
  const tz = env.observer.tz;
  const planets = t.planets.filter((p) => p.visibility.cls !== 'not-visible' && !['Uranus', 'Neptune'].includes(p.name));
  const cons = t.constellations.filter((c) => c.visibility.cls !== 'not-visible').sort((a, b) => b.visibility.bestAlt - a.visibility.bestAlt);
  const evening = cons.filter((c) => c.visibility.cls !== 'morning').slice(0, 4);
  return (
    <div className="card ln-tonight-card">
      <div className="ln-section-head">
        <h4>Tonight</h4>
        <Link to="/learn/tonight">Full list</Link>
      </div>
      <p className="ln-small">
        Sunset {formatTime(t.night.sunset, tz)} · dark by {formatTime(t.night.nauticalDusk, tz)}
        <br />
        Moon: {moonSentence(t.moon.phase.name, t.moon.phase.illumination)}
      </p>
      <ul className="ln-plain">
        {planets.map((p) => (
          <li key={p.ref}>
            <strong>{p.name}</strong> <span className="dim">{placePhrase(p, tz)}</span>
          </li>
        ))}
        {!planets.length && <li className="dim">No bright planets in the night sky tonight.</li>}
        {evening.map((c) => (
          <li key={c.ref}>
            <Link to={`/learn/constellation/${c.ref.slice(4)}`}>{c.name}</Link> <span className="dim">{placePhrase(c, tz)}</span>
          </li>
        ))}
      </ul>
      <LocationLine />
    </div>
  );
}
