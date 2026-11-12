/** How the sky is set up for a sky question. Pure: returns plain view/layer data for the engine. */
import { altAzOf, angularSeparation, currentNightDate, localDateOf, nightWindow } from '@/astro';
import { zonedToUtc } from '@/lib/time';
import type { QuizDifficulty } from '@/store/settings';
import type { Constellation, LayerState, Observer, Star, ViewState } from '@/types';
import type { Rng } from './rng';

const DEG = Math.PI / 180;

/** Layers for a quiz sky: only what the difficulty allows. `real` = tonight's sky with ground and horizon. */
export function quizLayers(diff: Pick<QuizDifficulty, 'lines' | 'boundaries' | 'labels'>, o: { labels?: boolean; real?: boolean } = {}): LayerState {
  const labels = o.labels ?? diff.labels;
  return {
    constellationLines: diff.lines,
    constellationBoundaries: diff.boundaries,
    constellationArt: false,
    deepSky: false,
    constellationNames: labels,
    starNames: labels,
    // the engine always names planets and deep-sky markers, which would give answers away (docs/requests/quiz.md)
    dsoMarkers: false,
    planets: false,
    ecliptic: false,
    equatorialGrid: false,
    azimuthalGrid: false,
    horizon: !!o.real,
    ground: !!o.real,
    atmosphere: false,
    milkyWay: false,
  };
}

/** Vertical field of view that shows `targetFov` degrees both ways with room for the prompt and action bars. */
export function fitFov(targetFov: number, aspect: number, margin = 1.12): number {
  const tall = aspect < 1 ? 1 / Math.max(0.3, aspect) : 1;
  return Math.max(20, Math.min(150, targetFov * margin * tall));
}

/** The point `dist` degrees from (ra, dec) along `bearing` (0 = north, 90 = east). */
export function offsetDirection(ra: number, dec: number, dist: number, bearing: number): { ra: number; dec: number } {
  const d = dist * DEG, b = bearing * DEG, p = dec * DEG;
  const dec2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b));
  const dra = Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(dec2));
  return { ra: (((ra + dra / DEG) % 360) + 360) % 360, dec: dec2 / DEG };
}

/** A uniformly random direction at least `minSep` degrees from `from`. */
export function randomDirectionAway(from: { ra: number; dec: number }, minSep: number, rng: Rng): { ra: number; dec: number } {
  let p = { ra: 0, dec: 0 };
  for (let i = 0; i < 40; i++) {
    p = { ra: rng() * 360, dec: Math.asin(rng() * 2 - 1) / DEG };
    if (angularSeparation(from, p) >= minSep) break;
  }
  return p;
}

/**
 * "A sensible evening time" for tonight's sky: 9 pm local, or the end of nautical twilight if that is later
 * (June). Between midnight and sunrise it means the evening of the night we are still in.
 */
export function eveningTime(now: Date, observer: Observer): Date {
  const nightDate = currentNightDate(now, observer);
  const d = localDateOf(nightDate, observer);
  const nine = zonedToUtc(d.year, d.month, d.day, 21, 0, observer.tz);
  const dusk = nightWindow(nightDate, observer).nauticalDusk;
  return dusk && dusk.getTime() > nine.getTime() ? dusk : nine;
}

/** At least 60 % of the main stars 10° up — the same "up" rule as the visibility code. */
export function constellationUpAt(c: Constellation, starById: Map<number, Star>, date: Date, observer: Observer): boolean {
  let up = 0, n = 0;
  for (const id of c.mainStars) {
    const s = starById.get(id);
    if (!s) continue;
    n++;
    if (altAzOf(s.ra, s.dec, date, observer).alt >= 10) up++;
  }
  return n > 0 && up / n >= 0.6;
}

/** "Near the target" start: view = fit × this (clamped), so there is sky around the target to search */
export const NEAR_WIDEN = 1.9;
export const NEAR_MIN_FOV = 70;
export const NEAR_MAX_FOV = 120;
/** Fraction of the free space the target's centre may use, and the least offset (as a fraction) from the middle */
export const NEAR_FILL = 0.8;
export const NEAR_MIN_OFFSET = 0.4;

export interface SceneArgs {
  target: { ra: number; dec: number; fov: number };
  diff: Pick<QuizDifficulty, 'randomRotation' | 'startNearTarget'>;
  /** canvas width ÷ height */
  aspect: number;
  rng: Rng;
  /** Always start on the target (name-it, ringed objects) */
  centred?: boolean;
  /** Real sky: alt-az mount at this time */
  real?: { date: Date; observer: Observer };
}

/**
 * Starting camera.
 * Star-chart mode (equatorial mount): for "near the target" the view is wide enough to hold the target with room
 * to spare and the target sits anywhere in the frame except the middle, so its position gives nothing away. For
 * "anywhere" it is a random direction at least 50° away with a wide 100° view. `centred` (name-it, ringed objects)
 * puts the target in the middle at a field that fits it. Roll is random when the difficulty asks for a rotated
 * sky. Real-sky mode (alt-az): upright, same placement rule, or looking south at a wide view for "anywhere".
 */
export function startView(a: SceneArgs): ViewState {
  const fit = fitFov(a.target.fov, a.aspect);
  const near = a.centred || a.diff.startNearTarget;
  let fov = fit;
  let off = 0;
  let bearing = 0;
  if (near && !a.centred) {
    fov = Math.min(NEAR_MAX_FOV, Math.max(NEAR_MIN_FOV, fit * NEAR_WIDEN));
    // how far the target's centre can sit from the middle and still be wholly in frame (with a margin for the
    // prompt at the top and the answer bar at the bottom)
    const maxY = Math.max(0, (fov - a.target.fov) / 2) * NEAR_FILL;
    const maxX = Math.max(0, (fov * Math.min(a.aspect, 1.8) - a.target.fov) / 2) * NEAR_FILL;
    let u = 0, v = 0;
    for (let i = 0; i < 8; i++) {
      u = a.rng() * 2 - 1;
      v = a.rng() * 2 - 1;
      if (Math.max(Math.abs(u), Math.abs(v)) >= NEAR_MIN_OFFSET) break;
    }
    // the camera moves opposite to where the target should appear; either sign is equally random
    off = Math.hypot(u * maxX, v * maxY);
    bearing = (Math.atan2(u * maxX, v * maxY) * 180) / Math.PI;
  } else {
    a.rng();
    a.rng();
  }
  if (a.real) {
    if (!near) return { mount: 'altaz', lon: 180, lat: 40, roll: 0, fov: 110 };
    const p = offsetDirection(a.target.ra, a.target.dec, off, bearing);
    const h = altAzOf(p.ra, p.dec, a.real.date, a.real.observer);
    return { mount: 'altaz', lon: h.az, lat: Math.max(8, Math.min(85, h.alt)), roll: 0, fov };
  }
  const roll = a.diff.randomRotation ? Math.floor(a.rng() * 360) : 0;
  if (!near) {
    const p = randomDirectionAway(a.target, 50, a.rng);
    return { mount: 'equatorial', lon: p.ra, lat: p.dec, roll, fov: 100 };
  }
  const p = offsetDirection(a.target.ra, a.target.dec, off, bearing);
  return { mount: 'equatorial', lon: p.ra, lat: p.dec, roll, fov };
}
