/**
 * Constellation illustrations (`npx tsx scripts/data/build-art.ts`, also an optional step of `npm run data`).
 *
 * Source: Stellarium's "modern" sky culture (index.json + illustrations/*.png, 8-bit grayscale, the figure is the
 * luminance). Each image is pinned to the sky by three anchor stars given as Hipparcos numbers; we look those up
 * in our own star catalogue (stars.json `hip`) and store their J2000 RA/Dec, so the engine never needs HIP numbers.
 *
 * Output: public/art/<Abbr>.webp (longest side ≤ 512 px, grayscale, lossy WebP) and public/data/constellation-art.json
 * `[{ con, file, size: [w, h], anchors: [{ x, y, ra, dec } ×3] }]` with x/y in the output image's pixels.
 * Images are converted with ImageMagick (`convert`, already on the build machine); the PNGs are parsed by it only.
 */
import { parse } from 'csv-parse/sync';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Star } from '../../src/types';
import { HYG_URL } from './build-stars';
import { IAU88_SET, OUT_DIR, RAW_DIR, Report, download, round, writeJson, type WrittenFile } from './lib';

export const STELLARIUM_MODERN = 'https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern';
export const ART_DIR = join(OUT_DIR, '..', 'art');
/** Longest side of the published images (the engine's texture array is ART_SIZE × ART_SIZE) */
export const ART_SIZE = 512;

interface StelAnchor { pos: [number, number]; hip: number }
interface StelCon { id: string; image?: { file: string; size: [number, number]; anchors: StelAnchor[] } }

export interface ArtEntry {
  con: string;
  file: string;
  size: [number, number];
  anchors: { x: number; y: number; ra: number; dec: number }[];
}

export async function buildArt(stars: Star[], report: Report): Promise<{ art: ArtEntry[]; files: WrittenFile[]; totalBytes: number }> {
  report.section('Constellation illustrations (Stellarium modern sky culture)');
  const indexPath = await download('stellarium-modern-index.json', `${STELLARIUM_MODERN}/index.json`);
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { constellations: StelCon[] };
  const byHip = new Map<number, { ra: number; dec: number }>();
  for (const s of stars) if (s.hip) byHip.set(s.hip, s);
  // A few anchors are fainter than stars.json (mag > 6.5); stars-faint.json has no HIP numbers, so take those
  // positions straight from the HYG file the star build uses (same source, same J2000 coordinates).
  const need = new Set<number>();
  for (const c of index.constellations) for (const a of c.image?.anchors ?? []) if (!byHip.has(a.hip)) need.add(a.hip);
  if (need.size) {
    const hyg = parse(readFileSync(await download('hyg-v41.csv', HYG_URL)), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    for (const r of hyg) {
      const hip = Number(r.hip);
      if (!need.has(hip)) continue;
      byHip.set(hip, { ra: round(Number(r.ra) * 15, 5), dec: round(Number(r.dec), 5) });
      report.note(`anchor HIP ${hip} (mag ${r.mag}) taken from HYG directly: fainter than stars.json`);
    }
  }

  mkdirSync(ART_DIR, { recursive: true });
  const art: ArtEntry[] = [];
  const missing: string[] = [];
  let totalBytes = 0;
  for (const c of index.constellations) {
    const con = c.id.replace(/^CON modern /, '');
    if (!IAU88_SET.has(con)) {
      report.note(`skip ${c.id}: not an IAU abbreviation`);
      continue;
    }
    const img = c.image;
    if (!img) {
      missing.push(con);
      continue;
    }
    const base = img.file.replace(/^.*\//, '');
    if (!/^[a-z0-9-]+\.png$/.test(base)) throw new Error(`Unexpected image name ${img.file}`);
    const src = await download(`stellarium-art-${base}`, `${STELLARIUM_MODERN}/${img.file}`);

    const anchors: ArtEntry['anchors'] = [];
    const scale = ART_SIZE / Math.max(img.size[0], img.size[1]);
    const k = Math.min(1, scale);
    for (const a of img.anchors) {
      const s = byHip.get(a.hip);
      if (!s) {
        report.note(`UNRESOLVED anchor ${con} HIP ${a.hip}`);
        continue;
      }
      anchors.push({ x: round(a.pos[0] * k, 2), y: round(a.pos[1] * k, 2), ra: s.ra, dec: s.dec });
    }
    if (anchors.length !== 3) {
      report.note(`skip ${con}: ${anchors.length}/3 anchors resolved`);
      continue;
    }

    const w = Math.round(img.size[0] * k), h = Math.round(img.size[1] * k);
    const out = join(ART_DIR, `${con}.webp`);
    // gray, resized (Lanczos), slightly lifted blacks clamped to 0 so the background adds no light, lossy WebP
    execFileSync('convert', [
      src, '-colorspace', 'Gray', '-resize', `${w}x${h}!`, '-level', '4%,100%', '-strip',
      '-define', 'webp:method=6', '-quality', '72', out,
    ]);
    if (!existsSync(out)) throw new Error(`convert produced nothing for ${con}`);
    totalBytes += statSync(out).size;
    art.push({ con, file: `art/${con}.webp`, size: [w, h], anchors });
  }
  art.sort((a, b) => (a.con < b.con ? -1 : 1));
  report.note(`${art.length} illustrations, ${(totalBytes / 1024).toFixed(0)} KiB of WebP`);
  report.note(`no illustration in the source: ${missing.join(', ') || 'none'}`);
  const files = [writeJson('constellation-art.json', art)];
  return { art, files, totalBytes };
}

// Standalone run: uses the already-built public/data/stars.json.
if (process.argv[1] && /build-art\.ts$/.test(process.argv[1])) {
  const report = new Report();
  mkdirSync(RAW_DIR, { recursive: true });
  const stars = JSON.parse(readFileSync(join(OUT_DIR, 'stars.json'), 'utf8')) as Star[];
  buildArt(stars, report).then(
    () => console.log(report.toString()),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
