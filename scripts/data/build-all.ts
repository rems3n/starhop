/**
 * `npm run data` — download the raw sources (cached in scripts/data/raw/) and write public/data/*.json.
 * Re-running with a warm cache produces byte-identical files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildConstellations, D3C_BASE } from './build-constellations';
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

  const files: WrittenFile[] = [
    writeJson('stars.json', stars),
    writeJson('stars-faint.json', faint),
    writeJson('constellations.json', constellations),
    writeJson('dsos.json', dsos),
    writeJson('milkyway.json', milkyWay),
  ];

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
    },
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
        usedFor: 'dsos.json: positions, types, magnitudes, sizes, Hubble types, names, constellations',
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
