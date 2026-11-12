import { describe, expect, it } from 'vitest';
import { mergeProgress } from '@/lib/account';
import { withDefaults } from '@/store/settings';
import { DEFAULT_LAYERS } from '@/types';

const item = (id: string, attempts: number, last: number) => ({ id, skill: 'find', ease: 2.5, intervalDays: 1, due: 0, reps: attempts, lapses: 0, attempts, correct: attempts, last, history: [] });

describe('merging progress from two devices', () => {
  it('keeps each item from whichever side practised it more, and everything learned on either side', () => {
    const phone = { items: { a: item('a', 5, 10), b: item('b', 1, 50) }, lessonsDone: { l1: 100 }, unitScores: { u1: 0.6 }, seen: { Ori: 30 } };
    const laptop = { items: { a: item('a', 2, 99), c: item('c', 3, 5) }, lessonsDone: { l1: 80, l2: 90 }, unitScores: { u1: 0.9, u2: 0.4 }, seen: { Ori: 20, Cas: 40 } };
    const m = mergeProgress(phone, laptop) as { items: Record<string, { attempts: number }>; lessonsDone: Record<string, number>; unitScores: Record<string, number>; seen: Record<string, number> };
    expect(Object.keys(m.items).sort()).toEqual(['a', 'b', 'c']);
    expect(m.items.a.attempts).toBe(5);
    expect(m.lessonsDone).toEqual({ l1: 80, l2: 90 });
    expect(m.unitScores).toEqual({ u1: 0.9, u2: 0.4 });
    expect(m.seen).toEqual({ Ori: 20, Cas: 40 });
  });
  it('breaks ties on attempts by the most recent practice', () => {
    const m = mergeProgress({ items: { a: item('a', 2, 10) } }, { items: { a: item('a', 2, 20) } }) as { items: Record<string, { last: number }> };
    expect(m.items.a.last).toBe(20);
  });
});

describe('sky map defaults', () => {
  it('starts each visit from the saved defaults', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = withDefaults({ layers: { ...DEFAULT_LAYERS, constellationArt: true }, bortle: 9, defaultLayers: { ...DEFAULT_LAYERS, ecliptic: true }, defaultBortle: 3 } as any);
    expect(s.layers.ecliptic).toBe(true);
    expect(s.layers.constellationArt).toBe(false);
    expect(s.bortle).toBe(3);
  });
});
