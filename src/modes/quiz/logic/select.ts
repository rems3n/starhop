/** Choosing what to ask (spaced repetition mix), grading, and small progress summaries. */
import { itemMastery, type Grade, type ItemProgress } from '@/store/progress';
import { shuffle, type Rng } from './rng';
import type { SessionLength } from './types';

/** Share of a session given to each kind of item (see docs/QUIZ.md). */
export const SESSION_MIX = { due: 0.5, weak: 0.25, fresh: 0.25 } as const;
/** Mastery below this counts as "weak". */
export const WEAK_BELOW = 0.6;
/** Mastery at or above this counts as "mastered" on the dashboard. */
export const MASTERED_AT = 0.8;

export interface Buckets {
  /** Seen before and due now, weakest first */
  due: string[];
  /** Seen, not due yet, mastery below WEAK_BELOW, weakest first */
  weak: string[];
  /** Never attempted */
  fresh: string[];
  /** Seen, not due, doing fine */
  rest: string[];
}

export function bucketItems(candidates: readonly string[], items: Record<string, ItemProgress>, now: number): Buckets {
  const b: Buckets = { due: [], weak: [], fresh: [], rest: [] };
  const m = (id: string) => itemMastery(items[id]) ?? 0;
  for (const id of new Set(candidates)) {
    const p = items[id];
    if (!p || p.attempts === 0) b.fresh.push(id);
    else if (p.due <= now) b.due.push(id);
    else if (m(id) < WEAK_BELOW) b.weak.push(id);
    else b.rest.push(id);
  }
  b.due.sort((x, y) => m(x) - m(y) || items[x].due - items[y].due);
  b.weak.sort((x, y) => m(x) - m(y));
  return b;
}

/**
 * Pick the items for one session.
 * With n slots: half go to due items (weakest first), a quarter to weak items that are not due yet, a
 * quarter to items never tried (random). Slots a bucket cannot fill are handed on in the order
 * due → new → weak → everything else, so a beginner gets all-new rounds and a caught-up learner gets
 * fresh material. The result is shuffled. 'all' (or n ≥ the pool) returns every candidate, shuffled.
 */
export function selectSession(candidates: readonly string[], items: Record<string, ItemProgress>, n: SessionLength, now: number, rng: Rng): string[] {
  const unique = [...new Set(candidates)];
  if (n === 'all' || n >= unique.length) return shuffle(unique, rng);
  const b = bucketItems(unique, items, now);
  const fresh = shuffle(b.fresh, rng);
  const rest = shuffle(b.rest, rng);
  const quota = { due: Math.round(n * SESSION_MIX.due), weak: Math.round(n * SESSION_MIX.weak), fresh: 0 };
  quota.fresh = n - quota.due - quota.weak;
  const out = [...b.due.slice(0, quota.due), ...b.weak.slice(0, quota.weak), ...fresh.slice(0, quota.fresh)];
  const taken = new Set(out);
  for (const list of [b.due, fresh, b.weak, rest]) {
    for (const id of list) {
      if (out.length >= n) break;
      if (!taken.has(id)) {
        taken.add(id);
        out.push(id);
      }
    }
  }
  return shuffle(out, rng);
}

/**
 * Answer → SM-2 grade. Wrong (or skipped, or out of time) = 0 "again"; right = 2 "good";
 * right, quick (under `fastMs`) and without help = 3 "easy".
 */
export function gradeFor(a: { correct: boolean; ms: number; fastMs: number; aided: boolean }): Grade {
  if (!a.correct) return 0;
  return a.ms <= a.fastMs && !a.aided ? 3 : 2;
}

/** Flashcard buttons. */
export const SELF_GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: 0, label: 'Again', hint: 'I did not remember it' },
  { grade: 1, label: 'Hard', hint: 'I got some of it' },
  { grade: 2, label: 'Good', hint: 'I remembered it' },
  { grade: 3, label: 'Easy', hint: 'I knew it at once' },
];

/** Time limits (seconds) when the timer is on, and what counts as "quick". */
export const TIME_LIMIT_S = { find: 60, findAnywhere: 100, name: 20, nameTyped: 30, skyobj: 20, mcq: 30 } as const;
export const FAST_MS = { find: 15000, name: 6000, nameTyped: 10000, skyobj: 6000, mcq: 8000 } as const;

const SKILLS = ['find', 'name', 'story', 'visibility'] as const;

/** Mean mastery over the skills a constellation has been practised in; null if untouched. */
export function conScore(items: Record<string, ItemProgress>, con: string): number | null {
  const sums: Partial<Record<(typeof SKILLS)[number], { t: number; n: number }>> = {};
  for (const p of Object.values(items)) {
    if (p.con !== con) continue;
    const skill = SKILLS.find((s) => s === p.skill);
    const m = itemMastery(p);
    if (!skill || m == null) continue;
    const s = (sums[skill] ??= { t: 0, n: 0 });
    s.t += m;
    s.n += 1;
  }
  const means = Object.values(sums).map((s) => s.t / s.n);
  return means.length ? means.reduce((a, b) => a + b, 0) / means.length : null;
}

/** Started constellations with the lowest scores, weakest first. */
export function weakestConstellations(items: Record<string, ItemProgress>, conIds: readonly string[], limit = 5): { id: string; score: number }[] {
  const out: { id: string; score: number }[] = [];
  for (const id of conIds) {
    const score = conScore(items, id);
    if (score != null) out.push({ id, score });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}

const DAY = 86_400_000;

/**
 * Accuracy over the last 7 days, as far as the store lets us tell: it keeps only each item's latest answer
 * time, so this is "of the items practised in the last 7 days, the share whose most recent answer was right".
 */
export function recentAccuracy(items: Record<string, ItemProgress>, now: number, days = 7): { practised: number; right: number; ratio: number | null } {
  let practised = 0, right = 0;
  for (const p of Object.values(items)) {
    if (!p.last || now - p.last > days * DAY || !p.history.length) continue;
    practised++;
    if (p.history[p.history.length - 1] > 0) right++;
  }
  return { practised, right, ratio: practised ? right / practised : null };
}

/** Epoch ms of the next item to fall due after `now`, or null. */
export function nextDue(items: Record<string, ItemProgress>, now: number): number | null {
  let best: number | null = null;
  for (const p of Object.values(items)) if (p.due > now && (best == null || p.due < best)) best = p.due;
  return best;
}

/** "in 10 minutes", "in 3 hours", "tomorrow", "in 4 days". */
export function untilWords(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `in ${min} minute${min === 1 ? '' : 's'}`;
  const h = Math.round(min / 60);
  if (h < 20) return `in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return d <= 1 ? 'tomorrow' : `in ${d} days`;
}
