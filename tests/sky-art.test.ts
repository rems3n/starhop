import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_ATLAS, ART_STRIDE, anchorMatrix, artAlpha, buildArtInstances, mapImagePoint, packArt, type ArtEntry } from '@/sky/art';
import { angleBetween, lonLatToVec } from '@/sky/camera';
import type { Star } from '@/types';

const DATA = join(__dirname, '..', 'public', 'data');
const art = JSON.parse(readFileSync(join(DATA, 'constellation-art.json'), 'utf8')) as ArtEntry[];
const stars = JSON.parse(readFileSync(join(DATA, 'stars.json'), 'utf8')) as Star[];
const byName = new Map(stars.filter((s) => s.name).map((s) => [s.name!, s]));

const vec = (ra: number, dec: number) => {
  const v = [0, 0, 0];
  lonLatToVec(ra, dec, v);
  return v;
};
const sep = (a: number[], b: number[]) => angleBetween(a[0], a[1], a[2], b[0], b[1], b[2]);

describe('constellation illustrations: anchor matrix', () => {
  const synthetic: ArtEntry['anchors'] = [
    { x: 100, y: 120, ra: 165.9, dec: 61.75 },
    { x: 400, y: 80, ra: 206.9, dec: 49.3 },
    { x: 260, y: 420, ra: 178.5, dec: 53.7 },
  ];

  it('maps each anchor pixel exactly onto its star', () => {
    const M = anchorMatrix(synthetic)!;
    expect(M).not.toBeNull();
    const out = [0, 0, 0];
    for (const a of synthetic) {
      const len = mapImagePoint(M, a.x, a.y, out);
      expect(len).toBeCloseTo(1, 9); // M·(x, y, 1) is already the unit vector, before normalising
      expect(sep(out, vec(a.ra, a.dec))).toBeLessThan(1e-7);
    }
  });

  it('puts a point inside the image triangle between the three stars', () => {
    const M = anchorMatrix(synthetic)!;
    const [a, b, c] = synthetic;
    const out = [0, 0, 0];
    mapImagePoint(M, (a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, out);
    const va = vec(a.ra, a.dec), vb = vec(b.ra, b.dec), vc = vec(c.ra, c.dec);
    // inside the spherical triangle: same side of all three great circles as the opposite vertex
    const side = (p: number[], q: number[], r: number[], x: number[]) => {
      const n = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
      return Math.sign(n[0] * r[0] + n[1] * r[1] + n[2] * r[2]) === Math.sign(n[0] * x[0] + n[1] * x[1] + n[2] * x[2]);
    };
    expect(side(va, vb, vc, out) && side(vb, vc, va, out) && side(vc, va, vb, out)).toBe(true);
    const maxSide = Math.max(sep(va, vb), sep(vb, vc), sep(vc, va));
    for (const v of [va, vb, vc]) expect(sep(out, v)).toBeLessThan(maxSide);
  });

  it('rejects collinear anchors', () => {
    expect(anchorMatrix([{ x: 0, y: 0, ra: 0, dec: 0 }, { x: 1, y: 1, ra: 10, dec: 0 }, { x: 2, y: 2, ra: 20, dec: 5 }])).toBeNull();
  });
});

describe('constellation illustrations: generated data', () => {
  it('has 85 figures with three resolved anchors each, in their own constellation area', () => {
    expect(art.length).toBe(85);
    for (const e of art) {
      expect(e.anchors).toHaveLength(3);
      expect(Math.max(...e.size)).toBeLessThanOrEqual(ART_ATLAS);
      for (const a of e.anchors) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThanOrEqual(e.size[0]);
        expect(a.y).toBeLessThanOrEqual(e.size[1]);
      }
      expect(anchorMatrix(e.anchors)).not.toBeNull();
    }
  });

  it('round-trips anchors for real figures, and the image centre falls near the figure', () => {
    for (const con of ['UMa', 'Ori', 'Sco', 'Cyg', 'Cru', 'Cen']) {
      const e = art.find((x) => x.con === con)!;
      const M = anchorMatrix(e.anchors)!;
      const out = [0, 0, 0];
      for (const a of e.anchors) {
        mapImagePoint(M, a.x, a.y, out);
        expect(sep(out, vec(a.ra, a.dec))).toBeLessThan(1e-6);
      }
      // the whole image spans a sensible piece of sky (2°–80° across) and does not fold over
      const c00 = [0, 0, 0], c11 = [0, 0, 0];
      mapImagePoint(M, 0, 0, c00);
      mapImagePoint(M, e.size[0], e.size[1], c11);
      const diag = sep(c00, c11);
      expect(diag).toBeGreaterThan(2);
      expect(diag).toBeLessThan(80);
    }
  });

  it('puts named stars inside their figure: the Big Dipper inside the bear, the belt inside Orion', () => {
    const inside = (con: string, starName: string) => {
      const e = art.find((x) => x.con === con)!;
      const M = anchorMatrix(e.anchors)!;
      // invert by a coarse search over the image grid: the closest grid point must be close to the star
      const s = byName.get(starName)!;
      const v = vec(s.ra, s.dec);
      let best = 1e9, bx = 0, by = 0;
      const out = [0, 0, 0];
      for (let y = 0; y <= e.size[1]; y += e.size[1] / 64) for (let x = 0; x <= e.size[0]; x += e.size[0] / 64) {
        mapImagePoint(M, x, y, out);
        const d = sep(out, v);
        if (d < best) { best = d; bx = x / e.size[0]; by = y / e.size[1]; }
      }
      return { best, bx, by };
    };
    for (const [con, name] of [['UMa', 'Dubhe'], ['UMa', 'Alkaid'], ['UMa', 'Mizar'], ['Ori', 'Alnilam'], ['Ori', 'Betelgeuse'], ['Ori', 'Rigel']] as const) {
      const r = inside(con, name);
      expect(r.best, `${name} on the ${con} image`).toBeLessThan(1);
      expect(r.bx).toBeGreaterThan(0.02);
      expect(r.bx).toBeLessThan(0.98);
      expect(r.by).toBeGreaterThan(0.02);
      expect(r.by).toBeLessThan(0.98);
    }
  });

  it('packs every image into the texture array without overlaps', () => {
    const { slots, layers } = packArt(art.map((e) => e.size));
    expect(layers).toBeLessThan(art.length);
    const seen: { layer: number; x: number; y: number; w: number; h: number }[] = [];
    art.forEach((e, i) => {
      const s = slots[i];
      expect(s.x + e.size[0]).toBeLessThanOrEqual(ART_ATLAS);
      expect(s.y + e.size[1]).toBeLessThanOrEqual(ART_ATLAS);
      for (const o of seen) {
        const overlap = o.layer === s.layer && s.x < o.x + o.w && o.x < s.x + e.size[0] && s.y < o.y + o.h && o.y < s.y + e.size[1];
        expect(overlap).toBe(false);
      }
      seen.push({ layer: s.layer, x: s.x, y: s.y, w: e.size[0], h: e.size[1] });
    });
    const { data, count } = buildArtInstances(art, slots);
    expect(data.length).toBe(count * ART_STRIDE);
    expect(count).toBeGreaterThan(art.length * 30);
    expect(count).toBeLessThan(40000);
  });

  it('fades with daylight and with very close or very wide fields', () => {
    expect(artAlpha(60, 0)).toBeGreaterThan(0.18);
    expect(artAlpha(60, 0)).toBeLessThan(0.4);
    expect(artAlpha(60, 1)).toBe(0);
    expect(artAlpha(2, 0)).toBe(0);
    expect(artAlpha(150, 0)).toBeLessThan(artAlpha(60, 0));
    expect(artAlpha(150, 0)).toBeGreaterThan(0.1);
  });
});
