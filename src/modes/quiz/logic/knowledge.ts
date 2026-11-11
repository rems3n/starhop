/** Sky-knowledge questions computed for the learner's own location. */
import { constellationPoints, eveningSeason, yearVisibility, type EveningSeason } from '@/astro';
import { MONTH_NAMES } from '@/lib/time';
import type { Constellation, Observer, Star, TonightItem, VisibilityClass } from '@/types';
import { buildChoices } from './distractors';
import { pickOne, sample, shuffle, type Rng } from './rng';
import type { McqQ, SkyObjQ } from './types';

export type Circumpolar = 'circumpolar' | 'rises-sets' | 'never-rises' | 'partial';

export interface ConFacts {
  id: string;
  name: string;
  /** Visibility class on the night of the 15th of each month */
  months: VisibilityClass[];
  season: EveningSeason;
  circ: Circumpolar;
}

/** Margin (degrees) so constellations that only scrape the horizon are not asked about. */
const CIRC_MARGIN = 1.5;

export function circumpolarClass(decs: readonly number[], lat: number): Circumpolar {
  const sign = lat >= 0 ? 1 : -1;
  const cap = 90 - Math.abs(lat);
  const d = decs.map((x) => x * sign);
  if (d.every((x) => x > cap + CIRC_MARGIN)) return 'circumpolar';
  if (d.every((x) => x < -cap - CIRC_MARGIN)) return 'never-rises';
  if (d.every((x) => x < cap - CIRC_MARGIN && x > -cap + CIRC_MARGIN)) return 'rises-sets';
  return 'partial';
}

const factCache = new Map<string, ConFacts[]>();

/** Year-round facts for every constellation from one place (about 0.1 s the first time, then cached). */
export function computeFacts(catalog: { constellations: Constellation[]; starById: Map<number, Star> }, observer: Observer, year: number): ConFacts[] {
  const k = `${observer.lat.toFixed(3)},${observer.lon.toFixed(3)},${observer.tz},${year},${catalog.constellations.length}`;
  let f = factCache.get(k);
  if (!f) {
    f = catalog.constellations.map((c) => {
      const points = constellationPoints(c, catalog);
      return {
        id: c.id,
        name: c.name,
        months: yearVisibility({ points }, year, observer).map((v) => v.cls),
        season: eveningSeason({ points }, observer, { year }),
        circ: circumpolarClass(points.map((p) => p.dec), observer.lat),
      };
    });
    factCache.set(k, f);
  }
  return f;
}

const base = (f: ConFacts, n: number) => ({ kind: 'mcq' as const, key: `vis:${f.id}#${n}`, itemId: `vis:${f.id}`, skill: 'visibility' as const, con: f.id });
const inEvening = (c: VisibilityClass) => c === 'evening' || c === 'all-night';
const latWords = (o: Observer) => `${Math.abs(o.lat).toFixed(1)}° ${o.lat >= 0 ? 'north' : 'south'}`;

/** "Which of these is in the evening sky in mid-July?" — the three wrong answers are not visible at all that month. */
export function monthQuestion(target: ConFacts, facts: readonly ConFacts[], observer: Observer, rng: Rng): McqQ | null {
  const months = target.months.map((c, i) => (inEvening(c) ? i : -1)).filter((i) => i >= 0);
  for (const m of shuffle(months, rng)) {
    const hidden = facts.filter((f) => f.id !== target.id && f.months[m] === 'not-visible');
    // prefer constellations that do show up at some other time of year: "never rises here" is too easy to rule out
    const seasonal = hidden.filter((f) => f.season !== 'never');
    const wrong = [...sample(seasonal, 3, rng), ...sample(hidden.filter((f) => f.season === 'never'), 3, rng)].slice(0, 3);
    if (wrong.length < 3) continue;
    const { choices, answerIndex } = buildChoices(target.name, wrong.map((f) => f.name), rng);
    const prompt = `Which of these constellations is in the evening sky in mid-${MONTH_NAMES[m]} from ${observer.name}?`;
    return {
      ...base(target, 1), prompt, choices, answerIndex, promptText: `Evening sky in ${MONTH_NAMES[m]}`, answerText: target.name,
      explanation: `${target.name} is ${target.months[m] === 'all-night' ? 'up all night' : 'up in the evening'} in mid-${MONTH_NAMES[m]}. The other three are not usefully above the horizon while it is dark that month.`,
    };
  }
  return null;
}

const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "In which season is Orion in the evening sky?" Only for constellations with one clear season. */
export function seasonQuestion(target: ConFacts, observer: Observer): McqQ | null {
  const i = SEASONS.findIndex((s) => s === target.season);
  if (i < 0) return null;
  return {
    ...base(target, 2), prompt: `In which season is ${target.name} best placed in the evening sky from ${observer.name}?`, choices: SEASONS.map(cap), answerIndex: i,
    promptText: `Evening season of ${target.name}`, answerText: cap(SEASONS[i]),
    explanation: `${target.name} stands highest in the late evening in ${SEASONS[i]}. Half a year later the Sun is on that side of the sky and it is up in daylight.`,
  };
}

const CIRC_CHOICES = ['Yes — it never sets', 'No — it rises and sets', 'No — it never rises here'];

/** "Is X circumpolar from here?" Constellations that straddle the limit are skipped. */
export function circumpolarQuestion(target: ConFacts, observer: Observer): McqQ | null {
  if (target.circ === 'partial') return null;
  const answerIndex = target.circ === 'circumpolar' ? 0 : target.circ === 'rises-sets' ? 1 : 2;
  const pole = observer.lat >= 0 ? 'north' : 'south';
  const why = answerIndex === 0
    ? `All of its main stars lie within ${Math.abs(observer.lat).toFixed(0)}° of the ${pole} celestial pole, so they circle the pole without ever dipping below the horizon.`
    : answerIndex === 1
      ? `Stars within ${Math.abs(observer.lat).toFixed(0)}° of the ${pole} celestial pole never set; ${target.name} lies farther from the pole than that, so it rises and sets.`
      : `It lies too close to the ${pole === 'north' ? 'south' : 'north'} celestial pole to clear the horizon from latitude ${latWords(observer)}.`;
  return {
    ...base(target, 3), prompt: `Is ${target.name} circumpolar from ${observer.name}? (Circumpolar means it circles the pole and never sets.)`, choices: CIRC_CHOICES, answerIndex,
    promptText: `Is ${target.name} circumpolar?`, answerText: CIRC_CHOICES[answerIndex], explanation: why,
  };
}

/** "Roughly how high does Polaris stand here?" Northern observers only. Recorded against Ursa Minor. */
export function polarisQuestion(observer: Observer, rng: Rng): McqQ | null {
  if (observer.lat < 10) return null;
  const answer = Math.round(observer.lat);
  const picked: number[] = [];
  for (const v of shuffle([90 - answer, 10, 25, 40, 55, 70, 90], rng)) {
    if (picked.length >= 3) break;
    if ([answer, ...picked].every((x) => Math.abs(x - v) >= 12)) picked.push(v);
  }
  if (picked.length < 3) return null;
  const all = [answer, ...picked].sort((a, b) => a - b);
  const text = (v: number) => (v === 90 ? 'Straight overhead (90°)' : `About ${v}° above the horizon`);
  return {
    kind: 'mcq', key: 'vis:UMi#4', itemId: 'vis:UMi', skill: 'visibility', con: 'UMi',
    prompt: `Roughly how high above the northern horizon does Polaris stand from ${observer.name}?`, choices: all.map(text), answerIndex: all.indexOf(answer),
    promptText: 'Height of Polaris here', answerText: text(answer),
    explanation: `Polaris sits within 1° of the north celestial pole, and the pole's height above the horizon equals your latitude: ${latWords(observer)}. That is about four fists held at arm's length for every 40°.`,
  };
}

/** One computed question for a `vis:<Abbr>` item, of a randomly chosen kind that applies to it. */
export function visibilityQuestion(conId: string, facts: readonly ConFacts[], observer: Observer, rng: Rng): McqQ | null {
  const f = facts.find((x) => x.id === conId);
  if (!f) return null;
  const makers: (() => McqQ | null)[] = [() => monthQuestion(f, facts, observer, rng), () => seasonQuestion(f, observer), () => circumpolarQuestion(f, observer)];
  if (conId === 'UMi') makers.push(() => polarisQuestion(observer, rng));
  for (const make of shuffle(makers, rng)) {
    const q = make();
    if (q) return q;
  }
  return null;
}

/**
 * Every computed question that applies to one constellation (month, season, circumpolar, and Polaris for
 * Ursa Minor), in random order. Used by `/quiz/visibility?con=Abbr`, where one item gets several angles.
 */
export function visibilityQuestionsFor(conId: string, facts: readonly ConFacts[], observer: Observer, rng: Rng): McqQ[] {
  const f = facts.find((x) => x.id === conId);
  if (!f) return [];
  const qs = [monthQuestion(f, facts, observer, rng), seasonQuestion(f, observer), circumpolarQuestion(f, observer), conId === 'UMi' ? polarisQuestion(observer, rng) : null];
  return shuffle(qs.filter((q): q is McqQ => !!q), rng);
}

export const QUIZ_PLANETS =['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

/** Naked-eye planets that are up tonight. */
export function planetsUp(planets: readonly TonightItem[]): TonightItem[] {
  return planets.filter((p) => QUIZ_PLANETS.includes(p.name) && p.visibility.cls !== 'not-visible' && p.visibility.bestTime);
}

/** "Which planet is this tonight?" — the planet ringed in tonight's real sky; the wrong answers are the other planets. */
export function planetQuestion(item: TonightItem, rng: Rng): SkyObjQ | null {
  if (!item.visibility.bestTime) return null;
  const { choices, answerIndex } = buildChoices(item.name, sample(QUIZ_PLANETS.filter((p) => p !== item.name), 3, rng), rng);
  return {
    kind: 'skyobj', key: `vis:${item.name}`, itemId: `vis:${item.name}`, skill: 'visibility', ref: item.ref, objKind: 'planet',
    prompt: 'Which planet is this tonight?', choices, answerIndex, explanation: item.note, fov: 75, tonightTime: item.visibility.bestTime.getTime(),
    promptText: 'Planet in tonight’s sky', answerText: item.name,
  };
}

export { pickOne };
