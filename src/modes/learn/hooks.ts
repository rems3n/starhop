/** Small shared hooks and Learn's own bit of saved state. */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { altAzOf, currentNightDate } from '@/astro';
import { useCatalog, type Catalog } from '@/data/catalog';
import { routes } from '@/lib/routes';
import { useSettings } from '@/store/settings';
import type { SkyController, TargetRef } from '@/types';
import type { SceneContext } from './logic/scene';

interface LearnLocal {
  /** Asterism / signpost pages the learner has opened (the shared progress store only tracks constellations) */
  asterismsSeen: Record<string, number>;
  markAsterismSeen: (id: string) => void;
}
export const useLearnLocal = create<LearnLocal>()(
  persist(
    (set) => ({
      asterismsSeen: {},
      markAsterismSeen: (id) => set((s) => (s.asterismsSeen[id] ? s : { asterismsSeen: { ...s.asterismsSeen, [id]: Date.now() } })),
    }),
    { name: 'starhop.learn.v1', version: 1 },
  ),
);

export interface LearnEnv extends SceneContext {
  catalog: Catalog;
  /** Date to pass to night functions when you mean "tonight" (yesterday's date between midnight and sunrise) */
  nightDate: Date;
}

/** Catalog + location + "now" (fixed for the life of the page so scenes do not jitter). Null while the catalog loads. */
export function useLearnEnv(): LearnEnv | null {
  const catalog = useCatalog();
  const observer = useSettings((s) => s.observer);
  const bortle = useSettings((s) => s.bortle);
  return useMemo(() => {
    if (!catalog) return null;
    const now = new Date();
    return { catalog, observer, bortle, now, nightDate: currentNightDate(now, observer), resolve: catalog.resolve };
  }, [catalog, observer, bortle]);
}

/**
 * Point a sky view at something the learner clicked in the text: select it and fly there.
 * Returns a short note when it is below the horizon in that view, else null.
 */
export function showInSky(c: SkyController | null, catalog: Catalog, ref: TargetRef): string | null {
  if (!c) return null;
  const when = { date: c.getTime(), observer: c.getObserver() };
  const t = catalog.resolve(ref, when);
  if (!t) return null;
  const view = c.getView();
  c.setSelection(ref);
  void c.flyTo(ref, { fov: t.fov ? Math.min(view.fov, Math.max(t.fov, 25)) : view.fov });
  if (view.mount === 'altaz' && c.getLayers().ground && altAzOf(t.ra, t.dec, when.date, when.observer).alt < 0) return `${t.name} is below the horizon at this time.`;
  return null;
}

export const objectHref = (ref: string) => routes.object(ref);
/** Sky deep link; `time` opens the sky at that moment with the clock paused. */
export const exploreHref = (ref?: string, time?: Date) => routes.sky(ref, time);
