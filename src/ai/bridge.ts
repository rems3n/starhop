/**
 * Link between the assistant and the full sky map. ExplorePage registers itself here while it is mounted, so the
 * assistant drives the same code paths as the page's own buttons (selection, fly-to, reset, zoom).
 */
import type { SkyController, TargetRef } from '@/types';

export interface SkyBridge {
  ctl: SkyController;
  /** Select (and optionally glide to) an object; null clears. Same as clicking it or picking it in search. */
  select(ref: TargetRef | null, opts?: { fly?: boolean; fov?: number }): void;
  /**
   * Show an object so it is actually in view: live sky if it is up in the dark now, otherwise the clock moves to its
   * best time tonight, otherwise the map switches to the atlas. Same as picking it in the search box.
   */
  present(ref: TargetRef, opts?: { fov?: number }): { mode: 'live' | 'time' | 'atlas'; time?: Date };
  /** Open the selected object's first photograph full-size (once its panel has rendered) */
  openPhoto(): void;
  selected(): TargetRef | null;
  mode(): 'live' | 'atlas';
  setMode(mode: 'live' | 'atlas', opts?: { keepView?: boolean }): void;
  resetView(): void;
  /** Multiply the field of view: < 1 zooms in */
  zoom(factor: number): void;
}

let current: SkyBridge | null = null;
const waiters = new Set<(b: SkyBridge) => void>();

export function registerSky(bridge: SkyBridge): () => void {
  current = bridge;
  for (const w of [...waiters]) w(bridge);
  waiters.clear();
  return () => {
    if (current === bridge) current = null;
  };
}

export const getSky = (): SkyBridge | null => current;

/** Resolves once the sky map is mounted and ready (straight away if it already is). */
export function waitForSky(timeoutMs = 10000): Promise<SkyBridge> {
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const done = (b: SkyBridge) => {
      window.clearTimeout(timer);
      resolve(b);
    };
    const timer = window.setTimeout(() => {
      waiters.delete(done);
      reject(new Error('The sky map did not open in time.'));
    }, timeoutMs);
    waiters.add(done);
  });
}
