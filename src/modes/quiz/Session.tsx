/** Runs one session: a question at a time, immediate feedback, score, timer, end summary. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { UNIT_PASS_SCORE, useProgress, type Grade } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { Button, Chip } from '@/ui';
import { uniqueKeys } from './logic/build';
import { FAST_MS, gradeFor, SELF_GRADES, TIME_LIMIT_S } from './logic/select';
import type { CardQ, McqQ, Question, QuizData } from './logic/types';
import { HopStage } from './HopStage';
import { debugOn, SkyStage } from './SkyStage';
import { isTyping } from './useQuizData';

export interface Answer {
  correct: boolean;
  /** What the learner answered, for feedback */
  given?: string;
  /** Flashcards: the learner's own grade */
  selfGrade?: Grade;
  skipped?: boolean;
  timedOut?: boolean;
  /** One-sentence feedback (lasso result) */
  message?: string;
}
export interface Result extends Answer {
  q: Question;
  grade: Grade;
  ms: number;
}

export interface ViewProps<Q extends Question> {
  q: Q;
  result: Result | null;
  answer: (a: Answer) => void;
  /** The "Next" button, rendered where the view wants it once answered */
  next: ReactNode;
}

function limitFor(q: Question, anywhere: boolean): number | null {
  switch (q.kind) {
    case 'find': return anywhere && !q.tonightTime ? TIME_LIMIT_S.findAnywhere : TIME_LIMIT_S.find;
    case 'name': return q.typed ? TIME_LIMIT_S.nameTyped : TIME_LIMIT_S.name;
    case 'skyobj': return TIME_LIMIT_S.skyobj;
    case 'mcq': return TIME_LIMIT_S.mcq;
    case 'hop': return TIME_LIMIT_S.hop;
    default: return null;
  }
}
function fastFor(q: Question): number {
  return q.kind === 'find' ? FAST_MS.find : q.kind === 'hop' ? FAST_MS.hop : q.kind === 'name' ? (q.typed ? FAST_MS.nameTyped : FAST_MS.name) : q.kind === 'skyobj' ? FAST_MS.skyobj : FAST_MS.mcq;
}
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export interface SessionProps {
  data: QuizData;
  title: string;
  questions: Question[];
  /** Build a fresh round (omit when there is nothing new to build) */
  onNewRound?: () => void;
  /** Where "Quit" and "Back" lead */
  exitTo?: string;
  /** Module quiz: record the score (setUnitScore) and show pass/fail; `backTo` = the module page */
  unit?: { id: string; title: string; backTo: string; backLabel: string };
  /** Extra line on the summary (e.g. "12 more items are due") */
  summaryNote?: ReactNode;
}

export function Session({ data, title, questions: initial, onNewRound, exitTo = routes.practice(), unit, summaryNote }: SessionProps) {
  const diff = useSettings((s) => s.difficulty);
  const [questions, setQuestions] = useState(initial);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(performance.now());
  const sessionStart = useRef(performance.now());
  const [totalMs, setTotalMs] = useState(0);
  const q = questions[idx] as Question | undefined;
  const done = idx >= questions.length;
  const limit = q && diff.timer ? limitFor(q, !diff.startNearTarget) : null;
  const rightItems = useRef(new Set<string>());
  const resultRef = useRef(result);
  resultRef.current = result;
  // headless checks (scripts/quiz) read the current question when ?debug=1 is in the URL
  if (debugOn()) (window as unknown as { __quizQ?: Question | null }).__quizQ = q ?? null;

  const answer = useCallback(
    (a: Answer) => {
      if (!q || resultRef.current) return;
      const ms = performance.now() - startRef.current;
      const aided = q.kind === 'find' ? diff.lines || diff.labels : q.kind === 'name' ? diff.lines && !q.typed : false;
      const grade = a.selfGrade ?? gradeFor({ correct: a.correct, ms, fastMs: fastFor(q), aided });
      const r: Result = { ...a, q, grade, ms };
      resultRef.current = r;
      // One success per item per session: several questions on the same item (e.g. /quiz/visibility?con=)
      // must not push its review interval out several steps at once. Misses are always recorded.
      if (!(grade > 0 && rightItems.current.has(q.itemId))) useProgress.getState().record(q.itemId, q.skill, grade, q.con);
      if (grade > 0) rightItems.current.add(q.itemId);
      setResult(r);
      setResults((rs) => [...rs, r]);
    },
    [q, diff.lines, diff.labels],
  );

  const next = useCallback(() => {
    if (!resultRef.current) return;
    resultRef.current = null;
    setResult(null);
    setElapsed(0);
    startRef.current = performance.now();
    setIdx((i) => i + 1);
  }, []);

  // question clock
  useEffect(() => {
    if (!q || result) return;
    const t = window.setInterval(() => {
      const ms = performance.now() - startRef.current;
      setElapsed(ms);
      if (limit && ms >= limit * 1000) answer({ correct: false, timedOut: true });
    }, 250);
    return () => window.clearInterval(t);
  }, [q, result, limit, answer]);

  // Enter = next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !resultRef.current || (e.target as HTMLElement | null)?.closest?.('[data-no-enter]')) return;
      e.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next]);

  const right = results.filter((r) => r.correct).length;
  const score = questions.length ? right / questions.length : 0;
  useEffect(() => {
    if (!done || !questions.length) return;
    setTotalMs(performance.now() - sessionStart.current);
    if (unit) useProgress.getState().setUnitScore(unit.id, score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const restart = (qs: Question[]) => {
    setQuestions(uniqueKeys(qs, `r${Date.now()}-`));
    setIdx(0);
    setResults([]);
    setResult(null);
    resultRef.current = null;
    setElapsed(0);
    startRef.current = sessionStart.current = performance.now();
  };

  const nextButton = result ? (
    <Button variant="primary" className="qz-next" onClick={next} autoFocus>
      {idx + 1 >= questions.length ? 'See results' : 'Next'} <kbd className="qz-kbd">Enter</kbd>
    </Button>
  ) : null;

  const body = useMemo(() => {
    if (!q) return null;
    const props = { result, answer, next: nextButton };
    if (q.kind === 'mcq') return <McqView key={q.key} q={q} {...props} />;
    if (q.kind === 'card') return <CardView key={q.key} q={q} {...props} />;
    if (q.kind === 'hop') return <HopStage key={q.key} q={q} data={data} {...props} />;
    return <SkyStage q={q} data={data} {...props} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, result, answer, data]);

  if (done) {
    const missed = results.filter((r) => !r.correct);
    const passed = score >= UNIT_PASS_SCORE;
    return (
      <div className="qz-session">
        <div className="qz-scroll">
          <div className="qz-summary" data-testid="summary">
            <p className="dim qz-summary-title">{title}</p>
            <h2>
              {right} of {questions.length} correct
            </h2>
            <p className="dim">
              {Math.round(score * 100)}% · {clock(totalMs)} total
            </p>
            {unit && (
              <p className={`qz-verdict ${passed ? 'is-good' : 'is-bad'}`} data-testid="unit-verdict">
                {passed
                  ? `Passed — ${unit.title} is complete. You needed ${Math.round(UNIT_PASS_SCORE * 100)}%.`
                  : `Not yet — you need ${Math.round(UNIT_PASS_SCORE * 100)}% to pass ${unit.title}. Review the misses below and try again.`}
              </p>
            )}
            {summaryNote && <p className="dim">{summaryNote}</p>}
            <div className="row row--wrap qz-summary-actions">
              {missed.length > 0 && (
                <Button variant="primary" onClick={() => restart(missed.map((r) => r.q))}>
                  Retry missed ({missed.length})
                </Button>
              )}
              {onNewRound && (
                <Button variant={missed.length ? 'default' : 'primary'} onClick={onNewRound}>
                  New round
                </Button>
              )}
              {unit && (
                <Link className="btn" to={unit.backTo}>
                  {unit.backLabel}
                </Link>
              )}
              <Link className="btn btn--quiet" to={exitTo}>
                {exitTo === routes.practice() ? 'All practice' : 'Back'}
              </Link>
            </div>
            {missed.length > 0 ? (
              <>
                <h4>To go over again</h4>
                <ul className="qz-misses">
                  {missed.map((r) => (
                    <li key={r.q.key}>
                      <span className="qz-miss-q">{r.q.promptText}</span>
                      <span className="qz-miss-a">{r.q.answerText}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="qz-verdict is-good">No misses. These will come back for review as they fall due.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const remaining = limit ? Math.max(0, limit * 1000 - elapsed) : null;
  return (
    <div className={`qz-session qz-session--${q?.kind === 'mcq' || q?.kind === 'card' ? 'read' : 'sky'}`} data-kind={q?.kind}>
      <div className="qz-top">
        <span className="qz-top-title">{title}</span>
        <span className="qz-top-count" data-testid="progress">
          {idx + 1} / {questions.length}
        </span>
        <div className="qz-top-bar" aria-hidden>
          <span style={{ width: `${((idx + (result ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
        <Chip tone={right ? 'good' : undefined}>{right} correct</Chip>
        {q?.kind !== 'card' && (
          <span className={`qz-clock${remaining != null && remaining < 6000 && !result ? ' is-low' : ''}`} role="timer">
            {remaining != null ? clock(result ? Math.max(0, limit! * 1000 - result.ms) : remaining) : clock(result ? result.ms : elapsed)}
          </span>
        )}
        <Link className="btn btn--quiet btn--sm" to={exitTo} data-no-enter>
          Quit
        </Link>
      </div>
      <div className="qz-body">{body}</div>
    </div>
  );
}

/** Choice buttons with 1–4 keys. */
export function Choices({ choices, answerIndex, picked, locked, onPick }: { choices: string[]; answerIndex: number; picked: number | null; locked: boolean; onPick: (i: number) => void }) {
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (Number.isInteger(i) && i >= 0 && i < choices.length) {
        e.preventDefault();
        onPick(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, choices.length, onPick]);
  return (
    <div className="qz-choices" role="group" aria-label="Answers">
      {choices.map((c, i) => {
        const state = !locked ? '' : i === answerIndex ? ' is-correct' : i === picked ? ' is-wrong' : ' is-muted';
        return (
          <button key={i} type="button" className={`mcq-choice qz-choice${state}`} disabled={locked} onClick={() => onPick(i)} data-choice={i} data-correct={locked && i === answerIndex ? 'true' : undefined}>
            <kbd className="qz-kbd">{i + 1}</kbd>
            <span>{c}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Feedback({ result, children }: { result: Result; children?: ReactNode }) {
  const head = result.correct ? 'Correct.' : result.timedOut ? 'Out of time.' : result.skipped ? 'Here it is.' : 'Not quite.';
  return (
    <p className={`mcq-feedback ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status" data-testid="feedback" data-correct={String(result.correct)}>
      <strong>{head}</strong> {children}
    </p>
  );
}

function McqView({ q, result, answer, next }: ViewProps<McqQ>) {
  const [picked, setPicked] = useState<number | null>(null);
  const [lead, ...rest] = q.prompt.split('\n\n');
  return (
    <div className="qz-scroll">
      <div className="qz-read" data-testid="mcq">
        {q.context && <div className="dim qz-context">{q.context}</div>}
        <p className="mcq-prompt">{lead}</p>
        {rest.map((p, i) => (
          <blockquote key={i} className="qz-quote">
            {p}
          </blockquote>
        ))}
        {q.image && (
          <figure className="qz-figure">
            <img src={q.image.file} alt="The object to identify" style={{ aspectRatio: `${q.image.width} / ${q.image.height}` }} />
            {result && (
              <figcaption className="faint">
                {q.image.title}. {q.image.telescope && q.image.telescope !== 'Not stated at source' ? `${q.image.telescope}. ` : ''}
                {q.image.kind !== 'photograph' ? `${q.image.kindNote ?? q.image.kind}. ` : ''}
                Credit: {q.image.credit} · <a href={q.image.sourceUrl} target="_blank" rel="noreferrer">{q.image.license}</a>
              </figcaption>
            )}
          </figure>
        )}
        <Choices
          choices={q.choices}
          answerIndex={q.answerIndex}
          picked={picked}
          locked={!!result}
          onPick={(i) => {
            setPicked(i);
            answer({ correct: i === q.answerIndex, given: q.choices[i] });
          }}
        />
        {result && <Feedback result={result}>{q.explanation}</Feedback>}
        {!result && (
          <div className="qz-read-actions">
            <Button variant="quiet" size="sm" onClick={() => answer({ correct: false, skipped: true })}>
              I don’t know
            </Button>
          </div>
        )}
        {next && <div className="qz-read-actions">{next}</div>}
      </div>
    </div>
  );
}

function CardView({ q, result, answer, next }: ViewProps<CardQ>) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (result) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
        const g = SELF_GRADES[Number(e.key) - 1];
        answer({ correct: g.grade > 0, selfGrade: g.grade });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, result, answer]);
  return (
    <div className="qz-scroll">
      <div className="qz-read" data-testid="card">
        <div className="dim qz-context">Flashcard · tell the story to yourself, then check</div>
        <div className="qz-card">
          <div className="qz-card-front">
            <span className="dim">{q.conName} · {q.culture}</span>
            <h3>{q.title}</h3>
          </div>
          {shown ? (
            <div className="qz-card-back prose">
              <p>{q.summary}</p>
              {q.characters.length > 0 && <p className="qz-card-chars">Characters: {q.characters.join(', ')}</p>}
            </div>
          ) : (
            <Button variant="primary" onClick={() => setShown(true)}>
              Show the story <kbd className="qz-kbd">Space</kbd>
            </Button>
          )}
        </div>
        {shown && !result && (
          <div className="qz-grades" role="group" aria-label="How well did you remember it?">
            {SELF_GRADES.map((g, i) => (
              <button key={g.grade} type="button" className="mcq-choice qz-grade" onClick={() => answer({ correct: g.grade > 0, selfGrade: g.grade })} data-grade={g.grade}>
                <kbd className="qz-kbd">{i + 1}</kbd>
                <strong>{g.label}</strong>
                <span className="dim">{g.hint}</span>
              </button>
            ))}
          </div>
        )}
        {result && <p className="dim">Marked “{SELF_GRADES[result.grade].label}”.</p>}
        {next && <div className="qz-read-actions">{next}</div>}
      </div>
    </div>
  );
}
