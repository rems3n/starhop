import { zonedToUtc } from '@/lib/time';
/**
 * Turns `Highlight[]` (targets as strings) into ready-to-project geometry: unit-vector polylines densified
 * so they follow the projection, ring/label anchors, trail samples. Done once per setHighlights (and again
 * when the clock moves, but only if a highlight refers to something that moves).
 */
import type { Catalog } from '@/data/catalog';
import type { BodyId, Highlight, Observer, ResolvedTarget } from '@/types';
import { angleBetween, applyMat, lonLatToVec, mat3, slerpAppend, DEG, type Mat3 } from './camera';
import { bodyRaDec, eqjToNeu } from './ephemeris';
import type { Glyph } from './labels';

export const FRAME_EQJ = 0;
export const FRAME_HOR = 1;
const STEP = 2;

export interface HPath {
  vecs: Float64Array;
  n: number;
  frame: number;
  closed: boolean;
  dash: number[] | null;
  width: number;
  alpha: number;
}
export interface HLabel {
  x: number;
  y: number;
  z: number;
  frame: number;
  text: string;
  /** 0 = at the vector, 1 = above the highest on-screen point of path `path`, 2 = beside the middle of path `path` */
  kind: number;
  path: number;
  dx: number;
  dy: number;
  /** 0 = centred on the anchor, 1 = starts to the right of the anchor */
  align: number;
  small: boolean;
  glyph: Glyph | null;
  /** Filled each frame by the overlay */
  sx: number;
  sy: number;
  show: boolean;
}
export interface HRing {
  x: number;
  y: number;
  z: number;
  frame: number;
  /** Minimum ring radius, CSS px */
  base: number;
  /** Angular radius of the object (degrees) so the ring grows with it when zoomed in */
  sizeDeg: number;
  /** Index into the engine's body list, or −1 */
  body: number;
  /** Index of a label in the same highlight that should sit to the right of the ring, or −1 */
  label: number;
}
export interface HDot {
  x: number;
  y: number;
  z: number;
  frame: number;
  r: number;
}
export interface PreparedHighlight {
  color: string;
  paths: HPath[];
  labels: HLabel[];
  rings: HRing[];
  dots: HDot[];
}

export interface PrepareContext {
  catalog: Catalog;
  date: Date;
  observer: Observer;
  defaultColor: string;
  bodyIds: BodyId[];
}

function vecOf(ra: number, dec: number): number[] {
  const v = [0, 0, 0];
  lonLatToVec(ra, dec, v);
  return v;
}

/** Densify a polyline of unit vectors along great circles. */
export function densify(points: number[][], closed: boolean, maxStep = STEP): Float64Array {
  const out: number[] = [];
  const n = points.length;
  if (n === 0) return new Float64Array(0);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i], b = points[(i + 1) % n];
    slerpAppend(a, 0, b, 0, maxStep, out, !closed && i === last - 1);
  }
  if (n === 1) out.push(points[0][0], points[0][1], points[0][2]);
  return new Float64Array(out);
}

/** Small circle of angular radius `radiusDeg` around a unit vector. */
export function circlePoints(c: number[], radiusDeg: number): Float64Array {
  // any vector not parallel to c
  const ref = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let ux = c[1] * ref[2] - c[2] * ref[1], uy = c[2] * ref[0] - c[0] * ref[2], uz = c[0] * ref[1] - c[1] * ref[0];
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul; uy /= ul; uz /= ul;
  const vx = c[1] * uz - c[2] * uy, vy = c[2] * ux - c[0] * uz, vz = c[0] * uy - c[1] * ux;
  const rho = radiusDeg * DEG;
  const cr = Math.cos(rho), sr = Math.sin(rho);
  const n = Math.max(32, Math.min(360, Math.ceil((360 * Math.abs(sr)) / STEP)));
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    const ct = Math.cos(t), st = Math.sin(t);
    out[i * 3] = c[0] * cr + (ux * ct + vx * st) * sr;
    out[i * 3 + 1] = c[1] * cr + (uy * ct + vy * st) * sr;
    out[i * 3 + 2] = c[2] * cr + (uz * ct + vz * st) * sr;
  }
  return out;
}

export function formatSeparation(deg: number): string {
  if (deg < 1) return `${Math.round(deg * 60)}′`;
  if (deg < 10) return `${(Math.round(deg * 10) / 10).toString()}°`;
  return `${Math.round(deg)}°`;
}

function label(v: ArrayLike<number>, frame: number, text: string, kind = 0, path = -1, dx = 0, dy = 0, align = 0, small = false): HLabel {
  return { x: v[0], y: v[1], z: v[2], frame, text, kind, path, dx, dy, align, small, glyph: null, sx: 0, sy: 0, show: false };
}
function path(vecs: Float64Array, frame: number, closed: boolean, dash: number[] | null, width: number, alpha = 1): HPath {
  return { vecs, n: vecs.length / 3, frame, closed, dash, width, alpha };
}

const NICE_HOURS = [1, 2, 3, 4, 6, 12, 24];
const NICE_DAYS = [1, 2, 3, 5, 7, 10, 14, 15, 30, 60, 90, 180, 365];

/** Which trail samples get a date/time label, and how to format them. */
export function trailLabelPlan(fromMs: number, toMs: number, stepHours: number, maxLabels = 8): { every: number; mode: 'time' | 'date' } {
  const spanH = Math.abs(toMs - fromMs) / 3600e3;
  const mode = spanH <= 48 ? 'time' : 'date';
  const nice = mode === 'time' ? NICE_HOURS : NICE_DAYS.map((d) => d * 24);
  let interval = nice[nice.length - 1];
  for (const c of nice) {
    if (c >= stepHours * 0.999 && spanH / c <= maxLabels) {
      interval = c;
      break;
    }
  }
  if (spanH / interval > maxLabels) interval = spanH / maxLabels;
  return { every: Math.max(1, Math.round(interval / stepHours)), mode };
}

export function isTimeDependentRef(ref: string): boolean {
  return ref.startsWith('body:') || ref.startsWith('altaz:') || (ref.startsWith('point:') && !/^point:\s*(ncp|scp)$/.test(ref));
}

interface TrailData {
  vecs: Float64Array;
  frame: number;
  marks: { v: number[]; text: string }[];
}

export class HighlightPreparer {
  private trailCache = new Map<string, TrailData>();
  private warned = new Set<string>();
  private h = mat3();

  private resolve(ctx: PrepareContext, ref: string): ResolvedTarget | null {
    const t = ctx.catalog.resolve(ref, { date: ctx.date, observer: ctx.observer });
    if (!t && !this.warned.has(ref)) {
      this.warned.add(ref);
      console.warn(`[sky] highlight target not found: ${ref}`);
    }
    return t;
  }

  private trail(ctx: PrepareContext, h: Extract<Highlight, { type: 'trail' }>): TrailData | null {
    const key = `${h.ref}|${h.from}|${h.to}|${h.stepHours}|${h.frame ?? 'stars'}|${h.dateLabels ? 1 : 0}|${ctx.observer.lat},${ctx.observer.lon},${ctx.observer.tz}`;
    const hit = this.trailCache.get(key);
    if (hit) return hit;
    const t0 = parseTrailTime(h.from, ctx.observer.tz), t1 = parseTrailTime(h.to, ctx.observer.tz);
    if (!isFinite(t0) || !isFinite(t1) || !(h.stepHours > 0)) return null;
    const horizon = h.frame === 'horizon';
    const dir = t1 >= t0 ? 1 : -1;
    let stepMs = h.stepHours * 3600e3;
    let count = Math.floor(Math.abs(t1 - t0) / stepMs) + 1;
    if (count > 3000) {
      stepMs = Math.abs(t1 - t0) / 2999;
      count = 3000;
    }
    // Paths across the local sky are strongly curved, so sample them finely between the requested steps.
    let sub = 1;
    if (horizon) sub = Math.max(1, Math.min(Math.ceil((stepMs / 3600e3) * 6), Math.floor(4000 / count)));
    const bodyMatch = /^body:\s*(\w+)$/i.exec(h.ref);
    const body = bodyMatch ? ctx.bodyIds.find((b) => b.toLowerCase() === bodyMatch[1].toLowerCase()) : undefined;
    const fixed = !body && !isTimeDependentRef(h.ref) ? this.resolve(ctx, h.ref) : null;
    if (!body && !fixed && !isTimeDependentRef(h.ref)) return null;
    const pts: number[][] = [];
    const marks: TrailData['marks'] = [];
    const plan = trailLabelPlan(t0, t1, stepMs / 3600e3);
    const spanDays = Math.abs(t1 - t0) / 86400e3;
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat('en-US', plan.mode === 'time'
        ? { hour: 'numeric', minute: '2-digit', timeZone: ctx.observer.tz }
        : spanDays > 330 ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: ctx.observer.tz } : { month: 'short', day: 'numeric', timeZone: ctx.observer.tz });
    } catch {
      fmt = new Intl.DateTimeFormat('en-US', plan.mode === 'time' ? { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    const total = (count - 1) * sub + 1;
    const tmp = [0, 0, 0];
    for (let i = 0; i < total; i++) {
      const date = new Date(t0 + dir * (i / sub) * stepMs);
      let ra: number, dec: number;
      if (body) ({ ra, dec } = bodyRaDec(body, date, ctx.observer));
      else if (fixed) ({ ra, dec } = fixed);
      else {
        const t = ctx.catalog.resolve(h.ref, { date, observer: ctx.observer });
        if (!t) return null;
        ({ ra, dec } = t);
      }
      let v = vecOf(ra, dec);
      if (horizon) {
        eqjToNeu(date, ctx.observer, this.h);
        applyMat(this.h, v[0], v[1], v[2], tmp);
        v = [tmp[0], tmp[1], tmp[2]];
      }
      pts.push(v);
      if (h.dateLabels && i % sub === 0 && (i / sub) % plan.every === 0) marks.push({ v, text: fmt.format(date).replace(':00', '') });
    }
    const data: TrailData = { vecs: densify(pts, false), frame: horizon ? FRAME_HOR : FRAME_EQJ, marks };
    if (this.trailCache.size > 24) this.trailCache.clear();
    this.trailCache.set(key, data);
    return data;
  }

  prepare(list: Highlight[], ctx: PrepareContext): { items: PreparedHighlight[]; timeDependent: boolean } {
    const items: PreparedHighlight[] = [];
    let timeDependent = false;
    const dep = (ref: string) => {
      if (isTimeDependentRef(ref)) timeDependent = true;
    };
    for (const h of list) {
      const item: PreparedHighlight = { color: h.color ?? ctx.defaultColor, paths: [], labels: [], rings: [], dots: [] };
      switch (h.type) {
        case 'constellation': {
          const c = ctx.catalog.conById.get(h.id) ?? this.resolve(ctx, `con:${h.id}`)?.constellation;
          if (!c) break;
          if (h.lines !== false) {
            for (const line of c.lines) {
              if (line.length < 2) continue;
              item.paths.push(path(densify(line.map((p) => vecOf(p[0], p[1])), false), FRAME_EQJ, false, null, 2.4));
            }
          }
          if (h.boundary) {
            for (const poly of c.boundary) {
              if (poly.length < 3) continue;
              item.paths.push(path(densify(poly.map((p) => vecOf(p[0], p[1])), true), FRAME_EQJ, true, [6, 5], 1.3, 0.85));
            }
          }
          if (h.label) item.labels.push(label(vecOf(c.ra, c.dec), FRAME_EQJ, c.name));
          break;
        }
        case 'object': {
          dep(h.ref);
          const t = this.resolve(ctx, h.ref);
          if (!t) break;
          const v = vecOf(t.ra, t.dec);
          let li = -1;
          const text = typeof h.label === 'string' ? h.label : h.label ? t.name : '';
          if (text) {
            li = item.labels.length;
            item.labels.push(label(v, FRAME_EQJ, text, 0, -1, 0, 0, 1));
          }
          const sizeDeg = t.dso?.sizeArcmin ? Math.max(t.dso.sizeArcmin[0], t.dso.sizeArcmin[1]) / 120 : 0;
          item.rings.push({ x: v[0], y: v[1], z: v[2], frame: FRAME_EQJ, base: 11, sizeDeg, body: t.body ? ctx.bodyIds.indexOf(t.body) : -1, label: li });
          break;
        }
        case 'polyline': {
          const pts: number[][] = [];
          for (const ref of h.points) {
            dep(ref);
            const t = this.resolve(ctx, ref);
            if (t) pts.push(vecOf(t.ra, t.dec));
          }
          if (pts.length < 2) break;
          item.paths.push(path(densify(pts, !!h.closed), FRAME_EQJ, !!h.closed, h.dashed ? [7, 5] : null, 2));
          if (h.label) {
            const s = [0, 0, 0];
            for (const p of pts) {
              s[0] += p[0];
              s[1] += p[1];
              s[2] += p[2];
            }
            const l = Math.hypot(s[0], s[1], s[2]) || 1;
            item.labels.push(label([s[0] / l, s[1] / l, s[2] / l], FRAME_EQJ, h.label));
          }
          break;
        }
        case 'angle': {
          dep(h.from);
          dep(h.to);
          const a = this.resolve(ctx, h.from), b = this.resolve(ctx, h.to);
          if (!a || !b) break;
          const va = vecOf(a.ra, a.dec), vb = vecOf(b.ra, b.dec);
          const sep = angleBetween(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
          const vecs = densify([va, vb], false, Math.min(STEP, Math.max(0.01, sep / 8)));
          item.paths.push(path(vecs, FRAME_EQJ, false, null, 2));
          item.dots.push({ x: va[0], y: va[1], z: va[2], frame: FRAME_EQJ, r: 3 }, { x: vb[0], y: vb[1], z: vb[2], frame: FRAME_EQJ, r: 3 });
          const mid = Math.floor(vecs.length / 6) * 3;
          item.labels.push(label([vecs[mid], vecs[mid + 1], vecs[mid + 2]], FRAME_EQJ, h.label ?? formatSeparation(sep), 2, 0));
          break;
        }
        case 'circle': {
          dep(h.center);
          const c = this.resolve(ctx, h.center);
          if (!c || !(h.radiusDeg > 0)) break;
          const v = vecOf(c.ra, c.dec);
          item.paths.push(path(circlePoints(v, Math.min(179.9, h.radiusDeg)), FRAME_EQJ, true, null, 1.8));
          if (h.label) item.labels.push(label(v, FRAME_EQJ, h.label, 1, 0));
          break;
        }
        case 'label': {
          dep(h.at);
          const t = this.resolve(ctx, h.at);
          if (!t) break;
          item.labels.push(label(vecOf(t.ra, t.dec), FRAME_EQJ, h.text, 0, -1, 0, t.kind === 'point' ? 0 : -16));
          break;
        }
        case 'trail': {
          const tr = this.trail(ctx, h);
          if (!tr || tr.vecs.length < 6) break;
          item.paths.push(path(tr.vecs, tr.frame, false, null, 2));
          for (const m of tr.marks) {
            item.dots.push({ x: m.v[0], y: m.v[1], z: m.v[2], frame: tr.frame, r: 2.6 });
            const l = label(m.v, tr.frame, m.text, 0, -1, 0, -13, 0, true);
            item.labels.push(l);
          }
          break;
        }
      }
      if (item.paths.length || item.labels.length || item.rings.length || item.dots.length) items.push(item);
    }
    return { items, timeDependent };
  }
}

/** Trail instants: "YYYY-MM-DD HH:MM" is local time at the observer; anything else is parsed as an ISO instant. */
function parseTrailTime(spec: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(spec);
  if (m) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz).getTime();
  return Date.parse(spec);
}
