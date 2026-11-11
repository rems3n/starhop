/**
 * Star-hop questions (`/practice/starhop`). Pure: catalog + the star-hop library in, questions out.
 * Item id `hop:<id>`, skill 'object' (the progress store's Skill union is fixed; see docs/QUIZ.md).
 */
import { angularSeparation, localDateOf } from '@/astro';
import type { Starhop } from '@/content/schema';
import type { Catalog } from '@/data/catalog';
import type { Observer, ResolvedTarget } from '@/types';
import { MASK, plainText } from './build';
import { buildChoices, constellationDistractors, pickDistinct } from './distractors';
import type { Rng } from './rng';
import type { HopQ, McqQ, Question } from './types';

type Cat = Pick<Catalog, 'resolve' | 'stars' | 'dsos' | 'constellations' | 'conById'>;

export type HopSeason = 'now' | 'any';
export type HopMode = 'click' | 'mcq';

export const hopItemId = (id: string) => `hop:${id}`;

/** Evening months when the hop works for this observer's hemisphere. */
export function hopMonths(h: Pick<Starhop, 'monthsNorth' | 'monthsSouth'>, lat: number): number[] {
  return lat >= 0 ? h.monthsNorth : h.monthsSouth;
}

/** Usable at all from this hemisphere (any season). */
export function hopUsable(h: Pick<Starhop, 'hemisphere' | 'monthsNorth' | 'monthsSouth'>, lat: number): boolean {
  const side = lat >= 0 ? 'N' : 'S';
  return (h.hemisphere === 'both' || h.hemisphere === side) && hopMonths(h, lat).length > 0;
}

/** Hops usable from the observer's hemisphere — this month's evenings (`now`) or in any season — by rank. */
export function hopsFor<H extends Pick<Starhop, 'hemisphere' | 'monthsNorth' | 'monthsSouth' | 'rank'>>(hops: readonly H[], observer: Observer, season: HopSeason, now: Date): H[] {
  const month = localDateOf(now, observer).month;
  return hops.filter((h) => hopUsable(h, observer.lat) && (season === 'any' || hopMonths(h, observer.lat).includes(month))).sort((a, b) => a.rank - b.rank);
}

/** "December–February" style label for a list of months (consecutive runs, wrapping over the year end). */
export function monthsLabel(months: readonly number[]): string {
  const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const set = new Set(months);
  if (!set.size) return '';
  if (set.size === 12) return 'all year';
  // start at a month whose predecessor is missing, so runs that wrap over December stay together
  const start = [...set].sort((a, b) => a - b).find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? 1;
  const runs: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((start - 1 + i) % 12) + 1;
    if (!set.has(m)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === (m === 1 ? 12 : m - 1)) last[1] = m;
    else runs.push([m, m]);
  }
  return runs.map(([a, b]) => (a === b ? NAMES[a - 1] : `${NAMES[a - 1]}–${NAMES[b - 1]}`)).join(', ');
}

// ───────────── question text

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name that would give the target away. */
function targetNames(t: ResolvedTarget): string[] {
  const out = [t.name];
  if (t.star?.name) out.push(t.star.name);
  if (t.dso) {
    if (t.dso.name) out.push(t.dso.name);
    if (t.dso.messier) out.push(`M${t.dso.messier}`, `M ${t.dso.messier}`, `Messier ${t.dso.messier}`);
  }
  if (t.constellation) out.push(t.constellation.name, t.constellation.english.replace(/^the\s+/i, ''));
  return [...new Set(out.filter((w) => w && w.length >= 2 && w !== 'Point'))];
}

/** A hop's instruction text with the target hidden: links to it and its names become ▁▁▁▁▁. */
export function maskHopText(text: string, targets: readonly ResolvedTarget[], catalog: Pick<Catalog, 'resolve'>): string {
  const canon = new Set(targets.map((t) => t.ref));
  let out = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, ref: string, label: string) => (canon.has(catalog.resolve(ref.trim())?.ref ?? ref) ? MASK : label));
  out = plainText(out);
  const words = targets.flatMap(targetNames).sort((a, b) => b.length - a.length);
  for (const w of words) out = out.replace(new RegExp(`(?<![\\p{L}\\d])${esc(w)}(?:['’]s)?(?![\\p{L}\\d])`, 'giu'), MASK);
  return out;
}

/** Refs to ring at the start: the first path star, and the second too when the hop starts from a pattern (pointer pairs, arcs). */
export function hopStartRefs(h: Pick<Starhop, 'from' | 'path'>): string[] {
  const fromStar = h.from.startsWith('star:');
  return h.path.slice(0, fromStar || h.path.length <= 2 ? 1 : 2);
}

/** The answer label of a resolved target, in the same style as its distractors. */
export function targetLabel(t: ResolvedTarget): string {
  if (t.kind === 'point' && t.name === 'Point') return 'the spot the hop describes';
  if (t.dso) return t.dso.messier ? (t.dso.name ? `M${t.dso.messier} (${t.dso.name})` : `M${t.dso.messier}`) : t.name;
  return t.name;
}

/**
 * The click target (last path point) and the answer of "where does it lead?" — the hop's `to`, except that a
 * shape (asterism) answer is replaced by the star the path ends on, so the four choices are all stars.
 */
export function hopTargets(h: Pick<Starhop, 'to' | 'path'>, catalog: Pick<Catalog, 'resolve'>): { click: ResolvedTarget | null; to: ResolvedTarget | null } {
  const click = catalog.resolve(h.path[h.path.length - 1]);
  const to = catalog.resolve(h.to);
  return { click, to: to?.kind === 'asterism' || to?.kind === 'point' ? click : to };
}

/** "Follow the hop": ring the start, show the masked steps, click the star you land on. */
export function hopClickQuestion(h: Starhop, catalog: Cat): HopQ | null {
  const { click, to } = hopTargets(h, catalog);
  const path = h.path.map((r) => catalog.resolve(r));
  if (!click || !to || path.some((p) => !p)) return null;
  const masks = [click, to];
  const id = hopItemId(h.id);
  return {
    kind: 'hop', key: id, itemId: id, skill: 'object', hopId: h.id, title: h.name, steps: h.steps.map((s) => maskHopText(s, masks, catalog)),
    start: hopStartRefs(h).map((r) => catalog.resolve(r)!.ref), path: path.map((p) => p!.ref), target: click.ref, targetName: targetLabel(click), explanation: plainText(h.summary),
    promptText: `Follow the hop from ${catalog.resolve(h.path[0])!.name}`, answerText: `${targetLabel(click)} — ${h.name}`,
  };
}

/** Same-kind objects near the target that a learner could plausibly land on instead. */
export function hopDistractors(h: Pick<Starhop, 'path'>, to: ResolvedTarget, catalog: Cat, rng: Rng, n = 3): string[] {
  const onPath = new Set(h.path.map((r) => catalog.resolve(r)?.ref));
  const answer = targetLabel(to);
  const near = (radius: number) => <T extends { ra: number; dec: number }>(list: T[]) => list.filter((x) => angularSeparation(x, to) <= radius).sort((a, b) => angularSeparation(a, to) - angularSeparation(b, to));
  if (to.constellation) {
    const ids = constellationDistractors(to.constellation, catalog.constellations, rng, n);
    return ids.map((id) => catalog.conById.get(id)!.name);
  }
  let names: string[] = [];
  for (const radius of [40, 70, 180]) {
    if (to.dso) {
      const pool = catalog.dsos.filter((d) => (d.messier || (d.name && d.mag != null && d.mag <= 7)) && d.id !== to.dso!.id && !onPath.has(`dso:${d.id}`));
      const sameType = near(radius)(pool.filter((d) => d.type === to.dso!.type)).slice(0, 6);
      const any = near(radius)(pool).slice(0, 8);
      names = [...sameType, ...any].map((d) => catalog.resolve(`dso:${d.id}`)).filter((t): t is ResolvedTarget => !!t).map(targetLabel);
    } else {
      const pool = catalog.stars.filter((s) => s.name && s.mag <= 3.5 && !onPath.has(`star:${s.id}`) && s.name !== to.name);
      names = near(radius)(pool).slice(0, 8).map((s) => s.name!);
    }
    if (pickDistinct(answer, names, rng, n).length >= n) break;
  }
  return pickDistinct(answer, names, rng, n);
}

/** "Where does this hop lead?" — the masked instructions, pick the target among four. */
export function hopMcqQuestion(h: Starhop, catalog: Cat, rng: Rng): McqQ | null {
  const { click, to } = hopTargets(h, catalog);
  const start = catalog.resolve(h.path[0]);
  // a point in empty sky (a celestial pole, the galactic centre) has no fair same-kind wrong answers
  if (!to || !start || to.kind === 'point') return null;
  const answer = targetLabel(to);
  const wrong = hopDistractors(h, to, catalog, rng);
  if (wrong.length < 3) return null;
  const masks = click ? [click, to] : [to];
  const steps = h.steps.map((s, i) => `${i + 1}. ${maskHopText(s, masks, catalog)}`);
  const id = hopItemId(h.id);
  return {
    kind: 'mcq', key: `${id}#mcq`, itemId: id, skill: 'object', context: `Star-hop · starting from ${start.name}`,
    prompt: `Where does this hop lead?\n\n${steps.join('\n')}`, ...buildChoices(answer, wrong, rng),
    explanation: `${h.name}: ${plainText(h.summary)}`, promptText: `Where does the hop from ${start.name} lead?`, answerText: answer,
  };
}

/** Item id → builder. With both modes on, each time an item is asked one format is picked at random. */
export function hopBuilders(hops: readonly Starhop[], catalog: Cat, modes: Record<HopMode, boolean>, rng: Rng): Map<string, () => Question | null> {
  const out = new Map<string, () => Question | null>();
  for (const h of hops) {
    const click = () => hopClickQuestion(h, catalog);
    const mcq = () => hopMcqQuestion(h, catalog, rng);
    if (modes.click && modes.mcq) out.set(hopItemId(h.id), () => (rng() < 0.5 ? click() ?? mcq() : mcq() ?? click()));
    else if (modes.click) out.set(hopItemId(h.id), click);
    else if (modes.mcq) out.set(hopItemId(h.id), mcq);
  }
  return out;
}

/** Every enabled format for one hop (deep link `?hop=`): click first, then multiple choice. */
export function questionsForHop(h: Starhop, catalog: Cat, modes: Record<HopMode, boolean>, rng: Rng): Question[] {
  const qs: (Question | null)[] = [modes.click ? hopClickQuestion(h, catalog) : null, modes.mcq ? hopMcqQuestion(h, catalog, rng) : null];
  return qs.filter((q): q is Question => !!q);
}

// ───────────── the sky

/** Centre and angular radius of a set of points (for framing the hop). */
export function hopFrame(points: readonly { ra: number; dec: number }[]): { ra: number; dec: number; radius: number } {
  const D = Math.PI / 180;
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    x += Math.cos(p.dec * D) * Math.cos(p.ra * D);
    y += Math.cos(p.dec * D) * Math.sin(p.ra * D);
    z += Math.sin(p.dec * D);
  }
  const ra = ((Math.atan2(y, x) / D) % 360 + 360) % 360;
  const dec = Math.atan2(z, Math.hypot(x, y)) / D;
  const c = { ra, dec };
  return { ra, dec, radius: Math.max(0, ...points.map((p) => angularSeparation(c, p))) };
}

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
  ra: number;
  dec: number;
}

/** Click tolerance: about 2° of sky, never less than 20 px (28 px on touch screens). */
export function hopTolerancePx(heightPx: number, fovDeg: number, coarse = false): number {
  return Math.max(coarse ? 28 : 20, (2 * heightPx) / Math.max(1, fovDeg));
}

/** Stars this close to the target (degrees) count as the target: wide pairs such as Mizar and Alcor. */
export const SAME_SPOT_DEG = 0.3;

/**
 * Which star did the learner click? The nearest of `candidates` (and the target) within `tolPx` of the click.
 * Right when that is the target (or practically on top of it); null `picked` means empty sky.
 */
export function judgeHopClick(click: { x: number; y: number }, target: ScreenPoint, candidates: readonly ScreenPoint[], tolPx: number): { correct: boolean; picked: ScreenPoint | null; distPx: number } {
  let picked: ScreenPoint | null = null;
  let best = Infinity;
  for (const p of [target, ...candidates]) {
    const d = Math.hypot(p.x - click.x, p.y - click.y);
    if (d < best - 1e-9) {
      best = d;
      picked = p;
    }
  }
  if (!picked || best > tolPx) return { correct: false, picked: null, distPx: Math.hypot(target.x - click.x, target.y - click.y) };
  const correct = picked.id === target.id || angularSeparation(picked, target) < SAME_SPOT_DEG;
  return { correct, picked, distPx: best };
}

