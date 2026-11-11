/** Star-hop questions, click judging, per-myth rounds and module quiz composition. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ResolvedModule } from '@/content/course';
import { starhopSchema, type ConstellationContent, type Lesson, type PathUnit, type Starhop } from '@/content/schema';
import { buildCatalog } from '@/data/catalog';
import { DEFAULT_OBSERVER, type Observer } from '@/types';
import { MASK } from '@/modes/quiz/logic/build';
import { composeModuleQuiz, MODULE_QUIZ_MAX, moduleHopIds } from '@/modes/quiz/logic/module';
import { mulberry32 } from '@/modes/quiz/logic/rng';
import { buildMythSession, buildStarhopSession } from '@/modes/quiz/logic/sessions';
import {
  hopClickQuestion, hopFrame, hopMcqQuestion, hopsFor, hopStartRefs, hopTolerancePx, hopUsable, judgeHopClick, maskHopText, monthsLabel, questionsForHop, SAME_SPOT_DEG,
} from '@/modes/quiz/logic/starhop';
import type { HopQ, McqQ, QuizData } from '@/modes/quiz/logic/types';
import { DIFFICULTY_PRESETS } from '@/store/settings';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(root(p), 'utf8'));
const catalog = buildCatalog({ stars: json('public/data/stars.json'), constellations: json('public/data/constellations.json'), dsos: json('public/data/dsos.json'), images: json('public/data/images.json') });
const readDir = <T,>(dir: string): T[] => readdirSync(root(dir)).filter((f) => f.endsWith('.json')).map((f) => json(`${dir}/${f}`) as T);
const content = readDir<ConstellationContent>('src/content/constellations');
const lessons = readDir<Lesson>('src/content/lessons');
const units = json('src/content/path.json') as PathUnit[];
const realHops = (json('src/content/starhops.json') as Starhop[]).map((h) => starhopSchema.parse(h));
const now = new Date('2026-11-11T17:00:00Z');
const south: Observer = { name: 'Sample southern city', lat: -33.9, lon: 151.2, tz: 'Australia/Sydney', elevationM: 0 };
const data: QuizData = { catalog, content, lessons, units, observer: DEFAULT_OBSERVER, now, hops: realHops };

const fixture = (over: Partial<Starhop> = {}): Starhop =>
  starhopSchema.parse({
    id: 'pointers', name: 'The Pointers to Polaris', rank: 1, method: 'line', from: 'asterism:big-dipper', to: 'star:Polaris',
    summary: 'Two stars of the Big Dipper bowl point to Polaris, the pole star.',
    steps: ['From [[star:Merak|Merak]] through [[star:Dubhe|Dubhe]], go on about five times the gap.', 'You reach [[star:Polaris|Polaris]], the North Star. Polaris barely moves.'],
    path: ['star:Merak', 'star:Dubhe', 'star:Polaris'], distanceDeg: 33, hemisphere: 'N', monthsNorth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], monthsSouth: [], constellations: ['UMa', 'UMi'], ...over,
  });
const fixtures: Starhop[] = [
  fixture(),
  fixture({ id: 'belt', name: "Orion's Belt to Sirius", rank: 2, from: 'asterism:orions-belt', to: 'star:Sirius', hemisphere: 'both', path: ['star:Mintaka', 'star:Alnilam', 'star:Alnitak', 'star:Sirius'], steps: ['Follow [[star:Mintaka|Mintaka]] through Alnitak.', 'Land on [[star:Sirius|Sirius]].'], monthsNorth: [12, 1, 2, 3], monthsSouth: [12, 1, 2, 3] }),
  fixture({ id: 'south-only', name: 'Pointers to the Cross', rank: 3, from: 'star:Rigil Kentaurus', to: 'star:Acrux', hemisphere: 'S', path: ['star:Rigil Kentaurus', 'star:Hadar', 'star:Acrux'], steps: ['From [[star:Rigil Kentaurus|Rigil Kentaurus]] through [[star:Hadar|Hadar]].', 'Reach [[star:Acrux|Acrux]].'], monthsNorth: [], monthsSouth: [3, 4, 5, 6] }),
  fixture({ id: 'to-m31', name: 'The Great Square to M31', rank: 4, from: 'star:Alpheratz', to: 'dso:M31', hemisphere: 'both', path: ['star:Alpheratz', 'star:Mirach', 'dso:M31'], steps: ['From [[star:Alpheratz|Alpheratz]] to [[star:Mirach|Mirach]].', 'Turn up to the [[dso:M31|Andromeda Galaxy]], M31.'], monthsNorth: [9, 10, 11, 12], monthsSouth: [10, 11] }),
];

describe('star-hop pool by hemisphere and month', () => {
  it('uses monthsNorth / monthsSouth by the sign of the latitude', () => {
    expect(hopUsable(fixtures[0], 40)).toBe(true);
    expect(hopUsable(fixtures[0], -34)).toBe(false);
    expect(hopUsable(fixtures[2], -34)).toBe(true);
    expect(hopsFor(fixtures, DEFAULT_OBSERVER, 'any', now).map((h) => h.id)).toEqual(['pointers', 'belt', 'to-m31']);
    // November: the belt (Dec–Mar) is out, M31 (Sep–Dec) is in
    expect(hopsFor(fixtures, DEFAULT_OBSERVER, 'now', now).map((h) => h.id)).toEqual(['pointers', 'to-m31']);
    expect(hopsFor(fixtures, south, 'now', now).map((h) => h.id)).toEqual(['to-m31']);
    expect(hopsFor(fixtures, south, 'any', now).map((h) => h.id)).toEqual(['belt', 'south-only', 'to-m31']);
  });
  it('labels month runs, wrapping over the year end', () => {
    expect(monthsLabel([12, 1, 2])).toBe('December–February');
    expect(monthsLabel([3, 4, 5, 9])).toBe('March–May, September');
    expect(monthsLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
  });
});

describe('follow the hop', () => {
  it('rings the start, masks the target in the steps, keeps the path', () => {
    const q = hopClickQuestion(fixtures[0], catalog)!;
    expect(q.kind).toBe('hop');
    expect(q.itemId).toBe('hop:pointers');
    expect(q.skill).toBe('object');
    expect(q.start).toHaveLength(2); // a pattern start rings two stars
    expect(q.path).toHaveLength(3);
    expect(q.target).toBe(catalog.resolve('star:Polaris')!.ref);
    expect(q.targetName).toBe('Polaris');
    for (const s of q.steps) expect(s).not.toMatch(/Polaris/);
    expect(q.steps[1]).toContain(MASK);
    expect(q.steps[0]).toContain('Merak');
    expect(q.steps.join(' ')).not.toMatch(/\[\[/);
  });
  it('a star start rings one star', () => {
    expect(hopStartRefs(fixtures[2])).toEqual(['star:Rigil Kentaurus']);
    expect(hopStartRefs(fixtures[0])).toEqual(['star:Merak', 'star:Dubhe']);
  });
  it('masks deep-sky names and Messier numbers', () => {
    const t = catalog.resolve('dso:M31')!;
    const out = maskHopText('Turn up to the [[dso:M31|Andromeda Galaxy]], M31.', [t], catalog);
    expect(out).not.toMatch(/M31|Andromeda Galaxy/);
  });
  it('frames the whole hop', () => {
    const pts = fixtures[0].path.map((r) => catalog.resolve(r)!);
    const f = hopFrame(pts);
    expect(f.radius).toBeGreaterThan(10);
    expect(f.radius).toBeLessThan(25);
  });
});

describe('where does this hop lead?', () => {
  it('offers the target among 4 same-kind, nearby, distinct answers (seeded)', () => {
    const a = hopMcqQuestion(fixtures[0], catalog, mulberry32(7)) as McqQ;
    const b = hopMcqQuestion(fixtures[0], catalog, mulberry32(7)) as McqQ;
    expect(a.choices).toEqual(b.choices);
    expect(a.choices).toHaveLength(4);
    expect(new Set(a.choices).size).toBe(4);
    expect(a.choices[a.answerIndex]).toBe('Polaris');
    expect(a.itemId).toBe('hop:pointers');
    expect(a.prompt).not.toMatch(/Polaris/);
    // distractors are named stars, not the path stars
    for (const c of a.choices) expect(['Merak', 'Dubhe']).not.toContain(c);
    for (const c of a.choices) expect(catalog.resolve(`star:${c}`)).toBeTruthy();
  });
  it('deep-sky targets get deep-sky distractors', () => {
    const q = hopMcqQuestion(fixtures[3], catalog, mulberry32(3)) as McqQ;
    expect(q.answerText).toMatch(/^M31/);
    for (const c of q.choices) expect(c).toMatch(/^M\d+|NGC|IC|[A-Z]/);
    expect(q.choices.filter((c) => /^M\d+/.test(c)).length).toBeGreaterThanOrEqual(3);
  });
});

describe('click judging', () => {
  const T = { id: 'star:T', x: 100, y: 100, ra: 10, dec: 10 };
  const near = { id: 'star:N', x: 115, y: 100, ra: 10.6, dec: 10 };
  it('the nearest star within tolerance is the pick', () => {
    expect(judgeHopClick({ x: 104, y: 101 }, T, [near], 20)).toMatchObject({ correct: true });
    expect(judgeHopClick({ x: 112, y: 100 }, T, [near], 20)).toMatchObject({ correct: false, picked: near });
    expect(judgeHopClick({ x: 160, y: 160 }, T, [near], 20)).toMatchObject({ correct: false, picked: null });
  });
  it('a star practically on top of the target counts', () => {
    const twin = { id: 'star:Alcor', x: 103, y: 100, ra: 10 + SAME_SPOT_DEG / 2, dec: 10 };
    expect(judgeHopClick({ x: 104, y: 100 }, T, [twin], 20).correct).toBe(true);
  });
  it('tolerance is about 2° but never under 20 px (28 on touch)', () => {
    expect(hopTolerancePx(860, 60)).toBeCloseTo(28.67, 1);
    expect(hopTolerancePx(860, 120)).toBe(20);
    expect(hopTolerancePx(860, 120, true)).toBe(28);
  });
});

describe('star-hop sessions', () => {
  const diff = DIFFICULTY_PRESETS.easy;
  it('builds a deterministic round from the pool, one item per hop', () => {
    const args = { data: { ...data, hops: fixtures }, diff, items: {}, length: 'all' as const, hops: fixtures, season: 'any' as const, modes: { click: true, mcq: true } };
    const a = buildStarhopSession({ ...args, rng: mulberry32(11) });
    const b = buildStarhopSession({ ...args, rng: mulberry32(11) });
    expect(a.map((q) => q.itemId)).toEqual(b.map((q) => q.itemId));
    expect(new Set(a.map((q) => q.itemId))).toEqual(new Set(['hop:pointers', 'hop:belt', 'hop:to-m31']));
  });
  it('?hop= asks that hop in both formats', () => {
    const qs = buildStarhopSession({ data, diff, items: {}, length: 10, rng: mulberry32(1), hops: fixtures, season: 'now', modes: { click: true, mcq: true }, hop: 'belt' });
    expect(qs.map((q) => q.kind)).toEqual(['hop', 'mcq']);
    expect(new Set(qs.map((q) => q.itemId))).toEqual(new Set(['hop:belt']));
  });
  it('every real star-hop builds both question formats', () => {
    for (const h of realHops) {
      const qs = questionsForHop(h, catalog, { click: true, mcq: true }, mulberry32(5));
      expect(qs.map((q) => q.kind), h.id).toEqual(['hop', 'mcq']);
      const click = qs[0] as HopQ;
      const mcq = qs[1] as McqQ;
      expect(new Set(mcq.choices).size, h.id).toBe(4);
      // the target's name never shows in the steps
      const name = click.targetName.replace(/^M\d+ \((.*)\)$/, '$1');
      for (const s of click.steps) expect(s.includes(name), `${h.id}: ${s}`).toBe(false);
    }
  });
});

describe('per-myth round', () => {
  const story = content.flatMap((c) => c.stories ?? []).find((s) => s.questions.length >= 2)!;
  it('asks exactly that myth: its questions, then which-constellation, then its flashcard', () => {
    const qs = buildMythSession(data, story.id, mulberry32(2));
    const ids = qs.map((q) => q.itemId);
    for (const id of ids) expect(id === `card:${story.id}` || id.startsWith(`story:${story.id}:`)).toBe(true);
    for (const q of story.questions) expect(ids).toContain(`story:${story.id}:${q.id}`);
    expect(ids[ids.length - 1]).toBe(`card:${story.id}`);
  });
  it('unknown myth → empty', () => {
    expect(buildMythSession(data, 'no-such-myth', mulberry32(2))).toEqual([]);
  });
});

describe('module quiz', () => {
  const base = { purpose: 'x'.repeat(20), objectives: ['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10)], optional: false, groups: [], starhopIds: [] };
  const lessonIds = lessons.filter((l) => l.questions?.length).slice(0, 4).map((l) => l.id);
  it('lessons module: questions from those lessons only, capped, every lesson represented', () => {
    const m: ResolvedModule = { ...base, id: 'l', number: 1, title: 'L', kind: 'lessons', lessons: lessonIds };
    const qs = composeModuleQuiz(m, data, realHops, mulberry32(4));
    expect(qs.length).toBeLessThanOrEqual(MODULE_QUIZ_MAX);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(lessonIds).toContain(q.itemId.split(':')[1]);
    expect(new Set(qs.map((q) => q.itemId.split(':')[1])).size).toBe(Math.min(lessonIds.length, qs.length));
  });
  it('starhops module: hop questions plus the lesson, falling back to top usable hops', () => {
    const m: ResolvedModule = { ...base, id: 's', number: 3, title: 'S', kind: 'starhops', lessons: ['star-hopping'], starhopCount: 10 };
    const hopIds = moduleHopIds(m, fixtures, data);
    expect(hopIds).toEqual(['pointers', 'belt', 'to-m31']);
    const qs = composeModuleQuiz(m, data, fixtures, mulberry32(9));
    const hopQs = qs.filter((q) => q.itemId.startsWith('hop:'));
    expect(hopQs).toHaveLength(3);
    expect(hopQs.some((q) => q.kind === 'hop')).toBe(true);
    expect(qs.filter((q) => q.itemId.startsWith('know:star-hopping:')).length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(MODULE_QUIZ_MAX);
    // resolved ids win over the fallback
    expect(moduleHopIds({ ...m, starhopIds: ['belt', 'gone'] }, fixtures, data)).toEqual(['belt']);
  });
  it('constellation module: mixes find, name, story and visibility over its constellations, capped at 12', () => {
    const cons = ['Ori', 'UMa', 'Cas', 'Lyr', 'Cyg', 'Sco', 'Leo', 'Tau', 'Gem'];
    const m: ResolvedModule = { ...base, id: 'a', number: 4, title: 'A', kind: 'anchors', lessons: [], groups: [{ id: 'g', title: 'G', months: [1], constellations: cons }] };
    const a = composeModuleQuiz(m, data, realHops, mulberry32(21));
    const b = composeModuleQuiz(m, data, realHops, mulberry32(21));
    expect(a.map((q) => q.itemId)).toEqual(b.map((q) => q.itemId));
    expect(a).toHaveLength(MODULE_QUIZ_MAX);
    const kinds = new Set(a.map((q) => q.itemId.split(':')[0]));
    for (const k of ['find', 'name', 'story', 'vis']) expect(kinds.has(k), k).toBe(true);
    for (const q of a) expect(cons).toContain(q.con);
    // sky first, then reading
    const firstRead = a.findIndex((q) => q.kind === 'mcq');
    expect(a.slice(firstRead).every((q) => q.kind === 'mcq')).toBe(true);
  });
  it('unresolved constellation module → empty (page says "available soon")', () => {
    const m: ResolvedModule = { ...base, id: 'b', number: 5, title: 'B', kind: 'seasons', lessons: [] };
    expect(composeModuleQuiz(m, data, realHops, mulberry32(1))).toEqual([]);
  });
});
