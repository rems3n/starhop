/**
 * The controller a page gets from <SkyEmbed onReady>. It is the real engine controller, except that calls the
 * PAGE makes to setLayers / setLimitingMag / setView are recorded as the page's "baseline" (what Reset returns
 * to) and announced to the embed so its open panel can refresh. The embed's own changes go to the raw controller
 * and are not recorded.
 */
import type { Highlight, LayerState, Observer, SkyController, TargetRef, ViewState } from '@/types';

export interface Baseline {
  layers: LayerState;
  limitingMag: number;
  view: ViewState;
  /** Only known once the page has set them */
  time?: Date;
  timeRate?: number;
  observer?: Observer;
  highlights?: Highlight[];
  selection?: TargetRef | null;
}

export function readBaseline(c: Pick<SkyController, 'getLayers' | 'getLimitingMag' | 'getView'>): Baseline {
  return { layers: { ...c.getLayers() }, limitingMag: c.getLimitingMag(), view: { ...c.getView() } };
}

export interface PageTracker {
  baseline: Baseline;
  /** Called after the page changed layers or limiting magnitude */
  onPageChange?: () => void;
}

/** Wrap `c` so page calls update `tracker.baseline`. Everything else passes straight through (bound to `c`). */
export function trackPageController(c: SkyController, tracker: PageTracker): SkyController {
  const overrides: Partial<SkyController> = {
    setLayers(patch) {
      c.setLayers(patch);
      tracker.baseline = { ...tracker.baseline, layers: { ...tracker.baseline.layers, ...patch } };
      tracker.onPageChange?.();
    },
    setLimitingMag(mag) {
      c.setLimitingMag(mag);
      tracker.baseline = { ...tracker.baseline, limitingMag: mag };
      tracker.onPageChange?.();
    },
    setView(patch) {
      c.setView(patch);
      // a mount change re-expresses lon/lat, so take the engine's resulting view for the changed fields
      const now = c.getView();
      const next: ViewState = { ...tracker.baseline.view };
      for (const k of Object.keys(patch) as (keyof ViewState)[]) (next as unknown as Record<string, unknown>)[k] = now[k];
      if (patch.mount) Object.assign(next, { mount: now.mount, lon: now.lon, lat: now.lat });
      tracker.baseline = { ...tracker.baseline, view: next };
    },
    setTime(date) {
      c.setTime(date);
      tracker.baseline = { ...tracker.baseline, time: new Date(date.getTime()) };
    },
    setTimeRate(rate) {
      c.setTimeRate(rate);
      tracker.baseline = { ...tracker.baseline, timeRate: rate };
    },
    setObserver(o) {
      c.setObserver(o);
      tracker.baseline = { ...tracker.baseline, observer: o };
    },
    setHighlights(list) {
      c.setHighlights(list);
      tracker.baseline = { ...tracker.baseline, highlights: list.slice() };
    },
    setSelection(ref) {
      c.setSelection(ref);
      tracker.baseline = { ...tracker.baseline, selection: ref };
    },
  };
  return new Proxy(c, {
    get(target, prop) {
      if (prop in overrides) return overrides[prop as keyof SkyController];
      const v = Reflect.get(target, prop);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

/** Put the sky back to the page's baseline: everything the page set, in the order a scene is applied. */
export function applyBaseline(c: SkyController, b: Baseline): void {
  if (b.observer) c.setObserver(b.observer);
  if (b.timeRate !== undefined) c.setTimeRate(b.timeRate);
  if (b.time) c.setTime(b.time);
  if (b.highlights) c.setHighlights(b.highlights);
  if (b.selection !== undefined) c.setSelection(b.selection);
  c.setLayers(b.layers);
  c.setLimitingMag(b.limitingMag);
  c.setView(b.view);
}
