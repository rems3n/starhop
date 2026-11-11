/**
 * Resolves the course for a learner's location (owner: IA/course engineer; see docs/briefs/v2.md).
 * PLACEHOLDER signatures — the implementation replaces the bodies, the exported types/signatures are FIXED.
 */
import type { Catalog } from '@/data/catalog';
import type { Observer } from '@/types';
import { courseModules, type CourseModule } from './index';

export interface ConstellationGroup {
  /** e.g. "dec-feb" */
  id: string;
  /** e.g. "December–February evenings" (hemisphere-neutral) */
  title: string;
  /** Months (1–12) in which this group is best placed in the evening at the learner's latitude */
  months: number[];
  /** IAU abbreviations, most prominent first */
  constellations: string[];
}

export interface ResolvedModule extends CourseModule {
  /** anchors / seasons / beyond: constellation groups for this location; lessons modules: [] */
  groups: ConstellationGroup[];
  /** starhops modules: star-hop ids practicable from this location, best first */
  starhopIds: string[];
}

export interface ResolvedCourse {
  observerKey: string;
  modules: ResolvedModule[];
  /** Every constellation id in the course (anchors + seasons [+ beyond]) */
  allConstellations: string[];
}

export function resolveCourse(observer: Observer, _catalog: Catalog): ResolvedCourse {
  return {
    observerKey: `${observer.lat.toFixed(1)},${observer.lon.toFixed(1)}`,
    modules: courseModules.map((m) => ({ ...m, groups: [], starhopIds: [] })),
    allConstellations: [],
  };
}
