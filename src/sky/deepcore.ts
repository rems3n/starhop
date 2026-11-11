/**
 * "Deep sky" — fainter stars (AT-HYG, to magnitude 11) and the full NGC/IC catalogue, shown when zoomed in.
 * Pure parts shared by the data pipeline (scripts/data/build-deep.ts), the engine and the tests: the tile codec,
 * the zoom → limiting-magnitude curve, and the compact deep-sky-object table format. No DOM.
 *
 * Star tile file (`public/deep/stars/<order>/<pixel>.bin`, little-endian), one HEALPix nested pixel:
 *   u32 count · f32 R (tangent-plane half-range) · u16 ξ[count] · u16 η[count] · u8 mag[count] · i8 bv[count]
 * ξ/η are gnomonic (tangent-plane) coordinates about the pixel centre, quantised over [−R, R]: < 1″ error for
 * the pixel sizes used. mag = byte / 20 (0.05 steps). bv = byte / 50, −128 = unknown. Stars are sorted by
 * magnitude, brightest first, so the limiting magnitude is a draw count.
 */
import { pixPoint } from './healpix';

export const TILE_HEADER_BYTES = 8;
export const BV_UNKNOWN = -128;

/** Bands of the star tiles, as written to `public/deep/stars/index.json` by the pipeline. */
export interface DeepBand {
  /** Magnitudes in (min, max] */
  min: number;
  max: number;
  /** HEALPix order of this band's tiles (nside = 2^order) */
  order: number;
  /** Star count per pixel (0 = no file) */
  counts: number[];
}
export interface DeepIndex {
  version: number;
  /** Id offset for deep stars (`star:<id>`): id = idBase + band·2^26 + pixel·2^14 + index-in-tile */
  idBase: number;
  bands: DeepBand[];
  total: number;
  source: string;
}

export const DEEP_ID_BASE = 10_000_000;
/** Deep star id ↔ (band, pixel, index). Stable for one build of the tiles. */
export function deepStarId(band: number, pix: number, index: number): number {
  return DEEP_ID_BASE + band * 2 ** 26 + pix * 2 ** 14 + index;
}
export function parseDeepStarId(id: number): { band: number; pix: number; index: number } | null {
  if (!Number.isInteger(id) || id < DEEP_ID_BASE) return null;
  const r = id - DEEP_ID_BASE;
  const band = Math.floor(r / 2 ** 26);
  const rest = r - band * 2 ** 26;
  return { band, pix: Math.floor(rest / 2 ** 14), index: rest % 2 ** 14 };
}

/** Tangent basis at a unit vector c: east e = ẑ × c (normalised), north n = c × e. */
function basis(cx: number, cy: number, cz: number, out: Float64Array): void {
  let ex = -cy, ey = cx;
  const el = Math.hypot(ex, ey) || 1;
  ex /= el; ey /= el;
  out[0] = ex; out[1] = ey; out[2] = 0;
  out[3] = cy * 0 - cz * ey; out[4] = cz * ex - cx * 0; out[5] = cx * ey - cy * ex;
}

export interface TileStar { x: number; y: number; z: number; mag: number; bv?: number }

/** Encode one pixel's stars (already sorted by magnitude). */
export function encodeStarTile(order: number, pix: number, stars: TileStar[]): Uint8Array {
  const n = stars.length;
  const c = [0, 0, 0];
  pixPoint(order, pix, 0.5, 0.5, c);
  const b = new Float64Array(6);
  basis(c[0], c[1], c[2], b);
  const xi = new Float64Array(n), eta = new Float64Array(n);
  let R = 1e-9;
  for (let i = 0; i < n; i++) {
    const s = stars[i];
    const w = s.x * c[0] + s.y * c[1] + s.z * c[2];
    if (w <= 0.1) throw new Error(`star ${i} is too far from the centre of pixel ${pix}`);
    xi[i] = (s.x * b[0] + s.y * b[1] + s.z * b[2]) / w;
    eta[i] = (s.x * b[3] + s.y * b[4] + s.z * b[5]) / w;
    R = Math.max(R, Math.abs(xi[i]), Math.abs(eta[i]));
  }
  R *= 1.000001;
  const buf = new ArrayBuffer(TILE_HEADER_BYTES + n * 6);
  const dv = new DataView(buf);
  dv.setUint32(0, n, true);
  dv.setFloat32(4, R, true);
  const q = (v: number) => Math.max(0, Math.min(65535, Math.round(((v / R + 1) / 2) * 65535)));
  for (let i = 0; i < n; i++) {
    dv.setUint16(TILE_HEADER_BYTES + i * 2, q(xi[i]), true);
    dv.setUint16(TILE_HEADER_BYTES + n * 2 + i * 2, q(eta[i]), true);
    const s = stars[i];
    dv.setUint8(TILE_HEADER_BYTES + n * 4 + i, Math.max(0, Math.min(255, Math.round(s.mag * 20))));
    dv.setInt8(TILE_HEADER_BYTES + n * 5 + i, s.bv === undefined || !isFinite(s.bv) ? BV_UNKNOWN : Math.max(-127, Math.min(127, Math.round(s.bv * 50))));
  }
  return new Uint8Array(buf);
}

export interface DecodedTile {
  count: number;
  /** Unit vectors, 3 per star */
  pos: Float32Array;
  mag: Float32Array;
  /** B−V, NaN when unknown */
  bv: Float32Array;
}

/** Decode a star tile written by `encodeStarTile`. */
export function decodeStarTile(order: number, pix: number, data: ArrayBuffer | Uint8Array): DecodedTile {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = dv.getUint32(0, true);
  if (u8.byteLength < TILE_HEADER_BYTES + n * 6) throw new Error(`star tile ${order}/${pix} is truncated`);
  const R = dv.getFloat32(4, true);
  const c = [0, 0, 0];
  pixPoint(order, pix, 0.5, 0.5, c);
  const b = new Float64Array(6);
  basis(c[0], c[1], c[2], b);
  const pos = new Float32Array(n * 3), mag = new Float32Array(n), bv = new Float32Array(n);
  const k = (2 * R) / 65535;
  for (let i = 0; i < n; i++) {
    const xi = dv.getUint16(TILE_HEADER_BYTES + i * 2, true) * k - R;
    const eta = dv.getUint16(TILE_HEADER_BYTES + n * 2 + i * 2, true) * k - R;
    const x = c[0] + xi * b[0] + eta * b[3];
    const y = c[1] + xi * b[1] + eta * b[4];
    const z = c[2] + xi * b[2] + eta * b[5];
    const l = Math.hypot(x, y, z);
    pos[i * 3] = x / l; pos[i * 3 + 1] = y / l; pos[i * 3 + 2] = z / l;
    mag[i] = u8[TILE_HEADER_BYTES + n * 4 + i] / 20;
    const q = dv.getInt8(TILE_HEADER_BYTES + n * 5 + i);
    bv[i] = q === BV_UNKNOWN ? NaN : q / 50;
  }
  return { count: n, pos, mag, bv };
}

// ───────────── zoom → limiting magnitude ─────────────

/** Fields of view at or above this are untouched by the deep-sky layer. */
export const DEEP_FOV_REF = 50;
/** Magnitudes gained per tenfold zoom (like 5·log10 of a telescope's aperture ratio). */
export const DEEP_K = 5;
export const DEEP_MAX_MAG = 11;

/**
 * Faintest magnitude drawn with the deep-sky layer on: the naked-eye (Bortle) limit at wide fields, growing as you
 * zoom in, telescope-like: base + 5·log10(50° / fov) below a 50° field, capped at 11 (the catalogue's depth).
 * Never fainter-limited than `base` (a base above 11 is kept as it is).
 */
export function deepLimit(base: number, fov: number): number {
  if (!(fov < DEEP_FOV_REF)) return base;
  return Math.max(base, Math.min(DEEP_MAX_MAG, base + DEEP_K * Math.log10(DEEP_FOV_REF / Math.max(0.1, fov))));
}

// ───────────── deep-sky objects (public/deep/dsos.json) ─────────────

/** Column order of the rows in public/deep/dsos.json. */
export const DEEP_DSO_COLS = ['id', 'ra', 'dec', 'type', 'mag', 'maj', 'min', 'con', 'name', 'hubble', 'aka'] as const;
/** Type codes (index into this list) used in the `type` column. */
export const DEEP_DSO_TYPES = [
  'galaxy', 'open-cluster', 'globular-cluster', 'emission-nebula', 'reflection-nebula', 'planetary-nebula', 'supernova-remnant',
  'dark-nebula', 'nebula', 'cluster-with-nebula', 'star-cloud', 'double-star', 'asterism', 'other',
] as const;
/** One row: [id, ra, dec, typeCode, mag|null, majArcmin|null, minArcmin|null, con, name, hubbleType, aka (" · "-joined)] */
export type DeepDsoRow = [string, number, number, number, number | null, number | null, number | null, string, string, string, string];
export interface DeepDsoFile { version: number; cols: readonly string[]; types: readonly string[]; rows: DeepDsoRow[] }

/** Minimum equipment for a deep-sky object, the docs/DATA.md rule (dark sky assumed). */
export function equipForMag(mag: number | undefined): 'naked-eye' | 'binoculars' | 'small-telescope' | 'telescope' {
  if (mag === undefined) return 'telescope';
  if (mag <= 4.6) return 'naked-eye';
  if (mag <= 7.6) return 'binoculars';
  if (mag <= 10) return 'small-telescope';
  return 'telescope';
}
