import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildCatalog, deepDsosFromFile } from '@/data/catalog';
import { DEEP_FOV_REF, decodeStarTile, deepLimit, deepStarId, encodeStarTile, parseDeepStarId, type DeepDsoFile, type DeepIndex, type TileStar } from '@/sky/deepcore';
import { npix, pixPoint, raDecToPix } from '@/sky/healpix';
import { ShippedIndex, designation, isDuplicate } from '../scripts/data/build-deep';

const vec = (ra: number, dec: number) => {
  const a = (ra * Math.PI) / 180, d = (dec * Math.PI) / 180;
  return { x: Math.cos(d) * Math.cos(a), y: Math.cos(d) * Math.sin(a), z: Math.sin(d) };
};
/** Separation in arcseconds via the chord (acos is useless this close to 1 with Float32 vectors). */
const sepArcsec = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
  const la = Math.hypot(a.x, a.y, a.z), lb = Math.hypot(b.x, b.y, b.z);
  const chord = Math.hypot(a.x / la - b.x / lb, a.y / la - b.y / lb, a.z / la - b.z / lb);
  return (2 * Math.asin(chord / 2) * 180 * 3600) / Math.PI;
};

describe('star tile codec', () => {
  it('round-trips positions to < 1″, magnitudes to 0.05 and B−V to 0.02', () => {
    for (const order of [2, 3]) {
      for (const pix of [0, 5, npix(order) / 2 + 3, npix(order) - 1]) {
        const stars: TileStar[] = [];
        const v = [0, 0, 0];
        for (let i = 0; i < 300; i++) {
          pixPoint(order, pix, (i * 0.618) % 1, (i * 0.414) % 1, v);
          stars.push({ x: v[0], y: v[1], z: v[2], mag: 7.65 + (i / 300) * 3.3, bv: i % 7 === 0 ? undefined : -0.3 + (i % 50) / 20 });
        }
        const bin = encodeStarTile(order, pix, stars);
        expect(bin.byteLength).toBe(8 + 6 * stars.length);
        const d = decodeStarTile(order, pix, bin);
        expect(d.count).toBe(stars.length);
        for (let i = 0; i < stars.length; i++) {
          const p = { x: d.pos[i * 3], y: d.pos[i * 3 + 1], z: d.pos[i * 3 + 2] };
          expect(sepArcsec(p, stars[i])).toBeLessThan(1);
          expect(Math.abs(d.mag[i] - stars[i].mag)).toBeLessThanOrEqual(0.025 + 1e-6);
          if (stars[i].bv === undefined) expect(d.bv[i]).toBeNaN();
          else expect(Math.abs(d.bv[i] - stars[i].bv!)).toBeLessThanOrEqual(0.01 + 1e-6);
        }
      }
    }
  });

  it('handles an empty tile and rejects a truncated one', () => {
    const bin = encodeStarTile(3, 10, []);
    expect(decodeStarTile(3, 10, bin).count).toBe(0);
    const full = encodeStarTile(3, 10, [{ ...vec(0, 0), mag: 8 }].map((s) => { const v = [0, 0, 0]; pixPoint(3, 10, 0.5, 0.5, v); return { x: v[0], y: v[1], z: v[2], mag: s.mag }; }));
    expect(() => decodeStarTile(3, 10, full.slice(0, 10))).toThrow();
  });

  it('deep star ids round-trip and never collide with HYG ids', () => {
    for (const [b, p, i] of [[0, 0, 0], [0, 191, 4000], [1, 767, 16383], [1, 300, 12]]) {
      const id = deepStarId(b, p, i);
      expect(id).toBeGreaterThanOrEqual(10_000_000);
      expect(id).toBeLessThan(2 ** 31);
      expect(parseDeepStarId(id)).toEqual({ band: b, pix: p, index: i });
    }
    expect(parseDeepStarId(27989)).toBeNull();
  });
});

describe('limiting magnitude with zoom', () => {
  it('leaves wide views alone and reaches ~10–11 at 5°', () => {
    for (const base of [3.8, 5.3, 6.3, 7.6]) {
      expect(deepLimit(base, 160)).toBe(base);
      expect(deepLimit(base, 100)).toBe(base);
      expect(deepLimit(base, DEEP_FOV_REF)).toBe(base);
      let prev = base;
      for (let fov = 49; fov >= 1; fov -= 0.5) {
        const l = deepLimit(base, fov);
        expect(l).toBeGreaterThanOrEqual(prev);
        expect(l).toBeLessThanOrEqual(11);
        prev = l;
      }
    }
    expect(deepLimit(5.3, 5)).toBeCloseTo(10.3, 5);
    expect(deepLimit(6.3, 5)).toBeCloseTo(11, 5);
    expect(deepLimit(5.3, 2)).toBe(11);
    expect(deepLimit(5.3, 20)).toBeCloseTo(5.3 + 5 * Math.log10(2.5), 5);
  });
});

describe('deduplication against the shipped stars', () => {
  const idx = new ShippedIndex();
  const sirius = vec(101.287, -16.716);
  idx.add({ ...sirius, mag: 7.2 }, 32349, 48915);
  const other = vec(10, 40);
  idx.add({ ...other, mag: 7.5 });

  it('matches by HIP or HD number first', () => {
    expect(isDuplicate(idx, { hip: 32349, ...vec(0, 0), mag: 9 })).toBe('hip');
    expect(isDuplicate(idx, { hd: 48915, ...vec(0, 0), mag: 9 })).toBe('hd');
  });
  it('else by position within 2″ and a similar magnitude', () => {
    const near = vec(10 + 1.5 / 3600 / Math.cos((40 * Math.PI) / 180), 40); // 1.5″ east
    expect(isDuplicate(idx, { ...near, mag: 7.9 })).toBe('pos');
    expect(isDuplicate(idx, { ...near, mag: 9.5 })).toBeNull(); // a faint companion, not the same star
    const far = vec(10, 40 + 3 / 3600); // 3″ north
    expect(isDuplicate(idx, { ...far, mag: 7.6 })).toBeNull();
  });
  it('designation prefers proper name, HD, HIP, TYC', () => {
    expect(designation({ proper: 'Vega', hd: '1', id: '1' })).toBe('Vega');
    expect(designation({ hd: '224701', hip: '5', tyc: '1-2-1', id: '2' })).toBe('HD 224701');
    expect(designation({ hip: '12', tyc: '1-2-1', id: '2' })).toBe('HIP 12');
    expect(designation({ tyc: '4669-731-1', id: '2' })).toBe('TYC 4669-731-1');
  });
});

// Checks on the built files (skipped when public/deep has not been generated)
const deepDir = fileURLToPath(new URL('../public/deep/', import.meta.url));
const built = existsSync(`${deepDir}stars/index.json`);
describe.skipIf(!built)('built deep-sky files', () => {
  const index = built ? (JSON.parse(readFileSync(`${deepDir}stars/index.json`, 'utf8')) as DeepIndex) : null;
  it('bands cover 7.6 < mag ≤ 11 and every star sits in its own tile', () => {
    expect(index!.bands.map((b) => [b.min, b.max])).toEqual([[7.6, 9.5], [9.5, 11]]);
    let total = 0;
    for (const [bi, band] of index!.bands.entries()) {
      total += band.counts.reduce((a, b) => a + b, 0);
      for (const pix of [0, 100, band.counts.length - 1]) {
        const bin = readFileSync(`${deepDir}stars/${band.order}/${pix}.bin`);
        const d = decodeStarTile(band.order, pix, bin);
        expect(d.count).toBe(band.counts[pix]);
        for (let i = 0; i < d.count; i += 17) {
          const ra = (Math.atan2(d.pos[i * 3 + 1], d.pos[i * 3]) * 180) / Math.PI;
          const dec = (Math.asin(d.pos[i * 3 + 2]) * 180) / Math.PI;
          expect(raDecToPix(band.order, (ra + 360) % 360, dec)).toBe(pix);
          expect(d.mag[i]).toBeGreaterThan(band.min - 0.03);
          expect(d.mag[i]).toBeLessThanOrEqual(band.max + 0.03);
          if (i) expect(d.mag[i]).toBeGreaterThanOrEqual(d.mag[i - 1]);
        }
        const meta = JSON.parse(gunzipSync(readFileSync(`${deepDir}stars/${band.order}/${pix}.json.gz`)).toString('utf8'));
        expect(meta.d.length).toBe(d.count);
        expect(meta.m.length).toBe(d.count);
      }
      expect(bi).toBeLessThan(2);
    }
    expect(total).toBe(index!.total);
    expect(total).toBeGreaterThan(800_000);
  });

  it('deep-sky objects load into the catalog and resolve', () => {
    const file = JSON.parse(readFileSync(`${deepDir}dsos.json`, 'utf8')) as DeepDsoFile;
    const list = deepDsosFromFile(file);
    expect(list.length).toBeGreaterThan(10_000);
    const read = (f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${f}`, import.meta.url)), 'utf8'));
    const cat = buildCatalog({ stars: read('stars.json'), constellations: read('constellations.json'), dsos: read('dsos.json') });
    const mainIds = new Set(cat.dsos.map((d) => d.id));
    expect(cat.resolve('dso:NGC7331')).not.toBeNull(); // curated
    expect(cat.resolve('dso:NGC4062')).toBeNull();
    cat.registerDsos(list);
    expect(list.every((d) => !mainIds.has(d.id))).toBe(true);
    const t = cat.resolve('dso:NGC4062');
    expect(t?.dso?.type).toBe('galaxy');
    expect(t?.dso?.equip).toBe('telescope');
    expect(cat.resolve('dso:NGC 4062')?.ref).toBe('dso:NGC4062');
    expect(cat.search('NGC 4062', 5)[0]?.ref).toBe('dso:NGC4062');
    expect(cat.resolve('dso:M42')?.dso?.messier).toBe(42); // curated entries still win
    // a registered deep star resolves by id
    cat.registerStar({ id: deepStarId(1, 5, 3), ra: 1, dec: 2, mag: 10.2, con: 'Psc', desig: 'TYC 1-2-1' });
    expect(cat.resolve(`star:${deepStarId(1, 5, 3)}`)?.name).toBe('TYC 1-2-1');
  });
});
