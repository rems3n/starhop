/** Access to authored content. Constellation pages are code-split (one chunk each); everything else is small and eager. */
import type { Asterism, ConstellationContent, CourseModule, Lesson, MeteorShower, MonthlyGuide, ObjectBlurb, PathUnit, Starhop } from './schema';
import pathJson from './path.json';
import asterismsJson from './asterisms.json';
import monthlyJson from './monthly.json';
import showersJson from './showers.json';
import starhopsJson from './starhops.json';
import courseJson from './course.json';

const lessonModules = import.meta.glob<{ default: Lesson }>('./lessons/*.json', { eager: true });
const blurbModules = import.meta.glob<{ default: Record<string, ObjectBlurb> }>('./objects/*.json', { eager: true });
const constellationLoaders = import.meta.glob<{ default: ConstellationContent }>('./constellations/*.json');

export const pathUnits = pathJson as PathUnit[];
export const asterisms = asterismsJson as unknown as Asterism[];
export const monthlyGuides = monthlyJson as unknown as MonthlyGuide[];
export const showers = showersJson as unknown as MeteorShower[];
/** Star-hop library, sorted by rank (1 = most widely taught) */
export const starhops = (starhopsJson as unknown as Starhop[]).slice().sort((a, b) => a.rank - b.rank);
export const starhopById = new Map(starhops.map((h) => [h.id, h]));
/** Course modules in order. Constellation modules are resolved per location by src/content/course.ts */
export const courseModules = (courseJson as unknown as { modules: CourseModule[] }).modules.slice().sort((a, b) => a.number - b.number);

export const lessons: Lesson[] = Object.values(lessonModules)
  .map((m) => m.default)
  .sort((a, b) => a.unit.localeCompare(b.unit) || a.order - b.order);
export const lessonById = new Map(lessons.map((l) => [l.id, l]));
export const asterismById = new Map(asterisms.map((a) => [a.id, a]));

/** Authored blurbs keyed by the ref the author used (e.g. "dso:M42", "star:Vega", "body:Mars"). Look up via getBlurb. */
const blurbs: Record<string, ObjectBlurb> = Object.assign({}, ...Object.values(blurbModules).map((m) => m.default));
const blurbsLower = new Map(Object.entries(blurbs).map(([k, v]) => [k.toLowerCase(), v]));

/** Try each alias of an object (e.g. ["star:Vega", "star:α Lyr", "star:91262"]) and return the first authored blurb. */
export function getBlurb(...refs: string[]): ObjectBlurb | undefined {
  for (const r of refs) {
    const b = blurbsLower.get(r.toLowerCase());
    if (b) return b;
  }
  return undefined;
}
export const blurbRefs = Object.keys(blurbs);

const conCache = new Map<string, Promise<ConstellationContent | null>>();
/** Lazy-load one constellation's page content. Resolves null if it has not been written. */
export function loadConstellationContent(id: string): Promise<ConstellationContent | null> {
  let p = conCache.get(id);
  if (!p) {
    const loader = constellationLoaders[`./constellations/${id}.json`];
    p = loader ? loader().then((m) => m.default) : Promise.resolve(null);
    conCache.set(id, p);
  }
  return p;
}
export const constellationContentIds = Object.keys(constellationLoaders).map((k) => k.replace(/^.*\/(\w+)\.json$/, '$1'));

/** Load every constellation's content (story quizzes, search). */
export async function loadAllConstellationContent(): Promise<ConstellationContent[]> {
  const all = await Promise.all(constellationContentIds.map(loadConstellationContent));
  return all.filter((c): c is ConstellationContent => !!c);
}

export type { CourseModule, Starhop, Figure, FigureImage } from './schema';
export type { Asterism, ConstellationContent, Lesson, MeteorShower, MonthlyGuide, ObjectBlurb, PathUnit, Story, Mcq, Demo, DemoStep } from './schema';
