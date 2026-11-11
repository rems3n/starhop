/**
 * Text for the 2D overlay. Every label string is drawn once (with its dark halo) into an atlas canvas and
 * then stamped with drawImage each frame — far cheaper than strokeText + fillText per label per frame.
 * Also: the tiny rectangle list used for collision avoidance.
 */

export interface LabelStyle {
  size: number;
  weight: number;
  color: string;
  /** Extra letter spacing in px (0 = none) */
  spacing?: number;
  italic?: boolean;
}

export interface Glyph {
  epoch: number;
  page: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Size in CSS px (including halo padding) */
  w: number;
  h: number;
  /** Padding around the text box inside the glyph, CSS px */
  pad: number;
}

export const LABEL_FONT = "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const HALO = 'rgba(5, 8, 22, 0.86)';
const HALO_W = 3;
const PAGE = 1024;

export class LabelAtlas {
  epoch = 1;
  private pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; x: number; y: number; rowH: number }[] = [];
  private styles: LabelStyle[] = [];
  private styleKey = new Map<string, number>();
  private measure: CanvasRenderingContext2D;

  constructor(public dpr: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    this.measure = c.getContext('2d')!;
  }

  /** Register (or find) a style; returns its id. */
  style(s: LabelStyle): number {
    const key = `${s.size}|${s.weight}|${s.color}|${s.spacing ?? 0}|${s.italic ? 1 : 0}`;
    let id = this.styleKey.get(key);
    if (id === undefined) {
      id = this.styles.length;
      this.styles.push(s);
      this.styleKey.set(key, id);
    }
    return id;
  }

  /** Forget every rendered glyph (device-pixel-ratio or font change). Holders detect it through `epoch`. */
  clear(dpr = this.dpr): void {
    this.dpr = dpr;
    this.epoch++;
    this.pages.length = 0;
  }

  private font(s: LabelStyle): string {
    return `${s.italic ? 'italic ' : ''}${s.weight} ${s.size}px ${LABEL_FONT}`;
  }

  private newPage() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PAGE;
    const ctx = canvas.getContext('2d')!;
    const p = { canvas, ctx, x: 0, y: 0, rowH: 0 };
    this.pages.push(p);
    return p;
  }

  /** Render `text` in a style (cached by the caller via the returned object). */
  make(styleId: number, text: string): Glyph {
    const s = this.styles[styleId];
    const dpr = this.dpr;
    const font = this.font(s);
    const m = this.measure;
    m.font = font;
    const spacing = s.spacing ?? 0;
    const tw = m.measureText(text).width + spacing * text.length;
    const pad = HALO_W + 1;
    const w = Math.ceil(tw + pad * 2);
    const h = Math.ceil(s.size * 1.3 + pad * 2);
    const sw = Math.min(PAGE, Math.ceil(w * dpr));
    const sh = Math.min(PAGE, Math.ceil(h * dpr));
    let p = this.pages[this.pages.length - 1] ?? this.newPage();
    if (p.x + sw > PAGE) {
      p.x = 0;
      p.y += p.rowH + 1;
      p.rowH = 0;
    }
    if (p.y + sh > PAGE) p = this.newPage();
    const ctx = p.ctx;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, p.x, p.y);
    ctx.font = font;
    if (spacing && 'letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = HALO_W;
    ctx.strokeStyle = HALO;
    ctx.strokeText(text, pad, h / 2 + 0.5);
    ctx.fillStyle = s.color;
    ctx.fillText(text, pad, h / 2 + 0.5);
    ctx.restore();
    const g: Glyph = { epoch: this.epoch, page: p.canvas, sx: p.x, sy: p.y, sw, sh, w: sw / dpr, h: sh / dpr, pad };
    p.x += sw + 1;
    p.rowH = Math.max(p.rowH, sh);
    return g;
  }
}

/** Stamp a glyph with its top-left at (x, y) CSS px, snapped to device pixels so text stays crisp. */
export function stamp(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number, dpr: number): void {
  const dx = Math.round(x * dpr) / dpr;
  const dy = Math.round(y * dpr) / dpr;
  ctx.drawImage(g.page, g.sx, g.sy, g.sw, g.sh, dx, dy, g.w, g.h);
}

/** Fixed-capacity list of occupied rectangles. */
export class Boxes {
  private d: Float32Array;
  n = 0;
  constructor(private cap = 512) {
    this.d = new Float32Array(cap * 4);
  }
  reset(): void {
    this.n = 0;
  }
  free(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = this.d;
    for (let i = 0, e = this.n * 4; i < e; i += 4) {
      if (x0 < d[i + 2] && x1 > d[i] && y0 < d[i + 3] && y1 > d[i + 1]) return false;
    }
    return true;
  }
  add(x0: number, y0: number, x1: number, y1: number): void {
    if (this.n >= this.cap) return;
    const o = this.n * 4;
    this.d[o] = x0;
    this.d[o + 1] = y0;
    this.d[o + 2] = x1;
    this.d[o + 3] = y1;
    this.n++;
  }
}
