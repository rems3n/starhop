/** Progress dashboard: mastery for all 88 constellations, per-myth breakdown, lessons, unit scores, reset. */
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { constellationMastery, dueItems, itemMastery, UNIT_PASS_SCORE, useProgress, type ItemProgress } from '@/store/progress';
import { Button, Chip, Loading, Modal } from '@/ui';
import { MASTERED_AT, recentAccuracy } from './logic/select';
import type { QuizData } from './logic/types';
import { useQuizData } from './useQuizData';

const SKILLS = ['find', 'name', 'story', 'visibility'] as const;
const SKILL_LABEL = { find: 'Find', name: 'Name', story: 'Stories', visibility: 'When visible' } as const;
type Sort = 'path' | 'name' | 'weakest' | 'strongest';
type Row = { id: string; name: string; english: string; m: Record<(typeof SKILLS)[number], number | null>; avg: number | null };

function Cell({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <td className="qz-cell is-empty" aria-label={`${label}: not started`}><span className="qz-cell-box" /></td>;
  const pct = Math.round(value * 100);
  return (
    <td className={`qz-cell${value >= MASTERED_AT ? ' is-good' : ''}`} aria-label={`${label}: ${pct}%`}>
      <span className="qz-cell-box"><span style={{ width: `${Math.max(6, pct)}%` }} /></span>
      <span className="qz-cell-num">{pct}</span>
    </td>
  );
}

interface StoryLine { id: string; title: string; questions: number | null; asked: number; qMastery: number | null; card: number | null }

/** Per-myth numbers for one constellation: from the content when it is written, else from the stored item ids. */
export function storyBreakdown(con: string, items: Record<string, ItemProgress>, data: Pick<QuizData, 'content'>): StoryLine[] {
  const lines = new Map<string, StoryLine>();
  for (const s of data.content.find((c) => c.id === con)?.stories ?? []) lines.set(s.id, { id: s.id, title: s.title, questions: s.questions.length + 1, asked: 0, qMastery: null, card: null });
  const sums = new Map<string, number[]>();
  for (const p of Object.values(items)) {
    const m = itemMastery(p);
    if (m == null) continue;
    const [scheme, storyId] = p.id.split(':');
    if ((scheme !== 'story' && scheme !== 'card') || !storyId?.startsWith(`${con}-`)) continue;
    const line = lines.get(storyId) ?? { id: storyId, title: storyId, questions: null, asked: 0, qMastery: null, card: null };
    lines.set(storyId, line);
    if (scheme === 'card') line.card = m;
    else sums.set(storyId, [...(sums.get(storyId) ?? []), m]);
  }
  for (const [id, ms] of sums) {
    const line = lines.get(id)!;
    line.asked = ms.length;
    line.qMastery = ms.reduce((a, b) => a + b, 0) / ms.length;
  }
  return [...lines.values()];
}

export function Dashboard() {
  const data = useQuizData();
  const items = useProgress((s) => s.items);
  const lessonsDone = useProgress((s) => s.lessonsDone);
  const unitScores = useProgress((s) => s.unitScores);
  const reset = useProgress((s) => s.reset);
  const [sort, setSort] = useState<Sort>('path');
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of data?.catalog.constellations ?? []) {
      const m = constellationMastery(items, c.id);
      const vals = SKILLS.map((s) => m[s]).filter((v): v is number => v != null);
      map.set(c.id, { id: c.id, name: c.name, english: c.english, m, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
    }
    return map;
  }, [data, items]);

  if (!data) return <Loading label="Loading your progress…" />;
  const all = [...rows.values()];
  const started = all.filter((r) => r.avg != null).length;
  const mastered = all.filter((r) => (r.m.find ?? 0) >= MASTERED_AT && (r.m.name ?? 0) >= MASTERED_AT).length;
  const now = Date.now();
  const due = dueItems(items, now).length;
  const acc = recentAccuracy(items, now);
  const lessonCount = data.lessons.filter((l) => lessonsDone[l.id]).length;

  const inUnits = new Set(data.units.flatMap((u) => u.constellations));
  const groups: { id: string; title: string; rows: Row[] }[] =
    sort === 'path'
      ? [
          ...data.units.map((u) => ({ id: u.id, title: u.title, rows: u.constellations.map((id) => rows.get(id)).filter((r): r is Row => !!r) })),
          { id: '_other', title: 'Not on the path yet', rows: all.filter((r) => !inUnits.has(r.id)) },
        ].filter((g) => g.rows.length)
      : [{
          id: '_all', title: '',
          rows: [...all].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'weakest' ? (a.avg ?? 2) - (b.avg ?? 2) || a.name.localeCompare(b.name) : (b.avg ?? -1) - (a.avg ?? -1) || a.name.localeCompare(b.name))),
        }];

  return (
    <div className="page qz-page qz-dash" data-testid="dashboard">
      <header className="qz-dash-head">
        <div>
          <h2>Progress</h2>
          <p className="dim qz-lead">How well you know each constellation, skill by skill. An empty box means not started; green means mastered ({Math.round(MASTERED_AT * 100)}% or better).</p>
        </div>
        <div className="row row--wrap">
          <Link className="btn btn--primary" to="/quiz/weakest">Practise weakest</Link>
          <Link className={`btn`} to="/quiz/review">Review {due ? `(${due} due)` : ''}</Link>
        </div>
      </header>

      <dl className="qz-stats">
        <div><dt>Constellations started</dt><dd data-testid="stat-started">{started}<span> / 88</span></dd></div>
        <div><dt>Mastered (find and name)</dt><dd>{mastered}<span> / 88</span></dd></div>
        <div><dt>Due now</dt><dd>{due}</dd></div>
        <div><dt>Right on last try, past 7 days</dt><dd>{acc.ratio == null ? '—' : `${Math.round(acc.ratio * 100)}%`}<span>{acc.ratio == null ? '' : ` of ${acc.practised} items`}</span></dd></div>
        <div><dt>Lessons completed</dt><dd>{lessonCount}<span> / {data.lessons.length}</span></dd></div>
      </dl>

      <section>
        <h4>Unit quizzes</h4>
        <ul className="qz-units">
          {data.units.map((u) => {
            const s = unitScores[u.id];
            return (
              <li key={u.id}>
                <Link to={`/quiz/unit/${u.id}`}>{u.title}</Link>
                {s == null ? <span className="faint qz-small">not taken</span> : <Chip tone={s >= UNIT_PASS_SCORE ? 'good' : 'amber'}>{Math.round(s * 100)}%{s >= UNIT_PASS_SCORE ? ' passed' : ''}</Chip>}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="qz-table-head">
          <h4>All 88 constellations</h4>
          <label className="qz-sort">
            <span className="dim">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="sort">
              <option value="path">Path order</option>
              <option value="name">Name</option>
              <option value="weakest">Weakest first</option>
              <option value="strongest">Strongest first</option>
            </select>
          </label>
        </div>
        <div className="qz-table-wrap">
          <table className="qz-table">
            <thead>
              <tr>
                <th scope="col">Constellation</th>
                {SKILLS.map((s) => <th key={s} scope="col">{SKILL_LABEL[s]}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.id}>
                  {g.title && (
                    <tr className="qz-group"><th colSpan={5} scope="colgroup">{g.title}</th></tr>
                  )}
                  {g.rows.map((r) => (
                    <Fragment key={r.id}>
                      <tr className={open === r.id ? 'is-open' : undefined} data-con={r.id}>
                        <th scope="row">
                          <button type="button" className="qz-rowbtn" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                            <span className="qz-caret" aria-hidden>{open === r.id ? '▾' : '▸'}</span>
                            <span>{r.name}</span> <span className="faint qz-small qz-english">{r.english}</span>
                          </button>
                        </th>
                        {SKILLS.map((s) => <Cell key={s} value={r.m[s]} label={`${r.name}, ${SKILL_LABEL[s]}`} />)}
                      </tr>
                      {open === r.id && (
                        <tr className="qz-detail">
                          <td colSpan={5}>
                            <Detail con={r.id} items={items} data={data} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="qz-reset">
        <Button variant="quiet" onClick={() => setConfirm(true)} data-testid="reset">Reset progress…</Button>
      </section>
      {confirm && (
        <Modal title="Reset all progress?" onClose={() => setConfirm(false)}>
          <p>This erases every quiz result, review schedule, completed lesson and unit score saved in this browser. It cannot be undone.</p>
          <div className="row">
            <Button onClick={() => setConfirm(false)}>Keep my progress</Button>
            <Button variant="primary" onClick={() => { reset(); setConfirm(false); }} data-testid="reset-confirm">Erase everything</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const pct = (v: number | null) => (v == null ? 'not started' : `${Math.round(v * 100)}%`);

function Detail({ con, items, data }: { con: string; items: Record<string, ItemProgress>; data: QuizData }) {
  const stories = storyBreakdown(con, items, data);
  const written = data.content.some((c) => c.id === con);
  return (
    <div className="qz-detail-body">
      {stories.length ? (
        <ul className="qz-stories">
          {stories.map((s) => (
            <li key={s.id}>
              <span className="qz-story-title">{s.title}</span>
              <span className="dim qz-small">Questions: {pct(s.qMastery)}{s.asked ? ` (${s.asked}${s.questions ? ` of ${s.questions}` : ''} tried)` : ''}</span>
              <span className="dim qz-small">Flashcard: {pct(s.card)}</span>
              <Link className="btn btn--sm btn--quiet" to={`/quiz/story?con=${con}&story=${s.id}`}>Practise</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim qz-small">{written ? 'No myth is attached to this constellation, so there are no story questions.' : 'Its page has not been written yet, so there are no story questions.'}</p>
      )}
      <div className="row row--wrap">
        <Link className="btn btn--sm" to={`/quiz/find?con=${con}`}>Find it</Link>
        <Link className="btn btn--sm" to={`/quiz/name?con=${con}`}>Name it</Link>
        <Link className="btn btn--sm" to={`/quiz/visibility?con=${con}`}>When is it up?</Link>
        <Link className="btn btn--sm btn--quiet" to={`/learn/constellation/${con}`}>Read its page</Link>
      </div>
    </div>
  );
}
