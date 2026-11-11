import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pathUnits } from '@/content';
import { UNIT_PASS_SCORE } from '@/store/progress';
import { Chip, Loading, Meter } from '@/ui';
import { Check, ConFigure, Crumbs, Empty, Page } from '../components/common';
import { useLearnEnv, usePathNames, useProgressLike } from '../hooks';
import { STAGE_TITLES, neighbours, nextStepInUnit, unitSteps, unitSummary, type PathStep } from '../logic/path';

const KIND_TITLE: Record<PathStep['kind'], string> = { lesson: 'Read', constellation: 'Meet the constellations', asterism: 'Learn the star patterns', quiz: 'Prove it' };

export default function UnitPage() {
  const { id } = useParams();
  const env = useLearnEnv();
  const progress = useProgressLike();
  const names = usePathNames(env?.catalog ?? null);
  const idx = pathUnits.findIndex((u) => u.id === id);
  const unit = pathUnits[idx];
  const steps = useMemo(() => (unit ? unitSteps(unit, progress, names, UNIT_PASS_SCORE) : []), [unit, progress, names]);
  if (!unit)
    return (
      <Page>
        <Empty>There is no unit called “{id}”.</Empty>
        <Link to="/learn">Back to the path</Link>
      </Page>
    );
  if (!env) return <Loading />;
  const summary = unitSummary(steps, unit, progress);
  const next = nextStepInUnit(steps);
  const { prev, next: nextUnit } = neighbours(pathUnits, idx);
  let n = 0;
  return (
    <Page>
      <Crumbs items={[['Path', '/learn'], [`Stage ${unit.stage}: ${STAGE_TITLES[unit.stage].title}`], [unit.title]]} />
      <header className="ln-head">
        <h1>{unit.title}</h1>
        <p className="ln-lede">{unit.blurb}</p>
        <div className="ln-unit-progress">
          <Meter value={summary.fraction} label="Unit progress" />
          <span className="dim">
            {Math.round(summary.fraction * 100)}% done
            {summary.score != null && ` · best quiz score ${Math.round(summary.score * 100)}%`}
          </span>
          {summary.passed && <Chip tone="good">Passed</Chip>}
        </div>
        {next && (
          <Link to={next.href} className="btn btn--primary">
            {summary.started ? 'Continue' : 'Start'}: {next.title}
          </Link>
        )}
      </header>
      {(['lesson', 'constellation', 'asterism', 'quiz'] as const).map((kind) => {
        const list = steps.filter((s) => s.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="ln-section">
            <h3>{KIND_TITLE[kind]}</h3>
            <ol className="ln-checklist">
              {list.map((s) => {
                n++;
                const con = kind === 'constellation' ? env.catalog.conById.get(s.id) : undefined;
                const body = (
                  <>
                    <Check done={s.done} />
                    <span className="ln-step-num dim">{n}</span>
                    {con && <ConFigure con={con} size={44} />}
                    <span className="grow">
                      <strong>{s.title}</strong>
                      {con && <span className="dim"> {con.english}</span>}
                      {s.meta && <span className="dim"> · {s.meta}</span>}
                    </span>
                    {s === next && <Chip tone="amber">Next</Chip>}
                  </>
                );
                return (
                  <li key={s.kind + s.id}>
                    {s.available ? (
                      <Link to={s.href} className="ln-step">
                        {body}
                      </Link>
                    ) : (
                      <div className="ln-step is-off">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            {kind === 'quiz' && <p className="dim ln-small">A unit is passed at {Math.round(UNIT_PASS_SCORE * 100)}%. You can retake the quiz as often as you like; your best score counts.</p>}
          </section>
        );
      })}
      <nav className="ln-prevnext">
        {prev ? <Link to={`/learn/unit/${prev.id}`}>← {prev.title}</Link> : <span />}
        {nextUnit ? <Link to={`/learn/unit/${nextUnit.id}`}>{nextUnit.title} →</Link> : <span />}
      </nav>
    </Page>
  );
}
