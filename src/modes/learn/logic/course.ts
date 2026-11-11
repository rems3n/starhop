/** Course helpers for Learn: lesson order, module progress and "continue where you left off". Pure except `useCourse`. */
import { useMemo } from 'react';
import { courseModules, lessonById, starhopById } from '@/content';
import { resolveCourse, type ResolvedCourse, type ResolvedModule } from '@/content/course';
import type { Catalog } from '@/data/catalog';
import { routes } from '@/lib/routes';
import { itemMastery, UNIT_PASS_SCORE, useProgress, type ItemProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

export interface LessonPlace {
  module: (typeof courseModules)[number];
  /** 1-based position in the module */
  k: number;
  n: number;
  prev?: string;
  next?: string;
  /** Next lesson in course order (may be in a later module), skipping unwritten ones */
  nextInCourse?: { id: string; moduleNumber: number; sameModule: boolean };
}

const written = (id: string) => lessonById.has(id);
/** course.json omits defaulted fields, so read lessons defensively. */
const lessonsOf = (m: { lessons?: string[] }) => m.lessons ?? [];

/** Where a lesson sits in the course, or null when it is not part of it. Only written lessons are counted. */
export function lessonPlace(lessonId: string): LessonPlace | null {
  const module = courseModules.find((m) => lessonsOf(m).includes(lessonId));
  if (!module) return null;
  const list = lessonsOf(module).filter(written);
  const i = list.indexOf(lessonId);
  const order = courseModules.flatMap((m) => lessonsOf(m).filter(written).map((id) => ({ id, m })));
  const ci = order.findIndex((x) => x.id === lessonId);
  const nx = ci >= 0 ? order[ci + 1] : undefined;
  return {
    module,
    k: i + 1,
    n: list.length,
    prev: i > 0 ? list[i - 1] : undefined,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined,
    nextInCourse: nx ? { id: nx.id, moduleNumber: nx.m.number, sameModule: nx.m.id === module.id } : undefined,
  };
}

export interface ProgressInput {
  lessonsDone: Record<string, number>;
  seen: Record<string, number>;
  unitScores: Record<string, number>;
  items: Record<string, ItemProgress>;
}

export const MASTERED = 0.8;

/** A constellation counts as mastered when its find-it mastery reaches MASTERED. */
export function isMastered(items: Record<string, ItemProgress>, con: string): boolean {
  const p = items[`find:${con}`];
  return (itemMastery(p) ?? 0) >= MASTERED;
}

export interface ModuleProgress {
  lessonsDone: number;
  lessonsTotal: number;
  consSeen: number;
  consMastered: number;
  consTotal: number;
  starhops: number;
  score: number | null;
  passed: boolean;
  /** 0..1 */
  fraction: number;
  started: boolean;
  done: boolean;
  /** Next thing to do in the module */
  next: { label: string; title: string; href: string };
}

export function moduleProgress(m: ResolvedModule, p: ProgressInput, conName: (id: string) => string): ModuleProgress {
  const lessons = m.lessons.filter(written);
  const cons = m.groups.flatMap((g) => g.constellations);
  const lessonsDone = lessons.filter((id) => p.lessonsDone[id]).length;
  const consSeen = cons.filter((c) => p.seen[c]).length;
  const consMastered = cons.filter((c) => isMastered(p.items, c)).length;
  const score = p.unitScores[m.id] ?? null;
  const passed = score != null && score >= UNIT_PASS_SCORE;
  const total = lessons.length + cons.length + 1;
  const fraction = (lessonsDone + consSeen + (passed ? 1 : 0)) / total;
  const started = lessonsDone > 0 || consSeen > 0 || score != null;
  const firstLesson = lessons.find((id) => !p.lessonsDone[id]);
  const firstCon = cons.find((c) => !p.seen[c]);
  const firstHop = m.starhopIds[0];
  let next: ModuleProgress['next'];
  if (firstLesson) {
    const k = lessons.indexOf(firstLesson) + 1;
    next = { label: `Lesson ${k} of ${lessons.length}`, title: lessonById.get(firstLesson)!.title, href: routes.lesson(firstLesson) };
  } else if (firstCon) next = { label: 'Constellation', title: conName(firstCon), href: routes.constellation(firstCon) };
  else if (m.kind === 'starhops' && firstHop && !passed) next = { label: 'Star-hops', title: starhopById.get(firstHop)?.name ?? 'The star-hops', href: routes.module(m.id) };
  else next = { label: 'Module quiz', title: passed ? 'Practise again' : 'Practice this module', href: routes.moduleQuiz(m.id) };
  return { lessonsDone, lessonsTotal: lessons.length, consSeen, consMastered, consTotal: cons.length, starhops: m.starhopIds.length, score, passed, fraction, started, done: fraction >= 1, next };
}

export interface CourseOverview {
  course: ResolvedCourse;
  modules: { module: ResolvedModule; progress: ModuleProgress }[];
  /** The first unfinished, non-optional module, or null when the course is done */
  current: { module: ResolvedModule; progress: ModuleProgress } | null;
}

export function courseOverview(course: ResolvedCourse, p: ProgressInput, conName: (id: string) => string): CourseOverview {
  const modules = course.modules.map((module) => ({ module, progress: moduleProgress(module, p, conName) }));
  const current = modules.find((x) => !x.module.optional && !x.progress.done) ?? null;
  return { course, modules, current };
}

/** The course for the learner's location (null while the catalog loads). */
export function useCourse(catalog: Catalog | null): ResolvedCourse | null {
  const observer = useSettings((s) => s.observer);
  return useMemo(() => (catalog ? resolveCourse(observer, catalog) : null), [catalog, observer]);
}

export function useCourseProgress(): ProgressInput {
  const lessonsDone = useProgress((s) => s.lessonsDone);
  const seen = useProgress((s) => s.seen);
  const unitScores = useProgress((s) => s.unitScores);
  const items = useProgress((s) => s.items);
  return useMemo(() => ({ lessonsDone, seen, unitScores, items }), [lessonsDone, seen, unitScores, items]);
}

/** "December–February" style month range for a list of months (1–12), or '' */
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthRange(months: number[]): string {
  if (!months.length) return '';
  if (months.length === 12) return 'all year';
  const set = new Set(months);
  // start at a month whose predecessor is not in the set
  const start = months.find((m) => !set.has(((m + 10) % 12) + 1)) ?? months[0];
  let end = start;
  while (set.has((end % 12) + 1) && (end % 12) + 1 !== start) end = (end % 12) + 1;
  const contiguous = [...set].length === ((end - start + 12) % 12) + 1;
  if (!contiguous) return months.map((m) => MONTHS_SHORT[m - 1]).join(', ');
  return start === end ? MONTHS_SHORT[start - 1] : `${MONTHS_SHORT[start - 1]}–${MONTHS_SHORT[end - 1]}`;
}

/**
 * How far a learner would have to travel to see a constellation that never rises usefully (some part ≥ 15° up):
 * "south of 25°N" / "north of 10°S".
 */
export function travelPhrase(decs: number[], observerLat: number): string {
  const fmt = (lat: number) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
  if (observerLat >= 0) {
    const need = Math.min(90, Math.max(...decs) + 75);
    return `visible from ${fmt(need)} and further south`;
  }
  const need = Math.max(-90, Math.min(...decs) - 75);
  return `visible from ${fmt(need)} and further north`;
}
