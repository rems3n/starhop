/** The quiz screens: hub and one page per quiz type. Each page builds a list of questions and hands it to <Session>. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { dueItems, UNIT_PASS_SCORE, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { Button, Loading, Meter, Segmented, Switch } from '@/ui';
import { DifficultyPanel } from './DifficultyPanel';
import { composeUnitQuiz, listStories, objectBuilders } from './logic/build';
import { planetsUp } from './logic/knowledge';
import { poolLabel } from './logic/pools';
import { liveRng } from './logic/rng';
import { nextDue, untilWords, weakestConstellations } from './logic/select';
import {
  buildFindSession, buildKnowledgeSession, buildLessonSession, buildNameSession, buildObjectSession, buildReviewSession, buildStorySession, buildVisibilitySession, buildWeakestSession,
  getTonight, poolIds, REVIEW_BATCH,
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
        <Link to="/quiz">Quizzes</Link>
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
          <Link className="btn" to="/quiz">
            Back to quizzes
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

const TYPES: { to: string; title: string; text: string }[] = [
  { to: '/quiz/find', title: 'Find it', text: 'You get a name. Draw a loop around that constellation in the sky.' },
  { to: '/quiz/name', title: 'Name it', text: 'A constellation is highlighted. Pick its name, or type it.' },
  { to: '/quiz/object', title: 'Stars and objects', text: 'Name the ringed star or deep-sky object, or identify one from a photograph.' },
  { to: '/quiz/story', title: 'Stories', text: 'The myths behind the figures: who did what, and which constellation it belongs to.' },
  { to: '/quiz/knowledge', title: 'Sky knowledge', text: 'What is up when, from where you live, plus questions from the lessons.' },
  { to: '/quiz/visibility', title: 'When is it up?', text: 'Only the visibility questions: months, seasons, what never sets, tonight’s planets.' },
];

export function Hub() {
  const data = useQuizData();
  const items = useProgress((s) => s.items);
  const diff = useSettings((s) => s.difficulty);
  if (!data) return <Loading label="Loading quizzes…" />;
  const now = Date.now();
  const due = dueItems(items, now).length;
  const upcoming = nextDue(items, now);
  const weakest = weakestConstellations(items, data.catalog.constellations.map((c) => c.id), 5);
  return (
    <div className="page qz-page qz-hub">
      <header className="qz-hub-head">
        <div>
          <h2>Quiz</h2>
          <p className="dim qz-lead">Short rounds with instant feedback. What you miss comes back sooner; what you know comes back later.</p>
        </div>
        <div className="qz-review-box card" data-testid="review-box">
          <div>
            <strong data-testid="due-count">{due}</strong> {due === 1 ? 'item' : 'items'} due for review
            <div className="faint qz-small">{due ? 'Weakest first, each in its own format.' : upcoming ? `Next review ${untilWords(upcoming - now)}.` : 'Answer a few questions and they will start coming back here.'}</div>
          </div>
          <Link className={`btn${due ? ' btn--primary' : ''}`} to="/quiz/review">
            Review
          </Link>
        </div>
      </header>

      <div className="qz-hub-grid">
        <div className="qz-hub-main">
          <div className="qz-length">
            <span className="dim">Questions per round</span>
            <LengthPicker />
            <span className="faint qz-small">Drawing from: {poolLabel(diff.pool, data)}</span>
          </div>
          <div className="qz-types">
            {TYPES.map((t) => (
              <Link key={t.to} to={t.to} className="card qz-type-card">
                <h4>{t.title}</h4>
                <p className="dim">{t.text}</p>
              </Link>
            ))}
            <Link to="/progress" className="card qz-type-card">
              <h4>Progress</h4>
              <p className="dim">Mastery for all 88 constellations, lessons done and unit scores.</p>
            </Link>
          </div>
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
                        <Link className="btn btn--sm" to={`/quiz/find?con=${w.id}`}>Find</Link>
                        <Link className="btn btn--sm" to={`/quiz/name?con=${w.id}`}>Name</Link>
                      </li>
                    );
                  })}
                </ul>
                <Link className="btn" to="/quiz/weakest">Practise weakest</Link>
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
        There are no constellations to ask about in “{poolLabel(spec, data)}” right now{spec === 'tonight' ? ' — nothing is well placed in tonight’s dark hours from your location' : ''}. Choose another set of constellations in the difficulty panel on
        the quiz page.
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
          Drawing from: {poolLabel(diff.pool, data)}. <Link to="/quiz">Change difficulty</Link>
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
  const { run, start } = useRun(useCallback(() => buildStorySession({ ...args(), con, story, modes, scope }), [args, con, story, modes, scope]));
  useStartOnEnter(!run && !!data, start);
  const stats = useMemo(() => {
    if (!data) return null;
    const all = listStories(data.content, data.catalog, con ? [con] : undefined).filter((s) => !story || s.story.id === story);
    const pool = con ? all : listStories(data.content, data.catalog, poolIds(data, diff.pool));
    return { all, pool };
  }, [data, con, story, diff.pool]);
  if (!data || !stats) return <Loading />;
  const conName = con ? data.catalog.conById.get(con)?.name ?? con : null;
  if (!stats.all.length) {
    return (
      <Empty title="Stories">
        <p>{conName ? `${conName} has no written story yet (or it is a modern constellation with no myth).` : 'No constellation stories have been written yet.'} Story questions appear here as the pages are added.</p>
      </Empty>
    );
  }
  if (run && !run.questions.length) return <Empty title="Stories"><p>Not enough content yet for this choice. Switch on another kind of question, or choose “Every story written so far”.</p></Empty>;
  if (run) return <Session key={run.id} data={data} title={conName ? `Stories · ${conName}` : 'Stories'} questions={run.questions} onNewRound={start} />;
  const inScope = con || scope === 'all' ? stats.all : stats.pool;
  return (
    <Page title={conName ? `Stories · ${conName}` : 'Stories'} lead="Each myth is its own item: a constellation with several stories is quizzed on every one of them separately.">
      <div className="qz-setup">
        <Switch checked={modes.mcq} onChange={(v) => setPrefs({ storyModes: { ...modes, mcq: v } })} label="Questions about characters and events" />
        <Switch checked={modes.which} onChange={(v) => setPrefs({ storyModes: { ...modes, which: v } })} label="Which constellation is this myth about?" />
        <Switch checked={modes.card} onChange={(v) => setPrefs({ storyModes: { ...modes, card: v } })} label="Flashcards (you grade yourself)" />
        {!con && (
          <div className="qz-setup-row">
            <span>Stories from</span>
            <Segmented label="Stories from" value={scope} options={[{ value: 'all', label: 'Every story written so far' }, { value: 'pool', label: poolLabel(diff.pool, data) }]} onChange={(v) => setPrefs({ storyScope: v })} />
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

const LESSON_UNITS = [
  { value: 'all', label: 'All lessons' }, { value: 'skills', label: 'Practical skills' }, { value: 'motion', label: 'How the sky moves' },
  { value: 'ecliptic', label: 'Planets, Moon, eclipses' }, { value: 'objects', label: 'Kinds of object' },
];

export function KnowledgePage() {
  const data = useQuizData();
  const modes = useQuizPrefs((s) => s.knowledgeModes);
  const lessonUnit = useQuizPrefs((s) => s.lessonUnit);
  const setPrefs = useQuizPrefs((s) => s.set);
  const args = useArgs(data);
  const { run, start } = useRun(useCallback(() => buildKnowledgeSession({ ...args(), modes, lessonUnit }), [args, modes, lessonUnit]));
  useStartOnEnter(!run && !!data, start);
  const info = useMemo(() => (data ? { planets: planetsUp(getTonight(data).planets).map((p) => p.name), bank: data.lessons.filter((l) => lessonUnit === 'all' || l.unit === lessonUnit).reduce((n, l) => n + (l.questions?.length ?? 0), 0) } : null), [data, lessonUnit]);
  if (!data || !info) return <Loading />;
  if (run && !run.questions.length) return <Empty title="Sky knowledge"><p>Not enough content yet for this choice. Switch on the other kind of question or pick another group of lessons.</p></Empty>;
  if (run) return <Session key={run.id} data={data} title="Sky knowledge" questions={run.questions} onNewRound={start} />;
  return (
    <Page title="Sky knowledge" lead={`Why the sky looks the way it does from ${data.observer.name}.`}>
      <div className="qz-setup">
        <Switch checked={modes.computed} onChange={(v) => setPrefs({ knowledgeModes: { ...modes, computed: v } })} label={<span>Your own sky <span className="faint qz-small">what is up in which month and season, what never sets, how high Polaris stands{info.planets.length ? `, and tonight’s planets (${info.planets.join(', ')})` : ''}</span></span>} />
        <Switch checked={modes.lessons} onChange={(v) => setPrefs({ knowledgeModes: { ...modes, lessons: v } })} label={<span>Questions from the lessons <span className="faint qz-small">{info.bank} questions</span></span>} />
        {modes.lessons && (
          <div className="qz-setup-row">
            <span>Lessons</span>
            <Segmented label="Lesson group" value={lessonUnit} options={LESSON_UNITS} onChange={(v) => setPrefs({ lessonUnit: v })} />
          </div>
        )}
        <SetupFoot data={data} start={start} disabled={!(modes.computed || (modes.lessons && info.bank > 0))} />
      </div>
    </Page>
  );
}

/** `/quiz/visibility[?con=Abbr]`: the computed "when is it up?" questions only. Learn links here per constellation. */
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
  if (run) return <Session key={run.id} data={data} title={title} questions={run.questions} onNewRound={start} exitTo={con ? `/learn/constellation/${con}` : '/quiz'} />;
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
  return <Session key={run.id} data={data} title={`Lesson · ${lesson.title}`} questions={run.questions} onNewRound={start} exitTo={`/learn/lesson/${id}`} />;
}

export function UnitQuizPage() {
  const { id = '' } = useParams();
  const data = useQuizData();
  const unit = data?.units.find((u) => u.id === id);
  const best = useProgress((s) => s.unitScores[id]);
  const { run, start } = useRun(useCallback(() => (data && unit ? composeUnitQuiz(unit, data, liveRng()) : []), [data, unit]));
  useStartOnEnter(!run && !!unit, start);
  if (!data) return <Loading />;
  if (!unit) return <Empty title="Unit quiz"><p>There is no unit called “{id}” on the path.</p></Empty>;
  if (run && !run.questions.length) return <Empty title={unit.title}><p>Not enough content yet to build this unit’s quiz.</p></Empty>;
  if (run) return <Session key={run.id} data={data} title={`Unit quiz · ${unit.title}`} questions={run.questions} onNewRound={start} unit={unit} />;
  const names = unit.constellations.map((c) => data.catalog.conById.get(c)?.name ?? c);
  return (
    <Page title={`Unit quiz · ${unit.title}`} lead={unit.blurb}>
      <div className="qz-setup">
        <p>
          You will be asked to find and to name each of {names.join(', ')}, then answer questions on their stories and on this unit’s lessons. Score {Math.round(UNIT_PASS_SCORE * 100)}% or more to pass.
        </p>
        {best != null && <p className="dim">Best score so far: {Math.round(best * 100)}%{best >= UNIT_PASS_SCORE ? ' — passed' : ''}.</p>}
        <div className="row">
          <Button variant="primary" onClick={start} data-testid="start">Start the unit quiz</Button>
          <Link className="btn btn--quiet" to="/learn">Back to the path</Link>
        </div>
      </div>
    </Page>
  );
}

// ───────────── review, weakest

export function ReviewPage() {
  const data = useQuizData();
  const [built, setBuilt] = useState<{ id: number; questions: Question[]; due: number } | null>(null);
  const start = useCallback(() => {
    if (data) setBuilt({ id: Date.now(), ...buildReviewSession({ ...data, now: new Date() }, useProgress.getState().items, liveRng()) });
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
  return <Session key={run.id} data={data} title="Practise weakest" questions={run.questions} onNewRound={start} exitTo="/progress" />;
}
