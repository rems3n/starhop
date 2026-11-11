/**
 * The 2D canvas stacked over the WebGL canvas: all text, deep-sky symbols, cardinal letters, grid labels,
 * highlights, the selection marker and the lasso. Per-frame work is limited to things that can be on screen.
 */
import type { Catalog } from '@/data/catalog';
import type { Dso, DsoType, LayerState } from '@/types';
import { DEEP_FOV_REF } from './deepcore';
import { lonLatToVec, type Mat3 } from './camera';
import { rgbaCss, smoothstep, starRadius } from './color';
import type { BodyInfo } from './ephemeris';
import { FRAME_HOR, type HLabel, type PreparedHighlight } from './highlights';
import { Boxes, LabelAtlas, stamp, type Glyph } from './labels';
import type { BodySprite, SkyTokens } from './renderer';

/** Everything the overlay reads for one frame; owned by the engine and mutated in place. */
export interface Scene {
  width: number;
  height: number;
  dpr: number;
  fov: number;
  /** Pixels per stereographic plane unit */
  S: number;
  eqj: Mat3;
  hor: Mat3;
  /** J2000 → (N, E, Up) */
  neu: Mat3;
  zClip: number;
  layers: LayerState;
  mount: 'altaz' | 'equatorial';
  starLimit: number;
  starZoom: number;
  day: number;
  bodies: BodyInfo[];
  sprites: BodySprite[];
  highlights: PreparedHighlight[];
  selection: PreparedHighlight | null;
  /** 0 → 1 while the selection ring settles */
  selectionT: number;
  showSelection: boolean;
  lasso: Float32Array;
  lassoN: number;
  lassoClosed: boolean;
}

const FAM_GALAXY = 0, FAM_OPEN = 1, FAM_GLOB = 2, FAM_NEB = 3, FAM_PN = 4, FAM_OTHER = 5;
export function dsoFamily(t: DsoType): number {
  switch (t) {
    case 'galaxy': return FAM_GALAXY;
    case 'open-cluster': case 'star-cloud': case 'asterism': return FAM_OPEN;
    case 'globular-cluster': return FAM_GLOB;
    case 'emission-nebula': case 'reflection-nebula': case 'supernova-remnant': case 'dark-nebula': case 'nebula': case 'cluster-with-nebula': return FAM_NEB;
    case 'planetary-nebula': return FAM_PN;
    default: return FAM_OTHER;
  }
}

const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Zoom level as "doublings in from the widest view". */
function zoomLevel(fov: number): number {
  return Math.log2(160 / fov);
}
export function namedStarLimit(fov: number): number {
  return 1.3 + 1.05 * zoomLevel(fov);
}
export function bayerLimit(fov: number): number {
  return fov > 55 ? -9 : 0.6 + 1.05 * zoomLevel(fov);
}
export function dsoLimit(fov: number): number {
  return 4.6 + 1.25 * zoomLevel(fov);
}
/** Deep-sky layer: NGC/IC objects beyond the curated list appear down to this magnitude (unknown magnitude counts as 15). */
export function deepDsoLimit(fov: number): number {
  return fov >= DEEP_FOV_REF ? -9 : dsoLimit(fov) + 0.75;
}
const DEEP_UNKNOWN_MAG = 15;

export class Overlay {
  ctx: CanvasRenderingContext2D;
  atlas: LabelAtlas;
  private boxes = new Boxes(640);
  private hlBoxes = new Boxes(256);
  private o = new Float64Array(3);
  private o2 = new Float64Array(3);

  // stars that can carry a label, brightest first
  private lsIdx: Int32Array;
  private lsVec: Float64Array;
  private lsMag: Float32Array;
  private lsNamed: Uint8Array;
  private lsText: string[];
  private lsGlyph: (Glyph | null)[];
  // constellations
  private conVec: Float64Array;
  private conOrder: Int32Array;
  private conGlyph: (Glyph | null)[];
  /** Label boxes of the constellation names drawn in the last frame (x0,y0,x1,y1; x1 < x0 when not drawn) */
  conRect: Float32Array;
  // deep-sky objects
  private dsoVec: Float64Array;
  private dsoMag: Float32Array;
  private dsoFam: Uint8Array;
  private dsoHalfDeg: Float32Array;
  private dsoRatio: Float32Array;
  private dsoText: string[];
  private dsoLong: string[];
  private dsoGlyph: (Glyph | null)[];
  private dsoGlyphLong: (Glyph | null)[];
  /** On-screen markers of the last frame, for picking */
  dsoShown: Uint8Array;
  dsoX: Float32Array;
  dsoY: Float32Array;
  dsoR: Float32Array;
  private dsoList: Int32Array;
  // the full NGC/IC list (deep-sky layer), set once loaded
  private deepVec = new Float64Array(0);
  private deepMag = new Float32Array(0);
  private deepFam = new Uint8Array(0);
  private deepHalfDeg = new Float32Array(0);
  private deepRatio = new Float32Array(0);
  private deepText: string[] = [];
  private deepGlyph: (Glyph | null)[] = [];
  deepX = new Float32Array(0);
  deepY = new Float32Array(0);
  deepR = new Float32Array(0);
  /** Indices (into catalog.deepDsos) of the deep objects drawn last frame; the first `deepShownN` are valid */
  deepList = new Int32Array(0);
  deepShownN = 0;
  private bodyGlyph: (Glyph | null)[] = [];
  private cardGlyph: (Glyph | null)[] = [];
  private cardVec = new Float64Array(24);
  private cardUp = new Float64Array(24);
  private gridGlyph = new Map<string, Glyph>();
  private hlStyle = new Map<string, number>();

  private stStar: number;
  private stBayer: number;
  private stCon: number;
  private stDso: number;
  private stBody: number;
  private stCard: number;
  private stCard2: number;
  private stGrid: number;
  private markerColor: string;

  constructor(public canvas: HTMLCanvasElement, private catalog: Catalog, private tokens: SkyTokens, dpr: number) {
    this.ctx = canvas.getContext('2d')!;
    this.atlas = new LabelAtlas(dpr);
    const lab = tokens.label;
    this.stStar = this.atlas.style({ size: 12.5, weight: 500, color: rgbaCss(lab, 1.05) });
    this.stBayer = this.atlas.style({ size: 12, weight: 400, color: rgbaCss(lab, 0.78) });
    this.stCon = this.atlas.style({ size: 13.5, weight: 500, color: rgbaCss([lab[0] * 0.8, lab[1] * 0.86, lab[2], lab[3]], 0.82), spacing: 0.6 });
    this.stDso = this.atlas.style({ size: 11.5, weight: 400, color: rgbaCss(lab, 0.86) });
    this.stBody = this.atlas.style({ size: 12.5, weight: 600, color: 'rgba(236,231,218,0.96)' });
    this.stCard = this.atlas.style({ size: 15, weight: 700, color: 'rgba(236,231,218,0.95)' });
    this.stCard2 = this.atlas.style({ size: 11.5, weight: 600, color: rgbaCss(lab, 0.8) });
    this.stGrid = this.atlas.style({ size: 10.5, weight: 400, color: rgbaCss([tokens.grid[0], tokens.grid[1], tokens.grid[2], 1], 0.8) });
    this.markerColor = rgbaCss(lab, 0.8);

    const v = [0, 0, 0];
    const stars = catalog.stars;
    const idx: number[] = [];
    for (let i = 0; i < stars.length; i++) if (stars[i].name || stars[i].bayer) idx.push(i);
    const n = idx.length;
    this.lsIdx = Int32Array.from(idx);
    this.lsVec = new Float64Array(n * 3);
    this.lsMag = new Float32Array(n);
    this.lsNamed = new Uint8Array(n);
    this.lsText = new Array<string>(n);
    this.lsGlyph = new Array<Glyph | null>(n).fill(null);
    idx.forEach((si, k) => {
      const s = stars[si];
      lonLatToVec(s.ra, s.dec, this.lsVec, k * 3);
      this.lsMag[k] = s.mag;
      this.lsNamed[k] = s.name ? 1 : 0;
      this.lsText[k] = s.name ?? (s.bayer ?? '').replace(/\d/g, (d) => SUP[d] ?? d);
    });

    const cons = catalog.constellations;
    this.conVec = new Float64Array(cons.length * 3);
    this.conGlyph = new Array<Glyph | null>(cons.length).fill(null);
    this.conRect = new Float32Array(cons.length * 4);
    const prom = cons.map((c, i) => {
      lonLatToVec(c.ra, c.dec, this.conVec, i * 3);
      const mags = c.figureStars.map((id) => catalog.starById.get(id)?.mag ?? 9).sort((a, b) => a - b).slice(0, 3);
      return mags.length ? mags.reduce((a, b) => a + b, 0) / mags.length : 9;
    });
    this.conOrder = Int32Array.from(cons.map((_, i) => i).sort((a, b) => prom[a] - prom[b]));

    const dsos = catalog.dsos;
    const m = dsos.length;
    this.dsoVec = new Float64Array(m * 3);
    this.dsoMag = new Float32Array(m);
    this.dsoFam = new Uint8Array(m);
    this.dsoHalfDeg = new Float32Array(m);
    this.dsoRatio = new Float32Array(m);
    this.dsoText = new Array<string>(m);
    this.dsoLong = new Array<string>(m);
    this.dsoGlyph = new Array<Glyph | null>(m).fill(null);
    this.dsoGlyphLong = new Array<Glyph | null>(m).fill(null);
    this.dsoShown = new Uint8Array(m);
    this.dsoX = new Float32Array(m);
    this.dsoY = new Float32Array(m);
    this.dsoR = new Float32Array(m);
    this.dsoList = new Int32Array(m);
    dsos.forEach((d, i) => {
      lonLatToVec(d.ra, d.dec, this.dsoVec, i * 3);
      // Messier objects are the beginner's list: let them appear a little earlier than their magnitude says
      this.dsoMag[i] = (d.mag ?? 12) - (d.messier ? 1.2 : 0) - (d.equip === 'naked-eye' ? 1 : 0);
      this.dsoFam[i] = dsoFamily(d.type);
      this.dsoHalfDeg[i] = d.sizeArcmin ? d.sizeArcmin[0] / 120 : 0;
      this.dsoRatio[i] = d.sizeArcmin && d.sizeArcmin[0] > 0 ? Math.max(0.3, d.sizeArcmin[1] / d.sizeArcmin[0]) : 0.5;
      const pretty = d.id.replace(/^(NGC|IC|Mel|Cr|Tr|St|C)(\d)/, '$1 $2');
      const short = d.messier ? `M${d.messier}` : d.name ?? pretty;
      this.dsoText[i] = short;
      this.dsoLong[i] = d.messier && d.name ? `M${d.messier} · ${d.name}` : short;
    });
    for (let i = 0; i < 8; i++) {
      lonLatToVec(i * 45, 0, this.cardVec, i * 3);
      lonLatToVec(i * 45, 3, this.cardUp, i * 3);
    }
  }

  /** The full NGC/IC list (catalog.deepDsos, brightest first, unknown magnitude last). */
  setDeepDsos(list: Dso[]): void {
    const m = list.length;
    this.deepVec = new Float64Array(m * 3);
    this.deepMag = new Float32Array(m);
    this.deepFam = new Uint8Array(m);
    this.deepHalfDeg = new Float32Array(m);
    this.deepRatio = new Float32Array(m);
    this.deepText = new Array<string>(m);
    this.deepGlyph = new Array<Glyph | null>(m).fill(null);
    this.deepX = new Float32Array(m);
    this.deepY = new Float32Array(m);
    this.deepR = new Float32Array(m);
    this.deepList = new Int32Array(Math.min(m, 400));
    this.deepShownN = 0;
    list.forEach((d, i) => {
      lonLatToVec(d.ra, d.dec, this.deepVec, i * 3);
      this.deepMag[i] = d.mag ?? DEEP_UNKNOWN_MAG;
      this.deepFam[i] = dsoFamily(d.type);
      this.deepHalfDeg[i] = d.sizeArcmin ? d.sizeArcmin[0] / 120 : 0;
      this.deepRatio[i] = d.sizeArcmin && d.sizeArcmin[0] > 0 ? Math.max(0.3, d.sizeArcmin[1] / d.sizeArcmin[0]) : 0.5;
      this.deepText[i] = d.name ?? d.id.replace(/^(NGC|IC|Mel|Cr|Tr|St|C)(\d)/, '$1 $2');
    });
  }

  /** Stroke deep-sky symbols, batched by family. */
  private drawMarkers(list: Int32Array, n: number, X: Float32Array, Y: Float32Array, R: Float32Array, fams: Uint8Array, ratio: Float32Array): void {
    const ctx = this.ctx;
    for (let fam = 0; fam <= FAM_OTHER; fam++) {
      ctx.beginPath();
      if (fam === FAM_OPEN) ctx.setLineDash([1.6, 2.6]);
      for (let k = 0; k < n; k++) {
        const i = list[k];
        if (fams[i] !== fam) continue;
        const x = X[i], y = Y[i], r = R[i];
        switch (fam) {
          case FAM_GALAXY:
            ctx.moveTo(x + r * 1.25, y);
            ctx.ellipse(x, y, r * 1.25, Math.max(2.2, r * 1.25 * Math.min(0.62, ratio[i])), -0.5, 0, 6.2832);
            break;
          case FAM_OPEN:
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, 6.2832);
            break;
          case FAM_GLOB:
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, 6.2832);
            ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
            ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
            break;
          case FAM_NEB:
            ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
            break;
          case FAM_PN: {
            const q = Math.min(r, 7) * 0.72;
            ctx.moveTo(x + q, y);
            ctx.arc(x, y, q, 0, 6.2832);
            ctx.moveTo(x - q, y); ctx.lineTo(x - q - 3.5, y);
            ctx.moveTo(x + q, y); ctx.lineTo(x + q + 3.5, y);
            ctx.moveTo(x, y - q); ctx.lineTo(x, y - q - 3.5);
            ctx.moveTo(x, y + q); ctx.lineTo(x, y + q + 3.5);
            break;
          }
          default:
            ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
        }
      }
      ctx.stroke();
      if (fam === FAM_OPEN) ctx.setLineDash([]);
    }
  }

  resize(w: number, h: number, dpr: number): void {
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    if (dpr !== this.atlas.dpr) this.resetGlyphs(dpr);
  }

  /** Drop all cached text (font finished loading, DPR changed). */
  resetGlyphs(dpr = this.atlas.dpr): void {
    this.atlas.clear(dpr);
    this.gridGlyph.clear();
  }

  private glyph(cache: (Glyph | null)[], i: number, style: number, text: string): Glyph {
    let g = cache[i];
    if (!g || g.epoch !== this.atlas.epoch) {
      g = this.atlas.make(style, text);
      cache[i] = g;
    }
    return g;
  }
  private gridLabel(text: string): Glyph {
    let g = this.gridGlyph.get(text);
    if (!g || g.epoch !== this.atlas.epoch) {
      g = this.atlas.make(this.stGrid, text);
      this.gridGlyph.set(text, g);
    }
    return g;
  }
  private hlGlyph(l: HLabel, color: string): Glyph {
    let g = l.glyph;
    if (!g || g.epoch !== this.atlas.epoch) {
      const key = `${color}|${l.small ? 1 : 0}`;
      let st = this.hlStyle.get(key);
      if (st === undefined) {
        st = this.atlas.style({ size: l.small ? 11.5 : 13.5, weight: 600, color });
        this.hlStyle.set(key, st);
      }
      g = this.atlas.make(st, l.text);
      l.glyph = g;
    }
    return g;
  }

  /** Project a J2000 vector; false when behind the camera, far off screen, or hidden by the ground. */
  private proj(sc: Scene, m: Mat3, x: number, y: number, z: number, margin: number, ground: boolean): boolean {
    const o = this.o;
    const vz = m[6] * x + m[7] * y + m[8] * z;
    if (vz < sc.zClip) return false;
    const w = 1 + vz;
    const sx = sc.width / 2 + ((m[0] * x + m[1] * y + m[2] * z) / w) * sc.S;
    const sy = sc.height / 2 - ((m[3] * x + m[4] * y + m[5] * z) / w) * sc.S;
    if (sx < -margin || sy < -margin || sx > sc.width + margin || sy > sc.height + margin) return false;
    if (ground) {
      const n = sc.neu;
      if (n[6] * x + n[7] * y + n[8] * z < 0) return false;
    }
    o[0] = sx;
    o[1] = sy;
    return true;
  }

  /** Try to place a glyph beside (x, y): right, left, above, below. Returns true and stamps it if a spot is free. */
  private placeBeside(g: Glyph, x: number, y: number, r: number, alpha: number): boolean {
    const b = this.boxes, p = g.pad - 1;
    const w = g.w, h = g.h;
    for (let k = 0; k < 4; k++) {
      let gx: number, gy: number;
      if (k === 0) { gx = x + r + 3 - p; gy = y - h / 2; }
      else if (k === 1) { gx = x - r - 3 - w + p; gy = y - h / 2; }
      else if (k === 2) { gx = x - w / 2; gy = y - r - 2 - h + p; }
      else { gx = x - w / 2; gy = y + r + 2 - p; }
      if (b.free(gx + p, gy + p, gx + w - p, gy + h - p)) {
        b.add(gx + p, gy + p, gx + w - p, gy + h - p);
        const ctx = this.ctx;
        if (alpha < 0.999) ctx.globalAlpha = alpha;
        stamp(ctx, g, gx, gy, this.atlas.dpr);
        if (alpha < 0.999) ctx.globalAlpha = 1;
        return true;
      }
    }
    return false;
  }
  private placeCentred(g: Glyph, x: number, y: number, alpha: number, force: boolean): boolean {
    const p = g.pad - 1;
    const gx = x - g.w / 2, gy = y - g.h / 2;
    if (!force && !this.boxes.free(gx + p, gy + p, gx + g.w - p, gy + g.h - p)) return false;
    this.boxes.add(gx + p, gy + p, gx + g.w - p, gy + g.h - p);
    const ctx = this.ctx;
    if (alpha < 0.999) ctx.globalAlpha = alpha;
    stamp(ctx, g, gx, gy, this.atlas.dpr);
    if (alpha < 0.999) ctx.globalAlpha = 1;
    return true;
  }

  /** Stroke a densified path of unit vectors, breaking it wherever it leaves the safe zone. Returns via o2: top-most point. */
  private tracePath(sc: Scene, m: Mat3, vecs: Float64Array, n: number, closed: boolean): boolean {
    const ctx = this.ctx;
    const cx = sc.width / 2, cy = sc.height / 2, S = sc.S, zc = sc.zClip;
    let pen = false, any = false;
    let topY = Infinity, topX = 0;
    const total = closed ? n + 1 : n;
    const big = Math.max(sc.width, sc.height) * 6;
    for (let k = 0; k < total; k++) {
      const i = (k % n) * 3;
      const x = vecs[i], y = vecs[i + 1], z = vecs[i + 2];
      const vz = m[6] * x + m[7] * y + m[8] * z;
      if (vz < zc) { pen = false; continue; }
      const w = 1 + vz;
      const sx = cx + ((m[0] * x + m[1] * y + m[2] * z) / w) * S;
      const sy = cy - ((m[3] * x + m[4] * y + m[5] * z) / w) * S;
      if (Math.abs(sx - cx) > big || Math.abs(sy - cy) > big) { pen = false; continue; }
      if (pen) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
      pen = true;
      any = true;
      if (sy < topY && sx > 8 && sx < sc.width - 8 && sy > 0) { topY = sy; topX = sx; }
    }
    this.o2[0] = topX;
    this.o2[1] = topY;
    return any;
  }

  draw(sc: Scene): void {
    const ctx = this.ctx;
    const dpr = this.atlas.dpr;
    const W = sc.width, H = sc.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.boxes.reset();
    const L = sc.layers;
    const o = this.o;
    const ground = L.ground;
    const pxPerDeg = (sc.S * Math.PI) / 360; // at the view centre
    const nightText = 1 - 0.7 * sc.day;
    const dsoAlpha = 1 - sc.day;

    // ── highlight + selection label anchors are reserved first so ordinary labels keep clear of them
    for (let hi = 0; hi <= sc.highlights.length; hi++) {
      const h = hi < sc.highlights.length ? sc.highlights[hi] : sc.selection;
      if (!h) continue;
      for (const l of h.labels) {
        l.show = false;
        if (l.kind !== 0) continue;
        const m = l.frame === FRAME_HOR ? sc.hor : sc.eqj;
        if (!this.proj(sc, m, l.x, l.y, l.z, 40, false)) continue;
        l.sx = o[0];
        l.sy = o[1];
        l.show = true;
        const g = this.hlGlyph(l, h.color);
        const bx = l.align === 1 ? l.sx + 12 : l.sx - g.w / 2;
        this.boxes.add(bx, l.sy + l.dy - g.h / 2 + 3, bx + g.w, l.sy + l.dy + g.h / 2 - 3);
      }
    }
    this.hlBoxes.reset();

    // ── cardinal letters on the horizon
    if (L.horizon) {
      for (let i = 0; i < 8; i++) {
        const c = this.cardVec, u = this.cardUp;
        if (!this.proj(sc, sc.hor, c[i * 3], c[i * 3 + 1], c[i * 3 + 2], 20, false)) continue;
        const x = o[0], y = o[1];
        let ux = 0, uy = -1;
        if (this.proj(sc, sc.hor, u[i * 3], u[i * 3 + 1], u[i * 3 + 2], 4000, false)) {
          const dx = o[0] - x, dy = o[1] - y, d = Math.hypot(dx, dy);
          if (d > 1e-3) { ux = dx / d; uy = dy / d; }
        }
        const main = i % 2 === 0;
        const g = this.glyph(this.cardGlyph, i, main ? this.stCard : this.stCard2, CARD[i]);
        const off = main ? 13 : 11;
        ctx.strokeStyle = this.markerColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ux * 4, y + uy * 4);
        ctx.stroke();
        this.placeCentred(g, x + ux * off, y + uy * off, 1, true);
      }
    }

    // ── grid labels
    if (L.equatorialGrid) {
      for (let ra = 0; ra < 360; ra += 30) this.gridText(sc, sc.eqj, ra, 0, `${ra / 15}h`, ground);
      for (let dec = -80; dec <= 80; dec += 20) {
        if (dec === 0) continue;
        for (let ra = 0; ra < 360; ra += 90) this.gridText(sc, sc.eqj, ra, dec, `${dec > 0 ? '+' : '−'}${Math.abs(dec)}°`, ground);
      }
    }
    if (L.azimuthalGrid) {
      for (let alt = -80; alt <= 80; alt += 20) {
        if (alt === 0 || (ground && alt < 0)) continue;
        for (let az = 0; az < 360; az += 90) this.gridText(sc, sc.hor, az, alt, `${alt}°`, false);
      }
      for (let az = 30; az < 360; az += 30) if (az % 90 !== 0) this.gridText(sc, sc.hor, az, 0, `${az}°`, false, 9);
    }

    // ── Sun, Moon, planets: names
    if (L.planets) {
      for (let i = 0; i < sc.sprites.length; i++) {
        const s = sc.sprites[i];
        if (!s.visible || s.alpha < 0.25) continue;
        if (s.x < -20 || s.y < -20 || s.x > W + 20 || s.y > H + 20) continue;
        const b = sc.bodies[i];
        if (ground && sc.neu[6] * b.x + sc.neu[7] * b.y + sc.neu[8] * b.z < -0.004) continue;
        const g = this.glyph(this.bodyGlyph, i, this.stBody, sc.bodies[i].id);
        this.boxes.add(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
        this.placeBeside(g, s.x, s.y, s.r + 1, Math.min(1, s.alpha * 1.3));
      }
    }

    // ── deep-sky markers (symbols now, names after the constellation names)
    let nd = 0;
    this.dsoShown.fill(0);
    this.deepShownN = 0;
    if (L.dsoMarkers && dsoAlpha > 0.05) {
      const lim = dsoLimit(sc.fov);
      const dm = this.dsoMag, dv = this.dsoVec;
      for (let i = 0; i < dm.length && nd < 90; i++) {
        if (dm[i] > lim) continue; // (sorted by true magnitude, the Messier bonus makes it only roughly ordered)
        if (!this.proj(sc, sc.eqj, dv[i * 3], dv[i * 3 + 1], dv[i * 3 + 2], 12, ground)) continue;
        this.dsoX[i] = o[0];
        this.dsoY[i] = o[1];
        this.dsoR[i] = Math.min(140, Math.max(5, this.dsoHalfDeg[i] * pxPerDeg));
        this.dsoShown[i] = 1;
        this.dsoList[nd++] = i;
      }
      ctx.strokeStyle = this.markerColor;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = dsoAlpha;
      this.drawMarkers(this.dsoList, nd, this.dsoX, this.dsoY, this.dsoR, this.dsoFam, this.dsoRatio);
      // the full NGC/IC list, progressively by magnitude as you zoom in (deep-sky layer)
      const dlim = L.deepSky ? deepDsoLimit(sc.fov) : -9;
      if (dlim > 0 && this.deepMag.length) {
        const dmg = this.deepMag, dvv = this.deepVec;
        const e = sc.eqj;
        const cosHalf = Math.cos(Math.min(Math.PI, 2 * Math.atan(Math.hypot(W, H) / 2 / sc.S) * 1.05));
        const cap = this.deepList.length;
        let n = 0;
        for (let i = 0; i < dmg.length && n < cap; i++) {
          if (dmg[i] > dlim) {
            if (dmg[i] < DEEP_UNKNOWN_MAG) continue;
            break;
          }
          const x = dvv[i * 3], y = dvv[i * 3 + 1], z = dvv[i * 3 + 2];
          if (e[6] * x + e[7] * y + e[8] * z < cosHalf) continue;
          if (!this.proj(sc, sc.eqj, x, y, z, 12, ground)) continue;
          this.deepX[i] = o[0];
          this.deepY[i] = o[1];
          this.deepR[i] = Math.min(140, Math.max(4, this.deepHalfDeg[i] * pxPerDeg));
          this.deepList[n++] = i;
        }
        this.deepShownN = n;
        ctx.globalAlpha = dsoAlpha * 0.8;
        this.drawMarkers(this.deepList, n, this.deepX, this.deepY, this.deepR, this.deepFam, this.deepRatio);
      }
      ctx.globalAlpha = 1;
    }

    // ── constellation names
    this.conRect.fill(-1);
    if (L.constellationNames) {
      const zoomA = smoothstep(7, 14, sc.fov) * nightText;
      const maxCount = sc.fov > 120 ? 26 : sc.fov > 80 ? 40 : 88;
      if (zoomA > 0.02) {
        const cons = this.catalog.constellations;
        let shown = 0;
        for (let k = 0; k < this.conOrder.length && shown < maxCount; k++) {
          const i = this.conOrder[k];
          const cv = this.conVec;
          if (!this.proj(sc, sc.eqj, cv[i * 3], cv[i * 3 + 1], cv[i * 3 + 2], 0, ground)) continue;
          const g = this.glyph(this.conGlyph, i, this.stCon, cons[i].name);
          const x = o[0], y = o[1];
          if (this.placeCentred(g, x, y, zoomA, false)) {
            shown++;
            const r = this.conRect;
            r[i * 4] = x - g.w / 2;
            r[i * 4 + 1] = y - g.h / 2;
            r[i * 4 + 2] = x + g.w / 2;
            r[i * 4 + 3] = y + g.h / 2;
          }
        }
      }
    }

    // ── star names, brightest first; Bayer letters once zoomed in
    if (L.starNames) {
      const limN = Math.min(namedStarLimit(sc.fov), sc.starLimit - 0.15);
      const limB = Math.min(bayerLimit(sc.fov), sc.starLimit - 0.15);
      const lim = Math.max(limN, limB);
      const mg = this.lsMag, lv = this.lsVec;
      let shown = 0;
      for (let k = 0; k < mg.length && shown < 70; k++) {
        const mag = mg[k];
        if (mag > lim) break;
        const named = this.lsNamed[k] === 1;
        if (mag > (named ? limN : limB)) continue;
        if (!this.proj(sc, sc.eqj, lv[k * 3], lv[k * 3 + 1], lv[k * 3 + 2], 0, ground)) continue;
        const g = this.glyph(this.lsGlyph, k, named ? this.stStar : this.stBayer, this.lsText[k]);
        const fade = Math.min(1, (sc.starLimit - mag) / 0.6);
        if (this.placeBeside(g, o[0], o[1], starRadius(mag) * sc.starZoom, fade)) shown++;
      }
    }

    // ── deep-sky names
    if (L.dsoMarkers && nd) {
      const long = sc.fov < 26;
      let shown = 0;
      for (let k = 0; k < nd && shown < 45; k++) {
        const i = this.dsoList[k];
        const g = long ? this.glyph(this.dsoGlyphLong, i, this.stDso, this.dsoLong[i]) : this.glyph(this.dsoGlyph, i, this.stDso, this.dsoText[i]);
        if (this.placeBeside(g, this.dsoX[i], this.dsoY[i], Math.min(this.dsoR[i], 30) + 1, dsoAlpha)) shown++;
      }
    }
    // deep-sky names only where there is room (collision boxes), fewest first: brightest objects win
    if (L.dsoMarkers && this.deepShownN) {
      let shown = 0;
      for (let k = 0; k < this.deepShownN && shown < 30; k++) {
        const i = this.deepList[k];
        const g = this.glyph(this.deepGlyph, i, this.stDso, this.deepText[i]);
        if (this.placeBeside(g, this.deepX[i], this.deepY[i], Math.min(this.deepR[i], 30) + 1, dsoAlpha * 0.85)) shown++;
      }
    }

    // ── highlights, then the selection marker, over everything else
    for (const h of sc.highlights) this.drawHighlight(sc, h, pxPerDeg, 1);
    if (sc.selection && sc.showSelection) this.drawHighlight(sc, sc.selection, pxPerDeg, sc.selectionT);

    // ── lasso
    if (sc.lassoN > 1) {
      const p = sc.lasso;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 1; i < sc.lassoN; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
      if (sc.lassoClosed) {
        ctx.closePath();
        ctx.fillStyle = rgbaCss(this.tokens.highlight, 0.1);
        ctx.fill();
      }
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(5,8,22,0.7)';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = rgbaCss(this.tokens.highlight, 1);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  private gridText(sc: Scene, m: Mat3, lon: number, lat: number, text: string, ground: boolean, lift = 0): void {
    const v = this.o2;
    lonLatToVec(lon, lat, v);
    if (!this.proj(sc, m, v[0], v[1], v[2], 0, ground)) return;
    const g = this.gridLabel(text);
    const gx = this.o[0] + 2, gy = this.o[1] - g.h + 3 - lift;
    const p = g.pad;
    if (!this.boxes.free(gx + p, gy + p, gx + g.w - p, gy + g.h - p)) return;
    this.boxes.add(gx + p, gy + p, gx + g.w - p, gy + g.h - p);
    stamp(this.ctx, g, gx, gy, this.atlas.dpr);
  }

  private drawHighlight(sc: Scene, h: PreparedHighlight, pxPerDeg: number, t: number): void {
    const ctx = this.ctx;
    const o = this.o;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // lines: dark underlay then colour, so they read over stars, ground and daylight alike
    for (let pi = 0; pi < h.paths.length; pi++) {
      const p = h.paths[pi];
      const m = p.frame === FRAME_HOR ? sc.hor : sc.eqj;
      ctx.beginPath();
      if (!this.tracePath(sc, m, p.vecs, p.n, p.closed)) continue;
      const topX = this.o2[0], topY = this.o2[1];
      if (p.dash) ctx.setLineDash(p.dash);
      ctx.globalAlpha = 0.55 * p.alpha;
      ctx.strokeStyle = 'rgb(5,8,22)';
      ctx.lineWidth = p.width + 2.4;
      ctx.stroke();
      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = h.color;
      ctx.lineWidth = p.width;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (p.dash) ctx.setLineDash([]);
      for (const l of h.labels) {
        if (l.path !== pi) continue;
        if (l.kind === 1 && isFinite(topY)) {
          l.sx = topX;
          l.sy = Math.max(12, topY - 12);
          l.show = true;
        } else if (l.kind === 2 && this.proj(sc, m, l.x, l.y, l.z, 40, false)) {
          // sit beside the middle of the arc, on the side away from the arc's chord normal pointing down
          const mx = o[0], my = o[1];
          const i0 = Math.max(0, Math.floor(p.n / 2) - 1) * 3, i1 = Math.min(p.n - 1, Math.floor(p.n / 2) + 1) * 3;
          let nx = 0, ny = -1;
          if (this.proj(sc, m, p.vecs[i0], p.vecs[i0 + 1], p.vecs[i0 + 2], 1e5, false)) {
            const ax = o[0], ay = o[1];
            if (this.proj(sc, m, p.vecs[i1], p.vecs[i1 + 1], p.vecs[i1 + 2], 1e5, false)) {
              const dx = o[0] - ax, dy = o[1] - ay, d = Math.hypot(dx, dy);
              if (d > 1e-3) {
                nx = dy / d;
                ny = -dx / d;
                if (ny > 0) { nx = -nx; ny = -ny; }
              }
            }
          }
          const g = this.hlGlyph(l, h.color);
          l.sx = mx + nx * (10 + Math.abs(nx) * g.w * 0.42);
          l.sy = my + ny * 13;
          l.show = true;
        }
      }
    }
    // dots
    if (h.dots.length) {
      ctx.fillStyle = h.color;
      ctx.strokeStyle = 'rgba(5,8,22,0.8)';
      ctx.lineWidth = 1;
      for (const d of h.dots) {
        if (!this.proj(sc, d.frame === FRAME_HOR ? sc.hor : sc.eqj, d.x, d.y, d.z, 10, false)) continue;
        ctx.beginPath();
        ctx.arc(o[0], o[1], d.r, 0, 6.2832);
        ctx.fill();
        ctx.stroke();
      }
    }
    // rings
    for (const r of h.rings) {
      if (!this.proj(sc, r.frame === FRAME_HOR ? sc.hor : sc.eqj, r.x, r.y, r.z, 60, false)) continue;
      let rad = Math.max(r.base, r.sizeDeg * pxPerDeg + 6);
      if (r.body >= 0 && sc.sprites[r.body]) rad = Math.max(rad, sc.sprites[r.body].r + 6);
      rad = Math.min(rad, 220);
      const x = o[0], y = o[1];
      const grow = rad + (1 - t) * 22;
      ctx.globalAlpha = 0.6 * t;
      ctx.strokeStyle = 'rgb(5,8,22)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, grow, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = t;
      ctx.strokeStyle = h.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x, y, grow, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (r.label >= 0) {
        const l = h.labels[r.label];
        l.dx = rad + 4;
      }
    }
    // labels
    for (const l of h.labels) {
      if (!l.show) continue;
      const g = this.hlGlyph(l, h.color);
      const x = l.align === 1 ? l.sx + l.dx - (g.pad - 1) : l.sx + l.dx - g.w / 2;
      const y = l.sy + l.dy - g.h / 2;
      const cx = Math.min(Math.max(x, 2 - g.pad), sc.width - g.w + g.pad - 2);
      const p = g.pad, step = g.h - 2 * p + 2;
      let cy = y;
      for (let k = 0; k < 5; k++) {
        const ty = y + (k === 0 ? 0 : k === 1 ? step : k === 2 ? -step : k === 3 ? 2 * step : -2 * step);
        if (this.hlBoxes.free(cx + p, ty + p, cx + g.w - p, ty + g.h - p)) { cy = ty; break; }
      }
      this.hlBoxes.add(cx + p, cy + p, cx + g.w - p, cy + g.h - p);
      stamp(ctx, g, cx, cy, this.atlas.dpr);
    }
  }
}
