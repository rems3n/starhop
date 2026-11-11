/**
 * Every in-app link goes through these helpers so the route map lives in one place.
 * Route map (see docs/briefs/v2.md):
 *   /sky                Sky map (formerly /explore)
 *   /tonight/*          Tonight, monthly guides, visibility calendar, events
 *   /learn/*            The course: modules and lessons
 *   /library/*          Reference: constellations, myths, star-hops, asterisms, stars, deep-sky objects, planets
 *   /practice/*         Quizzes, review and progress (formerly /quiz and /progress)
 */
import type { TargetRef } from '@/types';

const enc = encodeURIComponent;
const qs = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const routes = {
  // Sky
  sky: (target?: TargetRef, time?: Date) => `/sky${qs({ target, t: time && !isNaN(time.getTime()) ? time.toISOString() : undefined })}`,
  // Tonight
  tonight: () => '/tonight',
  month: (m?: number) => (m ? `/tonight/month/${m}` : '/tonight/month'),
  calendar: () => '/tonight/calendar',
  events: () => '/tonight/events',
  // Learn (course)
  learn: () => '/learn',
  module: (id: string) => `/learn/module/${id}`,
  lesson: (id: string) => `/learn/lesson/${id}`,
  // Library
  library: () => '/library',
  constellations: () => '/library/constellations',
  constellation: (id: string) => `/library/constellation/${id}`,
  myths: () => '/library/myths',
  myth: (storyId: string) => `/library/myth/${storyId}`,
  starhops: () => '/library/starhops',
  starhop: (id: string) => `/library/starhop/${id}`,
  asterisms: () => '/library/asterisms',
  asterism: (id: string) => `/library/asterism/${id}`,
  stars: () => '/library/stars',
  objects: () => '/library/objects',
  object: (ref: TargetRef) => `/library/object/${enc(ref)}`,
  planets: () => '/library/planets',
  // Practice
  practice: () => '/practice',
  quiz: (kind: 'find' | 'name' | 'object' | 'story' | 'knowledge' | 'visibility' | 'starhop', params: Record<string, string | undefined> = {}) => `/practice/${kind}${qs(params)}`,
  moduleQuiz: (moduleId: string) => `/practice/module/${moduleId}`,
  lessonQuiz: (lessonId: string) => `/practice/lesson/${lessonId}`,
  review: () => '/practice/review',
  progress: () => '/practice/progress',
};
