/**
 * Learning progress + spaced repetition, persisted to localStorage.
 *
 * Every quizzable thing is an "item" with a stable id:
 *   find:<Abbr>            find-it (lasso) for a constellation
 *   name:<Abbr>            name-it for a constellation
 *   story:<storyId>:<qId>  a multiple-choice question about one myth
 *   card:<storyId>         flashcard for one myth (self-graded)
 *   vis:<Abbr|Body>        visibility / season knowledge for a constellation or planet
 *   object:<TargetRef>     identify a star / DSO
 *   know:<lessonId>:<qId>  lesson knowledge question
 *
 * Scheduling is SM-2 style: grade 0 = again, 1 = hard, 2 = good, 3 = easy.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Skill = 'find' | 'name' | 'story' | 'visibility' | 'object' | 'knowledge';
export type Grade = 0 | 1 | 2 | 3;

export interface ItemProgress {
  id: string;
  skill: Skill;
  /** Constellation this item counts toward in the mastery dashboard (if any) */
  con?: string;
  ease: number;
  intervalDays: number;
  /** Epoch ms when the item is next due */
  due: number;
  reps: number;
  lapses: number;
  attempts: number;
  correct: number;
  last: number;
  /** Most recent grades, newest last (max 8) */
  history: Grade[];
}

const DAY = 86_400_000;

export function schedule(prev: ItemProgress | undefined, id: string, skill: Skill, con: string | undefined, grade: Grade, now: number): ItemProgress {
  const p: ItemProgress = prev ?? { id, skill, con, ease: 2.5, intervalDays: 0, due: now, reps: 0, lapses: 0, attempts: 0, correct: 0, last: 0, history: [] };
  let { ease, intervalDays, reps, lapses } = p;
  if (grade === 0) {
    reps = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    intervalDays = 0; // due again this session (10 minutes)
  } else {
    reps += 1;
    if (grade === 1) ease = Math.max(1.3, ease - 0.15);
    if (grade === 3) ease = ease + 0.15;
    if (reps === 1) intervalDays = grade === 3 ? 3 : 1;
    else if (reps === 2) intervalDays = grade === 1 ? 2 : grade === 3 ? 7 : 4;
    else intervalDays = Math.max(1, Math.round(intervalDays * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease)));
  }
  const due = grade === 0 ? now + 10 * 60_000 : now + intervalDays * DAY;
  return { ...p, con: con ?? p.con, ease, intervalDays, due, reps, lapses, attempts: p.attempts + 1, correct: p.correct + (grade > 0 ? 1 : 0), last: now, history: [...p.history, grade].slice(-8) };
}

/** 0..1 mastery from recent accuracy and interval length; null if never attempted. */
export function itemMastery(p: ItemProgress | undefined): number | null {
  if (!p || p.attempts === 0) return null;
  const recent = p.history.slice(-4);
  const acc = recent.filter((g) => g > 0).length / recent.length;
  const stability = Math.min(1, p.intervalDays / 21);
  return Math.round((0.6 * acc + 0.4 * stability) * 100) / 100;
}

interface ProgressState {
  items: Record<string, ItemProgress>;
  /** lesson id → epoch ms completed */
  lessonsDone: Record<string, number>;
  /** path unit id → best quiz score 0..1 */
  unitScores: Record<string, number>;
  /** constellation pages the learner has opened */
  seen: Record<string, number>;
  record: (id: string, skill: Skill, grade: Grade, con?: string) => void;
  markLessonDone: (lessonId: string) => void;
  setUnitScore: (unitId: string, score: number) => void;
  markSeen: (con: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      items: {},
      lessonsDone: {},
      unitScores: {},
      seen: {},
      record: (id, skill, grade, con) => set((s) => ({ items: { ...s.items, [id]: schedule(s.items[id], id, skill, con, grade, Date.now()) } })),
      markLessonDone: (lessonId) => set((s) => ({ lessonsDone: { ...s.lessonsDone, [lessonId]: Date.now() } })),
      setUnitScore: (unitId, score) => set((s) => ({ unitScores: { ...s.unitScores, [unitId]: Math.max(score, s.unitScores[unitId] ?? 0) } })),
      markSeen: (con) => set((s) => (s.seen[con] ? s : { seen: { ...s.seen, [con]: Date.now() } })),
      reset: () => set({ items: {}, lessonsDone: {}, unitScores: {}, seen: {} }),
    }),
    { name: 'starhop.progress.v1', version: 1 },
  ),
);

/** Items due now, weakest first. */
export function dueItems(items: Record<string, ItemProgress>, now = Date.now(), skill?: Skill): ItemProgress[] {
  return Object.values(items)
    .filter((p) => p.due <= now && (!skill || p.skill === skill))
    .sort((a, b) => (itemMastery(a) ?? 0) - (itemMastery(b) ?? 0) || a.due - b.due);
}

/** Mastery per skill for one constellation: average over its items, null where nothing attempted. */
export function constellationMastery(items: Record<string, ItemProgress>, con: string): Record<'find' | 'name' | 'story' | 'visibility', number | null> {
  const out = { find: null, name: null, story: null, visibility: null } as Record<'find' | 'name' | 'story' | 'visibility', number | null>;
  for (const skill of ['find', 'name', 'story', 'visibility'] as const) {
    const ms = Object.values(items)
      .filter((p) => p.skill === skill && p.con === con)
      .map(itemMastery)
      .filter((m): m is number => m != null);
    if (ms.length) out[skill] = Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * 100) / 100;
  }
  return out;
}

/** A path unit is passed when its quiz score is at least this. */
export const UNIT_PASS_SCORE = 0.8;
