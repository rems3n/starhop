/** Quiz question builders on the real catalog and authored content: unit quiz, stories, objects, computed sky knowledge, review. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ConstellationContent, Lesson, PathUnit } from '@/content/schema';
import pathJson from '@/content/path.json';
import { buildCatalog } from '@/data/catalog';
import { DIFFICULTY_PRESETS } from '@/store/settings';
import { DEFAULT_OBSERVER } from '@/types';
import {
  cardQuestion, composeUnitQuiz, listStories, maskConstellation, MASK, objectBuilders, questionForItem, storyBuilders, UNIT_MAX_LESSON, UNIT_MAX_STORY, whichMythQuestion,
} from '@/modes/quiz/logic/build';
import { circumpolarClass, circumpolarQuestion, computeFacts, monthQuestion, polarisQuestion, seasonQuestion, visibilityQuestion, visibilityQuestionsFor } from '@/modes/quiz/logic/knowledge';
import { mulberry32 } from '@/modes/quiz/logic/rng';
import { buildFindSession, buildKnowledgeSession, buildNameSession, buildStorySession, buildVisibilitySession, reviewContext } from '@/modes/quiz/logic/sessions';
import type { McqQ, Question, QuizData } from '@/modes/quiz/logic/types';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(root(p), 'utf8'));
const catalog = buildCatalog({ stars: json('public/data/stars.json'), constellations: json('public/data/constellations.json'), dsos: json('public/data/dsos.json'), images: json('public/data/images.json') });
const readDir = <T,>(dir: string): T[] => readdirSync(root(dir)).filter((f) => f.endsWith('.json')).map((f) => json(`${dir}/${f}`) as T);
const content = readDir<ConstellationContent>('src/content/constellations');
const lessons = readDir<Lesson>('src/content/lessons');
const units = pathJson as PathUnit[];
const observer = DEFAULT_OBSERVER;
const now = new Date('2026-11-11T17:00:00Z');
const data: QuizData = { catalog, content, lessons, units, observer, now };
const con = (id: string) => catalog.conById.get(id)!;

function checkMcq(q: McqQ) {
  expect(q.choices.length).toBeGreaterThanOrEqual(3);
  expect(new Set(q.choices.map((c) => c.toLowerCase())).size).toBe(q.choices.length);
  expect(q.answerIndex).toBeGreaterThanOrEqual(0);
  expect(q.answerIndex).toBeLessThan(q.choices.length);
  expect(q.choices[q.answerIndex]).toBe(q.answerText);
}
function checkQuestion(q: Question) {
  if (q.kind === 'mcq') checkMcq(q);
  if (q.kind === 'skyobj') {
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices[q.answerIndex]).toBe(q.answerText);
  }
  if (q.kind === 'name') {
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices).toContain(q.conId);
  }
}

describe('unit quiz', () => {
  it('every path unit: find + name per constellation, then ≤4 story (one per myth) and ≤6 lesson questions', () => {
    for (const unit of units) {
      const qs = composeUnitQuiz(unit, data, mulberry32(11));
      const n = unit.constellations.length;
      const find = qs.filter((q) => q.kind === 'find'), name = qs.filter((q) => q.kind === 'name');
      expect(find.map((q) => q.itemId).sort()).toEqual(unit.constellations.map((c) => `find:${c}`).sort());
      expect(name.map((q) => q.itemId).sort()).toEqual(unit.constellations.map((c) => `name:${c}`).sort());
      // sky questions first
      expect(qs.slice(0, 2 * n).every((q) => q.kind === 'find' || q.kind === 'name')).toBe(true);
      const story = qs.filter((q) => q.skill === 'story');
      const know = qs.filter((q) => q.skill === 'knowledge');
      expect(story.length).toBeLessThanOrEqual(UNIT_MAX_STORY);
      expect(know.length).toBeLessThanOrEqual(UNIT_MAX_LESSON);
      const storyIds = story.map((q) => q.itemId.split(':')[1]);
      expect(new Set(storyIds).size).toBe(storyIds.length);
      for (const q of story) expect(unit.constellations).toContain(q.con);
      for (const q of know) expect(unit.lessons).toContain(q.itemId.split(':')[1]);
      // a unit with lessons that have questions gets some
      const bank = lessons.filter((l) => unit.lessons.includes(l.id)).reduce((s, l) => s + (l.questions?.length ?? 0), 0);
      expect(know.length).toBe(Math.min(UNIT_MAX_LESSON, bank));
      expect(new Set(qs.map((q) => q.key)).size).toBe(qs.length);
      qs.forEach(checkQuestion);
    }
  });
  it('is deterministic for a seed', () => {
    const strip = (qs: Question[]) => qs.map((q) => [q.key, 'choices' in q ? q.choices : null]);
    expect(strip(composeUnitQuiz(units[1], data, mulberry32(5)))).toEqual(strip(composeUnitQuiz(units[1], data, mulberry32(5))));
  });
});

describe('stories', () => {
  const stories = listStories(content, catalog);
  it('lists every story and builds valid questions per myth', () => {
    expect(stories.length).toBeGreaterThan(0);
    const b = storyBuilders(stories, { mcq: true, which: true, card: true }, mulberry32(3));
    for (const [id, make] of b) {
      const q = make();
      if (!q) continue;
      expect(q.itemId).toBe(id);
      expect(id).toMatch(/^(story:[^:]+:[^:]+|card:[^:]+)$/);
      checkQuestion(q);
    }
    // each story is its own card item
    expect([...b.keys()].filter((k) => k.startsWith('card:'))).toHaveLength(stories.length);
  });
  it('“which constellation” masks the name and offers 4 constellations', () => {
    const cons = [...new Map(stories.map((s) => [s.con.id, s.con])).values()];
    const ori = stories.find((s) => s.con.id === 'Ori')!;
    const q = whichMythQuestion(ori, cons, mulberry32(1))!;
    checkMcq(q);
    expect(q.prompt).not.toMatch(/Orion/);
    expect(maskConstellation('Orion’s belt and Orion', con('Ori'))).toBe(`${MASK} belt and ${MASK}`);
    expect(cardQuestion(ori).itemId).toBe(`card:${ori.story.id}`);
  });
  it('story session for one constellation stays on it; missing content → empty', () => {
    const args = { data, diff: DIFFICULTY_PRESETS.easy, items: {}, length: 'all' as const, rng: mulberry32(2) };
    const qs = buildStorySession({ ...args, con: 'Ori', modes: { mcq: true, which: true, card: true }, scope: 'all' });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.con).toBe('Ori');
    expect(buildStorySession({ ...args, con: 'Nope', modes: { mcq: true, which: true, card: true }, scope: 'all' })).toEqual([]);
  });
});

describe('objects', () => {
  it('every sub-mode builds valid questions', () => {
    const { builders, counts } = objectBuilders(catalog, ['Ori', 'Tau'], { star: true, dso: true, image: true, type: true }, mulberry32(4));
    expect(counts.star).toBeGreaterThanOrEqual(6);
    expect(counts.dso).toBeGreaterThanOrEqual(6);
    let built = 0;
    for (const [id, make] of builders) {
      const q = make();
      if (!q) continue;
      built++;
      expect(q.itemId).toBe(id);
      expect(id).toMatch(/^object:(star|dso|body):/);
      checkQuestion(q);
    }
    expect(built).toBeGreaterThan(10);
  });
});

describe('computed sky knowledge (Brooklyn)', () => {
  const facts = computeFacts(catalog, observer, 2026);
  const f = (id: string) => facts.find((x) => x.id === id)!;
  it('facts make sense', () => {
    expect(facts).toHaveLength(88);
    expect(f('Ori').season).toBe('winter');
    expect(f('Sco').season).toBe('summer');
    expect(f('Cas').circ).toBe('circumpolar');
    expect(f('UMi').circ).toBe('circumpolar');
    expect(f('Ori').circ).toBe('rises-sets');
    expect(f('Cru').circ).toBe('never-rises');
    expect(circumpolarClass([60, 70], 40)).toBe('circumpolar');
    expect(circumpolarClass([-60, -70], 40)).toBe('never-rises');
    expect(circumpolarClass([45, 60], 40)).toBe('partial');
  });
  it('is deterministic under a seeded RNG', () => {
    for (const id of ['Ori', 'Cyg', 'UMi', 'Cru', 'Leo', 'Peg']) {
      const a = visibilityQuestion(id, facts, observer, mulberry32(42));
      const b = visibilityQuestion(id, facts, observer, mulberry32(42));
      expect(a).toEqual(b);
    }
    expect(visibilityQuestionsFor('UMi', facts, observer, mulberry32(8))).toEqual(visibilityQuestionsFor('UMi', facts, observer, mulberry32(8)));
  });
  it('month question: the wrong answers are not visible that month', () => {
    for (let s = 1; s <= 10; s++) {
      const q = monthQuestion(f('Cyg'), facts, observer, mulberry32(s))!;
      checkMcq(q);
      const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].findIndex((m) => q.prompt.includes(`mid-${m}`));
      expect(month).toBeGreaterThanOrEqual(0);
      expect(['evening', 'all-night']).toContain(f('Cyg').months[month]);
      for (const name of q.choices.filter((_, i) => i !== q.answerIndex)) expect(facts.find((x) => x.name === name)!.months[month]).toBe('not-visible');
    }
  });
  it('season, circumpolar and Polaris questions', () => {
    const season = seasonQuestion(f('Ori'), observer)!;
    expect(season.answerText).toBe('Winter');
    checkMcq(season);
    expect(circumpolarQuestion(f('Cas'), observer)!.answerIndex).toBe(0);
    expect(circumpolarQuestion(f('Ori'), observer)!.answerIndex).toBe(1);
    expect(circumpolarQuestion(f('Cru'), observer)!.answerIndex).toBe(2);
    const pol = polarisQuestion(observer, mulberry32(1))!;
    checkMcq(pol);
    expect(pol.answerText).toBe('About 41° above the horizon');
    expect(polarisQuestion({ ...observer, lat: -33 }, mulberry32(1))).toBeNull();
  });
  it('visibilityQuestionsFor gives several angles on one item', () => {
    const qs = visibilityQuestionsFor('UMi', facts, observer, mulberry32(3));
    expect(qs.length).toBeGreaterThanOrEqual(2);
    for (const q of qs) {
      expect(q.itemId).toBe('vis:UMi');
      expect(q.skill).toBe('visibility');
      checkMcq(q);
    }
    expect(new Set(qs.map((q) => q.key)).size).toBe(qs.length);
  });
});

describe('sessions', () => {
  const args = { data, diff: DIFFICULTY_PRESETS.easy, items: {}, length: 10 as const, rng: mulberry32(6) };
  it('?con= restricts find, name and visibility to that constellation', () => {
    expect(buildFindSession({ ...args, con: 'Lyr' }).map((q) => q.itemId)).toEqual(['find:Lyr']);
    expect(buildNameSession({ ...args, con: 'Lyr', typed: false }).map((q) => q.itemId)).toEqual(['name:Lyr']);
    const vis = buildVisibilitySession({ ...args, con: 'Ori' });
    expect(vis.length).toBeGreaterThanOrEqual(2);
    for (const q of vis) expect(q.itemId).toBe('vis:Ori');
  });
  it('without con, sessions draw from the pool', () => {
    const find = buildFindSession(args);
    expect(find).toHaveLength(10);
    for (const q of find) expect(DIFFICULTY_PRESETS.easy.pool === 'anchors' && q.con && ['UMa', 'UMi', 'Cas', 'Ori', 'Tau', 'CMa', 'Gem', 'Leo', 'Boo', 'Vir', 'Sco', 'Lyr', 'Cyg', 'Aql', 'Peg'].includes(q.con)).toBe(true);
    const vis = buildVisibilitySession(args);
    expect(vis.length).toBeGreaterThan(0);
    for (const q of vis) expect(q.skill).toBe('visibility');
    const know = buildKnowledgeSession({ ...args, modes: { computed: false, lessons: true }, lessonUnit: 'all' });
    expect(know).toHaveLength(10);
    for (const q of know) expect(q.itemId).toMatch(/^know:/);
  });
  it('review rebuilds a question for every item-id format', () => {
    const ctx = reviewContext(data);
    const story = listStories(content, catalog)[0];
    const lesson = lessons.find((l) => l.questions?.length)!;
    const ids = [
      'find:Ori', 'name:Ori', `story:${story.story.id}:${story.story.questions[0].id}`, `story:${story.story.id}:which`, `card:${story.story.id}`,
      'vis:Ori', 'vis:UMi', `know:${lesson.id}:${lesson.questions[0].id}`, 'object:star:Vega', 'object:dso:M42',
    ];
    for (const id of ids) {
      const q = questionForItem(id, ctx, mulberry32(1));
      expect(q, id).not.toBeNull();
      checkQuestion(q!);
    }
    expect(questionForItem('find:Nope', ctx, mulberry32(1))).toBeNull();
    expect(questionForItem('story:gone:q1', ctx, mulberry32(1))).toBeNull();
  });
});
