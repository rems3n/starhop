/** The guided path: what is done, what is next. Pure. */
import type { PathUnit } from '@/content/schema';

export interface ProgressLike {
  lessonsDone: Record<string, number>;
  seen: Record<string, number>;
  unitScores: Record<string, number>;
  /** Asterism pages opened (kept by Learn itself) */
  asterismsSeen?: Record<string, number>;
}

export interface PathNames {
  lesson: (id: string) => { title: string; minutes?: number } | undefined;
  constellation: (id: string) => string | undefined;
  asterism: (id: string) => string | undefined;
}

export type PathStepKind = 'lesson' | 'constellation' | 'asterism' | 'quiz';

export interface PathStep {
  kind: PathStepKind;
  id: string;
  title: string;
  /** Short extra, e.g. "5 min" */
  meta?: string;
  href: string;
  done: boolean;
  /** False when the lesson has not been written yet; such steps never block progress */
  available: boolean;
}

export const STAGE_TITLES: Record<number, { title: string; blurb: string }> = {
  1: { title: 'Anchors', blurb: 'Fifteen bright constellations, one season at a time. Everything else hangs from these.' },
  2: { title: 'Season by season', blurb: 'Fill in the fainter figures between the anchors.' },
  3: { title: 'Far south', blurb: 'The sky below your southern horizon, for the day you travel.' },
};

/** The ordered checklist for one unit: lessons, constellation pages, asterisms, then the unit quiz. */
export function unitSteps(unit: PathUnit, p: ProgressLike, names: PathNames, passScore: number): PathStep[] {
  const steps: PathStep[] = [];
  for (const id of unit.lessons) {
    const l = names.lesson(id);
    steps.push({ kind: 'lesson', id, title: l?.title ?? id, meta: l?.minutes ? `${l.minutes} min` : l ? undefined : 'not written yet', href: `/learn/lesson/${id}`, done: !!p.lessonsDone[id], available: !!l });
  }
  for (const id of unit.constellations) {
    steps.push({ kind: 'constellation', id, title: names.constellation(id) ?? id, href: `/learn/constellation/${id}`, done: !!p.seen[id], available: true });
  }
  for (const id of unit.asterisms) {
    const name = names.asterism(id);
    steps.push({ kind: 'asterism', id, title: name ?? id, href: `/learn/signpost/${id}`, done: !!p.asterismsSeen?.[id], available: !!name });
  }
  steps.push({ kind: 'quiz', id: unit.id, title: 'Unit quiz', meta: `pass at ${Math.round(passScore * 100)}%`, href: `/quiz/unit/${unit.id}`, done: (p.unitScores[unit.id] ?? 0) >= passScore, available: true });
  return steps;
}

export interface UnitSummary {
  lessonsDone: number;
  lessonsTotal: number;
  consSeen: number;
  consTotal: number;
  /** Best unit-quiz score 0..1, or null if never taken */
  score: number | null;
  passed: boolean;
  /** Share of available steps done, 0..1 */
  fraction: number;
  started: boolean;
}

export function unitSummary(steps: PathStep[], unit: PathUnit, p: ProgressLike): UnitSummary {
  const avail = steps.filter((s) => s.available);
  const done = avail.filter((s) => s.done).length;
  const lessons = avail.filter((s) => s.kind === 'lesson');
  const cons = steps.filter((s) => s.kind === 'constellation');
  const quiz = steps.find((s) => s.kind === 'quiz');
  const score = unit.id in p.unitScores ? p.unitScores[unit.id] : null;
  return {
    lessonsDone: lessons.filter((s) => s.done).length,
    lessonsTotal: lessons.length,
    consSeen: cons.filter((s) => s.done).length,
    consTotal: cons.length,
    score,
    passed: !!quiz?.done,
    fraction: avail.length ? done / avail.length : 0,
    started: done > 0 || score != null,
  };
}

/** First thing not yet done in a unit (skipping lessons that do not exist yet), or null when all done. */
export function nextStepInUnit(steps: PathStep[]): PathStep | null {
  return steps.find((s) => s.available && !s.done) ?? null;
}

export type UnitState = 'passed' | 'current' | 'up-next' | 'later';

export interface PathOverview {
  units: { unit: PathUnit; steps: PathStep[]; summary: UnitSummary; state: UnitState; next: PathStep | null }[];
  /** The one "Continue" action for the whole path */
  current: { unit: PathUnit; step: PathStep } | null;
  passedCount: number;
}

/**
 * The whole path. The current unit is the first one not yet passed; the one after it is "up next";
 * the rest are "later". Nothing is locked: every unit keeps its own next step.
 */
export function pathOverview(units: PathUnit[], p: ProgressLike, names: PathNames, passScore: number): PathOverview {
  let currentIdx = -1;
  const rows = units.map((unit, i) => {
    const steps = unitSteps(unit, p, names, passScore);
    const summary = unitSummary(steps, unit, p);
    if (!summary.passed && currentIdx < 0) currentIdx = i;
    return { unit, steps, summary, next: nextStepInUnit(steps) };
  });
  const out = rows.map((r, i) => {
    const state: UnitState = r.summary.passed ? 'passed' : i === currentIdx ? 'current' : i === nextUnpassed(rows, currentIdx) ? 'up-next' : 'later';
    return { ...r, state };
  });
  const cur = currentIdx >= 0 ? out[currentIdx] : null;
  return {
    units: out,
    current: cur && cur.next ? { unit: cur.unit, step: cur.next } : null,
    passedCount: out.filter((u) => u.state === 'passed').length,
  };
}

function nextUnpassed(rows: { summary: UnitSummary }[], after: number): number {
  if (after < 0) return -1;
  for (let i = after + 1; i < rows.length; i++) if (!rows[i].summary.passed) return i;
  return -1;
}

/** Previous and next entries around `id` in a list (no wrap-around). */
export function neighbours<T>(list: T[], index: number): { prev: T | null; next: T | null } {
  return { prev: index > 0 ? list[index - 1] : null, next: index >= 0 && index < list.length - 1 ? list[index + 1] : null };
}

/** The path unit that teaches a constellation (first match). */
export function unitOfConstellation(units: PathUnit[], con: string): PathUnit | undefined {
  return units.find((u) => u.constellations.includes(con));
}

/** The path unit that contains a lesson. */
export function unitOfLesson(units: PathUnit[], lessonId: string): PathUnit | undefined {
  return units.find((u) => u.lessons.includes(lessonId));
}
