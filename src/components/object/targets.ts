/** Helpers shared by the object panel and Explore: what to hand to the visibility functions for a resolved target. */
import { constellationPoints, type VisTarget } from '@/astro';
import { asterismById } from '@/content';
import type { Catalog } from '@/data/catalog';
import type { Observer, ResolvedTarget } from '@/types';

/** Stars of an asterism, resolved. */
export function asterismPoints(id: string, catalog: Catalog): { ra: number; dec: number }[] {
  const a = asterismById.get(id);
  if (!a) return [];
  const seen = new Set<string>();
  const out: { ra: number; dec: number }[] = [];
  for (const r of a.lines.flat()) {
    if (seen.has(r)) continue;
    seen.add(r);
    const t = catalog.resolve(r);
    if (t) out.push({ ra: t.ra, dec: t.dec });
  }
  return out;
}

export function asterismIdOf(ref: string): string | null {
  return ref.startsWith('asterism:') ? ref.slice('asterism:'.length) : null;
}

/** Target for visibilityOn / yearVisibility / bestMonths: a body id, a constellation's stars, or one position. */
export function visTargetOf(t: ResolvedTarget, catalog: Catalog): VisTarget {
  if (t.body) return t.body;
  if (t.constellation) return { points: constellationPoints(t.constellation, catalog) };
  const aid = t.kind === 'asterism' ? asterismIdOf(t.ref) : null;
  if (aid) {
    const pts = asterismPoints(aid, catalog);
    if (pts.length) return { points: pts };
  }
  return { ra: t.ra, dec: t.dec };
}

/** Same observer for caching purposes. */
export function observerKey(o: Observer): string {
  return `${o.lat.toFixed(3)},${o.lon.toFixed(3)},${o.tz}`;
}
