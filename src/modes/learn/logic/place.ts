/** Choosing a good moment and framing to show something. Pure. */
import { altAzOf, visibilityOn, type VisTarget } from '@/astro';
import { zonedParts, zonedToUtc } from '@/lib/time';
import type { Highlight, LayerState, Observer, TargetRef, VisibilityInfo } from '@/types';
import { makeScene, type SceneContext, type SkyScene } from './scene';

/** Layers for a horizon-free star chart (used when the thing is not in tonight's sky). */
export const CHART_LAYERS: Partial<LayerState> = { horizon: false, ground: false, atmosphere: false };

export interface PlacedScene {
  scene: SkyScene;
  /** 'sky' = the real sky at `scene.time`; 'chart' = horizon-free chart because it is not up tonight */
  mode: 'sky' | 'chart';
  visibility: VisibilityInfo;
}

/**
 * A scene centred on `ref`: the real sky at its best time on the night of `nightDate` when it is visible
 * that night, otherwise a north-up chart with the ground switched off.
 */
export function placeTarget(
  ref: TargetRef,
  visTarget: VisTarget,
  nightDate: Date,
  ctx: SceneContext,
  opts: { fov?: number; highlights?: Highlight[]; layers?: Partial<LayerState>; selection?: TargetRef | null } = {},
): PlacedScene {
  const visibility = visibilityOn(visTarget, nightDate, ctx.observer);
  const up = visibility.cls !== 'not-visible' && !!visibility.bestTime;
  const time = up ? visibility.bestTime! : eveningOf(nightDate, ctx.observer.tz, 21);
  const scene = makeScene(
    {
      time,
      target: ref,
      fov: opts.fov,
      mount: up ? 'altaz' : 'equatorial',
      layers: up ? opts.layers : { ...opts.layers, ...CHART_LAYERS },
      highlights: opts.highlights,
      selection: opts.selection,
    },
    ctx,
  );
  return { scene, mode: up ? 'sky' : 'chart', visibility };
}

/** `hour`:00 local time on the local calendar date of `date`. */
export function eveningOf(date: Date, tz: string, hour = 21): Date {
  const p = zonedParts(date, tz);
  return zonedToUtc(p.year, p.month, p.day, hour, 0, tz);
}

/** 15th of `month` in `year`, at `hour`:00 local. */
export function midMonthEvening(year: number, month: number, tz: string, hour = 21): Date {
  return zonedToUtc(year, month, 15, hour, 0, tz);
}

export interface WhenShown {
  time: Date;
  /** 'tonight' or the month number 1–12 the time was taken from, or null if nothing worked (chart mode) */
  from: 'tonight' | number | null;
}

/**
 * A 9 pm moment at which every position in `mustBeUp` is at least `minAlt` above the horizon: tonight
 * if that works, else mid-month evenings starting with `preferMonths`, else the remaining months.
 * `from: null` means no evening works from this latitude (use a chart).
 */
export function pickEvening(
  mustBeUp: { ra: number; dec: number }[],
  observer: Observer,
  now: Date,
  preferMonths: number[],
  minAlt = 10,
): WhenShown {
  const ok = (t: Date) => mustBeUp.every((p) => altAzOf(p.ra, p.dec, t, observer).alt >= minAlt);
  const tonight = eveningOf(now, observer.tz);
  if (ok(tonight)) return { time: tonight, from: 'tonight' };
  const year = zonedParts(now, observer.tz).year;
  const order = [...preferMonths, ...Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !preferMonths.includes(m))];
  for (const m of order) {
    const t = midMonthEvening(year, m, observer.tz);
    if (ok(t)) return { time: t, from: m };
  }
  return { time: tonight, from: null };
}
