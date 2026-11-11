/**
 * Closing quiz for a course module (`/practice/module/:id`). Pure: the resolved module (src/content/course.ts),
 * the quiz data and the star-hop library in, a list of questions out.
 */
import type { ResolvedModule } from '@/content/course';
import type { Starhop } from '@/content/schema';
import type { Constellation } from '@/types';
import { findQuestion, lessonQuestion, listStories, nameQuestion, storyMcq, uniqueKeys, type StoryRef } from './build';
import { computeFacts, visibilityQuestion } from './knowledge';
import { pickOne, shuffle, type Rng } from './rng';
import { hopClickQuestion, hopMcqQuestion, hopsFor } from './starhop';
import type { Question, QuizData } from './types';

export const MODULE_QUIZ_MAX = 12;
/** Constellation modules: how the 12 slots are split before topping up with find/name */
export const MODULE_MIX = { find: 4, name: 4, story: 2, visibility: 2 } as const;
/** Star-hop module: lesson questions kept even when there are many hops */
export const MODULE_MIN_LESSON = 4;

/** Constellation ids of a module (anchors / seasons / beyond), most prominent first, no repeats. */
export function moduleConstellations(m: Pick<ResolvedModule, 'groups'>): string[] {
  return [...new Set(m.groups.flatMap((g) => g.constellations))];
}

/** Star-hop ids of a starhops module: the resolved list, or (course not resolved yet) the top-ranked hops usable here. */
export function moduleHopIds(m: Pick<ResolvedModule, 'starhopIds' | 'starhopCount'>, hops: readonly Starhop[], data: Pick<QuizData, 'observer' | 'now'>): string[] {
  const known = new Set(hops.map((h) => h.id));
  const ids = m.starhopIds.filter((id) => known.has(id));
  return ids.length ? ids : hopsFor(hops, data.observer, 'any', data.now).slice(0, m.starhopCount ?? 10).map((h) => h.id);
}

/** Lesson questions, round-robin over the lessons so every lesson is represented. */
function lessonRoundRobin(lessonIds: readonly string[], data: Pick<QuizData, 'lessons'>, max: number, rng: Rng): Question[] {
  const queues = lessonIds
    .map((id) => data.lessons.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l && !!l.questions?.length)
    .map((l) => shuffle(l.questions, rng).map((q) => () => lessonQuestion(l, q, rng)));
  const out: Question[] = [];
  for (let round = 0; out.length < max && queues.some((q) => q[round]); round++) {
    for (const q of shuffle(queues, rng)) if (q[round] && out.length < max) out.push(q[round]());
  }
  return out;
}

function storyRoundRobin(stories: readonly StoryRef[], max: number, rng: Rng): Question[] {
  const byCon = new Map<string, StoryRef[]>();
  for (const s of shuffle(stories.filter((x) => x.story.questions?.length), rng)) byCon.set(s.con.id, [...(byCon.get(s.con.id) ?? []), s]);
  const out: Question[] = [];
  for (let round = 0; out.length < max && round < 6; round++) {
    for (const list of shuffle([...byCon.values()], rng)) {
      const s = list[round];
      if (s && out.length < max) out.push(storyMcq(s, pickOne(s.story.questions, rng), rng));
    }
  }
  return out;
}

/**
 * - lessons modules: up to 12 of the module's lesson questions, spread over its lessons;
 * - starhops module: one question per top hop (alternating "follow the hop" and "where does it lead?"),
 *   leaving at least 4 slots for the module's lesson questions;
 * - anchors / seasons / beyond: find-it, name-it, story and visibility questions over the module's
 *   constellations (4 / 4 / 2 / 2, topped up with find and name when stories or visibility run short).
 * Sky questions come first (shuffled), then the reading questions (shuffled). Empty when there is nothing
 * to ask yet (e.g. the course is not resolved for this location).
 */
export function composeModuleQuiz(m: ResolvedModule, data: QuizData, hops: readonly Starhop[], rng: Rng, max = MODULE_QUIZ_MAX): Question[] {
  if (m.kind === 'lessons') return uniqueKeys(shuffle(lessonRoundRobin(m.lessons, data, max, rng), rng));

  if (m.kind === 'starhops') {
    const byId = new Map(hops.map((h) => [h.id, h]));
    const chosen = moduleHopIds(m, hops, data).map((id) => byId.get(id)!).filter(Boolean);
    const lessonAvail = m.lessons.reduce((n, id) => n + (data.lessons.find((l) => l.id === id)?.questions?.length ?? 0), 0);
    const hopSlots = Math.max(0, max - Math.min(MODULE_MIN_LESSON, lessonAvail));
    const sky: Question[] = [];
    const reading: Question[] = [];
    for (const [i, h] of shuffle(chosen, rng).entries()) {
      if (sky.length + reading.length >= hopSlots) break;
      const q = i % 2 === 0 ? hopClickQuestion(h, data.catalog) ?? hopMcqQuestion(h, data.catalog, rng) : hopMcqQuestion(h, data.catalog, rng) ?? hopClickQuestion(h, data.catalog);
      if (q) (q.kind === 'hop' ? sky : reading).push(q);
    }
    reading.push(...lessonRoundRobin(m.lessons, data, max - sky.length - reading.length, rng));
    return uniqueKeys([...shuffle(sky, rng), ...shuffle(reading, rng)]);
  }

  const cons = shuffle(moduleConstellations(m).map((id) => data.catalog.conById.get(id)).filter((c): c is Constellation => !!c), rng);
  if (!cons.length) return [];
  const all = data.catalog.constellations;
  const stories = storyRoundRobin(listStories(data.content, data.catalog, cons.map((c) => c.id)), MODULE_MIX.story, rng);
  const facts = computeFacts(data.catalog, data.observer, data.now.getFullYear());
  const vis: Question[] = [];
  for (const c of cons) {
    if (vis.length >= MODULE_MIX.visibility) break;
    const q = visibilityQuestion(c.id, facts, data.observer, rng);
    if (q) vis.push(q);
  }
  // find and name share the remaining slots; different constellations for each where there are enough
  const skySlots = Math.min(max - stories.length - vis.length, cons.length * 2);
  const nFind = Math.ceil(skySlots / 2);
  const nName = skySlots - nFind;
  const finds = cons.slice(0, nFind).map((c) => findQuestion(c));
  const nameCons = cons.length >= nFind + nName ? cons.slice(nFind, nFind + nName) : [...cons.slice(nFind), ...cons].slice(0, nName);
  const names = nameCons.map((c) => nameQuestion(c, all, rng));
  return uniqueKeys([...shuffle([...finds, ...names], rng), ...shuffle([...stories, ...vis], rng)]);
}
