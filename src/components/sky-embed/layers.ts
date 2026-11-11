/** Pure helpers for the embedded sky controls: layer groups, allowed-layer filtering, Bortle lookup, view-centre refs. */
import { BORTLE, type LayerState, type TargetRef } from '@/types';

export interface LayerItem {
  key: keyof LayerState;
  label: string;
}
export interface LayerGroup {
  title: string;
  items: LayerItem[];
}

/** The same toggles and wording as the full sky map's Layers panel (src/modes/explore/SkyPanels.tsx). */
export const EMBED_LAYER_GROUPS: LayerGroup[] = [
  { title: 'Constellations', items: [{ key: 'constellationLines', label: 'Lines' }, { key: 'constellationBoundaries', label: 'Boundaries' }, { key: 'constellationNames', label: 'Names' }, { key: 'constellationArt', label: 'Figures (illustrations)' }] },
  { title: 'Stars and objects', items: [{ key: 'starNames', label: 'Star names' }, { key: 'dsoMarkers', label: 'Deep-sky markers' }, { key: 'deepSky', label: 'Fainter stars and objects when zoomed in' }, { key: 'planets', label: 'Sun, Moon and planets' }, { key: 'milkyWay', label: 'Milky Way' }] },
  { title: 'Guides', items: [{ key: 'ecliptic', label: 'Ecliptic (path of the Sun)' }, { key: 'equatorialGrid', label: 'Equatorial grid' }, { key: 'azimuthalGrid', label: 'Azimuthal grid' }] },
  { title: 'Ground and air', items: [{ key: 'horizon', label: 'Horizon and compass points' }, { key: 'ground', label: 'Ground' }, { key: 'atmosphere', label: 'Atmosphere (daylight)' }] },
];

export type EmbedControls = 'full' | 'limited' | 'none';

/**
 * The groups the embed shows. 'full' = everything; 'limited' = only `allowed` keys (empty groups dropped);
 * 'none' = nothing.
 */
export function visibleLayerGroups(controls: EmbedControls, allowed?: readonly (keyof LayerState)[]): LayerGroup[] {
  if (controls === 'none') return [];
  if (controls === 'full') return EMBED_LAYER_GROUPS;
  const ok = new Set(allowed ?? []);
  return EMBED_LAYER_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => ok.has(it.key)) })).filter((g) => g.items.length > 0);
}

/** Drop any keys the embed is not allowed to change (defence in depth for 'limited'). */
export function filterPatch(patch: Partial<LayerState>, controls: EmbedControls, allowed?: readonly (keyof LayerState)[]): Partial<LayerState> {
  if (controls === 'full') return patch;
  if (controls === 'none') return {};
  const ok = new Set(allowed ?? []);
  const out: Partial<LayerState> = {};
  for (const k of Object.keys(patch) as (keyof LayerState)[]) if (ok.has(k)) out[k] = patch[k];
  return out;
}

/**
 * What a quiz may let the learner toggle, from its difficulty:
 * lines only if `lines`, boundaries only if `boundaries`, names only if `labels` and only while finding
 * (naming questions would give the answer away). Planets and deep-sky markers always carry names, so never.
 * Ground, horizon and atmosphere never change during a find-it question (atmosphere never in quizzes).
 */
export function quizAllowedLayers(diff: { lines: boolean; boundaries: boolean; labels: boolean }, kind: string): (keyof LayerState)[] {
  const out: (keyof LayerState)[] = [];
  if (diff.lines) out.push('constellationLines');
  if (diff.boundaries) out.push('constellationBoundaries');
  if (diff.labels && kind === 'find') out.push('constellationNames', 'starNames');
  out.push('milkyWay', 'ecliptic', 'equatorialGrid', 'azimuthalGrid');
  // only questions that show the real sky from the ground; never while finding (or any other kind)
  if (kind === 'name' || kind === 'skyobj') out.push('horizon', 'ground');
  return out;
}

/** The Bortle class (1–9) whose limiting magnitude is closest to `mag`. */
export function bortleForMag(mag: number): number {
  let best = BORTLE[0];
  for (const b of BORTLE) if (Math.abs(b.limitingMag - mag) < Math.abs(best.limitingMag - mag)) best = b;
  return best.n;
}

export function magForBortle(n: number): number {
  return BORTLE[Math.min(9, Math.max(1, Math.round(n))) - 1].limitingMag;
}

/** A `radec:` ref for a J2000 position, rounded to 0.01°. */
export function radecRef(ra: number, dec: number): TargetRef {
  const r = (((ra % 360) + 360) % 360).toFixed(2);
  return `radec:${r},${dec.toFixed(2)}`;
}

/** Field of view after one zoom step (in = narrower). Clamped to the engine's sensible range. */
export function zoomFov(fov: number, dir: 'in' | 'out', step = 1.4): number {
  const next = dir === 'in' ? fov / step : fov * step;
  return Math.min(160, Math.max(1, next));
}
