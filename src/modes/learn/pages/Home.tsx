/** Learn home: the course as a numbered path of 8 modules with one "continue" action. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '@/data/catalog';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import { Chip, Loading, Meter } from '@/ui';
import { Page } from '../components/common';
import { courseOverview, useCourse, useCourseProgress, type ModuleProgress } from '../logic/course';
import type { ResolvedModule } from '@/content/course';

export function useWide(query = '(min-width: 721px)'): boolean {
  const [wide, setWide] = useState(() => typeof window === 'undefined' || window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return wide;
}

export function moduleCounts(m: ResolvedModule, pr: ModuleProgress): string {
  const parts: string[] = [];
  if (pr.lessonsTotal) parts.push(`${pr.lessonsTotal} lesson${pr.lessonsTotal === 1 ? '' : 's'}`);
  if (m.kind === 'starhops') parts.push(`${pr.starhops || m.starhopCount || 0} star-hops`);
  if (pr.consTotal) parts.push(`${pr.consTotal} constellation${pr.consTotal === 1 ? '' : 's'}`);
  if (m.groups.length > 1) parts.push(`${m.groups.length} groups`);
  parts.push('module quiz');
  return parts.join(' · ');
}

export default function Home() {
  const catalog = useCatalog();
  const observer = useSettings((s) => s.observer);
  const course = useCourse(catalog);
  const progress = useCourseProgress();
  const wide = useWide();
  const overview = useMemo(() => (course && catalog ? courseOverview(course, progress, (id) => catalog.conById.get(id)?.name ?? id) : null), [course, catalog, progress]);
  if (!overview) return <Loading label="Loading the course…" />;
  const cur = overview.current;
  const anyStarted = overview.modules.some((x) => x.progress.started);
  return (
    <Page>
      <header className="ln-hero">
        <div>
          <h1>Learn the night sky</h1>
          <p className="ln-lede">
            A course in eight modules: how to look, how the sky moves, how to find your way, then every constellation you can see from{' '}
            <strong>{observer.name}</strong>, and what is out there. Each module ends with a short quiz.
          </p>
        </div>
        {cur ? (
          <Link className="ln-continue" to={cur.progress.next.href}>
            <span className="dim">
              {anyStarted ? 'Continue where you left off' : 'Start here'} · Module {cur.module.number}: {cur.module.title}
            </span>
            <strong>
              {cur.progress.next.label}: {cur.progress.next.title}
            </strong>
            <span className="btn btn--primary">{anyStarted ? 'Continue' : 'Start the course'}</span>
          </Link>
        ) : (
          <div className="ln-continue">
            <strong>You have finished the course.</strong>
            <Link className="btn btn--primary" to={routes.review()}>
              Keep it fresh with a review
            </Link>
          </div>
        )}
      </header>

      <ol className="ln-units ln-modules" aria-label="Course modules">
        {overview.modules.map(({ module: m, progress: pr }) => {
          const isCur = cur?.module.id === m.id;
          return (
            <li key={m.id} className={`ln-unit${pr.done ? ' is-passed' : isCur ? ' is-current' : ''}`}>
              <div className="ln-unit-rail" aria-hidden>
                <span className="ln-mod-num">{pr.done ? '✓' : m.number}</span>
              </div>
              <div className="card ln-unit-card">
                <div className="ln-unit-top">
                  <Link to={routes.module(m.id)} className="ln-unit-title">
                    <span className="dim">Module {m.number} · </span>
                    {m.title}
                  </Link>
                  {pr.done && <Chip tone="good">Done</Chip>}
                  {isCur && <Chip tone="amber">{pr.started ? 'In progress' : 'Up next'}</Chip>}
                  {m.optional && <Chip>Optional</Chip>}
                </div>
                <p className="ln-unit-blurb">{m.purpose}</p>
                <details className="ln-mod-obj" open={wide}>
                  <summary>What you will be able to do</summary>
                  <ul>
                    {m.objectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </details>
                <div className="ln-unit-stats dim">{moduleCounts(m, pr)}</div>
                <Meter value={pr.fraction} label={`Module ${m.number}: progress`} />
                <div className="ln-unit-stats dim">
                  {pr.lessonsTotal > 0 && (
                    <span>
                      {pr.lessonsDone}/{pr.lessonsTotal} lessons done
                    </span>
                  )}
                  {pr.consTotal > 0 && (
                    <span>
                      {pr.consSeen}/{pr.consTotal} seen · {pr.consMastered} mastered
                    </span>
                  )}
                  <span>Quiz: {pr.score == null ? 'not taken' : `${Math.round(pr.score * 100)}%`}</span>
                </div>
                <div className="row row--wrap">
                  <Link to={pr.next.href} className={`btn btn--sm${isCur ? ' btn--primary' : ''}`}>
                    {pr.done ? 'Review' : pr.started ? 'Continue' : 'Start'}
                  </Link>
                  <Link to={routes.module(m.id)} className="btn btn--sm btn--quiet">
                    Open the module
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
