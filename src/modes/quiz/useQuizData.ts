import { useEffect, useMemo, useState } from 'react';
import { lessons, loadAllConstellationContent, pathUnits, starhops, type ConstellationContent } from '@/content';
import { resolveCourse } from '@/content/course';
import { useCatalog } from '@/data/catalog';
import { useSettings } from '@/store/settings';
import type { QuizData } from './logic/types';

/** Catalog + whatever authored content exists. Null while loading. Content that fails to load counts as "not written yet". */
export function useQuizData(): QuizData | null {
  const catalog = useCatalog();
  const observer = useSettings((s) => s.observer);
  const [content, setContent] = useState<ConstellationContent[] | null>(null);
  useEffect(() => {
    let live = true;
    loadAllConstellationContent().then((c) => live && setContent(c), () => live && setContent([]));
    return () => {
      live = false;
    };
  }, []);
  const course = useMemo(() => (catalog ? resolveCourse(observer, catalog) : undefined), [catalog, observer]);
  return useMemo(
    () => (catalog && content ? { catalog, content, lessons, units: pathUnits, observer, now: new Date(), course, hops: starhops } : null),
    [catalog, content, observer, course],
  );
}

export function cssToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};
