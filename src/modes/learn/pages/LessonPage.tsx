import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { lessonById, pathUnits, type Lesson } from '@/content';
import { useProgress } from '@/store/progress';
import { Button, Loading, McqQuestion, Prose, RichText } from '@/ui';
import type { SkyController } from '@/types';
import { Crumbs, Empty, Page, Split } from '../components/common';
import { DemoPlayer } from '../components/DemoPlayer';
import { SkyStage } from '../components/SkyStage';
import { objectHref, showInSky, useLearnEnv, type LearnEnv } from '../hooks';
import { unitOfLesson } from '../logic/path';
import { placeTarget } from '../logic/place';
import { LESSON_UNITS } from './LessonsIndex';

type Screen = { kind: 'section'; index: number } | { kind: 'examples' } | { kind: 'key' } | { kind: 'questions' };

function screensOf(l: Lesson): Screen[] {
  return [...l.sections.map((_, index): Screen => ({ kind: 'section', index })), ...(l.examples.length ? [{ kind: 'examples' } as Screen] : []), { kind: 'key' }, { kind: 'questions' }];
}

const pathLessonOrder = pathUnits.flatMap((u) => u.lessons);

export default function LessonPage() {
  const { id = '' } = useParams();
  const lesson = lessonById.get(id);
  const env = useLearnEnv();
  const [params, setParams] = useSearchParams();
  const screens = useMemo(() => (lesson ? screensOf(lesson) : []), [lesson]);
  const at = Math.min(Math.max(0, Number(params.get('s') ?? 0) || 0), Math.max(0, screens.length - 1));
  const go = (n: number) => {
    setParams(n ? { s: String(n) } : {}, { replace: false });
    document.querySelector('.app-main')?.scrollTo({ top: 0 });
  };
  if (!lesson)
    return (
      <Page>
        <Empty>This lesson has not been written yet.</Empty>
        <Link to="/learn/lessons">All lessons</Link>
      </Page>
    );
  if (!env) return <Loading />;
  const unit = unitOfLesson(pathUnits, lesson.id);
  const screen = screens[at];
  const nav = (
    <div className="ln-lesson-nav">
      <Button disabled={at === 0} onClick={() => go(at - 1)}>
        Back
      </Button>
      {at < screens.length - 1 && (
        <Button variant="primary" onClick={() => go(at + 1)}>
          {screens[at + 1].kind === 'questions' ? 'Practice questions' : 'Continue'}
        </Button>
      )}
    </div>
  );
  return (
    <Page wide>
      <Crumbs items={[['Lessons', '/learn/lessons'], ...(unit ? [[unit.title, `/learn/unit/${unit.id}`] as [string, string]] : [[LESSON_UNITS.find((u) => u.id === lesson.unit)?.title ?? lesson.unit] as [string]]), [lesson.title]]} />
      <header className="ln-lesson-head">
        <h1>{lesson.title}</h1>
        <p className="ln-lede">
          {lesson.subtitle} <span className="dim ln-nowrap">· {lesson.minutes} min</span>
        </p>
        <div className="ln-progress" role="progressbar" aria-valuemin={1} aria-valuemax={screens.length} aria-valuenow={at + 1} aria-label="Place in the lesson">
          {screens.map((s, i) => (
            <button key={i} type="button" className={i < at ? 'is-past' : i === at ? 'is-on' : ''} aria-label={`Go to part ${i + 1}`} onClick={() => go(i)} />
          ))}
        </div>
      </header>
      {screen.kind === 'section' && <SectionScreen key={at} lesson={lesson} index={screen.index} env={env} nav={nav} demoStep={Number(params.get('d') ?? 0) || 0} />}
      {screen.kind === 'examples' && <ExamplesScreen lesson={lesson} env={env} nav={nav} />}
      {screen.kind === 'key' && (
        <div className="ln-narrow">
          <h2 className="ln-h">Key points</h2>
          <ul className="ln-keypoints prose">
            {lesson.keyPoints.map((k, i) => (
              <li key={i}>
                <RichText text={k} />
              </li>
            ))}
          </ul>
          {nav}
        </div>
      )}
      {screen.kind === 'questions' && <Questions lesson={lesson} onBack={() => go(at - 1)} />}
    </Page>
  );
}

function SectionScreen({ lesson, index, env, nav, demoStep }: { lesson: Lesson; index: number; env: LearnEnv; nav: JSX.Element; demoStep: number }) {
  const section = lesson.sections[index];
  const ctl = useRef<SkyController | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const onTarget = section.demo ? (ref: string) => setNote(showInSky(ctl.current, env.catalog, ref)) : undefined;
  const text = (
    <>
      {section.heading && <h2 className="ln-h">{section.heading}</h2>}
      <Prose paragraphs={section.body} onTarget={onTarget} />
      {section.tryIt && (
        <aside className="ln-tryit">
          <strong>Try it outside</strong>
          <p>
            <RichText text={section.tryIt} onTarget={onTarget} />
          </p>
        </aside>
      )}
      {nav}
    </>
  );
  if (!section.demo) return <div className="ln-narrow">{text}</div>;
  return <Split sky={<DemoPlayer demo={section.demo} ctx={env} initialStep={demoStep} onController={(c) => (ctl.current = c)} onTarget={onTarget} note={note} />}>{text}</Split>;
}

function ExamplesScreen({ lesson, env, nav }: { lesson: Lesson; env: LearnEnv; nav: JSX.Element }) {
  const [sel, setSel] = useState(0);
  const ex = lesson.examples[sel];
  const placed = useMemo(() => {
    const t = env.catalog.resolve(ex.ref, { date: env.now, observer: env.observer });
    if (!t) return null;
    return placeTarget(ex.ref, t.body ?? { ra: t.ra, dec: t.dec }, env.nightDate, env, { fov: Math.max(t.fov ?? 30, 30), highlights: [{ type: 'object', ref: ex.ref, label: true }], layers: { dsoMarkers: true } });
  }, [ex, env]);
  return (
    <Split
      sky={
        placed ? (
          <SkyStage scene={placed.scene} exploreTarget={ex.ref} note={placed.mode === 'chart' ? `${placed.scene.target?.name ?? 'This'} is not in tonight's sky from ${env.observer.name}. Shown as a star chart.` : null} />
        ) : (
          <Empty>This example is not in the catalog.</Empty>
        )
      }
    >
      <h2 className="ln-h">Real examples to visit</h2>
      <p className="dim">Pick one to see where it is. On nights when it is up, the view shows it at its best time tonight.</p>
      <ul className="ln-examples">
        {lesson.examples.map((e, i) => (
          <li key={e.ref} className={`card${i === sel ? ' is-on' : ''}`}>
            <button type="button" className="ln-example-main" aria-pressed={i === sel} onClick={() => setSel(i)}>
              <strong>{e.label}</strong>
              <span className="dim">{e.note}</span>
            </button>
            <Link to={objectHref(e.ref)} className="ln-small">
              Object page
            </Link>
          </li>
        ))}
      </ul>
      {nav}
    </Split>
  );
}

function Questions({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const record = useProgress((s) => s.record);
  const markLessonDone = useProgress((s) => s.markLessonDone);
  const [q, setQ] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [right, setRight] = useState(0);
  const total = lesson.questions.length;
  const finished = q >= total;
  useEffect(() => {
    if (finished) markLessonDone(lesson.id);
  }, [finished, lesson.id, markLessonDone]);
  const unit = unitOfLesson(pathUnits, lesson.id);
  const pi = pathLessonOrder.indexOf(lesson.id);
  const next = pi >= 0 ? pathLessonOrder.slice(pi + 1).map((x) => lessonById.get(x)).find((x) => !!x) : undefined;
  const nextInUnit = unit && next && unit.lessons.includes(next.id);
  if (finished)
    return (
      <div className="ln-narrow ln-done">
        <h2 className="ln-h">Lesson complete</h2>
        <p className="ln-lede">
          You got {right} of {total} right{right === total ? '. Spotless.' : '. The ones you missed will come back in your reviews.'}
        </p>
        <div className="row row--wrap">
          {unit && nextInUnit && next && (
            <Link className="btn btn--primary" to={`/learn/lesson/${next.id}`}>
              Next lesson: {next.title}
            </Link>
          )}
          {unit && (
            <Link className={`btn${nextInUnit ? '' : ' btn--primary'}`} to={`/learn/unit/${unit.id}`}>
              Back to the unit
            </Link>
          )}
          {!unit && next && (
            <Link className="btn btn--primary" to={`/learn/lesson/${next.id}`}>
              Next lesson: {next.title}
            </Link>
          )}
          <Button
            variant="quiet"
            onClick={() => {
              setQ(0);
              setRight(0);
              setAnswered(false);
            }}
          >
            Try the questions again
          </Button>
          <Link className="btn btn--quiet" to="/learn/lessons">
            All lessons
          </Link>
        </div>
      </div>
    );
  const question = lesson.questions[q];
  return (
    <div className="ln-narrow">
      <h2 className="ln-h">Practice</h2>
      <McqQuestion
        key={question.id}
        question={question}
        label={`Question ${q + 1} of ${total}`}
        onAnswer={(correct) => {
          record(`know:${lesson.id}:${question.id}`, 'knowledge', correct ? 2 : 0);
          if (correct) setRight((r) => r + 1);
          setAnswered(true);
        }}
      />
      <div className="ln-lesson-nav">
        <Button disabled={q > 0 || answered} onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={!answered}
          onClick={() => {
            setAnswered(false);
            setQ(q + 1);
          }}
        >
          {q === total - 1 ? 'Finish' : 'Next question'}
        </Button>
      </div>
    </div>
  );
}
