/** Builds questions of every kind from catalog + authored content. Pure; randomness comes from the Rng passed in. */
import type { ConstellationContent, Lesson, Mcq, PathUnit, Story } from '@/content/schema';
import type { Catalog } from '@/data/catalog';
import type { Constellation, Dso, DsoType, Star, TonightItem } from '@/types';
import { buildChoices, constellationDistractors, pickDistinct } from './distractors';
import { planetQuestion, planetsUp, visibilityQuestion, type ConFacts } from './knowledge';
import { pickOne, sample, shuffle, type Rng } from './rng';
import type { CardQ, FindQ, McqQ, NameQ, Question, QuizData, SkyObjQ } from './types';

// ───────────── constellations: find it / name it

export function findQuestion(c: Constellation, tonightTime?: number): FindQ {
  return { kind: 'find', key: `find:${c.id}`, itemId: `find:${c.id}`, skill: 'find', con: c.id, conId: c.id, tonightTime, promptText: `Find ${c.name}`, answerText: c.name };
}

export function nameQuestion(c: Constellation, all: readonly Constellation[], rng: Rng, typed = false): NameQ {
  const { choices } = buildChoices(c.id, constellationDistractors(c, all, rng, 3), rng);
  return { kind: 'name', key: `name:${c.id}`, itemId: `name:${c.id}`, skill: 'name', con: c.id, conId: c.id, choices, typed, promptText: 'Name the highlighted constellation', answerText: c.name };
}

// ───────────── stories

export interface StoryRef {
  con: Constellation;
  story: Story;
}

/** Every story written so far, optionally only for some constellations. Constellations without stories are skipped. */
export function listStories(content: readonly ConstellationContent[], catalog: Pick<Catalog, 'conById'>, conIds?: readonly string[]): StoryRef[] {
  const out: StoryRef[] = [];
  for (const c of content) {
    const con = catalog.conById.get(c.id);
    if (!con || (conIds && !conIds.includes(c.id))) continue;
    for (const story of c.stories ?? []) out.push({ con, story });
  }
  return out;
}

/** Remove [[ref|label]] and *emphasis* markup. */
export function plainText(text: string): string {
  return text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
}

function shuffledMcq(q: Mcq, rng: Rng): { choices: string[]; answerIndex: number } {
  const order = shuffle(q.choices.map((_, i) => i), rng);
  return { choices: order.map((i) => q.choices[i]), answerIndex: order.indexOf(q.answerIndex) };
}

export function storyMcq(s: StoryRef, q: Mcq, rng: Rng): McqQ {
  const id = `story:${s.story.id}:${q.id}`;
  const m = shuffledMcq(q, rng);
  return {
    kind: 'mcq', key: id, itemId: id, skill: 'story', con: s.con.id, context: `${s.con.name} · ${s.story.title}`, prompt: plainText(q.prompt), ...m,
    explanation: plainText(q.explanation), promptText: plainText(q.prompt), answerText: q.choices[q.answerIndex],
  };
}

export const MASK = '▁▁▁▁▁';

/** Hide the constellation's own names (Latin, genitive, English) in a text. */
export function maskConstellation(text: string, con: Pick<Constellation, 'name' | 'genitive' | 'english'>): string {
  const words = [con.name, con.genitive, con.english.replace(/^the\s+/i, '')].filter((w) => w && w.length >= 3);
  let out = plainText(text);
  for (const w of words.sort((a, b) => b.length - a.length)) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\p{L}])${esc}(?:['’]s)?(?![\\p{L}])`, 'giu'), MASK);
  }
  return out;
}

/** "Which constellation is this myth about?" from the story's summary with the constellation's name masked. Item story:<storyId>:which. */
export function whichMythQuestion(s: StoryRef, storyCons: readonly Constellation[], rng: Rng): McqQ | null {
  const universe = storyCons.some((c) => c.id === s.con.id) ? storyCons : [...storyCons, s.con];
  const wrong = constellationDistractors(s.con, universe, rng, 3);
  if (wrong.length < 3) return null;
  const { choices, answerIndex } = buildChoices(s.con.id, wrong, rng);
  const nameOf = (id: string) => universe.find((c) => c.id === id)?.name ?? id;
  const id = `story:${s.story.id}:which`;
  return {
    kind: 'mcq', key: id, itemId: id, skill: 'story', con: s.con.id, context: `${s.story.culture} myth`,
    prompt: `Which constellation is this myth about?\n\n“${maskConstellation(s.story.summary, s.con)}”`, choices: choices.map(nameOf), answerIndex,
    explanation: `This is “${plainText(s.story.title)}”, one of the stories told about ${s.con.name}.`, promptText: `Which constellation: “${plainText(s.story.title)}”`, answerText: s.con.name,
  };
}

export function cardQuestion(s: StoryRef): CardQ {
  const id = `card:${s.story.id}`;
  return {
    kind: 'card', key: id, itemId: id, skill: 'story', con: s.con.id, conName: s.con.name, title: plainText(s.story.title), culture: s.story.culture,
    summary: plainText(s.story.summary), characters: s.story.characters ?? [], promptText: `${s.con.name}: ${plainText(s.story.title)}`, answerText: plainText(s.story.summary),
  };
}

export type StoryMode = 'mcq' | 'which' | 'card';

/** Item id → builder for every story question in scope. */
export function storyBuilders(stories: readonly StoryRef[], modes: Record<StoryMode, boolean>, rng: Rng): Map<string, () => Question | null> {
  const cons = [...new Map(stories.map((s) => [s.con.id, s.con])).values()];
  const out = new Map<string, () => Question | null>();
  for (const s of stories) {
    if (modes.mcq) for (const q of s.story.questions ?? []) out.set(`story:${s.story.id}:${q.id}`, () => storyMcq(s, q, rng));
    if (modes.which && cons.length >= 4) out.set(`story:${s.story.id}:which`, () => whichMythQuestion(s, cons, rng));
    if (modes.card) out.set(`card:${s.story.id}`, () => cardQuestion(s));
  }
  return out;
}

// ───────────── lessons

export function lessonQuestion(lesson: Lesson, q: Mcq, rng: Rng): McqQ {
  const id = `know:${lesson.id}:${q.id}`;
  return {
    kind: 'mcq', key: id, itemId: id, skill: 'knowledge', context: `Lesson · ${lesson.title}`, prompt: plainText(q.prompt), ...shuffledMcq(q, rng),
    explanation: plainText(q.explanation), promptText: plainText(q.prompt), answerText: q.choices[q.answerIndex],
  };
}

export function lessonBuilders(lessons: readonly Lesson[], rng: Rng): Map<string, () => Question | null> {
  const out = new Map<string, () => Question | null>();
  for (const l of lessons) for (const q of l.questions ?? []) out.set(`know:${l.id}:${q.id}`, () => lessonQuestion(l, q, rng));
  return out;
}

// ───────────── objects

/** Faintest named star asked about. */
export const STAR_QUIZ_MAG = 2.6;
/** Fewer candidates than this and the pool is widened to the whole sky. */
export const MIN_OBJECT_POOL = 6;

export const DSO_TYPE_LABEL: Record<DsoType, string> = {
  galaxy: 'Galaxy', 'open-cluster': 'Open star cluster', 'globular-cluster': 'Globular star cluster', 'emission-nebula': 'Emission nebula',
  'reflection-nebula': 'Reflection nebula', 'planetary-nebula': 'Planetary nebula', 'supernova-remnant': 'Supernova remnant', 'dark-nebula': 'Dark nebula',
  nebula: 'Nebula', 'cluster-with-nebula': 'Star cluster with nebula', 'star-cloud': 'Star cloud', 'double-star': 'Double star', asterism: 'Asterism', other: 'Other',
};
/** Types offered in "what type of object is it?" */
export const TYPE_QUIZ_TYPES: DsoType[] = ['galaxy', 'open-cluster', 'globular-cluster', 'emission-nebula', 'planetary-nebula', 'supernova-remnant', 'reflection-nebula'];

const widen = <T,>(inPool: T[], all: T[]): T[] => (inPool.length >= MIN_OBJECT_POOL ? inPool : all);
const dsoLabel = (d: Dso) => (d.messier ? `M${d.messier}` : d.aka[0] ?? d.id) + (d.name ? ` — ${d.name}` : '');
const dsoShort = (d: Dso) => (d.messier ? `M${d.messier}` : d.caldwell && !/^(NGC|IC)/.test(d.id) ? `C${d.caldwell}` : d.id.replace(/^(NGC|IC)/, '$1 '));

export function starCandidates(catalog: Pick<Catalog, 'stars'>, pool: readonly string[]): Star[] {
  const all = catalog.stars.filter((s) => s.name && s.mag <= STAR_QUIZ_MAG);
  return widen(all.filter((s) => pool.includes(s.con)), all);
}

/** Messier objects plus other named showpieces. */
export function dsoCandidates(catalog: Pick<Catalog, 'dsos'>, pool: readonly string[]): Dso[] {
  const all = catalog.dsos.filter((d) => d.messier || (d.name && d.mag != null && d.mag <= 7));
  return widen(all.filter((d) => pool.includes(d.con)), all);
}

export function typeCandidates(catalog: Pick<Catalog, 'dsos'>, pool: readonly string[]): Dso[] {
  const all = catalog.dsos.filter((d) => d.messier && TYPE_QUIZ_TYPES.includes(d.type));
  return widen(all.filter((d) => pool.includes(d.con)), all);
}

export function starQuestion(star: Star, candidates: readonly Star[], rng: Rng): SkyObjQ | null {
  const name = star.name ?? star.desig;
  // similar brightness first: nobody mistakes a 2nd-magnitude star for Sirius
  const near = candidates.filter((s) => s.id !== star.id && s.name).sort((a, b) => Math.abs(a.mag - star.mag) - Math.abs(b.mag - star.mag)).slice(0, 9);
  const wrong = pickDistinct(name, near.map((s) => s.name ?? s.desig), rng, 3);
  if (wrong.length < 3) return null;
  const ref = `star:${star.id}`;
  return {
    kind: 'skyobj', key: `object:${ref}`, itemId: `object:${ref}`, skill: 'object', con: star.con, ref, objKind: 'star', prompt: 'Which star is ringed?',
    ...buildChoices(name, wrong, rng), fov: 60, explanation: `${name} is ${star.desig}, magnitude ${star.mag.toFixed(1)}.`, promptText: 'Which star is ringed?', answerText: name,
  };
}

export function dsoQuestion(dso: Dso, candidates: readonly Dso[], rng: Rng): SkyObjQ | null {
  const same = candidates.filter((d) => d.id !== dso.id && d.type === dso.type);
  const wrong = pickDistinct(dsoLabel(dso), [...sample(same, 6, rng), ...sample(candidates.filter((d) => d.id !== dso.id), 6, rng)].slice(0, 8).map(dsoLabel), rng, 3);
  if (wrong.length < 3) return null;
  const ref = `dso:${dso.id}`;
  return {
    kind: 'skyobj', key: `object:${ref}`, itemId: `object:${ref}`, skill: 'object', con: dso.con, ref, objKind: 'dso', prompt: 'Which deep-sky object is marked?',
    ...buildChoices(dsoLabel(dso), wrong, rng), fov: 45, explanation: `${dsoLabel(dso)} is a ${DSO_TYPE_LABEL[dso.type].toLowerCase()}.`, promptText: 'Which deep-sky object is marked?', answerText: dsoLabel(dso),
  };
}

export function typeQuestion(dso: Dso, catalog: Pick<Catalog, 'imagesFor'>, rng: Rng): McqQ {
  const ref = `dso:${dso.id}`;
  const answer = DSO_TYPE_LABEL[dso.type];
  const wrong = sample(TYPE_QUIZ_TYPES.filter((t) => t !== dso.type), 3, rng).map((t) => DSO_TYPE_LABEL[t]);
  return {
    kind: 'mcq', key: `object:${ref}#type`, itemId: `object:${ref}`, skill: 'object', con: dso.con, prompt: `What type of object is ${dsoShort(dso)}?`, ...buildChoices(answer, wrong, rng),
    image: catalog.imagesFor(ref)[0], explanation: `${dsoLabel(dso)} is a ${answer.toLowerCase()}.`, promptText: `Type of ${dsoShort(dso)}`, answerText: answer,
  };
}

/** Refs that have at least one picture and resolve in the catalog. */
export function imageCandidates(catalog: Pick<Catalog, 'images' | 'resolve'>): string[] {
  return Object.keys(catalog.images).filter((ref) => catalog.images[ref]?.length && catalog.resolve(ref));
}

export function imageQuestion(ref: string, candidates: readonly string[], catalog: Pick<Catalog, 'images' | 'resolve'>, rng: Rng): McqQ | null {
  const t = catalog.resolve(ref);
  const image = catalog.images[ref] ? pickOne(catalog.images[ref], rng) : undefined;
  if (!t || !image) return null;
  const label = (r: string) => {
    const x = catalog.resolve(r);
    return x ? (x.dso ? dsoLabel(x.dso) : x.name) : null;
  };
  const scheme = ref.split(':')[0];
  const sameKind = candidates.filter((r) => r !== ref && r.split(':')[0] === scheme && (!t.dso || catalog.resolve(r)?.dso?.type === t.dso.type));
  const anyKind = candidates.filter((r) => r !== ref && r.split(':')[0] === scheme);
  const names = [...sample(sameKind, 6, rng), ...sample(anyKind, 6, rng)].map(label).filter((x): x is string => !!x);
  const answer = label(ref) ?? t.name;
  const wrong = pickDistinct(answer, names, rng, 3);
  if (wrong.length < 3) return null;
  const canon = t.ref;
  return {
    kind: 'mcq', key: `object:${canon}#img`, itemId: `object:${canon}`, skill: 'object', con: t.dso?.con ?? t.star?.con, prompt: 'Which object is this?', ...buildChoices(answer, wrong, rng),
    image, explanation: `${image.title}.`, promptText: 'Which object is this? (picture)', answerText: answer,
  };
}

export type ObjectMode = 'star' | 'dso' | 'image' | 'type';

export function objectBuilders(catalog: Catalog, pool: readonly string[], modes: Record<ObjectMode, boolean>, rng: Rng): { builders: Map<string, () => Question | null>; counts: Record<ObjectMode, number> } {
  const out = new Map<string, () => Question | null>();
  // several sub-modes can share an item id (object:<ref>); keep every builder and pick one at random
  const add = (id: string, make: () => Question | null) => {
    const prev = out.get(id);
    out.set(id, prev ? () => (rng() < 0.5 ? make() ?? prev() : prev() ?? make()) : make);
  };
  const stars = starCandidates(catalog, pool);
  const dsos = dsoCandidates(catalog, pool);
  const types = typeCandidates(catalog, pool);
  const images = imageCandidates(catalog);
  const counts = { star: stars.length, dso: dsos.length, image: images.length, type: types.length };
  if (modes.star && stars.length >= 4) for (const s of stars) add(`object:star:${s.id}`, () => starQuestion(s, stars, rng));
  if (modes.dso && dsos.length >= 4) for (const d of dsos) add(`object:dso:${d.id}`, () => dsoQuestion(d, dsos, rng));
  if (modes.type && types.length >= 4) for (const d of types) add(`object:dso:${d.id}`, () => typeQuestion(d, catalog, rng));
  if (modes.image && images.length >= 4) for (const r of images) add(`object:${catalog.resolve(r)?.ref ?? r}`, () => imageQuestion(r, images, catalog, rng));
  return { builders: out, counts };
}

// ───────────── unit quiz

export const UNIT_MAX_STORY = 4;
export const UNIT_MAX_LESSON = 6;

/**
 * End-of-unit quiz: one find-it and one name-it for every constellation of the unit, up to four story
 * questions (one per myth, spread over the unit's constellations) and up to six lesson questions (spread
 * over the unit's lessons). Sky questions come first (shuffled), then the reading questions (shuffled).
 */
export function composeUnitQuiz(unit: PathUnit, data: Pick<QuizData, 'catalog' | 'content' | 'lessons'>, rng: Rng): Question[] {
  const cons = unit.constellations.map((id) => data.catalog.conById.get(id)).filter((c): c is Constellation => !!c);
  const sky: Question[] = [...cons.map((c) => findQuestion(c)), ...cons.map((c) => nameQuestion(c, data.catalog.constellations, rng))];
  const stories = shuffle(listStories(data.content, data.catalog, unit.constellations), rng).filter((s) => s.story.questions?.length);
  // round-robin over constellations so one with five myths does not take every slot
  const byCon = new Map<string, StoryRef[]>();
  for (const s of stories) byCon.set(s.con.id, [...(byCon.get(s.con.id) ?? []), s]);
  const storyQs: Question[] = [];
  for (let round = 0; storyQs.length < UNIT_MAX_STORY && round < 6; round++) {
    for (const list of byCon.values()) {
      const s = list[round];
      if (s && storyQs.length < UNIT_MAX_STORY) storyQs.push(storyMcq(s, pickOne(s.story.questions, rng), rng));
    }
  }
  const unitLessons = data.lessons.filter((l) => unit.lessons.includes(l.id) && l.questions?.length);
  const lessonQs: Question[] = [];
  const queues = unitLessons.map((l) => shuffle(l.questions, rng).map((q) => lessonQuestion(l, q, rng)));
  for (let round = 0; lessonQs.length < UNIT_MAX_LESSON && queues.some((q) => q[round]); round++) {
    for (const q of queues) if (q[round] && lessonQs.length < UNIT_MAX_LESSON) lessonQs.push(q[round]);
  }
  return uniqueKeys([...shuffle(sky, rng), ...shuffle([...storyQs, ...lessonQs], rng)]);
}

/** Make keys unique within a session (the same item can appear twice, e.g. after "Retry missed"). */
export function uniqueKeys(qs: readonly Question[], salt = ''): Question[] {
  return qs.map((q, i) => ({ ...q, key: `${salt}${i}:${q.itemId}` }));
}

// ───────────── review: item id → a question in its own format

export interface ReviewContext extends QuizData {
  facts: () => ConFacts[];
  planets: () => TonightItem[];
}

/** Rebuild a question for a stored item id, or null when its content no longer exists (the item is then skipped). */
export function questionForItem(itemId: string, ctx: ReviewContext, rng: Rng): Question | null {
  const { catalog } = ctx;
  const i = itemId.indexOf(':');
  const scheme = itemId.slice(0, i);
  const rest = itemId.slice(i + 1);
  switch (scheme) {
    case 'find': {
      const c = catalog.conById.get(rest);
      return c ? findQuestion(c) : null;
    }
    case 'name': {
      const c = catalog.conById.get(rest);
      return c ? nameQuestion(c, catalog.constellations, rng) : null;
    }
    case 'story': {
      const [storyId, qId] = rest.split(':');
      const all = listStories(ctx.content, catalog);
      const s = all.find((x) => x.story.id === storyId);
      if (!s) return null;
      if (qId === 'which') return whichMythQuestion(s, [...new Map(all.map((x) => [x.con.id, x.con])).values()], rng);
      const q = s.story.questions.find((x) => x.id === qId);
      return q ? storyMcq(s, q, rng) : null;
    }
    case 'card': {
      const s = listStories(ctx.content, catalog).find((x) => x.story.id === rest);
      return s ? cardQuestion(s) : null;
    }
    case 'know': {
      const [lessonId, qId] = rest.split(':');
      const l = ctx.lessons.find((x) => x.id === lessonId);
      const q = l?.questions.find((x) => x.id === qId);
      return l && q ? lessonQuestion(l, q, rng) : null;
    }
    case 'vis': {
      if (catalog.conById.has(rest)) return visibilityQuestion(rest, ctx.facts(), ctx.observer, rng);
      const p = planetsUp(ctx.planets()).find((x) => x.name === rest);
      return p ? planetQuestion(p, rng) : null;
    }
    case 'object': {
      const t = catalog.resolve(rest);
      if (t?.star) return starQuestion(t.star, catalog.stars.filter((s) => s.name && s.mag <= STAR_QUIZ_MAG + 0.5), rng);
      if (t?.dso) return dsoQuestion(t.dso, dsoCandidates(catalog, []), rng);
      return t ? imageQuestion(Object.keys(catalog.images).find((r) => catalog.resolve(r)?.ref === t.ref) ?? rest, imageCandidates(catalog), catalog, rng) : null;
    }
    default:
      return null;
  }
}

/** Run builders for the chosen ids, dropping the ones that cannot be built. */
export function buildFrom(ids: readonly string[], builders: Map<string, () => Question | null>): Question[] {
  const out: Question[] = [];
  for (const id of ids) {
    const q = builders.get(id)?.();
    if (q) out.push(q);
  }
  return uniqueKeys(out);
}
