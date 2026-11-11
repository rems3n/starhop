/**
 * Constellation illustrations: pure maths (no DOM, no GL).
 *
 * Each image is pinned to the sky by three anchor stars, as in Stellarium: a 3×3 matrix M maps image pixels
 * (x, y, 1) to 3-D so that each anchor's pixel lands exactly on its star's J2000 unit vector. A grid over the
 * image is pushed through M and normalised onto the sphere; the renderer draws each grid cell as one instanced
 * quad (like the line pieces), so a cell with a corner behind the camera is dropped whole and nothing streaks.
 *
 * Images share one R8 texture array of ART_ATLAS × ART_ATLAS layers; smaller images (256, 128 px) are packed
 * several to a layer by a buddy allocator.
 */
import { DEG, lonLatToVec } from './camera';

/** public/data/constellation-art.json entry (written by scripts/data/build-art.ts) */
export interface ArtEntry {
  con: string;
  /** Path relative to the site base, e.g. "art/Ori.webp" */
  file: string;
  /** Image size in pixels */
  size: [number, number];
  /** Three anchors: image pixel (x, y; y down) and the anchor star's J2000 RA/Dec in degrees */
  anchors: { x: number; y: number; ra: number; dec: number }[];
}

export const ART_ATLAS = 512;
/** Floats per grid-cell instance: 4 corners × xyz, uv rect (u0 v0 u1 v1), layer, figure index */
export const ART_STRIDE = 18;
/** Target size of one grid cell on the sky */
const CELL_DEG = 3;

/** Row-major 3×3 M with M · (x, y, 1)ᵀ = unit vector of each anchor. Null if the anchors are collinear on the image. */
export function anchorMatrix(anchors: ArtEntry['anchors']): Float64Array | null {
  if (anchors.length !== 3) return null;
  // A has the image points as columns; V has the star vectors as columns; M = V · A⁻¹.
  const [a, b, c] = anchors;
  const a00 = a.x, a01 = b.x, a02 = c.x;
  const a10 = a.y, a11 = b.y, a12 = c.y;
  const det = a00 * (a11 - a12) - a01 * (a10 - a12) + a02 * (a10 - a11);
  if (Math.abs(det) < 1e-6) return null;
  const inv = [
    (a11 - a12) / det, (a02 - a01) / det, (a01 * a12 - a02 * a11) / det,
    (a12 - a10) / det, (a00 - a02) / det, (a02 * a10 - a00 * a12) / det,
    (a10 - a11) / det, (a01 - a00) / det, (a00 * a11 - a01 * a10) / det,
  ];
  const V = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // columns = star vectors
  const t = [0, 0, 0];
  anchors.forEach((p, j) => {
    lonLatToVec(p.ra, p.dec, t);
    V[j] = t[0]; V[3 + j] = t[1]; V[6 + j] = t[2];
  });
  const M = new Float64Array(9);
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    M[r * 3 + col] = V[r * 3] * inv[col] + V[r * 3 + 1] * inv[3 + col] + V[r * 3 + 2] * inv[6 + col];
  }
  return M;
}

/** Image pixel → point on the unit sphere (J2000). Returns the length before normalising (≈ 0 means degenerate). */
export function mapImagePoint(M: Float64Array, x: number, y: number, out: number[] | Float64Array, o = 0): number {
  const vx = M[0] * x + M[1] * y + M[2];
  const vy = M[3] * x + M[4] * y + M[5];
  const vz = M[6] * x + M[7] * y + M[8];
  const l = Math.hypot(vx, vy, vz);
  const k = l > 0 ? 1 / l : 0;
  out[o] = vx * k; out[o + 1] = vy * k; out[o + 2] = vz * k;
  return l;
}

export interface ArtSlot { layer: number; x: number; y: number }

/** Buddy-pack images (longest side ≤ ART_ATLAS) into square power-of-two slots of ART_ATLAS-sized layers. */
export function packArt(sizes: [number, number][], atlas = ART_ATLAS): { slots: ArtSlot[]; layers: number } {
  const slotSize = (s: [number, number]) => {
    let p = atlas;
    const m = Math.max(s[0], s[1]);
    while (p / 2 >= m && p > 16) p /= 2;
    return p;
  };
  const free = new Map<number, ArtSlot[]>();
  let layers = 0;
  const take = (size: number): ArtSlot => {
    const list = free.get(size);
    if (list?.length) return list.shift()!;
    if (size >= atlas) return { layer: layers++, x: 0, y: 0 };
    const big = take(size * 2);
    const rest = free.get(size) ?? [];
    rest.push({ layer: big.layer, x: big.x + size, y: big.y }, { layer: big.layer, x: big.x, y: big.y + size }, { layer: big.layer, x: big.x + size, y: big.y + size });
    free.set(size, rest);
    return { layer: big.layer, x: big.x, y: big.y };
  };
  const order = sizes.map((s, i) => ({ i, p: slotSize(s) })).sort((a, b) => b.p - a.p || a.i - b.i);
  const slots: ArtSlot[] = new Array(sizes.length);
  for (const { i, p } of order) slots[i] = take(p);
  return { slots, layers };
}

function angle(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number): number {
  const d = a[ao] * b[bo] + a[ao + 1] * b[bo + 1] + a[ao + 2] * b[bo + 2];
  return Math.acos(Math.max(-1, Math.min(1, d))) / DEG;
}

/**
 * One instance per grid cell: corners p00 p10 p01 p11 (J2000 unit vectors; x right, y down on the image), the cell's
 * uv rectangle in the texture array, the layer and the figure index. Figures whose anchors are degenerate are skipped.
 */
export function buildArtInstances(entries: ArtEntry[], slots: ArtSlot[], atlas = ART_ATLAS): { data: Float32Array; count: number } {
  const out: number[] = [];
  const c = new Float64Array(12);
  entries.forEach((e, fi) => {
    const M = anchorMatrix(e.anchors);
    if (!M) return;
    const [w, h] = e.size;
    mapImagePoint(M, 0, 0, c, 0);
    mapImagePoint(M, w, 0, c, 3);
    mapImagePoint(M, 0, h, c, 6);
    mapImagePoint(M, w, h, c, 9);
    const span = Math.max(angle(c, 0, c, 3), angle(c, 6, c, 9), angle(c, 0, c, 6), angle(c, 3, c, 9));
    const n = Math.max(6, Math.min(40, Math.ceil(span / CELL_DEG)));
    const s = slots[fi];
    const grid = new Float64Array((n + 1) * (n + 1) * 3);
    const ok = new Uint8Array((n + 1) * (n + 1));
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      ok[k] = mapImagePoint(M, (w * i) / n, (h * j) / n, grid, k * 3) > 0.15 ? 1 : 0;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k00 = j * (n + 1) + i, k10 = k00 + 1, k01 = k00 + n + 1, k11 = k01 + 1;
      if (!(ok[k00] && ok[k10] && ok[k01] && ok[k11])) continue;
      for (const k of [k00, k10, k01, k11]) out.push(grid[k * 3], grid[k * 3 + 1], grid[k * 3 + 2]);
      out.push((s.x + (w * i) / n) / atlas, (s.y + (h * j) / n) / atlas, (s.x + (w * (i + 1)) / n) / atlas, (s.y + (h * (j + 1)) / n) / atlas);
      out.push(s.layer, fi);
    }
  });
  return { data: new Float32Array(out), count: out.length / ART_STRIDE };
}

/**
 * Overall strength of the illustrations for a frame (before the per-figure emphasis): faint, gone in daylight,
 * fading out when zoomed in closer than ~5° and a little when very wide.
 */
export function artAlpha(fov: number, day: number): number {
  const s = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return 0.36 * (1 - day) * (1 - day) * s(2.5, 7, fov) * (1 - 0.3 * s(90, 150, fov));
}
