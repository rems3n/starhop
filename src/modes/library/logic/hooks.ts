/** Library data hooks: authored content, per-observer visibility computed in small chunks and cached. */
import { useEffect, useMemo, useState } from 'react';
import { loadAllConstellationContent, type ConstellationContent } from '@/content';
import { zonedParts } from '@/lib/time';
import { useProgress, itemMastery } from '@/store/progress';
import type { Observer } from '@/types';

let contentPromise: Promise<ConstellationContent[]> | null = null;
let contentCache: ConstellationContent[] | null = null;
/** Every constellation's authored content (88 small chunks, loaded once). Null while loading. */
export function useAllContent(): ConstellationContent[] | null {
  const [c, setC] = useState(contentCache);
  useEffect(() => {
    if (contentCache) return;
    let live = true;
    contentPromise ??= loadAllConstellationContent().then((all) => (contentCache = all));
    contentPromise.then((all) => live && setC(all), () => live && setC([]));
    return () => {
      live = false;
    };
  }, []);
  return c;
}

export function observerKey(o: Observer): string {
  return `${o.lat.toFixed(3)},${o.lon.toFixed(3)},${o.tz}`;
}

/** Month 1–12 now at the observer. */
export function currentMonth(o: Observer, now = new Date()): number {
  return zonedParts(now, o.tz).month;
}

const chunkCaches = new Map<string, Map<string, unknown>>();

/**
 * Compute `fn` for every item, a few per timer tick so the page never stalls, and cache the results under
 * `cacheKey` (include the observer in it) for the life of the page. `enabled: false` defers the work.
 */
export function useChunked<T, V>(cacheKey: string, items: T[] | null, key: (t: T) => string, fn: (t: T) => V, opts: { enabled?: boolean; size?: number } = {}): { get: (k: string) => V | undefined; done: boolean; version: number } {
  const { enabled = true, size = 12 } = opts;
  const [version, setVersion] = useState(0);
  let cache = chunkCaches.get(cacheKey) as Map<string, V> | undefined;
  if (!cache) {
    cache = new Map();
    chunkCaches.set(cacheKey, cache);
  }
  useEffect(() => {
    const c = cache!;
    const todo = (items ?? []).filter((t) => !c.has(key(t)));
    if (!enabled || !todo.length) return;
    let i = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      const t0 = performance.now();
      // at most `size` items and about 25 ms per tick
      for (let n = 0; i < todo.length && n < size && performance.now() - t0 < 25; n++, i++) {
        const t = todo[i];
        const k = key(t);
        if (!c.has(k)) c.set(k, fn(t));
      }
      setVersion((v) => v + 1);
      if (i < todo.length) timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, items, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = !!items && items.every((t) => cache!.has(key(t)));
  return { get: (k) => cache!.get(k), done, version };
}

/** Average mastery (0–1) over every quiz item tied to each constellation; missing = never practised. */
export function useMasteryByCon(): Map<string, number> {
  const items = useProgress((s) => s.items);
  return useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const p of Object.values(items)) {
      if (!p.con) continue;
      const m = itemMastery(p);
      if (m == null) continue;
      const a = acc.get(p.con) ?? { sum: 0, n: 0 };
      a.sum += m;
      a.n += 1;
      acc.set(p.con, a);
    }
    return new Map([...acc].map(([k, a]) => [k, a.sum / a.n]));
  }, [items]);
}

/** True when the viewport is phone-sized. */
export function useNarrow(query = '(max-width: 720px)'): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}
