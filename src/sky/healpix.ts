/**
 * HEALPix, nested scheme — just what the deep-sky tiles need: direction → pixel, pixel centre, pixel corners,
 * and a conservative bounding radius per pixel. Pure maths (no DOM); shared by the data pipeline
 * (scripts/data/build-deep.ts) and the engine's tile streaming (src/sky/deep.ts).
 *
 * Conventions: `z` = cos(colatitude) = sin(dec), `phi` = RA in radians (0..2π). A level-`order` map has
 * nside = 2^order and 12·nside² pixels of equal area. Formulas follow the reference healpix_base
 * (Górski et al. 2005).
 */

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

export function npix(order: number): number {
  return 12 << (2 * order);
}

/** Interleave the low 16 bits of v into the even bit positions. */
function spread(v: number): number {
  v &= 0xffff;
  v = (v | (v << 8)) & 0x00ff00ff;
  v = (v | (v << 4)) & 0x0f0f0f0f;
  v = (v | (v << 2)) & 0x33333333;
  v = (v | (v << 1)) & 0x55555555;
  return v;
}
/** Inverse of `spread`: collect the even bits. */
function compress(v: number): number {
  v &= 0x55555555;
  v = (v | (v >>> 1)) & 0x33333333;
  v = (v | (v >>> 2)) & 0x0f0f0f0f;
  v = (v | (v >>> 4)) & 0x00ff00ff;
  v = (v | (v >>> 8)) & 0x0000ffff;
  return v;
}

/** Nested pixel index of the direction (z = sin dec, phi = RA in radians). */
export function ang2pixNest(order: number, z: number, phi: number): number {
  const nside = 1 << order;
  const za = Math.abs(z);
  let tt = (phi % TWO_PI) / HALF_PI;
  if (tt < 0) tt += 4;
  if (tt >= 4) tt -= 4;
  let face: number, ix: number, iy: number;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt);
    const t2 = nside * z * 0.75;
    const jp = Math.floor(t1 - t2);
    const jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    face = ifp === ifm ? (ifp | 4) : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp));
    const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) {
      face = ntt;
      ix = nside - jm - 1;
      iy = nside - jp - 1;
    } else {
      face = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }
  return face * nside * nside + spread(ix) + (spread(iy) << 1);
}

/** Pixel index for RA/Dec in degrees. */
export function raDecToPix(order: number, raDeg: number, decDeg: number): number {
  return ang2pixNest(order, Math.sin((decDeg * Math.PI) / 180), (raDeg * Math.PI) / 180);
}

/**
 * Point inside pixel `pix` at fractional face offsets (fx, fy) ∈ [0,1]² — (0.5, 0.5) is the centre, the four
 * corners are (0|1, 0|1). Writes a J2000-style unit vector (x, y, z) into out[o..o+2].
 */
export function pixPoint(order: number, pix: number, fx: number, fy: number, out: ArrayLike<number> & { [i: number]: number }, o = 0): void {
  const nside = 1 << order;
  const npface = nside * nside;
  const face = Math.floor(pix / npface);
  const ipf = pix - face * npface;
  const x = (compress(ipf) + fx) / nside;
  const y = (compress(ipf >>> 1) + fy) / nside;
  const jr = JRLL[face] - x - y;
  let z: number, nr: number;
  if (jr < 1) {
    nr = jr;
    z = 1 - (nr * nr) / 3;
  } else if (jr > 3) {
    nr = 4 - jr;
    z = (nr * nr) / 3 - 1;
  } else {
    nr = 1;
    z = ((2 - jr) * 2) / 3;
  }
  let tmp = JPLL[face] * nr + x - y;
  if (tmp < 0) tmp += 8;
  if (tmp >= 8) tmp -= 8;
  const phi = nr < 1e-15 ? 0 : (0.5 * HALF_PI * tmp) / nr;
  const st = Math.sqrt(Math.max(0, 1 - z * z));
  out[o] = st * Math.cos(phi);
  out[o + 1] = st * Math.sin(phi);
  out[o + 2] = z;
}

/** Centre of a pixel as RA/Dec degrees. */
export function pix2RaDec(order: number, pix: number): { ra: number; dec: number } {
  const v = [0, 0, 0];
  pixPoint(order, pix, 0.5, 0.5, v);
  let ra = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  return { ra, dec: (Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180) / Math.PI };
}

/**
 * Centres (unit vectors, 3 per pixel) and a conservative bounding radius (radians) of every pixel at `order`.
 * The radius is the largest angle from the centre to any of 16 points on the pixel's boundary, plus 3 % —
 * HEALPix edges are curved, so the margin covers the bulge between sampled points.
 */
export function pixelBounds(order: number): { centres: Float64Array; radius: Float32Array } {
  const n = npix(order);
  const centres = new Float64Array(n * 3);
  const radius = new Float32Array(n);
  const p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pixPoint(order, i, 0.5, 0.5, centres, i * 3);
    const cx = centres[i * 3], cy = centres[i * 3 + 1], cz = centres[i * 3 + 2];
    let minDot = 1;
    for (let k = 0; k < 16; k++) {
      const s = (k % 4) / 4;
      const side = k >> 2;
      const fx = side === 0 ? s : side === 1 ? 1 : side === 2 ? 1 - s : 0;
      const fy = side === 0 ? 0 : side === 1 ? s : side === 2 ? 1 : 1 - s;
      pixPoint(order, i, fx, fy, p);
      const d = cx * p[0] + cy * p[1] + cz * p[2];
      if (d < minDot) minDot = d;
    }
    radius[i] = Math.acos(Math.max(-1, Math.min(1, minDot))) * 1.03;
  }
  return { centres, radius };
}

/**
 * Pixels at `order` that may intersect a cone (unit-vector centre, half-angle in radians). Writes indices into `out`
 * and returns how many. `bounds` comes from `pixelBounds(order)`; optional `skip(i, cosToCentre)` drops pixels (e.g. below
 * the horizon). Linear in the pixel count (3,072 at order 4): fine for "when the view settles", not for every frame.
 */
export function pixelsInCone(bounds: { centres: Float64Array; radius: Float32Array }, cx: number, cy: number, cz: number, halfAngle: number, out: Int32Array, skip?: (i: number) => boolean): number {
  const { centres, radius } = bounds;
  const n = radius.length;
  let k = 0;
  for (let i = 0; i < n && k < out.length; i++) {
    const r = halfAngle + radius[i];
    if (r >= Math.PI) {
      if (!skip || !skip(i)) out[k++] = i;
      continue;
    }
    const d = cx * centres[i * 3] + cy * centres[i * 3 + 1] + cz * centres[i * 3 + 2];
    if (d < Math.cos(r)) continue;
    if (skip && skip(i)) continue;
    out[k++] = i;
  }
  return k;
}
