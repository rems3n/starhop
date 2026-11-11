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

/** A setting the page may control: a layer, or the faintest star shown */
export type FilterKey = keyof LayerState | 'limitingMag';

export interface PageTracker {
  baseline: Baseline;
  /**
   * What the learner changed through the embed's controls. It survives the page applying a new scene (e.g. clicking
   * another object on Tonight) and is cleared by Reset. Keys in `pinned` are the page's to set: a page change to a
   * pinned key wins and drops the learner's override for it (lesson steps pin what they explicitly set).
   */
  user: { layers: Partial<LayerState>; limitingMag?: number };
  pinned: Set<FilterKey>;
  /** Called after the page changed layers or limiting magnitude */
  onPageChange?: () => void;
}

/** Wrap `c` so page calls update `tracker.baseline`. Everything else passes straight through (bound to `c`). */
export function trackPageController(c: SkyController, tracker: PageTracker): SkyController {
  const overrides: Partial<SkyController> = {
    setLayers(patch) {
      const effective: Partial<LayerState> = { ...patch };
      for (const k of Object.keys(patch) as (keyof LayerState)[]) {
        if (tracker.pinned.has(k)) delete tracker.user.layers[k];
        else if (k in tracker.user.layers) effective[k] = tracker.user.layers[k] as boolean;
      }
      c.setLayers(effective);
      tracker.baseline = { ...tracker.baseline, layers: { ...tracker.baseline.layers, ...patch } };
      tracker.onPageChange?.();
    },
    setLimitingMag(mag) {
      if (tracker.pinned.has('limitingMag')) delete tracker.user.limitingMag;
      c.setLimitingMag(tracker.user.limitingMag ?? mag);
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
