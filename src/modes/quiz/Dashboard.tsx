/** Progress dashboard: module quiz scores, constellations by course module, star-hops, myths, lessons, reset. */
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { constellationMastery, dueItems, itemMastery, UNIT_PASS_SCORE, useProgress, type ItemProgress } from '@/store/progress';
import { Button, Chip, Loading, Meter, Modal } from '@/ui';
import { plainText } from './logic/build';
import { SEASON_LABEL } from './logic/pools';
import { MASTERED_AT, recentAccuracy } from './logic/select';
import { hopItemId, hopsFor } from './logic/starhop';
import { weakestRoute } from './pages';
import type { QuizData } from './logic/types';
import { useQuizData } from './useQuizData';

const SKILLS = ['find', 'name', 'story', 'visibility'] as const;
const SKILL_LABEL = { find: 'Find', name: 'Name', story: 'Myths', visibility: 'When visible' } as const;
type Sort = 'course' | 'name' | 'weakest' | 'strongest';
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
  const [sort, setSort] = useState<Sort>('course');
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

  const groups: { id: string; title: string; rows: Row[] }[] =
    sort === 'course'
      ? courseOrder(data, rows)
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
          <Link className="btn btn--primary" to={weakestRoute()}>Practise weakest</Link>
          <Link className={`btn`} to={routes.review()}>Review {due ? `(${due} due)` : ''}</Link>
        </div>
      </header>

      <dl className="qz-stats">
        <div><dt>Constellations started</dt><dd data-testid="stat-started">{started}<span> / 88</span></dd></div>
        <div><dt>Mastered (find and name)</dt><dd>{mastered}<span> / 88</span></dd></div>
        <div><dt>Due now</dt><dd>{due}</dd></div>
        <div><dt>Right on last try, past 7 days</dt><dd>{acc.ratio == null ? '—' : `${Math.round(acc.ratio * 100)}%`}<span>{acc.ratio == null ? '' : ` of ${acc.practised} items`}</span></dd></div>
        <div><dt>Lessons completed</dt><dd>{lessonCount}<span> / {data.lessons.length}</span></dd></div>
      </dl>

      <section data-testid="module-scores">
        <h4>Module quizzes</h4>
        <ul className="qz-units">
          {(data.course?.modules ?? []).map((m) => {
            const sc = unitScores[m.id];
            return (
              <li key={m.id}>
                <Link to={routes.moduleQuiz(m.id)}>{m.number}. {m.title}</Link>
                {sc == null ? <span className="faint qz-small">not taken</span> : <Chip tone={sc >= UNIT_PASS_SCORE ? 'good' : 'amber'}>{Math.round(sc * 100)}%{sc >= UNIT_PASS_SCORE ? ' passed' : ''}</Chip>}
              </li>
            );
          })}
        </ul>
      </section>

      <HopsBlock data={data} items={items} />
      <MythsBlock data={data} items={items} />

      <section>
        <div className="qz-table-head">
          <h4>All 88 constellations</h4>
          <label className="qz-sort">
            <span className="dim">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-testid="sort">
              <option value="course">Course order</option>
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
              <Link className="btn btn--sm btn--quiet" to={routes.quiz('story', { story: s.id })}>Practise</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim qz-small">{written ? 'No myth is attached to this constellation, so there are no story questions.' : 'Its page has not been written yet, so there are no story questions.'}</p>
      )}
      <div className="row row--wrap">
        <Link className="btn btn--sm" to={routes.quiz('find', { con })}>Find it</Link>
        <Link className="btn btn--sm" to={routes.quiz('name', { con })}>Name it</Link>
        <Link className="btn btn--sm" to={routes.quiz('visibility', { con })}>When is it up?</Link>
        <Link className="btn btn--sm btn--quiet" to={routes.constellation(con)}>Read its page</Link>
      </div>
    </div>
  );
}

/**
 * Course order: one group per constellation group of the course for this location (module title, then the
 * group), then anything left. Until the course is resolved, the evening months of each constellation.
 */
function courseOrder(data: QuizData, rows: Map<string, Row>): { id: string; title: string; rows: Row[] }[] {
  const seen = new Set<string>();
  const out: { id: string; title: string; rows: Row[] }[] = [];
  for (const m of data.course?.modules ?? []) {
    for (const g of m.groups) {
      const list = g.constellations.filter((id) => !seen.has(id)).map((id) => rows.get(id)).filter((r): r is Row => !!r);
      list.forEach((r) => seen.add(r.id));
      if (list.length) out.push({ id: `${m.id}/${g.id}`, title: m.groups.length > 1 ? `${m.number}. ${m.title} · ${g.title}` : `${m.number}. ${m.title}`, rows: list });
    }
  }
  if (!out.length) {
    for (const [season, title] of Object.entries(SEASON_LABEL)) {
      const list = data.catalog.constellations.filter((c) => c.season === season).map((c) => rows.get(c.id)).filter((r): r is Row => !!r);
      list.forEach((r) => seen.add(r.id));
      if (list.length) out.push({ id: season, title, rows: list });
    }
  }
  const rest = [...rows.values()].filter((r) => !seen.has(r.id));
  if (rest.length) out.push({ id: '_other', title: out.length ? 'Other constellations' : '', rows: rest });
  return out;
}

const pctText = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** Star-hop mastery: every hop usable from this hemisphere (then the rest), with a practise link. */
function HopsBlock({ data, items }: { data: QuizData; items: Record<string, ItemProgress> }) {
  const hops = data.hops ?? [];
  const usable = new Set(hopsFor(hops, data.observer, 'any', data.now).map((h) => h.id));
  const list = [...hops].sort((a, b) => Number(usable.has(b.id)) - Number(usable.has(a.id)) || a.rank - b.rank);
  const [showAll, setShowAll] = useState(false);
  const ms = list.map((h) => ({ h, m: itemMastery(items[hopItemId(h.id)]) }));
  const shown = showAll ? ms : ms.slice(0, 10);
  const started = ms.filter((x) => x.m != null).length;
  const mastered = ms.filter((x) => (x.m ?? 0) >= MASTERED_AT).length;
  return (
    <section data-testid="hops-block">
      <div className="qz-table-head">
        <h4>Star-hops</h4>
        <span className="dim qz-small">{hops.length ? `${started} of ${hops.length} practised · ${mastered} mastered` : ''}</span>
      </div>
      {hops.length ? (
        <ul className="qz-hoplist">
          {shown.map(({ h, m }) => (
            <li key={h.id} className={usable.has(h.id) ? undefined : 'qz-off'}>
              <Link to={routes.starhop(h.id)}>{h.name}</Link>
              <Meter value={m ?? 0} label={`${h.name} mastery`} />
              <span className="faint qz-small">{pctText(m)}</span>
              <Link className="btn btn--sm btn--quiet" to={routes.quiz('starhop', { hop: h.id })}>Practise</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim qz-small">The star-hop library is still being written.</p>
      )}
      {ms.length > 10 && (
        <Button size="sm" variant="quiet" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show the first 10' : `Show all ${ms.length} star-hops`}
        </Button>
      )}
    </section>
  );
}

/** Per-myth mastery (questions and flashcard together), weakest first, plus how many myths are untouched. */
function MythsBlock({ data, items }: { data: QuizData; items: Record<string, ItemProgress> }) {
  const [showAll, setShowAll] = useState(false);
  const myths = useMemo(() => {
    const out: { id: string; title: string; con: string; m: number | null; tried: number }[] = [];
    for (const c of data.content) {
      for (const s of c.stories ?? []) {
        const vals = Object.values(items)
          .filter((p) => p.id === `card:${s.id}` || p.id.startsWith(`story:${s.id}:`))
          .map(itemMastery)
          .filter((v): v is number => v != null);
        out.push({ id: s.id, title: plainText(s.title), con: data.catalog.conById.get(c.id)?.name ?? c.id, m: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, tried: vals.length });
      }
    }
    return out;
  }, [data, items]);
  const started = myths.filter((x) => x.m != null).sort((a, b) => a.m! - b.m! || a.title.localeCompare(b.title));
  const shown = showAll ? [...started, ...myths.filter((x) => x.m == null).sort((a, b) => a.con.localeCompare(b.con) || a.title.localeCompare(b.title))] : started;
  return (
    <section data-testid="myths-block">
      <div className="qz-table-head">
        <h4>Myths</h4>
        <span className="dim qz-small">{started.length} of {myths.length} practised · {started.filter((x) => x.m! >= MASTERED_AT).length} mastered</span>
      </div>
      {shown.length ? (
        <ul className="qz-mythlist">
          {shown.map((x) => (
            <li key={x.id}>
              <span>
                <Link to={routes.myth(x.id)}>{x.title}</Link> <span className="faint qz-small">{x.con}</span>
              </span>
              <Meter value={x.m ?? 0} label={`${x.title} mastery`} />
              <span className="faint qz-small">{pctText(x.m)}</span>
              <Link className="btn btn--sm btn--quiet" to={routes.quiz('story', { story: x.id })}>Practise</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim qz-small">No myths practised yet. Open one in the <Link to={routes.myths()}>myth library</Link> and practise it, or start a round of myth questions.</p>
      )}
      {myths.length > started.length && (
        <Button size="sm" variant="quiet" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show only the ones practised' : `Show all ${myths.length} myths`}
        </Button>
      )}
    </section>
  );
}
