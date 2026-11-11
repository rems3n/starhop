/**
 * Streaming of deep stars (public/deep/stars/, AT-HYG to magnitude 11) for one engine.
 *
 * - `select(view)` (cheap: ~1,000 dot products) works out which HEALPix tiles the view needs for the current limiting
 *   magnitude; the engine calls it when the view has settled or moved a lot, never every frame.
 * - Missing tiles are fetched nearest-to-centre first, at most `CONCURRENCY` at a time; fetches for tiles that are no
 *   longer wanted are aborted.
 * - Decoded tiles go to the GPU (same vertex layout and shader as the catalog stars) and fade in over 300 ms.
 * - GPU tiles beyond the budget (`MAX_TILES` / `MAX_STARS`) are evicted, least recently wanted first. Decoded tiles are
 *   kept in a page-wide cache shared by every engine, so a second sky view does not download them again.
 * - `frame()` (every frame) only flags which resident tiles intersect the screen and their fade.
 */
import { bvToRgb } from './color';
import { decodeStarTile, deepStarId, type DeepIndex } from './deepcore';
import { pixelBounds, pixelsInCone } from './healpix';
import type { DeepGpuTile } from './renderer';

const BASE_URL: string = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
export const CONCURRENCY = 4;
export const MAX_TILES = 150;
export const MAX_STARS = 200_000;
export const FADE_MS = 300;

// ───────────── page-wide caches (shared by every engine)
let indexPromise: Promise<DeepIndex | null> | null = null;
/** Page-wide network byte counter (perf checks). */
export const deepNet = { bytes: 0, requests: 0 };
export function loadDeepIndex(): Promise<DeepIndex | null> {
  indexPromise ??= fetch(`${BASE_URL}deep/stars/index.json`).then(async (r) => {
    if (!r.ok) return null;
    const text = await r.text();
    deepNet.bytes += text.length;
    deepNet.requests++;
    try {
      return JSON.parse(text) as DeepIndex;
    } catch {
      return null; // a dev server may answer a missing file with index.html
    }
  }, () => null);
  return indexPromise;
}

interface CpuTile { data: Float32Array; mags: Float32Array; bv: Float32Array; count: number }
const cpuCache = new Map<number, CpuTile>();
const CPU_CACHE_MAX = 400;
function cacheGet(key: number): CpuTile | undefined {
  const t = cpuCache.get(key);
  if (t) {
    cpuCache.delete(key);
    cpuCache.set(key, t);
  }
  return t;
}
function cachePut(key: number, t: CpuTile): void {
  cpuCache.set(key, t);
  while (cpuCache.size > CPU_CACHE_MAX) cpuCache.delete(cpuCache.keys().next().value as number);
}

/** B−V byte code → colour, once per code. */
const bvLut = new Map<number, [number, number, number]>();
function colourFor(bv: number): [number, number, number] {
  const code = isNaN(bv) ? -999 : Math.round(bv * 50);
  let c = bvLut.get(code);
  if (!c) bvLut.set(code, (c = bvToRgb(isNaN(bv) ? undefined : code / 50)));
  return c;
}

/** Decode a tile file into the 7-floats-per-star GPU layout (x y z mag r g b). */
export function tileToGpuData(order: number, pix: number, buf: ArrayBuffer): CpuTile {
  const d = decodeStarTile(order, pix, buf);
  const data = new Float32Array(d.count * 7);
  for (let i = 0; i < d.count; i++) {
    const o = i * 7;
    data[o] = d.pos[i * 3]; data[o + 1] = d.pos[i * 3 + 1]; data[o + 2] = d.pos[i * 3 + 2];
    data[o + 3] = d.mag[i];
    const c = colourFor(d.bv[i]);
    data[o + 4] = c[0]; data[o + 5] = c[1]; data[o + 6] = c[2];
  }
  return { data, mags: d.mag, bv: d.bv, count: d.count };
}

// ───────────── identity of one deep star (fetched on click)
export interface DeepStarMeta { d: string[]; m: number[]; l: number[]; s: string[] }
const metaCache = new Map<number, Promise<DeepStarMeta | null>>();
async function readMaybeGzip(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  deepNet.bytes += buf.byteLength;
  deepNet.requests++;
  // The files are gzip on disk; a server may already have decoded them (Content-Encoding), so check the magic bytes.
  if (buf[0] === 0x1f && buf[1] === 0x8b && typeof DecompressionStream === 'function') {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(buf);
}
export function loadDeepMeta(order: number, pix: number, band: number): Promise<DeepStarMeta | null> {
  const key = band * 4096 + pix;
  let p = metaCache.get(key);
  if (!p) {
    p = fetch(`${BASE_URL}deep/stars/${order}/${pix}.json.gz`)
      .then((r) => (r.ok ? readMaybeGzip(r) : null))
      .then((t) => (t ? (JSON.parse(t) as DeepStarMeta) : null))
      .catch(() => null);
    p.then((m) => { if (!m) metaCache.delete(key); });
    metaCache.set(key, p);
    if (metaCache.size > 24) metaCache.delete(metaCache.keys().next().value as number);
  }
  return p;
}

// ───────────── per-engine streaming
export interface DeepTile extends DeepGpuTile {
  key: number;
  band: number;
  order: number;
  pix: number;
  cx: number;
  cy: number;
  cz: number;
  /** B−V per star (NaN = unknown), for the info panel of a clicked star */
  bv: Float32Array;
  /** Bounding radius of the tile, radians */
  radius: number;
  loadedAt: number;
  lastWanted: number;
}

export interface DeepView {
  /** View centre, J2000 unit vector */
  cx: number;
  cy: number;
  cz: number;
  /** Angle from the centre to a screen corner, radians */
  halfAngle: number;
  /** Effective limiting magnitude */
  limit: number;
  /** J2000 → local "up" row when the ground hides the sky below the horizon, else null */
  up: ArrayLike<number> | null;
}

interface Pending { key: number; band: number; pix: number; prio: number }

export class DeepStars {
  /** GPU-resident tiles (also handed to the renderer for drawing and context-loss re-upload) */
  readonly tiles: DeepTile[] = [];
  private byKey = new Map<number, DeepTile>();
  private index: DeepIndex | null = null;
  private bounds: { centres: Float64Array; radius: Float32Array }[] = [];
  private queue: Pending[] = [];
  private inflight = new Map<number, AbortController>();
  private wanted = new Set<number>();
  private scratch = new Int32Array(1024);
  private destroyed = false;
  private indexRequested = false;
  /** Statistics for perf checks */
  loads = 0;
  evictions = 0;
  aborted = 0;

  constructor(private upload: (t: DeepTile) => void, private free: (t: DeepTile) => void, private onChange: () => void, private reduced: () => boolean) {}

  get ready(): boolean {
    return !!this.index;
  }
  get starCount(): number {
    let n = 0;
    for (const t of this.tiles) n += t.count;
    return n;
  }
  get pendingCount(): number {
    return this.queue.length + this.inflight.size;
  }
  get bands(): DeepIndex['bands'] {
    return this.index?.bands ?? [];
  }

  private ensureIndex(): void {
    if (this.indexRequested) return;
    this.indexRequested = true;
    loadDeepIndex().then((idx) => {
      if (this.destroyed || !idx) return;
      this.index = idx;
      this.bounds = idx.bands.map((b) => pixelBounds(b.order));
      this.onChange();
    });
  }

  /** Work out the tiles this view needs and start fetching the missing ones. Call when the view settles or moves a lot. */
  select(v: DeepView, now: number): void {
    if (v.limit <= 7.6) return; // nothing deep to show: keep what is resident, fetch nothing
    this.ensureIndex();
    const idx = this.index;
    if (!idx) return;
    this.wanted.clear();
    const want: Pending[] = [];
    idx.bands.forEach((band, bi) => {
      if (v.limit <= band.min) return;
      const b = this.bounds[bi];
      const up = v.up;
      const skip = up ? (i: number) => {
        // whole tile below the horizon
        const c = b.centres;
        return up[0] * c[i * 3] + up[1] * c[i * 3 + 1] + up[2] * c[i * 3 + 2] < -Math.sin(b.radius[i]);
      } : undefined;
      const n = pixelsInCone(b, v.cx, v.cy, v.cz, v.halfAngle, this.scratch, skip);
      for (let k = 0; k < n; k++) {
        const pix = this.scratch[k];
        if (!band.counts[pix]) continue;
        const key = bi * 4096 + pix;
        this.wanted.add(key);
        const t = this.byKey.get(key);
        if (t) { t.lastWanted = now; continue; }
        const c = b.centres;
        const dot = v.cx * c[pix * 3] + v.cy * c[pix * 3 + 1] + v.cz * c[pix * 3 + 2];
        want.push({ key, band: bi, pix, prio: bi * 4 - dot });
      }
    });
    // stale fetches: abort what the view no longer needs
    for (const [key, ctl] of this.inflight) {
      if (!this.wanted.has(key)) {
        ctl.abort();
        this.inflight.delete(key);
        this.aborted++;
      }
    }
    this.queue = want.filter((p) => !this.inflight.has(p.key)).sort((a, b) => a.prio - b.prio);
    this.pump();
  }

  private pump(): void {
    while (this.inflight.size < CONCURRENCY && this.queue.length) {
      const p = this.queue.shift()!;
      const band = this.index!.bands[p.band];
      const cached = cacheGet(p.key);
      if (cached) {
        this.add(p, cached);
        continue;
      }
      const ctl = new AbortController();
      this.inflight.set(p.key, ctl);
      fetch(`${BASE_URL}deep/stars/${band.order}/${p.pix}.bin`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((buf) => {
          deepNet.bytes += buf.byteLength;
          deepNet.requests++;
          const t = tileToGpuData(band.order, p.pix, buf);
          cachePut(p.key, t);
          if (this.inflight.get(p.key) !== ctl) return;
          this.inflight.delete(p.key);
          if (!this.destroyed) this.add(p, t);
        })
        .catch((e: unknown) => {
          if (this.inflight.get(p.key) === ctl) this.inflight.delete(p.key);
          if ((e as Error)?.name !== 'AbortError') console.warn(`[sky] deep star tile ${band.order}/${p.pix} unavailable`, e);
        })
        .finally(() => { if (!this.destroyed) this.pump(); });
    }
  }

  private add(p: Pending, cpu: CpuTile): void {
    if (this.byKey.has(p.key)) return;
    const band = this.index!.bands[p.band];
    const b = this.bounds[p.band];
    const now = performance.now();
    const t: DeepTile = {
      key: p.key, band: p.band, order: band.order, pix: p.pix,
      cx: b.centres[p.pix * 3], cy: b.centres[p.pix * 3 + 1], cz: b.centres[p.pix * 3 + 2], radius: b.radius[p.pix],
      data: cpu.data, mags: cpu.mags, bv: cpu.bv, count: cpu.count, vao: null, buf: null,
      visible: false, alpha: this.reduced() ? 1 : 0, loadedAt: now, lastWanted: now,
    };
    this.upload(t);
    this.tiles.push(t);
    this.byKey.set(p.key, t);
    this.loads++;
    this.evict();
    this.onChange();
  }

  private evict(): void {
    let stars = this.starCount;
    if (this.tiles.length <= MAX_TILES && stars <= MAX_STARS) return;
    const order = this.tiles.filter((t) => !this.wanted.has(t.key)).sort((a, b) => a.lastWanted - b.lastWanted);
    for (const t of order) {
      if (this.tiles.length <= MAX_TILES && stars <= MAX_STARS) break;
      this.free(t);
      this.byKey.delete(t.key);
      this.tiles.splice(this.tiles.indexOf(t), 1);
      stars -= t.count;
      this.evictions++;
    }
  }

  /**
   * Per frame: which resident tiles intersect the view, and their fade-in. Allocates nothing.
   * Returns true while a tile is still fading in (the engine keeps drawing).
   */
  frame(v: DeepView, now: number): boolean {
    let fading = false;
    const reduced = this.reduced();
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const lim = this.index!.bands[t.band].min;
      if (v.limit <= lim) { t.visible = false; continue; }
      const d = v.cx * t.cx + v.cy * t.cy + v.cz * t.cz;
      const r = v.halfAngle + t.radius;
      t.visible = r >= Math.PI || d >= Math.cos(r);
      if (!t.visible) continue;
      if (t.alpha < 1) {
        t.alpha = reduced ? 1 : Math.min(1, (now - t.loadedAt) / FADE_MS);
        if (t.alpha < 1) fading = true;
      }
    }
    return fading;
  }

  /** Star id (`star:<id>`) of star `i` of a resident tile. */
  idOf(t: DeepTile, i: number): number {
    return deepStarId(t.band, t.pix, i);
  }

  destroy(): void {
    this.destroyed = true;
    for (const ctl of this.inflight.values()) ctl.abort();
    this.inflight.clear();
    this.queue = [];
    for (const t of this.tiles) this.free(t);
    this.tiles.length = 0;
    this.byKey.clear();
  }
}

/** Unit vector of a deep star from its tile data (for building a Star on click). */
export function deepStarVec(t: DeepTile, i: number): [number, number, number] {
  return [t.data[i * 7], t.data[i * 7 + 1], t.data[i * 7 + 2]];
}
