/** Checking a typed constellation name. */
import type { Constellation } from '@/types';

type Named = Pick<Constellation, 'id' | 'name' | 'english'>;

/** Lower-case, strip accents and anything that is not a letter or digit ("Boötes" → "bootes", "Canis  Major" → "canismajor"). */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const englishKey = (english: string) => normalizeAnswer(english.replace(/^the\s+/i, ''));

/** Damerau–Levenshtein distance (insert, delete, substitute, swap two neighbours). */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** Typos allowed for a name of this many letters: none up to 4, one for 5–8, two for 9 or more. */
export function typoAllowance(length: number): number {
  return length <= 4 ? 0 : length <= 8 ? 1 : 2;
}

export interface MatchResult {
  correct: boolean;
  /** How it matched */
  via: 'name' | 'abbreviation' | 'english' | 'typo' | null;
}

/**
 * Is `input` an acceptable way to write `target`?
 * Accepted: the Latin name, the IAU abbreviation, or the English name ("the Hunter" / "hunter"), ignoring
 * case, accents, spaces and punctuation; or the Latin name with a small typo (see `typoAllowance`).
 * A typo is only forgiven when the input is strictly closer to the target than to every other
 * constellation name, and is not itself another constellation's exact name or abbreviation — so
 * "Ursa Minor" never passes for Ursa Major and "Corona Australis" never passes for Corona Borealis.
 */
export function matchConstellation(input: string, target: Named, all: readonly Named[]): MatchResult {
  const typed = normalizeAnswer(input);
  if (!typed) return { correct: false, via: null };
  // "the Hunter" and "Hunter" both count as the English name
  const typedEnglish = englishKey(input.trim());
  const name = normalizeAnswer(target.name);
  if (typed === name) return { correct: true, via: 'name' };
  if (typed === normalizeAnswer(target.id)) return { correct: true, via: 'abbreviation' };
  if (typedEnglish === englishKey(target.english)) return { correct: true, via: 'english' };

  const others = all.filter((c) => c.id !== target.id);
  // an exact hit on a different constellation is simply a wrong answer
  if (others.some((c) => typed === normalizeAnswer(c.name) || typed === normalizeAnswer(c.id) || typedEnglish === englishKey(c.english))) return { correct: false, via: null };

  const allow = typoAllowance(name.length);
  if (!allow) return { correct: false, via: null };
  const d = editDistance(typed, name);
  if (d > allow) return { correct: false, via: null };
  for (const c of others) if (editDistance(typed, normalizeAnswer(c.name)) <= d) return { correct: false, via: null };
  return { correct: true, via: 'typo' };
}
