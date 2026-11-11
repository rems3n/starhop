/** Quiz pure logic: pools, distractors, typed-answer matching, session selection, grades, difficulty presets. */
import { describe, expect, it } from 'vitest';
import pathJson from '@/content/path.json';
import type { PathUnit } from '@/content/schema';
import { schedule, type Grade, type ItemProgress } from '@/store/progress';
import { DIFFICULTY_PRESETS } from '@/store/settings';
import { ANCHORS } from '@/types';
import { matchingPreset, starCount } from '@/modes/quiz/logic/difficulty';
import { buildChoices, constellationDistractors, NEIGHBOUR_COUNT, pickDistinct } from '@/modes/quiz/logic/distractors';
import { editDistance, matchConstellation, normalizeAnswer, typoAllowance } from '@/modes/quiz/logic/match';
import { buildPool, poolLabel, poolOptions } from '@/modes/quiz/logic/pools';
import { mulberry32 } from '@/modes/quiz/logic/rng';
import type { SessionLength } from '@/modes/quiz/logic/types';
import { bucketItems, conScore, gradeFor, nextDue, recentAccuracy, selectSession, SELF_GRADES, untilWords, weakestConstellations } from '@/modes/quiz/logic/select';
import { learnCatalog } from './learn-catalog';

const catalog = learnCatalog();
const units = pathJson as PathUnit[];
const ctx = { constellations: catalog.constellations, units };
const con = (id: string) => catalog.conById.get(id)!;

describe('buildPool', () => {
  it('anchors = the 15 anchors in authored order', () => {
    expect(buildPool('anchors', ctx)).toEqual([...ANCHORS]);
  });
  it('all = 88', () => {
    expect(buildPool('all', ctx)).toHaveLength(88);
  });
  it('season pools partition the sky', () => {
    const seasons = ['winter', 'spring', 'summer', 'autumn', 'north-circumpolar', 'far-south'];
    const ids = seasons.flatMap((s) => buildPool(`season:${s}`, ctx));
    expect(ids).toHaveLength(88);
    expect(new Set(ids).size).toBe(88);
    expect(buildPool('season:winter', ctx)).toContain('Ori');
    for (const id of buildPool('season:summer', ctx)) expect(con(id).season).toBe('summer');
  });
  it('hemisphere pools split N/S', () => {
    const n = buildPool('hemisphere:N', ctx), s = buildPool('hemisphere:S', ctx);
    expect(n.length + s.length).toBe(88);
    expect(n).toContain('UMa');
    expect(s).toContain('Cru');
    for (const id of s) expect(con(id).hemisphere).toBe('S');
  });
  it('tonight keeps given order, drops unknown ids and duplicates', () => {
    expect(buildPool('tonight', { ...ctx, tonightIds: ['Cyg', 'Nope', 'Lyr', 'Cyg'] })).toEqual(['Cyg', 'Lyr']);
    expect(buildPool('tonight', ctx)).toEqual([]);
  });
  it('unit pools follow path.json', () => {
    for (const u of units) expect(buildPool(`unit:${u.id}`, ctx)).toEqual(u.constellations);
    expect(buildPool('unit:missing', ctx)).toEqual([]);
  });
  it('unknown spec falls back to anchors', () => {
    expect(buildPool('bogus', ctx)).toEqual([...ANCHORS]);
  });
  it('labels and options cover every kind', () => {
    expect(poolLabel('anchors', ctx)).toMatch(/anchors/);
    expect(poolLabel('hemisphere:S', ctx)).toBe('Southern hemisphere');
    expect(poolLabel(`unit:${units[0].id}`, ctx)).toBe(units[0].title);
    const values = poolOptions(ctx).flatMap((g) => g.options.map((o) => o.value));
    expect(values).toContain('tonight');
    expect(values).toContain('all');
    expect(values.filter((v) => v.startsWith('unit:'))).toHaveLength(units.length);
  });
});

describe('distractors', () => {
  it('constellationDistractors: 3 distinct wrong answers, target excluded, for every constellation and seed', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = mulberry32(seed);
      for (const c of catalog.constellations) {
        const d = constellationDistractors(c, catalog.constellations, rng, 3);
        expect(d).toHaveLength(3);
        expect(new Set(d).size).toBe(3);
        expect(d).not.toContain(c.id);
        const { choices, answerIndex } = buildChoices(c.id, d, rng);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices[answerIndex]).toBe(c.id);
      }
    }
  });
  it('includes at least one near neighbour', () => {
    const rng = mulberry32(7);
    const ori = con('Ori');
    const sep = (b: typeof ori) => Math.hypot((ori.ra - b.ra) * Math.cos((ori.dec * Math.PI) / 180), ori.dec - b.dec);
    const near = catalog.constellations.filter((c) => c.id !== 'Ori').sort((a, b) => sep(a) - sep(b)).slice(0, NEIGHBOUR_COUNT).map((c) => c.id);
    for (let i = 0; i < 20; i++) expect(constellationDistractors(ori, catalog.constellations, rng).some((id) => near.includes(id))).toBe(true);
  });
  it('small universes give fewer, never duplicates', () => {
    const u = ['Ori', 'Tau', 'Gem'].map(con);
    expect(constellationDistractors(con('Ori'), u, mulberry32(1))).toHaveLength(2);
  });
  it('pickDistinct ignores case duplicates and the answer', () => {
    const out = pickDistinct('Vega', ['vega', 'Deneb', 'DENEB', 'Altair', 'altair', 'Sirius'], mulberry32(3), 3);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((s) => s.toLowerCase())).size).toBe(3);
    expect(out.map((s) => s.toLowerCase())).not.toContain('vega');
  });
});

describe('matchConstellation', () => {
  const all = catalog.constellations;
  const ok = (input: string, id: string) => matchConstellation(input, con(id), all).correct;
  it('accepts name, abbreviation and English name, any case, accents optional', () => {
    expect(ok('Orion', 'Ori')).toBe(true);
    expect(ok('orion', 'Ori')).toBe(true);
    expect(ok('ORI', 'Ori')).toBe(true);
    expect(ok('uma', 'UMa')).toBe(true);
    expect(ok('ursa major', 'UMa')).toBe(true);
    expect(ok('UrsaMajor', 'UMa')).toBe(true);
    expect(ok('Bootes', 'Boo')).toBe(true);
    expect(ok('Boötes', 'Boo')).toBe(true);
    expect(ok('the hunter', 'Ori')).toBe(true);
    expect(ok('Great Bear', 'UMa')).toBe(true);
    expect(ok('  Canis   Major ', 'CMa')).toBe(true);
  });
  it('forgives small typos', () => {
    expect(ok('Orian', 'Ori')).toBe(true);
    expect(ok('Casiopeia', 'Cas')).toBe(true);
    expect(ok('Cassiopea', 'Cas')).toBe(true);
    expect(ok('Sagitarius', 'Sgr')).toBe(true);
    expect(ok('Andromeda', 'And')).toBe(true);
    expect(ok('Andromda', 'And')).toBe(true);
    expect(ok('Ursa Majr', 'UMa')).toBe(true);
    expect(matchConstellation('Orian', con('Ori'), all).via).toBe('typo');
  });
  it('rejects look-alike constellations', () => {
    const pairs: [string, string][] = [
      ['Corona Australis', 'CrB'], ['Ursa Minor', 'UMa'], ['Canis Minor', 'CMa'], ['Leo Minor', 'Leo'],
      ['Triangulum Australe', 'Tri'], ['Piscis Austrinus', 'Psc'],
      // and the other way round
      ['Corona Borealis', 'CrA'], ['Ursa Major', 'UMi'], ['Canis Major', 'CMi'], ['Leo', 'LMi'], ['Triangulum', 'TrA'], ['Pisces', 'PsA'],
      // abbreviations of the look-alike
      ['CrA', 'CrB'], ['UMi', 'UMa'], ['LMi', 'Leo'],
    ];
    for (const [input, id] of pairs) expect(ok(input, id), `${input} for ${id}`).toBe(false);
  });
  it('rejects near-misses that are closer to another name, and junk', () => {
    expect(ok('Ursa Minr', 'UMa')).toBe(false);
    expect(ok('Corona Austral', 'CrB')).toBe(false);
    expect(ok('', 'Ori')).toBe(false);
    expect(ok('Lep', 'Leo')).toBe(false);
    expect(ok('Lyra', 'Leo')).toBe(false);
    expect(ok('Cygnus', 'Ori')).toBe(false);
  });
  it('every constellation accepts its own name and abbreviation and rejects every other exact name', () => {
    for (const c of all) {
      expect(ok(c.name, c.id)).toBe(true);
      expect(ok(c.id.toLowerCase(), c.id)).toBe(true);
      for (const o of all) if (o.id !== c.id) expect(matchConstellation(o.name, c, all).correct, `${o.name} for ${c.name}`).toBe(false);
    }
  });
  it('helpers', () => {
    expect(normalizeAnswer('Boötes!')).toBe('bootes');
    expect(editDistance('orion', 'orino')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect([typoAllowance(4), typoAllowance(5), typoAllowance(8), typoAllowance(9)]).toEqual([0, 1, 1, 2]);
  });
});

// ───────────── session selection

const NOW = Date.UTC(2026, 10, 11, 12);
const DAY = 86_400_000;
function item(id: string, grades: Grade[], dueOffset: number): ItemProgress {
  let p: ItemProgress | undefined;
  for (const g of grades) p = schedule(p, id, 'find', id.split(':')[1], g, NOW - 30 * DAY);
  return { ...p!, due: NOW + dueOffset };
}

describe('selectSession', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `find:C${i}`);
  // 0–9 due (mixed mastery), 10–19 weak and not due, 20–29 fine and not due, 30–39 never tried
  const items: Record<string, ItemProgress> = {};
  for (let i = 0; i < 10; i++) items[ids[i]] = item(ids[i], i < 5 ? [0, 0] : [2, 2, 2], -DAY);
  for (let i = 10; i < 20; i++) items[ids[i]] = item(ids[i], [0, 0, 2], DAY);
  for (let i = 20; i < 30; i++) items[ids[i]] = { ...item(ids[i], [2, 2, 3, 3], DAY), intervalDays: 30 };
  const bucketOf = (id: string) => { const n = Number(id.slice(6)); return n < 10 ? 'due' : n < 20 ? 'weak' : n < 30 ? 'rest' : 'fresh'; };

  it('buckets items', () => {
    const b = bucketItems(ids, items, NOW);
    expect(b.due).toHaveLength(10);
    expect(b.weak).toHaveLength(10);
    expect(b.rest).toHaveLength(10);
    expect(b.fresh).toHaveLength(10);
    // weakest due first
    expect(b.due.slice(0, 5).every((id) => Number(id.slice(6)) < 5)).toBe(true);
  });
  it('n = 10 → 5 due (weakest), 3 weak, 2 new', () => {
    const out = selectSession(ids, items, 10, NOW, mulberry32(1));
    expect(out).toHaveLength(10);
    expect(new Set(out).size).toBe(10);
    const count = (k: string) => out.filter((id) => bucketOf(id) === k).length;
    expect(count('due')).toBe(5);
    expect(count('weak')).toBe(3);
    expect(count('fresh')).toBe(2);
    expect(out.filter((id) => bucketOf(id) === 'due').every((id) => Number(id.slice(6)) < 5)).toBe(true);
  });
  it('n = 20 → 10 due, 5 weak, 5 new', () => {
    const out = selectSession(ids, items, 20, NOW, mulberry32(2));
    const count = (k: string) => out.filter((id) => bucketOf(id) === k).length;
    expect([count('due'), count('weak'), count('fresh'), count('rest')]).toEqual([10, 5, 5, 0]);
  });
  it('a beginner gets all-new rounds', () => {
    const out = selectSession(ids, {}, 10, NOW, mulberry32(3));
    expect(out).toHaveLength(10);
    expect(new Set(out).size).toBe(10);
  });
  it('unfilled slots pass on: due → new → weak → rest', () => {
    const few: Record<string, ItemProgress> = { [ids[0]]: items[ids[0]], [ids[20]]: items[ids[20]], [ids[21]]: items[ids[21]] };
    const out = selectSession([ids[0], ids[20], ids[21], ids[30], ids[31]], few, 4 as SessionLength, NOW, mulberry32(4));
    expect(out).toContain(ids[0]);
    expect(out).toContain(ids[30]);
    expect(out).toContain(ids[31]);
    expect(out).toHaveLength(4);
  });
  it("'all' or n ≥ pool returns every candidate once", () => {
    expect(selectSession([...ids, ids[0]], items, 'all', NOW, mulberry32(5)).sort()).toEqual([...ids].sort());
    expect(selectSession(ids.slice(0, 3), items, 5, NOW, mulberry32(5))).toHaveLength(3);
  });
  it('is deterministic for a seed', () => {
    expect(selectSession(ids, items, 10, NOW, mulberry32(9))).toEqual(selectSession(ids, items, 10, NOW, mulberry32(9)));
  });
});

describe('grades', () => {
  it('maps answers to SM-2 grades', () => {
    expect(gradeFor({ correct: false, ms: 1000, fastMs: 5000, aided: false })).toBe(0);
    expect(gradeFor({ correct: true, ms: 1000, fastMs: 5000, aided: false })).toBe(3);
    expect(gradeFor({ correct: true, ms: 1000, fastMs: 5000, aided: true })).toBe(2);
    expect(gradeFor({ correct: true, ms: 9000, fastMs: 5000, aided: false })).toBe(2);
  });
  it('flashcard buttons are Again/Hard/Good/Easy = 0..3', () => {
    expect(SELF_GRADES.map((g) => [g.label, g.grade])).toEqual([['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]]);
  });
});

describe('progress summaries', () => {
  const items: Record<string, ItemProgress> = {
    'find:Ori': item('find:Ori', [0, 0], -DAY),
    'name:Ori': item('name:Ori', [2, 2, 2], DAY),
    'find:Lyr': item('find:Lyr', [2, 2, 3], 2 * DAY),
  };
  items['name:Ori'] = { ...items['name:Ori'], skill: 'name' };
  it('conScore averages skills; weakest first', () => {
    expect(conScore(items, 'Ori')).not.toBeNull();
    expect(conScore(items, 'Cyg')).toBeNull();
    const w = weakestConstellations(items, ['Ori', 'Lyr', 'Cyg']);
    expect(w.map((x) => x.id)).toEqual(['Ori', 'Lyr']);
  });
  it('nextDue, recentAccuracy, untilWords', () => {
    expect(nextDue(items, NOW)).toBe(NOW + DAY);
    const acc = recentAccuracy(Object.fromEntries(Object.entries(items).map(([k, p]) => [k, { ...p, last: NOW - DAY }])), NOW);
    expect(acc).toEqual({ practised: 3, right: 2, ratio: 2 / 3 });
    expect(untilWords(5 * 60000)).toBe('in 5 minutes');
    expect(untilWords(3 * 3600000)).toBe('in 3 hours');
    expect(untilWords(DAY)).toBe('tomorrow');
    expect(untilWords(4 * DAY)).toBe('in 4 days');
  });
});

describe('difficulty', () => {
  it('each preset matches itself; a tweak is Custom', () => {
    for (const name of ['easy', 'medium', 'hard', 'expert'] as const) expect(matchingPreset(DIFFICULTY_PRESETS[name])).toBe(name);
    expect(matchingPreset({ ...DIFFICULTY_PRESETS.easy, timer: true })).toBeNull();
  });
  it('starCount counts stars at or brighter than the limit', () => {
    const mags = catalog.stars.map((s) => s.mag).sort((a, b) => a - b);
    expect(starCount(mags, 99)).toBe(mags.length);
    expect(starCount(mags, -5)).toBe(0);
    expect(starCount(mags, 4)).toBe(mags.filter((m) => m <= 4).length);
  });
});
