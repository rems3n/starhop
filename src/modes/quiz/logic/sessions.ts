/** Assembling whole sessions: pool → candidate items → spaced-repetition pick → questions. */
import { tonight, type Tonight } from '@/astro';
import { dueItems, type ItemProgress } from '@/store/progress';
import type { QuizDifficulty } from '@/store/settings';
import type { Constellation } from '@/types';
import {
  buildFrom, findQuestion, lessonBuilders, listStories, nameQuestion, objectBuilders, questionForItem, storyBuilders, uniqueKeys,
  type ObjectMode, type ReviewContext, type StoryMode,
} from './build';
import { computeFacts, planetQuestion, planetsUp, visibilityQuestion, visibilityQuestionsFor } from './knowledge';
import { buildPool } from './pools';
import type { Rng } from './rng';
import { constellationUpAt, eveningTime } from './sky';
import { selectSession, weakestConstellations } from './select';
import { hopBuilders, hopsFor, questionsForHop, type HopMode, type HopSeason } from './starhop';
import type { Starhop } from '@/content/schema';
import { shuffle } from './rng';
import type { Question, QuizData, SessionLength } from './types';

const tonightCache = new WeakMap<QuizData, Tonight>();
export function getTonight(data: QuizData): Tonight {
  let t = tonightCache.get(data);
  if (!t) {
    t = tonight(data.now, data.observer, data.catalog);
    tonightCache.set(data, t);
  }
  return t;
}

export function reviewContext(data: QuizData): ReviewContext {
  return { ...data, facts: () => computeFacts(data.catalog, data.observer, data.now.getFullYear()), planets: () => getTonight(data).planets };
}

/** Every constellation group of the resolved course (anchors, seasons, beyond), in course order; id = `<module>/<group>`. */
export function courseGroups(data: Pick<QuizData, 'course'>): { id: string; title: string; constellations: string[] }[] {
  // group ids repeat across modules (e.g. a months group in both anchors and seasons), so prefix the module
  return (data.course?.modules ?? []).flatMap((m) => m.groups.map((g) => ({ id: `${m.id}/${g.id}`, title: m.groups.length > 1 ? `${m.title}: ${g.title}` : m.title, constellations: g.constellations })));
}

/** Constellation ids of a pool spec for this learner (computes tonight's sky only when asked for). */
export function poolIds(data: QuizData, spec: string): string[] {
  const tonightIds = spec === 'tonight' ? getTonight(data).constellations.filter((c) => c.visibility.cls !== 'not-visible').map((c) => c.ref.slice(4)) : undefined;
  return buildPool(spec, { constellations: data.catalog.constellations, units: data.units, tonightIds, groups: courseGroups(data) });
}

export interface SessionArgs {
  data: QuizData;
  diff: QuizDifficulty;
  items: Record<string, ItemProgress>;
  length: SessionLength;
  rng: Rng;
  /** Only this constellation (deep link ?con=Abbr) */
  con?: string | null;
}

function cons(a: SessionArgs): Constellation[] {
  const ids = a.con && a.data.catalog.conById.has(a.con) ? [a.con] : poolIds(a.data, a.diff.pool);
  return ids.map((id) => a.data.catalog.conById.get(id)).filter((c): c is Constellation => !!c);
}
const byItem = (list: Constellation[], prefix: string) => new Map(list.map((c) => [`${prefix}:${c.id}`, c]));

/**
 * Time (epoch ms) at which to show tonight's real sky for a constellation: the session's evening time when
 * the constellation is up then, otherwise its own best time tonight.
 */
export function tonightTimes(data: QuizData): Map<string, number> {
  const evening = eveningTime(data.now, data.observer);
  const out = new Map<string, number>();
  for (const item of getTonight(data).constellations) {
    const c = data.catalog.conById.get(item.ref.slice(4));
    if (!c || item.visibility.cls === 'not-visible') continue;
    out.set(c.id, constellationUpAt(c, data.catalog.starById, evening, data.observer) ? evening.getTime() : (item.visibility.bestTime ?? evening).getTime());
  }
  return out;
}

export function buildFindSession(a: SessionArgs): Question[] {
  const map = byItem(cons(a), 'find');
  const times = a.diff.pool === 'tonight' && !a.con ? tonightTimes(a.data) : null;
  const ids = selectSession([...map.keys()], a.items, a.length, a.data.now.getTime(), a.rng);
  return uniqueKeys(ids.map((id) => findQuestion(map.get(id)!, times?.get(map.get(id)!.id))));
}

export function buildNameSession(a: SessionArgs & { typed: boolean }): Question[] {
  const map = byItem(cons(a), 'name');
  const ids = selectSession([...map.keys()], a.items, a.length, a.data.now.getTime(), a.rng);
  return uniqueKeys(ids.map((id) => nameQuestion(map.get(id)!, a.data.catalog.constellations, a.rng, a.typed)));
}

export function buildObjectSession(a: SessionArgs & { modes: Record<ObjectMode, boolean> }): Question[] {
  const { builders } = objectBuilders(a.data.catalog, poolIds(a.data, a.diff.pool), a.modes, a.rng);
  return buildFrom(selectSession([...builders.keys()], a.items, a.length, a.data.now.getTime(), a.rng), builders);
}

export function buildStorySession(a: SessionArgs & { modes: Record<StoryMode, boolean>; scope: 'pool' | 'all'; story?: string | null }): Question[] {
  const conIds = a.con ? [a.con] : a.scope === 'pool' ? poolIds(a.data, a.diff.pool) : undefined;
  let stories = listStories(a.data.content, a.data.catalog, conIds);
  if (a.story) stories = stories.filter((s) => s.story.id === a.story);
  // "which constellation?" needs wrong answers from every constellation that has a story, not just the ones in scope
  const builders = storyBuilders(stories, { ...a.modes, which: false }, a.rng);
  if (a.modes.which) {
    const all = listStories(a.data.content, a.data.catalog);
    const whichAll = storyBuilders(all, { mcq: false, which: true, card: false }, a.rng);
    for (const s of stories) {
      const id = `story:${s.story.id}:which`;
      const make = whichAll.get(id);
      if (make) builders.set(id, make);
    }
  }
  return buildFrom(selectSession([...builders.keys()], a.items, a.length, a.data.now.getTime(), a.rng), builders);
}

/**
 * One myth (`/practice/story?story=<storyId>`): every authored question on it, "which constellation is this
 * myth about?" when it can be built, and its flashcard last.
 */
export function buildMythSession(data: QuizData, storyId: string, rng: Rng): Question[] {
  const stories = listStories(data.content, data.catalog).filter((s) => s.story.id === storyId);
  if (!stories.length) return [];
  const own = storyBuilders(stories, { mcq: true, which: false, card: false }, rng);
  const which = storyBuilders(listStories(data.content, data.catalog), { mcq: false, which: true, card: false }, rng).get(`story:${storyId}:which`);
  const card = storyBuilders(stories, { mcq: false, which: false, card: true }, rng);
  const ids = [...shuffle([...own.keys()], rng), ...(which ? [`story:${storyId}:which`] : []), `card:${storyId}`];
  return buildFrom(ids, new Map([...own, ...(which ? [[`story:${storyId}:which`, which] as const] : []), ...card]));
}

/**
 * Star-hops (`/practice/starhop`): hops usable from the learner's hemisphere this month (or in any season),
 * picked with the usual spaced-repetition mix. With `hop`: that one hop in every enabled format.
 */
export function buildStarhopSession(a: Omit<SessionArgs, 'con'> & { hops: readonly Starhop[]; season: HopSeason; modes: Record<HopMode, boolean>; hop?: string | null }): Question[] {
  const { data, rng } = a;
  const one = a.hop ? a.hops.find((h) => h.id === a.hop) : undefined;
  if (one) return uniqueKeys(questionsForHop(one, data.catalog, a.modes, rng));
  const builders = hopBuilders(hopsFor(a.hops, data.observer, a.season, data.now), data.catalog, a.modes, rng);
  return buildFrom(selectSession([...builders.keys()], a.items, a.length, data.now.getTime(), rng), builders);
}

export type KnowledgeMode = 'computed' | 'lessons';

/** Lessons in a group: a course module id (its lessons), 'all', or a lesson unit saved before the course existed. */
export function lessonsInGroup<L extends { id: string; unit: string }>(lessons: readonly L[], group: string, modules: readonly { id: string; lessons: string[] }[]): L[] {
  if (group === 'all') return [...lessons];
  const mod = modules.find((m) => m.id === group);
  return mod ? lessons.filter((l) => (mod.lessons ?? []).includes(l.id)) : lessons.filter((l) => l.unit === group);
}

export function buildKnowledgeSession(a: SessionArgs & { modes: Record<KnowledgeMode, boolean>; lessonUnit: string }): Question[] {
  const { data, rng } = a;
  const builders = new Map<string, () => Question | null>();
  if (a.modes.computed) {
    const facts = computeFacts(data.catalog, data.observer, data.now.getFullYear());
    for (const id of poolIds(data, a.diff.pool)) builders.set(`vis:${id}`, () => visibilityQuestion(id, facts, data.observer, rng));
    for (const p of planetsUp(getTonight(data).planets)) builders.set(`vis:${p.name}`, () => planetQuestion(p, rng));
  }
  if (a.modes.lessons) {
    for (const [id, make] of lessonBuilders(lessonsInGroup(data.lessons, a.lessonUnit, data.course?.modules ?? []), rng)) builders.set(id, make);
  }
  // ask for a few spares: some computed questions do not apply to every constellation
  const ids = selectSession([...builders.keys()], a.items, a.length === 'all' ? 'all' : ((a.length + 4) as number as SessionLength), data.now.getTime(), rng);
  const qs = buildFrom(ids, builders);
  return a.length === 'all' ? qs : qs.slice(0, a.length);
}

/**
 * Visibility only (`/practice/visibility`). With `con`: every computed question that applies to that one
 * constellation. Without: the computed half of the knowledge quiz over the difficulty pool (plus planets).
 */
export function buildVisibilitySession(a: SessionArgs): Question[] {
  const { data, rng } = a;
  if (a.con && data.catalog.conById.has(a.con)) {
    const qs = visibilityQuestionsFor(a.con, computeFacts(data.catalog, data.observer, data.now.getFullYear()), data.observer, rng);
    return uniqueKeys(a.length === 'all' ? qs : qs.slice(0, a.length));
  }
  return buildKnowledgeSession({ ...a, con: null, modes: { computed: true, lessons: false }, lessonUnit: 'all' });
}

export function buildLessonSession(data: QuizData, lessonId: string, rng: Rng): Question[] {
  const builders = lessonBuilders(data.lessons.filter((l) => l.id === lessonId), rng);
  return buildFrom([...builders.keys()], builders);
}

/** Largest review round; the rest stays due and is offered as the next round. */
export const REVIEW_BATCH = 20;

/** Due items, weakest first, each in its own question format. Items whose content has gone are skipped. */
export function buildReviewSession(data: QuizData, items: Record<string, ItemProgress>, rng: Rng, limit = REVIEW_BATCH, hops: readonly Starhop[] = []): { questions: Question[]; due: number } {
  const due = dueItems(items, data.now.getTime());
  const ctx = reviewContext(data);
  const hopBuild = hopBuilders(hops, data.catalog, { click: true, mcq: true }, rng);
  const out: Question[] = [];
  for (const p of due) {
    if (out.length >= limit) break;
    const q = p.id.startsWith('hop:') ? hopBuild.get(p.id)?.() ?? null : questionForItem(p.id, ctx, rng);
    if (q) out.push(q);
  }
  return { questions: uniqueKeys(out), due: due.length };
}

/** Find-it and name-it for the weakest constellations practised so far (or the first anchors for a newcomer). */
export function buildWeakestSession(a: Omit<SessionArgs, 'length' | 'con'>, count = 5): Question[] {
  const { catalog } = a.data;
  let ids = weakestConstellations(a.items, catalog.constellations.map((c) => c.id), count).map((w) => w.id);
  if (!ids.length) ids = buildPool('anchors', { constellations: catalog.constellations, units: [] }).slice(0, count);
  const list = ids.map((id) => catalog.conById.get(id)).filter((c): c is Constellation => !!c);
  return uniqueKeys([...list.map((c) => findQuestion(c)), ...list.map((c) => nameQuestion(c, catalog.constellations, a.rng))]);
}
