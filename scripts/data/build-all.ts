/**
 * `npm run data` — download the raw sources (cached in scripts/data/raw/) and write public/data/*.json.
 * Re-running with a warm cache produces byte-identical files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildArt, STELLARIUM_MODERN } from './build-art';
import { buildConstellations, D3C_BASE } from './build-constellations';
import { buildDeep, ATHYG_URL } from './build-deep';
import { buildDsos, ONGC_BASE } from './build-dsos';
import { buildMilkyWay } from './build-milkyway';
import { buildStars, HYG_URL } from './build-stars';
import { RAW_DIR, Report, type WrittenFile, readManifest, writeJson } from './lib';

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  const report = new Report();
  console.log('Starhop data build');

  const { stars, faint, version: hygVersion } = await buildStars(report);
  const { constellations, wikiAreaRevid } = await buildConstellations(stars, report);
  const milkyWay = await buildMilkyWay(report);
  const { dsos, messierRevid, caldwellRevid } = await buildDsos(report);

  // Optional: constellation illustrations (needs ImageMagick `convert`; skipped with a note if it fails or with --no-art)
  let artCount = 0;
  const artFiles: WrittenFile[] = [];
  if (!process.argv.includes('--no-art')) {
    try {
      const r = await buildArt(stars, report);
      artCount = r.art.length;
      artFiles.push(...r.files);
    } catch (e) {
      report.note(`Constellation illustrations skipped: ${(e as Error).message}`);
    }
  }

  // Optional: deep sky (fainter stars to mag 11 as HEALPix tiles + the full NGC/IC list), public/deep/; --no-deep skips.
  // Runs after dsos.json is written (it leaves out objects already there), so it is done below.
  const files: WrittenFile[] = [
    writeJson('stars.json', stars),
    writeJson('stars-faint.json', faint),
    writeJson('constellations.json', constellations),
    writeJson('dsos.json', dsos),
    writeJson('milkyway.json', milkyWay),
    ...artFiles,
  ];

  let deep: Awaited<ReturnType<typeof buildDeep>> | null = null;
  if (!process.argv.includes('--no-deep')) {
    try {
      deep = await buildDeep(report);
    } catch (e) {
      report.note(`Deep sky skipped: ${(e as Error).message}`);
    }
  }

  // builtAt = when the newest raw file was downloaded, so a rebuild from the same cache is byte-identical
  const manifest = readManifest();
  const builtAt = Object.values(manifest).map((m) => m.fetchedAt).sort().pop() ?? new Date(0).toISOString();
  const hash = (name: string) => manifest[name]?.sha256.slice(0, 16);
  const meta = {
    builtAt,
    counts: {
      stars: stars.length,
      starsFaint: faint.ra.length,
      constellations: constellations.length,
      dsos: dsos.length,
      messier: dsos.filter((d) => d.messier).length,
      caldwell: dsos.filter((d) => d.caldwell).length,
      milkyWayLevels: milkyWay.levels.length,
      milkyWayPolygons: milkyWay.levels.reduce((a, l) => a + l.polygons.length, 0),
      constellationArt: artCount,
      deepStars: deep?.stars ?? 0,
      deepDsos: deep?.dsos ?? 0,
    },
    deepBytes: deep ? { starTiles: deep.starBytes, starIdentityGz: deep.metaBytes, dsos: deep.dsoBytes } : null,
    files: Object.fromEntries(files.map((f) => [f.file, { bytes: f.bytes, gzipBytes: f.gzipBytes }])),
    sources: [
      {
        name: 'HYG Database (David Nash / astronexus)',
        url: HYG_URL,
        licence: 'CC BY-SA 4.0',
        version: hygVersion,
        sha256: hash('hyg-v41.csv'),
        usedFor: 'stars.json, stars-faint.json',
      },
      {
        name: 'd3-celestial data (Olaf Frohn)',
        url: D3C_BASE,
        licence: 'BSD-3-Clause',
        version: 'master branch (commit not recorded; see sha256 of each file in scripts/data/raw/manifest.json)',
        sha256: hash('d3c-constellations.lines.json'),
        usedFor: 'constellation names, genitives, label positions, stick figures, IAU boundaries; Milky Way contours',
      },
      {
        name: 'OpenNGC (Mattia Verga)',
        url: ONGC_BASE,
        licence: 'CC BY-SA 4.0',
        version: 'master branch (commit not recorded)',
        sha256: hash('ongc-NGC.csv'),
        usedFor: 'dsos.json and public/deep/dsos.json (every other valid NGC/IC/addendum object): positions, types, magnitudes, sizes, Hubble types, names, constellations',
      },
      {
        name: 'AT-HYG v4.0 (David Nash / astronexus), magnitude-11 subset',
        url: ATHYG_URL,
        licence: 'CC BY-SA 4.0',
        version: 'v4.0 (athyg_40_reduced_m11.csv.gz)',
        sha256: hash('athyg_40_reduced_m11.csv.gz'),
        usedFor: 'public/deep/stars/: stars fainter than 7.6 down to 11 (Tycho-2 + Gaia DR3 + Hipparcos), designations, Gaia distances, spectral types',
      },
      {
        name: 'Wikipedia — Messier object (list table)',
        url: `https://en.wikipedia.org/w/index.php?title=Messier_object&oldid=${messierRevid}`,
        licence: 'CC BY-SA 4.0',
        version: `revision ${messierRevid}`,
        usedFor: 'Messier distances, article names, type hints, magnitude where OpenNGC has none',
      },
      {
        name: 'Wikipedia — Caldwell catalogue (list table)',
        url: `https://en.wikipedia.org/w/index.php?title=Caldwell_catalogue&oldid=${caldwellRevid}`,
        licence: 'CC BY-SA 4.0',
        version: `revision ${caldwellRevid}`,
        usedFor: 'Caldwell → NGC/IC mapping, distances, names and magnitudes where OpenNGC has none',
      },
      {
        name: 'Wikipedia — IAU designated constellations by area',
        url: 'https://en.wikipedia.org/wiki/IAU_designated_constellations_by_area',
        licence: 'CC BY-SA 4.0',
        version: wikiAreaRevid ? `revision ${wikiAreaRevid}` : 'not fetched',
        usedFor: 'cross-check of the authored IAU area table (no data copied beyond the check)',
      },
      {
        name: "Stellarium — 'modern' sky culture (constellation illustrations by Johan Meuris)",
        url: `${STELLARIUM_MODERN}/index.json`,
        licence: 'Illustrations: Free Art License; sky-culture data: CC BY-SA 4.0',
        version: 'master branch (commit not recorded)',
        sha256: hash('stellarium-modern-index.json'),
        usedFor: 'constellation-art.json (anchor stars) and public/art/*.webp (illustrations, resized and re-encoded)',
      },
      {
        name: 'astronomy-engine (Don Cross)',
        url: 'https://github.com/cosinekitty/astronomy',
        licence: 'MIT',
        version: 'npm dependency',
        usedFor: 'constellation lookup for positions, B1875 ↔ J2000 rotation for boundary densification',
      },
    ],
  };
  files.push(writeJson('meta.json', meta, true));

  report.section('Output files');
  for (const f of files) report.note(`${f.file.padEnd(22)} ${String(f.bytes).padStart(9)} bytes   gzip ${String(f.gzipBytes).padStart(8)}   sha256 ${f.sha256.slice(0, 12)}`);
  const text = report.toString();
  writeFileSync(join(RAW_DIR, 'build-report.txt'), text);
  console.log('\n' + text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
