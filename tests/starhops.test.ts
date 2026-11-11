/** The star-hop library (src/content/starhops.json): schema, references, ids and computed distances. */
import { describe, expect, it } from 'vitest';
import { separation } from '@/data/catalog';
import { starhopSchema } from '@/content/schema';
import raw from '@/content/starhops.json';
import { learnCatalog } from './learn-catalog';

const hops = (raw as unknown[]).map((h) => starhopSchema.parse(h));
const cat = learnCatalog();
const resolve = (ref: string) => cat.resolve(ref);

describe('starhops.json', () => {
  it('has 24–28 hops with unique ids and ranks 1..n', () => {
    expect(hops.length).toBeGreaterThanOrEqual(24);
    expect(hops.length).toBeLessThanOrEqual(28);
    expect(new Set(hops.map((h) => h.id)).size).toBe(hops.length);
    expect(hops.map((h) => h.rank).sort((a, b) => a - b)).toEqual(hops.map((_, i) => i + 1));
  });

  it('resolves every ref (from, to, path, inline links) and constellation', () => {
    for (const h of hops) {
      const inline = [...h.steps.join(' ').matchAll(/\[\[([^|\]]+)\|[^\]]+\]\]/g)].map((m) => m[1]);
      for (const ref of [h.from, h.to, ...h.path, ...inline]) expect(resolve(ref), `${h.id}: ${ref}`).not.toBeNull();
      for (const c of h.constellations) expect(cat.conById.has(c), `${h.id}: ${c}`).toBe(true);
    }
  });

  it('links next ids to existing hops', () => {
    const ids = new Set(hops.map((h) => h.id));
    for (const h of hops) for (const n of h.next) expect(ids.has(n) && n !== h.id, `${h.id} → ${n}`).toBe(true);
  });

  it('distanceDeg matches the summed separations along path within 1°', () => {
    for (const h of hops) {
      const pts = h.path.map((r) => resolve(r)!);
      const sum = pts.slice(1).reduce((s, p, i) => s + separation(pts[i], p), 0);
      expect(Math.abs(sum - h.distanceDeg), h.id).toBeLessThan(1);
    }
  });

  it('hemisphere agrees with the month lists', () => {
    for (const h of hops) {
      const want = h.monthsNorth.length && h.monthsSouth.length ? 'both' : h.monthsNorth.length ? 'N' : 'S';
      expect(h.monthsNorth.length + h.monthsSouth.length, h.id).toBeGreaterThan(0);
      expect(h.hemisphere, h.id).toBe(want);
    }
  });
});
