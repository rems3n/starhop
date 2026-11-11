/** Wrong answers that are worth thinking about. */
import type { Constellation } from '@/types';
import { shuffle, type Rng } from './rng';

type Con = Pick<Constellation, 'id' | 'ra' | 'dec' | 'season'>;

const DEG = Math.PI / 180;
function sep(a: Con, b: Con): number {
  const s = Math.sin(a.dec * DEG) * Math.sin(b.dec * DEG) + Math.cos(a.dec * DEG) * Math.cos(b.dec * DEG) * Math.cos((a.ra - b.ra) * DEG);
  return Math.acos(Math.max(-1, Math.min(1, s))) / DEG;
}

/** How many of the nearest constellations count as "neighbours". */
export const NEIGHBOUR_COUNT = 6;

/**
 * `n` distinct constellation ids to offer next to `target`: first up to two of its six nearest neighbours
 * (the ones a learner really confuses it with), then constellations of the same evening season, then
 * anything else. `universe` restricts the candidates (e.g. to constellations that have a story).
 */
export function constellationDistractors(target: Con, universe: readonly Con[], rng: Rng, n = 3): string[] {
  const others = universe.filter((c) => c.id !== target.id);
  const near = [...others].sort((a, b) => sep(target, a) - sep(target, b)).slice(0, NEIGHBOUR_COUNT);
  const out: string[] = [];
  const take = (list: readonly Con[], max: number) => {
    for (const c of shuffle(list, rng)) {
      if (out.length >= max) break;
      if (!out.includes(c.id)) out.push(c.id);
    }
  };
  take(near, Math.min(n, 2));
  take(others.filter((c) => c.season === target.season), n);
  take(near, n);
  take(others, n);
  return out.slice(0, n);
}

const key = (s: string) => s.trim().toLowerCase();

/** Up to `n` candidates that differ from the answer and from each other (ignoring case), in random order. */
export function pickDistinct(answer: string, candidates: readonly string[], rng: Rng, n = 3): string[] {
  const seen = new Set([key(answer)]);
  const out: string[] = [];
  for (const c of shuffle(candidates, rng)) {
    if (out.length >= n) break;
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    out.push(c);
  }
  return out;
}

/** Shuffle the answer in among the distractors. */
export function buildChoices<T>(answer: T, distractors: readonly T[], rng: Rng): { choices: T[]; answerIndex: number } {
  const choices = shuffle([answer, ...distractors], rng);
  return { choices, answerIndex: choices.indexOf(answer) };
}
