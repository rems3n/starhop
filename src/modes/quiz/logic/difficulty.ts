import { DIFFICULTY_PRESETS, type QuizDifficulty } from '@/store/settings';

export type PresetName = keyof typeof DIFFICULTY_PRESETS;
export const PRESET_NAMES: PresetName[] = ['easy', 'medium', 'hard', 'expert'];
export const PRESET_LABEL: Record<PresetName, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** Which preset the current settings equal exactly, or null for "Custom". */
export function matchingPreset(d: QuizDifficulty): PresetName | null {
  for (const name of PRESET_NAMES) {
    const p = DIFFICULTY_PRESETS[name];
    if ((Object.keys(p) as (keyof QuizDifficulty)[]).every((k) => (k === 'limitingMag' ? Math.abs(p[k] - d[k]) < 0.05 : p[k] === d[k]))) return name;
  }
  return null;
}

/** Number of catalog stars at or brighter than a limiting magnitude (`mags` sorted ascending). */
export function starCount(mags: readonly number[], limitingMag: number): number {
  let lo = 0, hi = mags.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mags[mid] <= limitingMag + 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
