/**
 * Scenes: one plain object that says everything a sky view should show (place, time, camera, layers,
 * faintest stars, annotations). Every Learn page builds a scene with these pure functions and hands it
 * to <SkyStage>, which applies it to the engine. No React, no DOM.
 */
import { altAzOf, raDecOfAltAz } from '@/astro';
import type { DemoStep } from '@/content/schema';
import { formatTime, parseTimeSpec, zonedParts, zonedToUtc } from '@/lib/time';
import { BORTLE, type Highlight, type LayerState, type Observer, type ResolvedTarget, type SkyController, type TargetRef } from '@/types';

/** Layers a lesson demo starts from (docs/LESSON-BRIEF.md): everything a beginner sees outside, no chart furniture. */
export const DEMO_LAYERS: LayerState = {
  constellationLines: true,
  constellationBoundaries: false,
  constellationArt: false,
  constellationNames: true,
  starNames: true,
  dsoMarkers: false,
  planets: true,
  ecliptic: false,
  equatorialGrid: false,
  azimuthalGrid: false,
  horizon: true,
  ground: true,
  atmosphere: true,
  milkyWay: true,
};

export const DEMO_DEFAULT_TIME = 'tonight 21:00';
export const DEMO_DEFAULT_VIEW = { mount: 'altaz' as const, az: 180, alt: 35, fov: 100 };

export interface SceneView {
  mount: 'altaz' | 'equatorial';
  lon: number;
  lat: number;
  roll: number;
  fov: number;
}

export interface SkyScene {
  observer: Observer;
  time: Date;
  /** Simulated seconds per real second; 0 = frozen */
  rate: number;
  layers: LayerState;
  bortle: number;
  limitingMag: number;
  view: SceneView;
  highlights: Highlight[];
  selection: TargetRef | null;
  /** What the view is centred on, when the scene was built from a target */
  target?: { ref: TargetRef; name: string; ra: number; dec: number; alt: number; az: number };
  /** Where every highlighted thing is (J2000), for checks */
  marks: { ref: TargetRef; ra: number; dec: number }[];
  /** Things that could not be resolved (unknown refs). Empty when all is well. */
  problems: string[];
}

export interface SceneContext {
  /** The learner's saved location */
  observer: Observer;
  /** The learner's Bortle setting */
  bortle: number;
  /** "Now" — passed in so results are reproducible */
  now: Date;
  resolve: (ref: string, when?: { date: Date; observer: Observer }) => ResolvedTarget | null;
}

export function bortleLimitingMag(bortle: number): number {
  const n = Math.min(9, Math.max(1, Math.round(bortle)));
  return BORTLE[n - 1].limitingMag;
}

export interface SceneSpec {
  observer?: Observer;
  time: Date;
  rate?: number;
  target?: TargetRef;
  az?: number;
  alt?: number;
  fov?: number;
  mount?: 'altaz' | 'equatorial';
  layers?: Partial<LayerState>;
  bortle?: number;
  highlights?: Highlight[];
  selection?: TargetRef | null;
}

const LOCAL_STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/**
 * Trail highlights give `from`/`to` as local wall-clock times at the observer ("YYYY-MM-DD HH:MM").
 * The engine wants unambiguous instants, so they are turned into ISO strings here.
 */
export function normaliseHighlights(list: Highlight[], observer: Pick<Observer, 'tz'>): Highlight[] {
  return list.map((h) => {
    if (h.type !== 'trail') return h;
    const fix = (s: string) => (LOCAL_STAMP.test(s) ? parseTimeSpec(s, observer).toISOString() : s);
    return { ...h, from: fix(h.from), to: fix(h.to) };
  });
}

/** Every target reference a highlight mentions. */
export function highlightRefs(h: Highlight): TargetRef[] {
  switch (h.type) {
    case 'constellation':
      return [`con:${h.id}`];
    case 'object':
    case 'trail':
      return [h.ref];
    case 'polyline':
      return h.points;
    case 'angle':
      return [h.from, h.to];
    case 'circle':
      return [h.center];
    case 'label':
      return [h.at];
  }
}

/** Build a scene from explicit values. The camera is centred on `target` if given, else on `az`/`alt`. */
export function makeScene(spec: SceneSpec, ctx: SceneContext): SkyScene {
  const observer = spec.observer ?? ctx.observer;
  const time = spec.time;
  const mount = spec.mount ?? DEMO_DEFAULT_VIEW.mount;
  const problems: string[] = [];
  let lon = DEMO_DEFAULT_VIEW.az;
  let lat = DEMO_DEFAULT_VIEW.alt;
  let target: SkyScene['target'];

  const when = { date: time, observer };
  if (spec.target) {
    const t = ctx.resolve(spec.target, when);
    if (t) {
      const aa = altAzOf(t.ra, t.dec, time, observer);
      target = { ref: spec.target, name: t.name, ra: t.ra, dec: t.dec, alt: aa.alt, az: aa.az };
      if (mount === 'equatorial') {
        lon = t.ra;
        lat = t.dec;
      } else {
        lon = aa.az;
        lat = aa.alt;
      }
    } else problems.push(`unknown view target ${spec.target}`);
  }
  if (!target) {
    const az = spec.az ?? DEMO_DEFAULT_VIEW.az;
    const alt = spec.alt ?? DEMO_DEFAULT_VIEW.alt;
    if (mount === 'equatorial') {
      const p = raDecOfAltAz(az, alt, time, observer);
      lon = p.ra;
      lat = p.dec;
    } else {
      lon = az;
      lat = alt;
    }
  }

  const highlights = normaliseHighlights(spec.highlights ?? [], observer);
  const marks: SkyScene['marks'] = [];
  for (const h of highlights)
    for (const r of highlightRefs(h)) {
      const t = ctx.resolve(r, when);
      if (t) marks.push({ ref: r, ra: t.ra, dec: t.dec });
      else problems.push(`unknown highlight target ${r}`);
    }

  const bortle = Math.min(9, Math.max(1, Math.round(spec.bortle ?? ctx.bortle)));
  return {
    observer,
    time,
    rate: spec.rate && isFinite(spec.rate) ? spec.rate : 0,
    layers: { ...DEMO_LAYERS, ...spec.layers },
    bortle,
    limitingMag: bortleLimitingMag(bortle),
    view: { mount, lon: ((lon % 360) + 360) % 360, lat: Math.max(-90, Math.min(90, lat)), roll: 0, fov: Math.min(160, Math.max(1, spec.fov ?? DEMO_DEFAULT_VIEW.fov)) },
    highlights,
    selection: spec.selection ?? null,
    target,
    marks,
    problems,
  };
}

/**
 * One lesson-demo step → scene, exactly as docs/LESSON-BRIEF.md says: start from the defaults and the
 * learner's location, then apply only the fields the step gives. Nothing carries over between steps.
 */
export function resolveDemoStep(step: DemoStep, ctx: SceneContext): SkyScene {
  const observer: Observer = step.observer && step.observer !== 'user' ? { ...step.observer } : ctx.observer;
  const time = parseTimeSpec(step.time ?? DEMO_DEFAULT_TIME, observer, ctx.now);
  return makeScene(
    {
      observer,
      time,
      rate: step.rate,
      target: step.view?.target,
      az: step.view?.az,
      alt: step.view?.alt,
      fov: step.view?.fov,
      mount: step.view?.mount,
      layers: step.layers,
      bortle: step.bortle,
      highlights: step.highlights as Highlight[] | undefined,
    },
    ctx,
  );
}

/** Push a whole scene into an engine. The clock is stopped first so nothing drifts while the pieces are set. */
export function applyScene(c: SkyController, s: SkyScene): void {
  c.setTimeRate(0);
  c.setObserver(s.observer);
  c.setTime(s.time);
  c.setLayers(s.layers);
  c.setLimitingMag(s.limitingMag);
  c.setView({ mount: s.view.mount, lon: s.view.lon, lat: s.view.lat, roll: s.view.roll, fov: s.view.fov });
  c.setHighlights(s.highlights);
  c.setSelection(s.selection);
  if (s.rate) c.setTimeRate(s.rate);
}

// ───────────── Demos that work everywhere (docs/briefs/location-neutral-text.md) ─────────────

/** Reference observers a demo step falls back to when its target cannot be seen from the learner's place. */
export const REFERENCE_NORTH: Observer = { name: 'mid-northern latitudes (New York)', lat: 40.7, lon: -74, tz: 'America/New_York' };
export const REFERENCE_SOUTH: Observer = { name: 'mid-southern latitudes (Sydney)', lat: -33.9, lon: 151.2, tz: 'Australia/Sydney' };
/** Targets at or north of this declination use the northern reference observer */
export const REFERENCE_DEC_SPLIT = -10;
/** A later time the same night counts only if the target climbs at least this high then */
export const LATER_MIN_ALT = 10;
/** The Sun must be at least this far below the horizon for a moment to count as night */
const NIGHT_SUN_ALT = -6;
const SCAN_STEP_MIN = 10;
const SCAN_HOURS = 16;

export type DemoPlacement =
  | { kind: 'as-authored'; step: DemoStep }
  | { kind: 'later'; step: DemoStep; time: Date; note: string }
  | { kind: 'reference'; step: DemoStep; observer: Observer; note: string };

/** The ref a step is "about": its view target, else its first object/constellation highlight. Horizon-fixed points are skipped. */
export function demoStepSubject(step: DemoStep): TargetRef | null {
  let ref: string | undefined = step.view?.target;
  if (!ref) {
    const h = step.highlights?.find((x) => x.type === 'object' || x.type === 'constellation');
    if (h) ref = h.type === 'constellation' ? `con:${h.id}` : h.type === 'object' ? h.ref : undefined;
  }
  if (!ref) return null;
  if (ref.startsWith('altaz:')) return null;
  if (ref.startsWith('point:') && ref !== 'point:ncp' && ref !== 'point:scp') return null;
  return ref as TargetRef;
}

function localStamp(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month)}-${z(p.day)} ${z(p.hour)}:${z(p.minute)}`;
}

/**
 * Decide where and when a demo step is shown so its subject is above the horizon (pure; `ctx.now` makes it
 * reproducible). Steps with a fixed observer, an equatorial (chart) mount or the ground switched off are shown
 * as authored. Otherwise, if the subject is below the horizon at the step's time from the learner's place:
 *  1. if it climbs to ≥ LATER_MIN_ALT later that same night there, the step moves to the time it is highest;
 *  2. else the step is shown from a reference observer (northern for dec ≥ −10°, southern below), at the same
 *     local clock time there, provided the subject is up from that place then.
 */
export function placeDemoStep(step: DemoStep, ctx: SceneContext): DemoPlacement {
  const asIs: DemoPlacement = { kind: 'as-authored', step };
  if (step.observer && step.observer !== 'user') return asIs;
  if (step.view?.mount === 'equatorial' || step.layers?.ground === false) return asIs;
  const ref = demoStepSubject(step);
  if (!ref) return asIs;
  const home = ctx.observer;
  const t0 = parseTimeSpec(step.time ?? DEMO_DEFAULT_TIME, home, ctx.now);
  const t = ctx.resolve(ref, { date: t0, observer: home });
  if (!t) return asIs;
  if (altAzOf(t.ra, t.dec, t0, home).alt >= 0) return asIs;
  // "the Big Dipper", but "Orion's Belt" and "Orion"
  const labelled = step.highlights?.find((h) => h.type === 'label' && h.at === ref);
  const name =
    labelled && labelled.type === 'label' ? `the ${labelled.text.replace(/^the /i, '')}` : t.kind === 'point' && t.name === 'Point' ? "this step's target" : ref.startsWith('asterism:') && !t.name.includes("'") ? `the ${t.name}` : t.name;

  // 1. Later the same night, from the learner's own place.
  const sunAlt = (d: Date) => {
    const s = ctx.resolve('body:Sun', { date: d, observer: home });
    return s ? altAzOf(s.ra, s.dec, d, home).alt : -90;
  };
  let best: { date: Date; alt: number } | null = null;
  let seenNight = false;
  for (let m = SCAN_STEP_MIN; m <= SCAN_HOURS * 60; m += SCAN_STEP_MIN) {
    const d = new Date(t0.getTime() + m * 60_000);
    const dark = sunAlt(d) <= NIGHT_SUN_ALT;
    if (!dark) {
      if (seenNight) break; // dawn ends "that night"
      continue;
    }
    seenNight = true;
    const p = ctx.resolve(ref, { date: d, observer: home }) ?? t;
    const alt = altAzOf(p.ra, p.dec, d, home).alt;
    if (!best || alt > best.alt) best = { date: d, alt };
  }
  if (best && best.alt >= LATER_MIN_ALT) {
    const when = formatTime(best.date, home.tz);
    return {
      kind: 'later',
      time: best.date,
      step: { ...step, time: localStamp(best.date, home.tz) },
      note: `This step is shown at ${when}, when ${name} is highest that night from ${home.name}; at the step's usual time it is below the horizon there.`,
    };
  }

  // 2. A reference observer where it is well placed, at the same local clock time.
  const ref0 = t.dec >= REFERENCE_DEC_SPLIT ? REFERENCE_NORTH : REFERENCE_SOUTH;
  const p = zonedParts(t0, home.tz);
  const t1 = zonedToUtc(p.year, p.month, p.day, p.hour, p.minute, ref0.tz);
  const there = ctx.resolve(ref, { date: t1, observer: ref0 }) ?? t;
  if (altAzOf(there.ra, there.dec, t1, ref0).alt < 0) return asIs;
  const label = ref0 === REFERENCE_NORTH ? 'mid-northern latitudes' : 'mid-southern latitudes';
  return {
    kind: 'reference',
    observer: ref0,
    step: { ...step, observer: { ...ref0 }, time: localStamp(t1, ref0.tz) },
    note: `This step is shown from ${label}, because from ${home.name}, ${name} is below the horizon at that time.`,
  };
}
