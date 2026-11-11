/**
 * Deep sky (optional step, `--no-deep` skips): fainter stars from AT-HYG v4.0 (to magnitude 11) as HEALPix tiles,
 * and every remaining OpenNGC object, for the "Fainter stars and objects when zoomed in" layer.
 *
 *   public/deep/stars/index.json                 bands, HEALPix order, per-pixel star counts
 *   public/deep/stars/<order>/<pixel>.bin         render data (format in src/sky/deepcore.ts)
 *   public/deep/stars/<order>/<pixel>.json.gz     identity per star {d: designation, m: mag×100, l: distance ly (0 = none),
 *                                                 s: spectral type}, same order as the .bin;
 *                                                 fetched only when the learner clicks a deep star
 *   public/deep/dsos.json                         compact table of NGC/IC/addendum objects not in dsos.json
 *
 * Run alone: `npx tsx scripts/data/build-deep.ts` (needs public/data/dsos.json and the cached HYG/OpenNGC raws).
 */
import * as Astronomy from 'astronomy-engine';
import { parse } from 'csv-parse/sync';
import { createReadStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip, gzipSync } from 'node:zlib';
import { DEEP_DSO_COLS, DEEP_DSO_TYPES, encodeStarTile, type DeepDsoFile, type DeepDsoRow, type DeepIndex } from '../../src/sky/deepcore';
import { npix, raDecToPix } from '../../src/sky/healpix';
import type { Dso, DsoType } from '../../src/types';
import { HYG_URL, FAINT_LIMIT } from './build-stars';
import { ONGC_BASE, TYPE_MAP } from './build-dsos';
import { IAU88_SET, OUT_DIR, Report, download, dmsToDeg, hmsToDeg, num, roundSig } from './lib';

export const ATHYG_URL = 'https://codeberg.org/astronexus/athyg/media/branch/main/data/subsets/athyg_40_reduced_m11.csv.gz';
export const DEEP_DIR = join(OUT_DIR, '..', 'deep');
export const DEEP_MAX = 11.0;
/** Star bands: (min, max] magnitude and HEALPix order. See docs/DATA.md for why these orders. */
export const STAR_BANDS = [
  { min: FAINT_LIMIT, max: 9.5, order: 2 },
  { min: 9.5, max: DEEP_MAX, order: 3 },
];
const PC_TO_LY = 3.26156;
/** Positional match radius for deduplication against the stars we already ship, and the magnitude tolerance. */
export const DEDUPE_ARCSEC = 2;
export const DEDUPE_DMAG = 1.0;

type Row = Record<string, string>;

export interface ShippedStar { x: number; y: number; z: number; mag: number }

/**
 * Spatial hash of the stars already shipped (HYG, mag ≤ 7.6), for "is this AT-HYG star one we already draw?".
 * Cells are 0.001 rad (3.4′) cubes of the unit vector; a query looks at the 27 surrounding cells.
 */
export class ShippedIndex {
  private cells = new Map<number, ShippedStar[]>();
  readonly hip = new Set<number>();
  readonly hd = new Set<number>();
  private static key(ix: number, iy: number, iz: number): number {
    return ((ix + 1100) * 2203 + (iy + 1100)) * 2203 + (iz + 1100);
  }
  add(s: ShippedStar, hip?: number, hd?: number): void {
    if (hip) this.hip.add(hip);
    if (hd) this.hd.add(hd);
    const k = ShippedIndex.key(Math.floor(s.x * 1000), Math.floor(s.y * 1000), Math.floor(s.z * 1000));
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(s);
  }
  /** Nearest shipped star within `arcsec` whose magnitude is within `dmag`, or null. */
  near(x: number, y: number, z: number, mag: number, arcsec = DEDUPE_ARCSEC, dmag = DEDUPE_DMAG): ShippedStar | null {
    const ix = Math.floor(x * 1000), iy = Math.floor(y * 1000), iz = Math.floor(z * 1000);
    const minDot = Math.cos((arcsec / 3600) * (Math.PI / 180));
    let best: ShippedStar | null = null, bestDot = minDot;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cell = this.cells.get(ShippedIndex.key(ix + a, iy + b, iz + c));
      if (!cell) continue;
      for (const s of cell) {
        const d = s.x * x + s.y * y + s.z * z;
        if (d >= bestDot && Math.abs(s.mag - mag) <= dmag) { best = s; bestDot = d; }
      }
    }
    return best;
  }
}

/** Is an AT-HYG star a duplicate of a shipped one? By HIP or HD number first, else by position + magnitude. */
export function isDuplicate(idx: ShippedIndex, s: { hip?: number; hd?: number; x: number; y: number; z: number; mag: number }): 'hip' | 'hd' | 'pos' | null {
  if (s.hip && idx.hip.has(s.hip)) return 'hip';
  if (s.hd && idx.hd.has(s.hd)) return 'hd';
  if (idx.near(s.x, s.y, s.z, s.mag)) return 'pos';
  return null;
}

const vec = (raDeg: number, decDeg: number): [number, number, number] => {
  const a = (raDeg * Math.PI) / 180, d = (decDeg * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};

interface DeepStar {
  x: number; y: number; z: number; ra: number; dec: number; mag: number; bv?: number;
  desig: string; distLy?: number; sp?: string; athyg: number;
}

/** Designation: proper name, else HD, else HIP, else Tycho-2, else Gaia DR3, else the AT-HYG serial. */
export function designation(r: { proper?: string; hd?: string; hip?: string; tyc?: string; gaia?: string; id: string }): string {
  if (r.proper) return r.proper;
  if (r.hd) return `HD ${r.hd}`;
  if (r.hip) return `HIP ${r.hip}`;
  if (r.tyc) return `TYC ${r.tyc}`;
  if (r.gaia) return `Gaia DR3 ${r.gaia}`;
  return `AT-HYG ${r.id}`;
}

async function buildDeepStars(report: Report): Promise<{ files: number; bytes: number; metaBytes: number; total: number }> {
  report.section('Deep stars (AT-HYG v4.0, magnitude ≤ 11)');
  // What we already ship: every HYG v4.1 star with mag ≤ 7.6 (stars.json + stars-faint.json), minus the Sun.
  const hygPath = await download('hyg-v41.csv', HYG_URL);
  const hyg = parse(readFileSync(hygPath), { columns: true, skip_empty_lines: true }) as Row[];
  const shipped = new ShippedIndex();
  let nShipped = 0;
  for (const r of hyg) {
    const mag = Number(r.mag);
    if (r.id === '0' || !(mag <= FAINT_LIMIT)) continue;
    const [x, y, z] = vec(Number(r.ra) * 15, Number(r.dec));
    shipped.add({ x, y, z, mag }, num(r.hip), num(r.hd));
    nShipped++;
  }
  report.note(`shipped HYG stars used for deduplication: ${nShipped}`);

  const path = await download('athyg_40_reduced_m11.csv.gz', ATHYG_URL);
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  let cols: string[] = [];
  const stars: DeepStar[] = [];
  let near10 = 0, rows = 0, quoted = 0, tooFaint = 0, brightUnmatched = 0, sol = 0;
  const dup = { hip: 0, hd: 0, pos: 0 };
  const brightExamples: string[] = [];
  for await (const line of rl) {
    if (!cols.length) { cols = line.split(','); continue; }
    if (!line) continue;
    rows++;
    let f = line.split(',');
    if (f.length !== cols.length) {
      quoted++;
      f = (parse(line, { relax_quotes: true }) as string[][])[0];
    }
    const r: Row = {};
    for (let i = 0; i < cols.length; i++) r[cols[i]] = f[i] ?? '';
    if (r.hyg === '0' || r.proper === 'Sol') { sol++; continue; }
    const mag = Number(r.mag);
    if (!(mag <= DEEP_MAX)) { tooFaint++; continue; }
    const ra = Number(r.ra) * 15, dec = Number(r.dec);
    const [x, y, z] = vec(ra, dec);
    const hip = num(r.hip), hd = num(r.hd);
    const d = isDuplicate(shipped, { hip, hd, x, y, z, mag });
    if (d) { dup[d]++; continue; }
    if (shipped.near(x, y, z, mag, 10, 99)) near10++;
    if (mag <= FAINT_LIMIT) {
      // brighter than what the tiles hold but not in our HYG files: left out (it would pop in only when zoomed)
      brightUnmatched++;
      if (brightExamples.length < 8) brightExamples.push(`${designation({ ...r, id: r.id })} ${mag}`);
      continue;
    }
    const dist = Number(r.dist);
    const s: DeepStar = { x, y, z, ra, dec, mag, desig: designation({ ...r, id: r.id }), athyg: Number(r.id) };
    const ci = num(r.ci);
    if (ci !== undefined) s.bv = ci;
    if (r.dist_src.startsWith('G') && dist > 0 && dist < 100000) s.distLy = roundSig(dist * PC_TO_LY, 3);
    if (r.spect.trim()) s.sp = r.spect.trim();
    stars.push(s);
  }
  report.note(`AT-HYG rows: ${rows} (${quoted} needed quote-aware parsing); Sun skipped: ${sol}; fainter than ${DEEP_MAX} (nearby stars the subset keeps regardless of magnitude): ${tooFaint}`);
  report.note(`duplicates of shipped stars removed: by HIP ${dup.hip}, by HD ${dup.hd}, by position (≤ ${DEDUPE_ARCSEC}″, |Δmag| ≤ ${DEDUPE_DMAG}) ${dup.pos}`);
  report.note(`AT-HYG stars at mag ≤ ${FAINT_LIMIT} with no HYG match, left out: ${brightUnmatched} (e.g. ${brightExamples.join('; ')})`);
  report.note(`deep stars kept: ${stars.length}; of those, within 10″ of a shipped star (any magnitude; true close pairs or undetected duplicates): ${near10}`);

  rmSync(join(DEEP_DIR, 'stars'), { recursive: true, force: true });
  let files = 0, bytes = 0, metaBytes = 0, maxTile = 0;
  const index: DeepIndex = { version: 1, idBase: 10_000_000, bands: [], total: stars.length, source: 'AT-HYG v4.0 (athyg_40_reduced_m11), CC BY-SA 4.0' };
  STAR_BANDS.forEach((band, bi) => {
    const n = npix(band.order);
    const tiles: DeepStar[][] = Array.from({ length: n }, () => []);
    for (const s of stars) if (s.mag > band.min && s.mag <= band.max) tiles[raDecToPix(band.order, s.ra, s.dec)].push(s);
    const dir = join(DEEP_DIR, 'stars', String(band.order));
    mkdirSync(dir, { recursive: true });
    const counts: number[] = [];
    let inBand = 0, bandBytes = 0;
    for (let p = 0; p < n; p++) {
      const t = tiles[p];
      t.sort((a, b) => a.mag - b.mag || a.athyg - b.athyg);
      counts.push(t.length);
      inBand += t.length;
      if (!t.length) continue;
      if (t.length >= 2 ** 14) throw new Error(`tile ${band.order}/${p} has ${t.length} stars; the id scheme allows 16,383`);
      maxTile = Math.max(maxTile, t.length);
      const bin = encodeStarTile(band.order, p, t);
      writeFileSync(join(dir, `${p}.bin`), bin);
      const meta = { d: t.map((s) => s.desig), m: t.map((s) => Math.round(s.mag * 100)), l: t.map((s) => s.distLy ?? 0), s: t.map((s) => s.sp ?? '') };
      const gz = gzipSync(JSON.stringify(meta), { level: 9 });
      writeFileSync(join(dir, `${p}.json.gz`), gz);
      files += 2;
      bytes += bin.length;
      bandBytes += bin.length;
      metaBytes += gz.length;
    }
    const nonEmpty = counts.filter((c) => c > 0).length;
    const sorted = counts.filter((c) => c > 0).sort((a, b) => a - b);
    report.note(`band ${bi} (${band.min} < mag ≤ ${band.max}): ${inBand} stars in ${nonEmpty} of ${n} tiles (order ${band.order}, nside ${1 << band.order}); per tile median ${sorted[sorted.length >> 1]}, mean ${Math.round(inBand / nonEmpty)}, max ${sorted[sorted.length - 1]}; ${bandBytes} bytes`);
    index.bands.push({ min: band.min, max: band.max, order: band.order, counts });
  });
  const idx = JSON.stringify(index);
  writeFileSync(join(DEEP_DIR, 'stars', 'index.json'), idx);
  bytes += idx.length;
  report.note(`star tiles: ${files / 2} render files ${bytes} bytes, ${files / 2} identity files ${metaBytes} bytes (gzip on disk); largest tile ${maxTile} stars`);
  return { files, bytes, metaBytes, total: stars.length };
}

function compactId(name: string): string {
  const m = /^([A-Za-z]+)0*(\d+)(.*)$/.exec(name);
  if (!m) return name.replace(/\s+/g, '');
  const prefix = m[1] === 'Cl' ? 'Cr' : m[1];
  return `${prefix}${m[2]}${m[3].replace(/-0+(\d)/, '-$1').replace(/\s+/g, '')}`;
}
function displayId(name: string): string {
  const m = /^([A-Za-z]+)0*(\d+)(.*)$/.exec(name);
  if (!m) return name;
  const prefix = m[1] === 'Cl' ? 'Cr' : m[1];
  return `${prefix} ${m[2]}${m[3].replace(/-0+(\d)/, '-$1')}`;
}

async function buildDeepDsos(report: Report): Promise<{ bytes: number; count: number }> {
  report.section('Deep-sky objects, full OpenNGC (public/deep/dsos.json)');
  const pMain = await download('ongc-NGC.csv', ONGC_BASE + 'NGC.csv');
  const pAdd = await download('ongc-addendum.csv', ONGC_BASE + 'addendum.csv');
  const opts = { columns: true, delimiter: ';', quote: false, skip_empty_lines: true, relax_column_count: true } as const;
  const rows = [...(parse(readFileSync(pMain), opts) as Row[]), ...(parse(readFileSync(pAdd), opts) as Row[])];
  const main = JSON.parse(readFileSync(join(OUT_DIR, 'dsos.json'), 'utf8')) as Dso[];
  const key = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  const have = new Set<string>();
  for (const d of main) {
    have.add(key(d.id));
    for (const a of d.aka) have.add(key(a));
  }
  const skipped = { dupNonEx: 0, starsOther: 0, ned: 0, inMain: 0, noPos: 0 };
  const out: DeepDsoRow[] = [];
  const typeIdx = new Map<string, number>(DEEP_DSO_TYPES.map((t, i) => [t, i]));
  const byType = new Map<string, number>();
  for (const r of rows) {
    if (r.Type === 'Dup' || r.Type === 'NonEx') { skipped.dupNonEx++; continue; }
    if (TYPE_MAP[r.Type] === undefined) throw new Error(`Unknown OpenNGC type "${r.Type}" on ${r.Name}`);
    if (TYPE_MAP[r.Type] === null || r.Type === '**') { skipped.starsOther++; continue; }
    if (/ NED\d+$/.test(r.Name)) { skipped.ned++; continue; }
    const id = compactId(r.Name);
    const aka: string[] = [];
    for (const x of (r.NGC ?? '').split(',').filter(Boolean)) aka.push(`NGC ${Number(x) || x}`);
    for (const x of (r.IC ?? '').split(',').filter(Boolean)) aka.push(`IC ${Number(x) || x}`);
    if (have.has(key(id)) || aka.some((a) => have.has(key(a)))) { skipped.inMain++; continue; }
    const ra = hmsToDeg(r.RA), dec = dmsToDeg(r.Dec);
    if (!isFinite(ra) || !isFinite(dec)) { skipped.noPos++; continue; }
    let con = (r.Const ?? '').trim().replace(/^Se[12]$/, 'Ser');
    if (!IAU88_SET.has(con)) con = Astronomy.Constellation(ra / 15, dec).symbol;
    const type = TYPE_MAP[r.Type] as DsoType;
    const mag = num(r['V-Mag']) ?? num(r['B-Mag']);
    const maj = num(r.MajAx), min = num(r.MinAx);
    const name = (r['Common names'] ?? '').split(',')[0].trim();
    const disp = displayId(r.Name);
    out.push([
      id, Math.round(ra * 1e4) / 1e4, Math.round(dec * 1e4) / 1e4, typeIdx.get(type)!,
      mag === undefined ? null : Math.round(mag * 100) / 100,
      maj === undefined ? null : Math.round(maj * 100) / 100,
      min === undefined ? null : Math.round(min * 100) / 100,
      con, name, type === 'galaxy' ? (r.Hubble ?? '').trim() : '',
      aka.filter((a) => a.replace(/\s+/g, '') !== id && a !== disp).join(' · '),
    ]);
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  out.sort((a, b) => (a[4] ?? 99) - (b[4] ?? 99) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const ids = new Set<string>();
  for (const r of out) {
    if (ids.has(r[0])) throw new Error(`duplicate deep DSO id ${r[0]}`);
    ids.add(r[0]);
  }
  const file: DeepDsoFile = { version: 1, cols: DEEP_DSO_COLS, types: DEEP_DSO_TYPES, rows: out };
  // one row per line: readable diffs, same gzip size
  const text = `{"version":1,"cols":${JSON.stringify(file.cols)},"types":${JSON.stringify(file.types)},"rows":[\n${out.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  mkdirSync(DEEP_DIR, { recursive: true });
  writeFileSync(join(DEEP_DIR, 'dsos.json'), text);
  report.note(`OpenNGC rows: ${rows.length}; skipped: Dup/NonEx ${skipped.dupNonEx}, stars/doubles/novae/other ${skipped.starsOther}, NED sub-entries ${skipped.ned}, already in dsos.json ${skipped.inMain}, no position ${skipped.noPos}`);
  report.note(`deep dsos.json: ${out.length} objects, ${text.length} bytes (gzip ${gzipSync(text).length}); with magnitude ${out.filter((r) => r[4] != null).length}, with a name ${out.filter((r) => r[8]).length}`);
  report.note(`by type: ${[...byType].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return { bytes: text.length, count: out.length };
}

export async function buildDeep(report: Report): Promise<{ stars: number; dsos: number; starBytes: number; metaBytes: number; dsoBytes: number }> {
  const s = await buildDeepStars(report);
  const d = await buildDeepDsos(report);
  return { stars: s.total, dsos: d.count, starBytes: s.bytes, metaBytes: s.metaBytes, dsoBytes: d.bytes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = new Report();
  buildDeep(report).then((r) => {
    console.log(report.toString());
    console.log(r);
  }, (e) => {
    console.error(e);
    process.exit(1);
  });
}
