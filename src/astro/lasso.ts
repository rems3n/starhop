/**
 * Scoring a freehand "circle the constellation" answer. Everything here works in flat 2-D screen
 * coordinates (pixels), so it can be tested without a sky renderer. The rule is described in docs/ASTRO.md.
 */
import type { Constellation, Star } from '@/types';

export interface Pt { x: number; y: number }

// ───────────────────────────── Tunable constants ─────────────────────────────

/** Share of the target's main stars that must be inside the loop (need = ceil(0.7 · n) for n ≥ 5). */
export const LASSO_RECALL = 0.7;
/** Other-constellation stars allowed inside the loop: max(LASSO_FREE_INTRUDERS, LASSO_INTRUDER_FRACTION × enclosed target stars). */
export const LASSO_INTRUDER_FRACTION = 0.5;
export const LASSO_FREE_INTRUDERS = 2;
/** The loop may be at most this many times the area of the padded convex hull of the target stars. */
export const LASSO_MAX_AREA_RATIO = 4;
/** Hull padding as a fraction of the figure's extent (largest distance between two target stars)… */
export const LASSO_PAD_FRACTION = 0.15;
/** …but never less than this many pixels (overridable per call with `minPadPx`). */
export const LASSO_DEFAULT_MIN_PAD_PX = 30;
/** A loop with less area than this (px²) is treated as an accidental tap: 'invalid'. */
export const LASSO_MIN_AREA_PX2 = 64;
/** A failed loop smaller than this fraction of the padded hull is reported as 'too-small' rather than 'missed-stars'. */
export const LASSO_TOO_SMALL_RATIO = 0.3;

// ───────────────────────────── Geometry ─────────────────────────────

/** Signed shoelace area (positive when the vertices run counter-clockwise in a y-up frame). */
export function signedArea(polygon: Pt[]): number {
  let a = 0;
  for (let i = 0, n = polygon.length; i < n; i++) {
    const p = polygon[i], q = polygon[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Area of a simple polygon (absolute shoelace value; closing edge implied). */
export function polygonArea(polygon: Pt[]): number {
  return polygon.length < 3 ? 0 : Math.abs(signedArea(polygon));
}

/**
 * Is the point inside the closed path? Non-zero winding rule, so a loop that overlaps itself where the
 * ends meet, or is drawn clockwise or counter-clockwise, still counts everything it goes around.
 */
export function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  let wn = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n];
    const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y) {
      if (b.y > p.y && cross > 0) wn++;
    } else if (b.y <= p.y && cross < 0) wn--;
  }
  return wn !== 0;
}

/** Convex hull (Andrew's monotone chain). Returns the corner points in order, without repeating the first; 1 or 2 points for degenerate input. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y }))
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y);
  if (pts.length <= 2) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from a point to a convex hull (0 when inside). Works for 1- and 2-point hulls. */
export function distanceToHull(p: Pt, hull: Pt[]): number {
  if (hull.length === 0) return Infinity;
  if (hull.length === 1) return Math.hypot(p.x - hull[0].x, p.y - hull[0].y);
  if (hull.length >= 3 && pointInPolygon(p, hull)) return 0;
  let d = Infinity;
  for (let i = 0; i < hull.length; i++) d = Math.min(d, distToSegment(p, hull[i], hull[(i + 1) % hull.length]));
  return d;
}

/** Area, perimeter and extent (largest corner-to-corner distance) of a convex hull. A 2-point hull has perimeter 2 × length. */
export function hullMetrics(hull: Pt[]): { area: number; perimeter: number; extent: number } {
  let perimeter = 0, extent = 0;
  if (hull.length >= 2) for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  for (let i = 0; i < hull.length; i++) for (let j = i + 1; j < hull.length; j++) extent = Math.max(extent, Math.hypot(hull[i].x - hull[j].x, hull[i].y - hull[j].y));
  return { area: polygonArea(hull), perimeter, extent };
}

/** Padding (px) given to a figure: LASSO_PAD_FRACTION of its extent, at least `minPadPx`. */
export function lassoPad(hull: Pt[], minPadPx = LASSO_DEFAULT_MIN_PAD_PX): number {
  return Math.max(minPadPx, LASSO_PAD_FRACTION * hullMetrics(hull).extent);
}

/** Exact area of a convex hull grown outward by `pad` with rounded corners: A + P·pad + π·pad². */
export function paddedHullArea(hull: Pt[], pad: number): number {
  const m = hullMetrics(hull);
  return m.area + m.perimeter * pad + Math.PI * pad * pad;
}

/**
 * The convex hull of `points` grown outward by `pad` pixels with rounded corners, as a polygon.
 * One point gives a circle, two points a capsule. Used for the "ideal loop" in tests and for showing
 * the accepted region when revealing an answer.
 */
export function padHull(points: Pt[], pad: number, arcStepDeg = 15): Pt[] {
  let hull = convexHull(points);
  if (hull.length === 0) return [];
  if (signedArea(hull) < 0) hull = hull.reverse();
  const out: Pt[] = [];
  const n = hull.length;
  const step = (arcStepDeg * Math.PI) / 180;
  if (n === 1) {
    for (let a = 0; a < 2 * Math.PI - 1e-9; a += step) out.push({ x: hull[0].x + pad * Math.cos(a), y: hull[0].y + pad * Math.sin(a) });
    return out;
  }
  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n], cur = hull[i], next = hull[(i + 1) % n];
    // Outward normal of an edge (dx, dy) of a counter-clockwise hull is (dy, −dx).
    const a0 = Math.atan2(-(cur.x - prev.x), cur.y - prev.y);
    let a1 = Math.atan2(-(next.x - cur.x), next.y - cur.y);
    while (a1 < a0 - 1e-12) a1 += 2 * Math.PI;
    const steps = Math.max(1, Math.ceil((a1 - a0) / step));
    for (let s = 0; s <= steps; s++) {
      const a = a0 + ((a1 - a0) * s) / steps;
      out.push({ x: cur.x + pad * Math.cos(a), y: cur.y + pad * Math.sin(a) });
    }
  }
  return out;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function decimate(polygon: Pt[], max: number): Pt[] {
  if (polygon.length <= max) return polygon;
  const out: Pt[] = [];
  for (let i = 0; i < max; i++) out.push(polygon[Math.floor((i * polygon.length) / max)]);
  return out;
}

/**
 * Area actually enclosed by a freehand path. For a simple loop this is the shoelace area; for a path
 * that crosses itself (where shoelace areas cancel) it is measured by sampling a grid with the same
 * non-zero winding rule used for the stars.
 */
export function enclosedArea(polygon: Pt[]): number {
  if (polygon.length < 3) return 0;
  const poly = decimate(polygon, 256);
  const n = poly.length;
  let crosses = false;
  outer: for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) { crosses = true; break outer; }
    }
  }
  if (!crosses) return polygonArea(polygon);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const G = 96;
  const dx = (x1 - x0) / G, dy = (y1 - y0) / G;
  let inside = 0;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) if (pointInPolygon({ x: x0 + (i + 0.5) * dx, y: y0 + (j + 0.5) * dy }, poly)) inside++;
  return inside * dx * dy;
}

// ───────────────────────────── Scoring ─────────────────────────────

export interface LassoStar { id: number; x: number; y: number; mag: number }
export interface LassoOther extends LassoStar { con: string }

export interface LassoInput {
  /** The drawn path in pixels; it is closed automatically (last point back to first). */
  polygon: Pt[];
  /** The target constellation's main stars, projected to the screen. */
  targets: LassoStar[];
  /** Main stars of all OTHER constellations that are on screen and brighter than the quiz's limiting magnitude. */
  others: LassoOther[];
  /** Smallest hull padding in pixels (default 30). Raise it on touch screens or when zoomed far out. */
  minPadPx?: number;
  /** Display name of the target, for the message ("Orion"). */
  targetName?: string;
  /** Display names of other constellations by id, for the message. */
  conNames?: Record<string, string>;
}

export type LassoReason = 'ok' | 'missed-stars' | 'too-much-else' | 'too-small' | 'invalid';

export interface LassoResult {
  correct: boolean;
  /** Enclosed target stars ÷ all target stars */
  recall: number;
  enclosedTargets: number[];
  missedTargets: number[];
  /** Other-constellation main stars inside the loop that lie outside the target's own padded hull */
  intruders: number;
  /** Loop area ÷ area of the padded convex hull of the target stars */
  areaRatio: number;
  reason: LassoReason;
  /** One friendly sentence explaining the result */
  message: string;
}

/** How many of n target stars must be inside the loop. */
export function lassoNeed(n: number): number {
  if (n <= 0) return 0;
  if (n <= 4) return Math.min(n, Math.max(2, n - 1));
  return Math.ceil(LASSO_RECALL * n - 1e-9);
}

/** How many other-constellation stars a loop holding `enclosed` target stars may contain. */
export function lassoIntruderAllowance(enclosed: number): number {
  return Math.max(LASSO_FREE_INTRUDERS, Math.floor(LASSO_INTRUDER_FRACTION * enclosed + 1e-9));
}

export function scoreLasso(input: LassoInput): LassoResult {
  const { polygon, targets, others } = input;
  const name = input.targetName;
  const n = targets.length;
  const poly = polygon.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const area = enclosedArea(poly);
  if (poly.length < 3 || area < LASSO_MIN_AREA_PX2 || n === 0) {
    return {
      correct: false, recall: 0, enclosedTargets: [], missedTargets: targets.map((t) => t.id), intruders: 0, areaRatio: 0, reason: 'invalid',
      message: n === 0 ? 'There is nothing to circle here.' : `Draw a closed loop around ${name ?? 'the constellation'} — that was too small to count.`,
    };
  }
  const onScreen = targets.filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y));
  const hull = convexHull(onScreen);
  const pad = lassoPad(hull, input.minPadPx ?? LASSO_DEFAULT_MIN_PAD_PX);
  const enclosedTargets: number[] = [], missedTargets: number[] = [];
  for (const t of targets) (Number.isFinite(t.x) && Number.isFinite(t.y) && pointInPolygon(t, poly) ? enclosedTargets : missedTargets).push(t.id);
  const insideByCon = new Map<string, number>(), totalByCon = new Map<string, number>();
  let intruders = 0;
  for (const o of others) {
    totalByCon.set(o.con, (totalByCon.get(o.con) ?? 0) + 1);
    if (!pointInPolygon(o, poly)) continue;
    // Stars that sit inside the target's own (padded) outline cannot be avoided and are not held against the learner.
    if (distanceToHull(o, hull) <= pad) continue;
    intruders++;
    insideByCon.set(o.con, (insideByCon.get(o.con) ?? 0) + 1);
  }
  const enclosed = enclosedTargets.length;
  const recall = enclosed / n;
  const need = lassoNeed(n);
  const areaRatio = area / paddedHullArea(hull, pad);
  const tooMany = intruders > lassoIntruderAllowance(enclosed);
  const tooBig = areaRatio > LASSO_MAX_AREA_RATIO;

  let topCon = '', topCount = 0;
  for (const [con, c] of insideByCon) if (c > topCount) { topCon = con; topCount = c; }
  const topName = input.conNames?.[topCon] ?? topCon;
  const topShare = topCount / (totalByCon.get(topCon) ?? 1);
  const got = enclosed === n ? `all ${n} main stars` : `${enclosed} of ${n} main stars`;
  const ofName = name ? ` of ${name}` : '';
  const extra = topCount === 0 ? '' : topShare >= 0.5 && topCount >= 2 ? `most of ${topName}` : `${intruders} star${intruders === 1 ? '' : 's'} from ${insideByCon.size > 1 ? `other constellations (mostly ${topName})` : topName}`;

  let reason: LassoReason, message: string;
  if (enclosed < need) {
    if (areaRatio < LASSO_TOO_SMALL_RATIO) {
      reason = 'too-small';
      message = `That loop is too small: it holds ${enclosed === 0 ? 'none' : `only ${enclosed}`} of the ${n} main stars${ofName}. ${name ?? 'The constellation'} is bigger than that.`;
    } else {
      reason = 'missed-stars';
      message = enclosed === 0 && topCount > 0
        ? `That loop is around ${extra.startsWith('most of') ? extra.slice(8) : topName}, not ${name ?? 'the target'} — none of its ${n} main stars are inside.`
        : `You got ${got}${ofName}, but you need at least ${need}.${extra ? ` The loop also took in ${extra}.` : ''}`;
    }
  } else if (tooMany || tooBig) {
    reason = 'too-much-else';
    message = tooMany
      ? `You got ${got}${ofName}, but the loop also took in ${extra}.`
      : `You got ${got}${ofName}, but the loop is much bigger than the constellation — draw it tighter.`;
  } else {
    reason = 'ok';
    message = enclosed === n ? `Yes — you circled ${got}${ofName}.` : `Good — you got ${got}${ofName}.`;
  }
  return { correct: reason === 'ok', recall, enclosedTargets, missedTargets, intruders, areaRatio, reason, message };
}

/** Faintest magnitude that counts for a constellation: the limiting magnitude, but never brighter than its 4th-brightest main star. */
export function lassoTargetCutoff(mainStarMags: number[], limitingMag: number): number {
  const sorted = [...mainStarMags].sort((a, b) => a - b);
  if (!sorted.length) return limitingMag;
  return Math.max(limitingMag, sorted[Math.min(3, sorted.length - 1)]);
}

export interface ConstellationLassoArgs {
  polygon: Pt[];
  constellation: Constellation;
  catalog: { constellations: Constellation[]; starById: Map<number, Star> };
  /** e.g. SkyController.project */
  project: (ra: number, dec: number) => { x: number; y: number; visible: boolean };
  limitingMag: number;
  minPadPx?: number;
}

/**
 * Build targets/others from the catalog and score the loop.
 * Targets: the constellation's main stars at or brighter than max(limitingMag, magnitude of its
 * 4th-brightest main star) — so stars the learner cannot see at the current limiting magnitude are not
 * demanded, yet there are always (up to) four stars to find. Target stars count even if off-screen.
 * Others: main stars of every other constellation that are on screen (`visible`) and at or brighter
 * than limitingMag.
 */
export function scoreConstellationLasso(args: ConstellationLassoArgs): LassoResult {
  const { constellation, catalog, project, limitingMag } = args;
  const mine: Star[] = [];
  for (const id of constellation.mainStars) {
    const s = catalog.starById.get(id);
    if (s) mine.push(s);
  }
  const cutoff = lassoTargetCutoff(mine.map((s) => s.mag), limitingMag);
  const mineIds = new Set(mine.map((s) => s.id));
  const targets: LassoStar[] = mine.filter((s) => s.mag <= cutoff + 1e-9).map((s) => {
    const p = project(s.ra, s.dec);
    return { id: s.id, x: p.x, y: p.y, mag: s.mag };
  });
  const others: LassoOther[] = [];
  const conNames: Record<string, string> = {};
  for (const c of catalog.constellations) {
    if (c.id === constellation.id) continue;
    conNames[c.id] = c.name;
    for (const id of c.mainStars) {
      if (mineIds.has(id)) continue;
      const s = catalog.starById.get(id);
      if (!s || s.mag > limitingMag) continue;
      const p = project(s.ra, s.dec);
      if (p.visible && Number.isFinite(p.x) && Number.isFinite(p.y)) others.push({ id: s.id, x: p.x, y: p.y, mag: s.mag, con: c.id });
    }
  }
  return scoreLasso({ polygon: args.polygon, targets, others, minPadPx: args.minPadPx, targetName: constellation.name, conNames });
}
