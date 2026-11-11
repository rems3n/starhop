/** The quiz screens: hub and one page per quiz type. Each page builds a list of questions and hands it to <Session>. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { courseModules } from '@/content';
import { routes } from '@/lib/routes';
import { dueItems, UNIT_PASS_SCORE, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { Button, Loading, Meter, Segmented, Switch } from '@/ui';
import { DifficultyPanel } from './DifficultyPanel';
import { listStories, objectBuilders, plainText } from './logic/build';
import { composeModuleQuiz, moduleConstellations, moduleHopIds } from './logic/module';
import { hopsFor, monthsLabel, type HopMode } from './logic/starhop';
import { planetsUp } from './logic/knowledge';
import { poolLabel } from './logic/pools';
import { liveRng } from './logic/rng';
import { nextDue, untilWords, weakestConstellations } from './logic/select';
import {
  buildFindSession, buildKnowledgeSession, buildLessonSession, buildMythSession, buildNameSession, buildObjectSession, buildReviewSession, buildStarhopSession, buildStorySession,
  buildVisibilitySession, buildWeakestSession, courseGroups, lessonsInGroup, getTonight, poolIds, REVIEW_BATCH,
} from './logic/sessions';
import type { Question, QuizData, SessionLength } from './logic/types';
import { useQuizPrefs } from './prefs';
import { Session } from './Session';
import { useQuizData } from './useQuizData';

const LENGTHS: { value: string; label: string }[] = [
  { value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }, { value: 'all', label: 'All' },
];
function LengthPicker() {
  const length = useQuizPrefs((s) => s.length);
  const set = useQuizPrefs((s) => s.set);
  return <Segmented label="Questions per round" value={String(length)} options={LENGTHS} onChange={(v) => set({ length: v === 'all' ? 'all' : (Number(v) as SessionLength) })} />;
}

function Page({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="page qz-page">
      <p className="qz-crumb">
        <Link to={routes.practice()}>Practice</Link>
      </p>
      <h2>{title}</h2>
      {lead && <p className="dim qz-lead">{lead}</p>}
      {children}
    </div>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page title={title}>
      <div className="card qz-empty" data-testid="empty">
        {children}
        <p>
          <Link className="btn" to={routes.practice()}>
            Back to practice
          </Link>
        </p>
      </div>
    </Page>
  );
}

interface Run {
  id: number;
  questions: Question[];
}
/** Holds the running session; `start` builds a new one. */
function useRun(build: () => Question[]) {
  const [run, setRun] = useState<Run | null>(null);
  const start = useCallback(() => setRun({ id: Date.now(), questions: build() }), [build]);
  return { run, start, stop: () => setRun(null) };
}

function useArgs(data: QuizData | null) {
  const diff = useSettings((s) => s.difficulty);
  const length = useQuizPrefs((s) => s.length);
  return useCallback(() => ({ data: data!, diff, length, items: useProgress.getState().items, rng: liveRng() }), [data, diff, length]);
}

// ───────────── hub

export const weakestRoute = () => `${routes.practice()}/weakest`;

const TYPES: { to: string; title: string; text: string }[] = [
  { to: routes.quiz('find'), title: 'Find it', text: 'You get a name. Draw a loop around that constellation in the sky.' },
  { to: routes.quiz('name'), title: 'Name it', text: 'A constellation is highlighted. Pick its name, or type it.' },
  { to: routes.quiz('starhop'), title: 'Star-hops', text: 'Follow a hop from stars you know to the one it leads to, or say where a hop ends.' },
  { to: routes.quiz('object'), title: 'Stars and objects', text: 'Name the ringed star or deep-sky object, or identify one from a photograph.' },
  { to: routes.quiz('story'), title: 'Myths', text: 'The stories behind the figures: who did what, and which constellation it belongs to.' },
  { to: routes.quiz('knowledge'), title: 'Sky knowledge', text: 'What is up when from your location, plus questions from the lessons.' },
  { to: routes.quiz('visibility'), title: 'When is it up?', text: 'Only the visibility questions: months, what never sets, tonight’s planets.' },
];

export function Hub() {
  const data = useQuizData();
  const items = useProgress((s) => s.items);
  const scores = useProgress((s) => s.unitScores);
  const diff = useSettings((s) => s.difficulty);
  if (!data) return <Loading label="Loading practice…" />;
  const now = Date.now();
  const due = dueItems(items, now).length;
  const upcoming = nextDue(items, now);
  const weakest = weakestConstellations(items, data.catalog.constellations.map((c) => c.id), 5);
  return (
    <div className="page qz-page qz-hub">
      <header className="qz-hub-head">
        <div>
          <h2>Practice</h2>
          <p className="dim qz-lead">Short rounds with instant feedback. What you miss comes back sooner; what you know comes back later.</p>
        </div>
        <div className="qz-review-box card" data-testid="review-box">
          <div>
            <strong data-testid="due-count">{due}</strong> {due === 1 ? 'item' : 'items'} due for review
            <div className="faint qz-small">{due ? 'Weakest first, each in its own format.' : upcoming ? `Next review ${untilWords(upcoming - now)}.` : 'Answer a few questions and they will start coming back here.'}</div>
          </div>
          <Link className={`btn${due ? ' btn--primary' : ''}`} to={routes.review()}>
            Review
          </Link>
        </div>
      </header>

      <div className="qz-hub-grid">
        <div className="qz-hub-main">
          <div className="qz-length">
            <span className="dim">Questions per round</span>
            <LengthPicker />
            <span className="faint qz-small">Drawing from: {poolLabel(diff.pool, { units: data.units, groups: courseGroups(data) })}</span>
          </div>
          <div className="qz-types">
            {TYPES.map((t) => (
              <Link key={t.to} to={t.to} className="card qz-type-card">
                <h4>{t.title}</h4>
                <p className="dim">{t.text}</p>
              </Link>
            ))}
            <Link to={routes.progress()} className="card qz-type-card">
              <h4>Progress</h4>
              <p className="dim">Mastery by course module, star-hops and myths, and your module quiz scores.</p>
            </Link>
          </div>
          <section className="qz-weak" data-testid="hub-modules">
            <h4>Practise a module</h4>
            <p className="dim qz-small">Each course module ends in a short quiz. Score {Math.round(UNIT_PASS_SCORE * 100)}% or more to complete it.</p>
            <ul className="qz-modules">
              {courseModules.map((m) => {
                const sc = scores[m.id];
                return (
                  <li key={m.id}>
                    <span className="qz-mod-num">{m.number}</span>
                    <Link className="qz-mod-title" to={routes.moduleQuiz(m.id)}>{m.title}</Link>
                    {sc == null ? <span className="faint qz-small">not taken</span> : <span className={`qz-small ${sc >= UNIT_PASS_SCORE ? 'qz-good' : 'dim'}`}>{Math.round(sc * 100)}%{sc >= UNIT_PASS_SCORE ? ' · passed' : ''}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="qz-weak">
            <h4>Your weakest constellations</h4>
            {weakest.length ? (
              <>
                <ul className="qz-weak-list">
                  {weakest.map((w) => {
                    const c = data.catalog.conById.get(w.id)!;
                    return (
                      <li key={w.id}>
                        <span className="qz-weak-name">{c.name}</span>
                        <Meter value={w.score} label={`${c.name} mastery`} />
                        <span className="faint qz-small">{Math.round(w.score * 100)}%</span>
                        <Link className="btn btn--sm" to={routes.quiz('find', { con: w.id })}>Find</Link>
                        <Link className="btn btn--sm" to={routes.quiz('name', { con: w.id })}>Name</Link>
                      </li>
                    );
                  })}
                </ul>
                <Link className="btn" to={weakestRoute()}>Practise weakest</Link>
              </>
            ) : (
              <p className="dim">Nothing yet. Once you have tried a few, the ones that give you trouble are listed here.</p>
            )}
          </section>
        </div>
        <DifficultyPanel data={data} />
      </div>
    </div>
  );
}

// ───────────── find it / name it

export function FindPage() {
  const data = useQuizData();
  const [params] = useSearchParams();
  const con = params.get('con');
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildFindSession({ ...args(), con }), [args, con]));
  useEffect(() => {
    if (data && !run) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const diff = useSettings((s) => s.difficulty);
  if (!data || !run) return <Loading label="Setting up the sky…" />;
  if (!run.questions.length) return <NoPool title="Find it" data={data} spec={diff.pool} />;
  return <Session key={run.id} data={data} title="Find it" questions={run.questions} onNewRound={start} />;
}

function NoPool({ title, data, spec }: { title: string; data: QuizData; spec: string }) {
  return (
    <Empty title={title}>
      <p>
        There are no constellations to ask about in “{poolLabel(spec, { units: data.units, groups: courseGroups(data) })}” right now{spec === 'tonight' ? ' — nothing is well placed in tonight’s dark hours from your location' : ''}. Choose another set of constellations in the difficulty panel on
        the practice page.
      </p>
    </Empty>
  );
}

export function NamePage() {
  const data = useQuizData();
  const [params] = useSearchParams();
  const con = params.get('con');
  const typed = useQuizPrefs((s) => s.nameTyped);
  const setPrefs = useQuizPrefs((s) => s.set);
  const diff = useSettings((s) => s.difficulty);
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildNameSession({ ...args(), con, typed }), [args, con, typed]));
  useEffect(() => {
    if (data && con && !run) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, con]);
  useStartOnEnter(!run && !!data, start);
  if (!data || (con && !run)) return <Loading label="Setting up the sky…" />;
  if (run && !run.questions.length) return <NoPool title="Name it" data={data} spec={diff.pool} />;
  if (run) return <Session key={run.id} data={data} title="Name it" questions={run.questions} onNewRound={start} />;
  return (
    <Page title="Name it" lead="A constellation is highlighted in the sky with every label switched off. Say which one it is.">
      <div className="qz-setup">
        <div className="qz-setup-row">
          <span>How to answer</span>
          <Segmented label="How to answer" value={typed ? 'type' : 'pick'} options={[{ value: 'pick', label: 'Pick from 4' }, { value: 'type', label: 'Type it' }]} onChange={(v) => setPrefs({ nameTyped: v === 'type' })} />
        </div>
        {typed && <p className="faint qz-small">The Latin name, the three-letter abbreviation or the English name all count. Capitals and accents do not matter, and a small typo is forgiven.</p>}
        <SetupFoot data={data} start={start} />
      </div>
    </Page>
  );
}

function useStartOnEnter(active: boolean, start: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target as HTMLElement | null)?.closest?.('a, button, select, input')) start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, start]);
}

function SetupFoot({ data, start, disabled, usesPool = true }: { data: QuizData; start: () => void; disabled?: boolean; usesPool?: boolean }) {
  const diff = useSettings((s) => s.difficulty);
  return (
    <>
      <div className="qz-setup-row">
        <span>Questions per round</span>
        <LengthPicker />
      </div>
      {usesPool && (
        <p className="faint qz-small">
          Drawing from: {poolLabel(diff.pool, { units: data.units, groups: courseGroups(data) })}. <Link to={routes.practice()}>Change difficulty</Link>
        </p>
      )}
      <div>
        <Button variant="primary" onClick={start} disabled={disabled} data-testid="start">
          Start
        </Button>
      </div>
    </>
  );
}

// ───────────── objects

export function ObjectPage() {
  const data = useQuizData();
  const modes = useQuizPrefs((s) => s.objectModes);
  const setPrefs = useQuizPrefs((s) => s.set);
  const diff = useSettings((s) => s.difficulty);
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildObjectSession({ ...args(), modes }), [args, modes]));
  const counts = useMemo(() => (data ? objectBuilders(data.catalog, poolIds(data, diff.pool), { star: true, dso: true, image: true, type: true }, liveRng()).counts : null), [data, diff.pool]);
  useStartOnEnter(!run && !!data, start);
  if (!data || !counts) return <Loading />;
  if (run && !run.questions.length) return <Empty title="Stars and objects"><p>Not enough content yet for the kinds of question you switched on. Turn on another kind and try again.</p></Empty>;
  if (run) return <Session key={run.id} data={data} title="Stars and objects" questions={run.questions} onNewRound={start} />;
  const rows: { id: keyof typeof modes; label: string; note: string }[] = [
    { id: 'star', label: 'Which star is ringed?', note: `${counts.star} bright named stars` },
    { id: 'dso', label: 'Which deep-sky object is marked?', note: `${counts.dso} Messier objects and showpieces` },
    { id: 'image', label: 'Which object is in this picture?', note: `${counts.image} objects with pictures` },
    { id: 'type', label: 'What type of object is it?', note: `${counts.type} objects` },
  ];
  const any = rows.some((r) => modes[r.id] && counts[r.id] >= 4);
  return (
    <Page title="Stars and objects" lead="Bright stars, the Messier list and other showpieces — in the sky and in photographs.">
      <div className="qz-setup">
        {rows.map((r) => (
          <div key={r.id} className={counts[r.id] < 4 ? 'qz-off' : undefined}>
            <Switch checked={modes[r.id] && counts[r.id] >= 4} onChange={(v) => counts[r.id] >= 4 && setPrefs({ objectModes: { ...modes, [r.id]: v } })} label={<span>{r.label} <span className="faint qz-small">{counts[r.id] < 4 ? 'not enough content yet' : r.note}</span></span>} />
          </div>
        ))}
        <SetupFoot data={data} start={start} disabled={!any} />
      </div>
    </Page>
  );
}

// ───────────── stories

export function StoryPage() {
  const data = useQuizData();
  const [params] = useSearchParams();
  const con = params.get('con');
  const story = params.get('story');
  const modes = useQuizPrefs((s) => s.storyModes);
  const scope = useQuizPrefs((s) => s.storyScope);
  const setPrefs = useQuizPrefs((s) => s.set);
  const diff = useSettings((s) => s.difficulty);
  const args = useArgs(data);
  // ?story=<id>: exactly that myth — every question on it and its flashcard, started at once
  const { run, start } = useRun(useCallback(() => (story ? buildMythSession(args().data, story, liveRng()) : buildStorySession({ ...args(), con, story, modes, scope })), [args, con, story, modes, scope]));
  useEffect(() => {
    if (data && story && !run) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, story]);
  useStartOnEnter(!run && !!data, start);
  const stats = useMemo(() => {
    if (!data) return null;
    const all = listStories(data.content, data.catalog, con && !story ? [con] : undefined).filter((s) => !story || s.story.id === story);
    const pool = con ? all : listStories(data.content, data.catalog, poolIds(data, diff.pool));
    return { all, pool };
  }, [data, con, story, diff.pool]);
  if (!data || !stats || (story && stats.all.length && !run)) return <Loading />;
  const conName = con ? data.catalog.conById.get(con)?.name ?? con : null;
  if (!stats.all.length) {
    return (
      <Empty title="Myths">
        <p>
          {story ? 'That myth has not been written yet, or its link is out of date.' : conName ? `${conName} has no written story yet (or it is a modern constellation with no myth).` : 'No constellation stories have been written yet.'} Story questions appear here as
          the pages are added. <Link to={routes.myths()}>Browse all myths</Link>
        </p>
      </Empty>
    );
  }
  if (run && !run.questions.length) return <Empty title="Myths"><p>Not enough content yet for this choice. Switch on another kind of question, or choose “Every story written so far”.</p></Empty>;
  if (run && story) {
    const s0 = stats.all[0];
    return <Session key={run.id} data={data} title={`Myth · ${plainText(s0.story.title)}`} questions={run.questions} onNewRound={start} exitTo={routes.myth(story)} />;
  }
  if (run) return <Session key={run.id} data={data} title={conName ? `Myths · ${conName}` : 'Myths'} questions={run.questions} onNewRound={start} />;
  const inScope = con || scope === 'all' ? stats.all : stats.pool;
  return (
    <Page title={conName ? `Myths · ${conName}` : 'Myths'} lead={<>Each myth is its own item: a constellation with several stories is quizzed on every one of them separately. To practise one myth, open it from the <Link to={routes.myths()}>myth library</Link>.</>}>
      <div className="qz-setup">
        <Switch checked={modes.mcq} onChange={(v) => setPrefs({ storyModes: { ...modes, mcq: v } })} label="Questions about characters and events" />
        <Switch checked={modes.which} onChange={(v) => setPrefs({ storyModes: { ...modes, which: v } })} label="Which constellation is this myth about?" />
        <Switch checked={modes.card} onChange={(v) => setPrefs({ storyModes: { ...modes, card: v } })} label="Flashcards (you grade yourself)" />
        {!con && (
          <div className="qz-setup-row">
            <span>Stories from</span>
            <Segmented label="Stories from" value={scope} options={[{ value: 'all', label: 'Every story written so far' }, { value: 'pool', label: poolLabel(diff.pool, { units: data.units, groups: courseGroups(data) }) }]} onChange={(v) => setPrefs({ storyScope: v })} />
          </div>
        )}
        <p className="faint qz-small" data-testid="story-count">
          {inScope.length} {inScope.length === 1 ? 'story' : 'stories'} from {new Set(inScope.map((s) => s.con.id)).size} constellations in this selection.
        </p>
        <SetupFoot data={data} start={start} usesPool={false} disabled={!inScope.length || !(modes.mcq || modes.which || modes.card)} />
      </div>
    </Page>
  );
}

// ───────────── sky knowledge, lesson quiz

/** Lesson groups = the course's lesson modules (any module that lists lessons). */
const LESSON_GROUPS = [{ value: 'all', label: 'All lessons' }, ...courseModules.filter((m) => m.lessons?.length).map((m) => ({ value: m.id, label: m.title }))];

export function KnowledgePage() {
  const data = useQuizData();
  const modes = useQuizPrefs((s) => s.knowledgeModes);
  const lessonUnit = useQuizPrefs((s) => s.lessonUnit);
  const setPrefs = useQuizPrefs((s) => s.set);
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildKnowledgeSession({ ...args(), modes, lessonUnit }), [args, modes, lessonUnit]));
  useStartOnEnter(!run && !!data, start);
  const info = useMemo(() => (data ? { planets: planetsUp(getTonight(data).planets).map((p) => p.name), bank: lessonsInGroup(data.lessons, lessonUnit, courseModules).reduce((n, l) => n + (l.questions?.length ?? 0), 0) } : null), [data, lessonUnit]);
  if (!data || !info) return <Loading />;
  if (run && !run.questions.length) return <Empty title="Sky knowledge"><p>Not enough content yet for this choice. Switch on the other kind of question or pick another group of lessons.</p></Empty>;
  if (run) return <Session key={run.id} data={data} title="Sky knowledge" questions={run.questions} onNewRound={start} />;
  return (
    <Page title="Sky knowledge" lead={`Why the sky looks the way it does from ${data.observer.name}, and what the lessons teach.`}>
      <div className="qz-setup">
        <Switch checked={modes.computed} onChange={(v) => setPrefs({ knowledgeModes: { ...modes, computed: v } })} label={<span>Your own sky <span className="faint qz-small">what is up in which month and season, what never sets, how high Polaris stands{info.planets.length ? `, and tonight’s planets (${info.planets.join(', ')})` : ''}</span></span>} />
        <Switch checked={modes.lessons} onChange={(v) => setPrefs({ knowledgeModes: { ...modes, lessons: v } })} label={<span>Questions from the lessons <span className="faint qz-small">{info.bank} questions</span></span>} />
        {modes.lessons && (
          <div className="qz-setup-row">
            <span>Lessons</span>
            <select className="select" aria-label="Lesson group" value={LESSON_GROUPS.some((g) => g.value === lessonUnit) ? lessonUnit : 'all'} onChange={(e) => setPrefs({ lessonUnit: e.target.value })}>
              {LESSON_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        )}
        <SetupFoot data={data} start={start} disabled={!(modes.computed || (modes.lessons && info.bank > 0))} />
      </div>
    </Page>
  );
}

/** `/practice/visibility[?con=Abbr]`: the computed "when is it up?" questions only. Learn links here per constellation. */
export function VisibilityPage() {
  const data = useQuizData();
  const [params] = useSearchParams();
  const raw = params.get('con');
  const con = raw && data?.catalog.conById.has(raw) ? raw : null;
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildVisibilitySession({ ...args(), con }), [args, con]));
  useEffect(() => {
    if (data && con && !run) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, con]);
  useStartOnEnter(!run && !!data, start);
  if (!data || (con && !run)) return <Loading />;
  const conName = con ? data.catalog.conById.get(con)!.name : null;
  const title = conName ? `When is it up? · ${conName}` : 'When is it up?';
  if (run && !run.questions.length) {
    return (
      <Empty title={title}>
        <p>{conName ? `There is no clear-cut visibility question to ask about ${conName} from ${data.observer.name} — it sits right on the edge of what this latitude can see.` : 'No visibility questions could be built for this set of constellations.'}</p>
      </Empty>
    );
  }
  if (run) return <Session key={run.id} data={data} title={title} questions={run.questions} onNewRound={start} exitTo={con ? routes.constellation(con) : routes.practice()} />;
  return (
    <Page title={title} lead={`Which constellations are up in which month and season, which never set, and how high Polaris stands — worked out for ${data.observer.name}.`}>
      <div className="qz-setup">
        <SetupFoot data={data} start={start} />
      </div>
    </Page>
  );
}

function useAutoRun(data: QuizData | null, build: () => Question[]) {
  const r = useRun(build);
  useEffect(() => {
    if (data && !r.run) r.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return r;
}

export function LessonQuizPage() {
  const { id = '' } = useParams();
  const data = useQuizData();
  const { run, start } = useAutoRun(data, useCallback(() => buildLessonSession(data!, id, liveRng()), [data, id]));
  if (!data || !run) return <Loading />;
  const lesson = data.lessons.find((l) => l.id === id);
  if (!lesson || !run.questions.length) return <Empty title="Lesson practice"><p>{lesson ? 'This lesson has no practice questions yet.' : 'That lesson has not been written yet.'}</p></Empty>;
  return <Session key={run.id} data={data} title={`Lesson · ${lesson.title}`} questions={run.questions} onNewRound={start} exitTo={routes.lesson(id)} />;
}

/** What a module quiz asks, in one phrase. */
function moduleQuizText(kind: string, hopCount: number, conCount: number): string {
  if (kind === 'lessons') return 'questions from this module’s lessons';
  if (kind === 'starhops') return `${hopCount ? `${hopCount} star-hops to follow in the sky or name` : 'star-hops'}, and questions from the star-hopping lesson`;
  const cons = conCount ? `${conCount} constellations` : 'the constellations';
  if (kind === 'beyond') return `finding and naming ${cons} that never rise from your location, and their myths`;
  return `finding and naming ${cons} visible from your location, their myths and when they are up`;
}

/** `/practice/module/:id`: the closing quiz of a course module. Records the score with setUnitScore. */
export function ModuleQuizPage() {
  const { id = '' } = useParams();
  const data = useQuizData();
  const mod = data?.course?.modules.find((m) => m.id === id);
  const best = useProgress((s) => s.unitScores[id]);
  const { run, start } = useRun(useCallback(() => (data && mod ? composeModuleQuiz(mod, data, data.hops ?? [], liveRng()) : []), [data, mod]));
  // can a quiz be built at all? (constellation modules need the course resolved for this location)
  const ready = useMemo(() => {
    if (!data || !mod) return false;
    if (mod.kind === 'lessons') return (mod.lessons ?? []).some((l) => data.lessons.find((x) => x.id === l)?.questions?.length);
    if (mod.kind === 'starhops') return moduleHopIds(mod, data.hops ?? [], data).length > 0 || (mod.lessons ?? []).some((l) => data.lessons.find((x) => x.id === l)?.questions?.length);
    return moduleConstellations(mod).length > 0;
  }, [data, mod]);
  useStartOnEnter(!run && ready, start);
  if (!data) return <Loading />;
  if (!mod) return <Empty title="Module quiz"><p>There is no course module called “{id}”. <Link to={routes.learn()}>See the course</Link></p></Empty>;
  const title = `Module ${mod.number} quiz · ${mod.title}`;
  const back = (
    <Link className="btn btn--quiet" to={routes.module(mod.id)}>
      Back to the module
    </Link>
  );
  if (!ready || (run && !run.questions.length)) {
    return (
      <Page title={title} lead={mod.purpose}>
        <div className="card qz-empty" data-testid="empty">
          <p>This module’s practice will be available soon{mod.kind === 'lessons' || mod.kind === 'starhops' ? ', once its lessons have practice questions' : ' — its constellations for your location are still being worked out'}.</p>
          <div className="row row--wrap">{back}<Link className="btn" to={routes.practice()}>Other practice</Link></div>
        </div>
      </Page>
    );
  }
  if (run) return <Session key={run.id} data={data} title={title} questions={run.questions} onNewRound={start} exitTo={routes.module(mod.id)} unit={{ id: mod.id, title: `Module ${mod.number}`, backTo: routes.module(mod.id), backLabel: 'Back to the module' }} />;
  const hopCount = mod.kind === 'starhops' ? moduleHopIds(mod, data.hops ?? [], data).length : 0;
  const conCount = moduleConstellations(mod).length;
  return (
    <Page title={title} lead={mod.purpose}>
      <div className="qz-setup" data-testid="module-intro">
        <p>
          Up to 12 questions drawn from {moduleQuizText(mod.kind, hopCount, conCount)}. Score {Math.round(UNIT_PASS_SCORE * 100)}% or more to pass.
        </p>
        {best != null && <p className="dim">Best score so far: {Math.round(best * 100)}%{best >= UNIT_PASS_SCORE ? ' — passed' : ''}.</p>}
        <div className="row row--wrap">
          <Button variant="primary" onClick={start} data-testid="start">Start the module quiz</Button>
          {back}
        </div>
      </div>
    </Page>
  );
}

// ───────────── star-hops

/** `/practice/starhop[?hop=id]`: hops usable from your hemisphere this month (or any season); with `hop`, that one hop. */
export function StarhopPage() {
  const data = useQuizData();
  const [params] = useSearchParams();
  const hop = params.get('hop');
  const season = useQuizPrefs((s) => s.hopSeason);
  const modes = useQuizPrefs((s) => s.hopModes);
  const setPrefs = useQuizPrefs((s) => s.set);
  const args = useArgs(data);
  const hops = data?.hops ?? [];
  const one = hop ? hops.find((h) => h.id === hop) : undefined;
  const { run, start } = useRun(useCallback(() => buildStarhopSession({ ...args(), hops: args().data.hops ?? [], season, modes: one ? { click: true, mcq: true } : modes, hop }), [args, season, modes, hop, one]));
  useEffect(() => {
    if (data && one && !run) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, one]);
  useStartOnEnter(!run && !!data, start);
  const counts = useMemo(() => (data ? { now: hopsFor(hops, data.observer, 'now', data.now).length, any: hopsFor(hops, data.observer, 'any', data.now).length } : null), [data, hops]);
  if (!data || !counts || (one && !run)) return <Loading label="Setting up the sky…" />;
  if (!hops.length) return <Empty title="Star-hops"><p>The star-hop library is still being written. Star-hop practice appears here as soon as it is ready.</p></Empty>;
  if (hop && !one) return <Empty title="Star-hops"><p>There is no star-hop called “{hop}”. <Link to={routes.starhops()}>Browse the star-hops</Link></p></Empty>;
  if (run && !run.questions.length) {
    return (
      <Empty title="Star-hops">
        <p>{season === 'now' ? 'None of the star-hops is well placed in this month’s evening sky from your hemisphere. Choose “Any season” to practise the others.' : 'No star-hop questions could be built for this choice.'}</p>
      </Empty>
    );
  }
  if (run) return <Session key={run.id} data={data} title={one ? `Star-hop · ${one.name}` : 'Star-hops'} questions={run.questions} onNewRound={start} exitTo={one ? routes.starhop(one.id) : routes.practice()} />;
  const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: data.observer.tz }).format(data.now);
  const hemi = data.observer.lat >= 0 ? 'northern' : 'southern';
  const modeRows: { id: HopMode; label: string; note: string }[] = [
    { id: 'click', label: 'Follow the hop', note: 'the start is ringed and the steps are given; click the star you land on' },
    { id: 'mcq', label: 'Where does this hop lead?', note: 'read the steps and pick where they take you' },
  ];
  const sample = hopsFor(hops, data.observer, season, data.now).slice(0, 3);
  return (
    <Page title="Star-hops" lead={<>Use stars you know to find the ones you don’t. Each hop is one item; learn them first in the <Link to={routes.starhops()}>star-hop library</Link>.</>}>
      <div className="qz-setup" data-testid="hop-setup">
        {modeRows.map((r) => (
          <Switch key={r.id} checked={modes[r.id]} onChange={(v) => setPrefs({ hopModes: { ...modes, [r.id]: v } })} label={<span>{r.label} <span className="faint qz-small">{r.note}</span></span>} />
        ))}
        <div className="qz-setup-row">
          <span>Which hops</span>
          <Segmented
            label="Which hops"
            value={season}
            options={[{ value: 'now', label: `${month} evenings (${counts.now})` }, { value: 'any', label: `Any season (${counts.any})` }]}
            onChange={(v) => setPrefs({ hopSeason: v as 'now' | 'any' })}
          />
        </div>
        <p className="faint qz-small" data-testid="hop-count">
          Hops that work from the {hemi} hemisphere{season === 'now' ? ` in ${month}` : ''}
          {sample.length ? `, for example ${sample.map((h) => `${h.name} (${monthsLabel(data.observer.lat >= 0 ? h.monthsNorth : h.monthsSouth)})`).join('; ')}` : ''}. Constellation lines and the faintest stars follow your difficulty
          settings.
        </p>
        <SetupFoot data={data} start={start} usesPool={false} disabled={!(modes.click || modes.mcq) || !(season === 'now' ? counts.now : counts.any)} />
      </div>
    </Page>
  );
}

// ───────────── review, weakest

export function ReviewPage() {
  const data = useQuizData();
  const [built, setBuilt] = useState<{ id: number; questions: Question[]; due: number } | null>(null);
  const start = useCallback(() => {
    if (data) setBuilt({ id: Date.now(), ...buildReviewSession({ ...data, now: new Date() }, useProgress.getState().items, liveRng(), REVIEW_BATCH, data.hops ?? []) });
  }, [data]);
  useEffect(() => {
    if (data && !built) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  if (!data || !built) return <Loading />;
  if (!built.questions.length) {
    const items = useProgress.getState().items;
    const upcoming = nextDue(items, Date.now());
    return (
      <Empty title="Review">
        <p data-testid="nothing-due">
          <strong>Nothing due.</strong> {upcoming ? `Next review ${untilWords(upcoming - Date.now())}.` : 'You have not answered any questions yet — play a round and what you practise will come back here on a schedule.'}
        </p>
      </Empty>
    );
  }
  const more = built.due - built.questions.length;
  return <Session key={built.id} data={data} title="Review" questions={built.questions} onNewRound={start} summaryNote={more > 0 ? `${more} more ${more === 1 ? 'item was' : 'items were'} due when this round started (rounds hold up to ${REVIEW_BATCH}). “New round” continues with what is still due.` : undefined} />;
}

export function WeakestPage() {
  const data = useQuizData();
  const diff = useSettings((s) => s.difficulty);
  const { run, start } = useAutoRun(data, useCallback(() => buildWeakestSession({ data: data!, diff, items: useProgress.getState().items, rng: liveRng() }), [data, diff]));
  if (!data || !run) return <Loading />;
  if (!run.questions.length) return <Empty title="Practise weakest"><p>Nothing to practise yet.</p></Empty>;
  return <Session key={run.id} data={data} title="Practise weakest" questions={run.questions} onNewRound={start} exitTo={routes.progress()} />;
}
