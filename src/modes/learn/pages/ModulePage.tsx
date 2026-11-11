/** One course module: purpose, objectives, its lessons / star-hops / constellation groups, progress and the closing quiz. */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bestMonths, constellationPoints } from '@/astro';
import { lessonById, starhopById } from '@/content';
import type { ConstellationGroup, ResolvedModule } from '@/content/course';
import { useCatalog, type Catalog } from '@/data/catalog';
import { routes } from '@/lib/routes';
import { UNIT_PASS_SCORE } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { Chip, Loading, Meter } from '@/ui';
import { Check, ConFigure, Crumbs, Empty, Page } from '../components/common';
import { isMastered, moduleProgress, monthRange, travelPhrase, useCourse, useCourseProgress, type ProgressInput } from '../logic/course';
import { moduleCounts } from './Home';

export default function ModulePage() {
  const { id = '' } = useParams();
  const catalog = useCatalog();
  const course = useCourse(catalog);
  const progress = useCourseProgress();
  if (!course || !catalog) return <Loading label="Loading the course…" />;
  const i = course.modules.findIndex((m) => m.id === id);
  const m = course.modules[i];
  if (!m)
    return (
      <Page>
        <Empty>There is no module with that name.</Empty>
        <Link to={routes.learn()}>Back to the course</Link>
      </Page>
    );
  const pr = moduleProgress(m, progress, (c) => catalog.conById.get(c)?.name ?? c);
  const prev = course.modules[i - 1];
  const next = course.modules[i + 1];
  return (
    <Page>
      <Crumbs items={[['The course', routes.learn()], [`Module ${m.number}`]]} />
      <header className="ln-head">
        <p className="ln-kicker">Module {m.number} of {course.modules.length}{m.optional ? ' · optional' : ''}</p>
        <h1>{m.title}</h1>
        <p className="ln-lede">{m.purpose}</p>
      </header>

      <section className="card ln-mod-goals">
        <h2 className="ln-h3">By the end of this module you will be able to</h2>
        <ul>
          {m.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <div className="ln-unit-stats dim">{moduleCounts(m, pr)}</div>
        <Meter value={pr.fraction} label="Module progress" />
        <div className="ln-unit-stats dim">
          {pr.lessonsTotal > 0 && <span>{pr.lessonsDone}/{pr.lessonsTotal} lessons done</span>}
          {pr.consTotal > 0 && <span>{pr.consSeen}/{pr.consTotal} constellations seen · {pr.consMastered} mastered</span>}
          <span>Quiz: {pr.score == null ? 'not taken' : `best ${Math.round(pr.score * 100)}%`}</span>
        </div>
        {!pr.done && (
          <div className="row">
            <Link className="btn btn--primary btn--sm" to={pr.next.href}>
              {pr.started ? 'Continue' : 'Start'}: {pr.next.title}
            </Link>
          </div>
        )}
      </section>

      {m.lessons.length > 0 && <LessonList m={m} progress={progress} />}
      {m.kind === 'starhops' && <StarhopList ids={m.starhopIds} />}
      {(m.kind === 'anchors' || m.kind === 'seasons' || m.kind === 'beyond') && <GroupList m={m} catalog={catalog} progress={progress} />}

      <section className="card ln-mod-quiz">
        <div>
          <h2 className="ln-h3">Practice this module</h2>
          <p className="dim ln-small">
            A short quiz on everything in this module. Pass at {Math.round(UNIT_PASS_SCORE * 100)}%.
            {pr.score != null && ` Your best so far: ${Math.round(pr.score * 100)}%.`}
          </p>
        </div>
        <Link className={`btn${pr.passed ? '' : ' btn--primary'}`} to={routes.moduleQuiz(m.id)}>
          {pr.score == null ? 'Take the quiz' : pr.passed ? 'Practise again' : 'Try again'}
        </Link>
      </section>

      <nav className="ln-prevnext" aria-label="Modules">
        {prev ? <Link to={routes.module(prev.id)}>← Module {prev.number}: {prev.title}</Link> : <Link to={routes.learn()}>← The course</Link>}
        {next ? <Link to={routes.module(next.id)}>Module {next.number}: {next.title} →</Link> : <Link to={routes.learn()}>The course →</Link>}
      </nav>
    </Page>
  );
}

function LessonList({ m, progress }: { m: ResolvedModule; progress: ProgressInput }) {
  const list = m.lessons;
  const written = list.filter((id) => lessonById.has(id));
  return (
    <section className="ln-section">
      <div className="ln-section-head">
        <h3>Lessons</h3>
      </div>
      <ol className="ln-checklist">
        {list.map((id) => {
          const l = lessonById.get(id);
          const k = written.indexOf(id) + 1;
          return (
            <li key={id}>
              {l ? (
                <Link to={routes.lesson(id)} className="ln-step">
                  <Check done={!!progress.lessonsDone[id]} />
                  <span className="grow">
                    <span className="dim ln-small">Lesson {k} · </span>
                    <strong>{l.title}</strong>
                    <span className="dim ln-small"> · {l.minutes} min</span>
                    <span className="dim ln-small ln-step-sub">{l.subtitle}</span>
                  </span>
                </Link>
              ) : (
                <span className="ln-step is-off">
                  <Check done={false} />
                  <span className="grow dim">{id.replace(/-/g, ' ')} (not written yet)</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StarhopList({ ids }: { ids: string[] }) {
  return (
    <section className="ln-section">
      <div className="ln-section-head">
        <h3>The star-hops</h3>
        <Link to={routes.starhops()} className="ln-small">All star-hops</Link>
      </div>
      {ids.length === 0 ? (
        <Empty>The star-hops for your location are not ready yet. The lesson above teaches the three methods.</Empty>
      ) : (
        <ol className="ln-checklist">
          {ids.map((id, i) => {
            const h = starhopById.get(id)!;
            return (
              <li key={id}>
                <Link to={routes.starhop(id)} className="ln-step">
                  <span className="ln-step-num" aria-hidden>{i + 1}</span>
                  <span className="grow">
                    <strong>{h.name}</strong>
                    <span className="dim ln-small ln-step-sub">{h.summary}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function GroupList({ m, catalog, progress }: { m: ResolvedModule; catalog: Catalog; progress: ProgressInput }) {
  const observer = useSettings((s) => s.observer);
  const best = useMemo(() => {
    const out = new Map<string, string>();
    if (m.kind === 'beyond') return out;
    for (const g of m.groups)
      for (const id of g.constellations) {
        const c = catalog.conById.get(id);
        if (c) out.set(id, monthRange(bestMonths({ points: constellationPoints(c, catalog) }, observer)));
      }
    return out;
  }, [m, catalog, observer]);
  if (!m.groups.length) return <Empty>Every constellation rises from {observer.name}, so there is nothing beyond your horizon.</Empty>;
  return (
    <>
      {m.groups.map((g: ConstellationGroup) => (
        <section key={g.id} className="ln-section">
          <div className="ln-section-head">
            <h3>{m.kind === 'beyond' ? `Never above the horizon from ${observer.name}` : g.title}</h3>
            <span className="dim ln-small">{g.constellations.length} constellation{g.constellations.length === 1 ? "" : "s"}</span>
          </div>
          <div className="ln-con-grid">
            {g.constellations.map((id) => {
              const c = catalog.conById.get(id);
              if (!c) return null;
              const sub = m.kind === 'beyond' ? travelPhrase(constellationPoints(c, catalog).map((p) => p.dec), observer.lat) : best.get(id) ? `Best in the evening: ${best.get(id)}` : '';
              return (
                <Link key={id} to={routes.constellation(id)} className="card ln-con-card">
                  <ConFigure con={c} size={56} />
                  <span className="grow">
                    <strong>{c.name}</strong>
                    <span className="dim ln-small">{c.english}</span>
                    {sub && <span className="faint ln-small">{sub}</span>}
                  </span>
                  <span className="ln-con-card-state">
                    {isMastered(progress.items, id) ? <Chip tone="good">Mastered</Chip> : progress.seen[id] ? <Chip>Seen</Chip> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
