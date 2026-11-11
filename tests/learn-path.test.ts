import { describe, expect, it } from 'vitest';
import type { PathUnit } from '@/content/schema';
import pathJson from '@/content/path.json';
import { neighbours, nextStepInUnit, pathOverview, unitOfConstellation, unitOfLesson, unitSteps, unitSummary, type PathNames, type ProgressLike } from '@/modes/learn/logic/path';

const units: PathUnit[] = [
  { id: 'u1', title: 'One', stage: 1, blurb: '', lessons: ['l1', 'l2'], constellations: ['UMa', 'UMi'], asterisms: ['big-dipper'] },
  { id: 'u2', title: 'Two', stage: 1, blurb: '', lessons: ['l3', 'ghost'], constellations: ['Ori'], asterisms: [] },
  { id: 'u3', title: 'Three', stage: 2, blurb: '', lessons: [], constellations: ['Leo'], asterisms: [] },
];
const names: PathNames = {
  lesson: (id) => (id === 'ghost' ? undefined : { title: `Lesson ${id}`, minutes: 5 }),
  constellation: (id) => ({ UMa: 'Ursa Major', UMi: 'Ursa Minor', Ori: 'Orion', Leo: 'Leo' })[id],
  asterism: (id) => (id === 'big-dipper' ? 'Big Dipper' : undefined),
};
const empty: ProgressLike = { lessonsDone: {}, seen: {}, unitScores: {}, asterismsSeen: {} };
const PASS = 0.8;

describe('unit checklist', () => {
  it('orders lessons, constellations, asterisms, then the quiz, with the agreed links', () => {
    const steps = unitSteps(units[0], empty, names, PASS);
    expect(steps.map((s) => `${s.kind}:${s.id}`)).toEqual(['lesson:l1', 'lesson:l2', 'constellation:UMa', 'constellation:UMi', 'asterism:big-dipper', 'quiz:u1']);
    expect(steps.map((s) => s.href)).toEqual(['/learn/lesson/l1', '/learn/lesson/l2', '/learn/constellation/UMa', '/learn/constellation/UMi', '/learn/signpost/big-dipper', '/quiz/unit/u1']);
    expect(steps[2].title).toBe('Ursa Major');
    expect(steps.every((s) => !s.done)).toBe(true);
  });
  it('marks steps done from progress and picks the first open one', () => {
    const p: ProgressLike = { ...empty, lessonsDone: { l1: 1 }, seen: { UMa: 1 } };
    const steps = unitSteps(units[0], p, names, PASS);
    expect(nextStepInUnit(steps)?.id).toBe('l2');
    const s = unitSummary(steps, units[0], p);
    expect(s).toMatchObject({ lessonsDone: 1, lessonsTotal: 2, consSeen: 1, consTotal: 2, score: null, passed: false, started: true });
    expect(s.fraction).toBeCloseTo(2 / 6);
  });
  it('a lesson that is not written yet is unavailable and never blocks', () => {
    const steps = unitSteps(units[1], { ...empty, lessonsDone: { l3: 1 } }, names, PASS);
    expect(steps[1]).toMatchObject({ id: 'ghost', available: false });
    expect(nextStepInUnit(steps)?.id).toBe('Ori');
    expect(unitSummary(steps, units[1], empty).lessonsTotal).toBe(1);
  });
  it('the quiz passes only at the pass score', () => {
    const below = unitSteps(units[0], { ...empty, unitScores: { u1: 0.79 } }, names, PASS);
    expect(below.at(-1)!.done).toBe(false);
    expect(unitSummary(below, units[0], { ...empty, unitScores: { u1: 0.79 } })).toMatchObject({ score: 0.79, passed: false, started: true });
    expect(unitSteps(units[0], { ...empty, unitScores: { u1: 0.8 } }, names, PASS).at(-1)!.done).toBe(true);
  });
});

describe('path overview', () => {
  it('starts at the first step of the first unit', () => {
    const o = pathOverview(units, empty, names, PASS);
    expect(o.units.map((u) => u.state)).toEqual(['current', 'up-next', 'later']);
    expect(o.current).toMatchObject({ unit: { id: 'u1' }, step: { kind: 'lesson', id: 'l1' } });
    expect(o.passedCount).toBe(0);
  });
  it('sends the learner to the unit quiz when everything else is done', () => {
    const p: ProgressLike = { lessonsDone: { l1: 1, l2: 1 }, seen: { UMa: 1, UMi: 1 }, unitScores: {}, asterismsSeen: { 'big-dipper': 1 } };
    expect(pathOverview(units, p, names, PASS).current?.step).toMatchObject({ kind: 'quiz', href: '/quiz/unit/u1' });
  });
  it('moves on once a unit is passed, even if pages were skipped', () => {
    const o = pathOverview(units, { ...empty, unitScores: { u1: 0.9 } }, names, PASS);
    expect(o.units.map((u) => u.state)).toEqual(['passed', 'current', 'up-next']);
    expect(o.current).toMatchObject({ unit: { id: 'u2' }, step: { id: 'l3' } });
  });
  it('a later unit passed out of order stays passed and is skipped for "up next"', () => {
    const o = pathOverview(units, { ...empty, unitScores: { u2: 1 } }, names, PASS);
    expect(o.units.map((u) => u.state)).toEqual(['current', 'passed', 'up-next']);
  });
  it('never locks: every unpassed unit keeps its own next step', () => {
    const o = pathOverview(units, empty, names, PASS);
    expect(o.units.map((u) => u.next?.id)).toEqual(['l1', 'l3', 'Leo']);
  });
  it('has nothing to continue when all units are passed', () => {
    const o = pathOverview(units, { ...empty, unitScores: { u1: 1, u2: 1, u3: 1 } }, names, PASS);
    expect(o.current).toBeNull();
    expect(o.passedCount).toBe(3);
  });
  it('works on the real path: 19 units, 88 constellations, each once', () => {
    const real = pathJson as PathUnit[];
    const o = pathOverview(real, empty, { lesson: (id) => ({ title: id }), constellation: (id) => id, asterism: (id) => id }, PASS);
    expect(o.units[0].state).toBe('current');
    const cons = real.flatMap((u) => u.constellations);
    expect(new Set(cons).size).toBe(88);
    expect(cons.length).toBe(88);
    expect(o.current?.step.href).toBe(`/learn/lesson/${real[0].lessons[0]}`);
  });
});

describe('helpers', () => {
  it('neighbours and lookups', () => {
    expect(neighbours(['a', 'b', 'c'], 1)).toEqual({ prev: 'a', next: 'c' });
    expect(neighbours(['a', 'b', 'c'], 0)).toEqual({ prev: null, next: 'b' });
    expect(neighbours(['a'], -1)).toEqual({ prev: null, next: null });
    expect(unitOfConstellation(units, 'Ori')?.id).toBe('u2');
    expect(unitOfLesson(units, 'l2')?.id).toBe('u1');
    expect(unitOfLesson(units, 'nope')).toBeUndefined();
  });
});
