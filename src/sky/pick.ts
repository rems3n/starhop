/**
 * Pure picking logic: given what is near the pointer, decide what a click means.
 *
 * Tiers (lower wins whenever it has any candidate in range):
 *   0  Sun, Moon, planets
 *   1  named stars and deep-sky objects with a visible marker
 *   2  constellation names (hit = pointer inside the label box)
 *   3  every other visible star
 * Inside a tier the candidate closest to the pointer wins.
 */
export const PICK_RADIUS = 14;

export const TIER_BODY = 0;
export const TIER_NAMED = 1;
export const TIER_LABEL = 2;
export const TIER_STAR = 3;

export interface PickCandidate<T> {
  tier: number;
  /** Distance in CSS px from the pointer to the object's centre */
  dist: number;
  /** On-screen radius of the object (large discs are easier to hit than their centre) */
  radius?: number;
  item: T;
}

/** Is a candidate within reach of the pointer? */
export function inRange(dist: number, radius = 0, pickRadius = PICK_RADIUS): boolean {
  return dist <= Math.max(pickRadius, radius + 4);
}

export function choosePick<T>(candidates: PickCandidate<T>[], pickRadius = PICK_RADIUS): T | null {
  let best: PickCandidate<T> | null = null;
  for (const c of candidates) {
    if (!inRange(c.dist, c.radius, pickRadius)) continue;
    if (!best || c.tier < best.tier || (c.tier === best.tier && c.dist < best.dist)) best = c;
  }
  return best ? best.item : null;
}

/** Streaming version used by the engine so a click allocates nothing per star. */
export class PickAccumulator {
  tier = 99;
  dist = Infinity;
  kind = 0;
  index = -1;
  constructor(public pickRadius = PICK_RADIUS) {}
  reset(pickRadius = PICK_RADIUS): void {
    this.tier = 99;
    this.dist = Infinity;
    this.kind = 0;
    this.index = -1;
    this.pickRadius = pickRadius;
  }
  offer(tier: number, dist: number, radius: number, kind: number, index: number): void {
    if (!inRange(dist, radius, this.pickRadius)) return;
    if (tier < this.tier || (tier === this.tier && dist < this.dist)) {
      this.tier = tier;
      this.dist = dist;
      this.kind = kind;
      this.index = index;
    }
  }
  get hit(): boolean {
    return this.index >= 0;
  }
}

/** Point-in-polygon (even-odd) — handy for consumers of the `lasso` event and used by the dev harness. */
export function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Reduce a freehand stroke to at most `max` points by uniform resampling (keeps first and last). */
export function decimate(points: { x: number; y: number }[], max = 300): { x: number; y: number }[] {
  if (points.length <= max) return points.slice();
  const out: { x: number; y: number }[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}
