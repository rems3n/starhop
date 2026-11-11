import { describe, expect, it } from 'vitest';
import { ang2pixNest, npix, pix2RaDec, pixelBounds, pixelsInCone, pixPoint, raDecToPix } from '@/sky/healpix';

/** Deterministic pseudo-random numbers (mulberry32). */
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomDir = (r: () => number) => ({ z: r() * 2 - 1, phi: r() * Math.PI * 2 });

describe('HEALPix nested', () => {
  it('has 12·nside² pixels', () => {
    expect(npix(0)).toBe(12);
    expect(npix(3)).toBe(768);
    expect(npix(4)).toBe(3072);
  });

  it('pixel centre → pixel round-trips for every pixel at orders 0–5', () => {
    for (let order = 0; order <= 5; order++) {
      const v = [0, 0, 0];
      for (let p = 0; p < npix(order); p++) {
        pixPoint(order, p, 0.5, 0.5, v);
        expect(ang2pixNest(order, v[2], Math.atan2(v[1], v[0]))).toBe(p);
        const c = pix2RaDec(order, p);
        expect(raDecToPix(order, c.ra, c.dec)).toBe(p);
      }
    }
  });

  it('matches known base-pixel layout', () => {
    expect(ang2pixNest(0, 0, 0)).toBe(4); // equator at RA 0 is the centre of face 4
    expect(ang2pixNest(0, 0.99, 0.1)).toBe(0); // north polar cap, first quadrant
    expect(ang2pixNest(0, -0.99, 0.1)).toBe(8);
    expect(ang2pixNest(0, 0, Math.PI / 2)).toBe(5); // equator at RA 90° is the centre of face 5
    // children of a pixel share its index >> 2
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const d = randomDir(r);
      expect(ang2pixNest(5, d.z, d.phi) >> 2).toBe(ang2pixNest(4, d.z, d.phi));
    }
  });

  it('pixels have equal area (uniform random points fill them evenly)', () => {
    const r = rng(42);
    const order = 2;
    const counts = new Array(npix(order)).fill(0);
    const N = 192_000;
    for (let i = 0; i < N; i++) {
      const d = randomDir(r);
      counts[ang2pixNest(order, d.z, d.phi)]++;
    }
    const mean = N / npix(order);
    for (const c of counts) expect(Math.abs(c - mean)).toBeLessThan(mean * 0.12);
  });

  it('every point lies within its pixel’s bounding radius, and corners touch neighbours', () => {
    for (const order of [2, 3, 4]) {
      const b = pixelBounds(order);
      const r = rng(order);
      for (let i = 0; i < 20_000; i++) {
        const d = randomDir(r);
        const p = ang2pixNest(order, d.z, d.phi);
        const st = Math.sqrt(1 - d.z * d.z);
        const dot = st * Math.cos(d.phi) * b.centres[p * 3] + st * Math.sin(d.phi) * b.centres[p * 3 + 1] + d.z * b.centres[p * 3 + 2];
        expect(Math.acos(Math.min(1, dot))).toBeLessThanOrEqual(b.radius[p]);
      }
      // a point just inside each corner of pixel p belongs to p (pixPoint and ang2pix agree on the layout)
      const v = [0, 0, 0];
      for (let p = 0; p < npix(order); p += 7) {
        for (const [fx, fy] of [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]]) {
          pixPoint(order, p, fx, fy, v);
          expect(ang2pixNest(order, v[2], Math.atan2(v[1], v[0]))).toBe(p);
        }
      }
    }
  });

  it('cone selection covers every point of the cone', () => {
    const order = 3;
    const b = pixelBounds(order);
    const out = new Int32Array(npix(order));
    const r = rng(99);
    for (const half of [0.02, 0.09, 0.35, 1.2]) {
      for (let k = 0; k < 6; k++) {
        const c = randomDir(r);
        const st = Math.sqrt(1 - c.z * c.z);
        const cx = st * Math.cos(c.phi), cy = st * Math.sin(c.phi), cz = c.z;
        const n = pixelsInCone(b, cx, cy, cz, half, out);
        const set = new Set(Array.from(out.subarray(0, n)));
        // random points inside the cone
        for (let i = 0; i < 3000; i++) {
          const d = randomDir(r);
          const s2 = Math.sqrt(1 - d.z * d.z);
          const dot = s2 * Math.cos(d.phi) * cx + s2 * Math.sin(d.phi) * cy + d.z * cz;
          if (dot < Math.cos(half)) continue;
          expect(set.has(ang2pixNest(order, d.z, d.phi))).toBe(true);
        }
        // and the selection is not wildly larger than the cone: ≤ cone area / pixel area + a ring of edge pixels
        const coneArea = 2 * Math.PI * (1 - Math.cos(half));
        const pixArea = (4 * Math.PI) / npix(order);
        const edge = 2 * Math.PI * Math.sin(Math.min(half, Math.PI / 2)) / Math.sqrt(pixArea);
        expect(n).toBeLessThanOrEqual(Math.ceil(coneArea / pixArea + 3 * edge + 6));
      }
    }
  });
});
