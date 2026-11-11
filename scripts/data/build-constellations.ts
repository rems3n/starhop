/**
 * Constellations: d3-celestial (names, lines, boundaries, label positions) + authored table (English names, IAU areas)
 * + stars.json (figure stars) → public/data/constellations.json
 */
import * as Astronomy from 'astronomy-engine';
import { readFileSync } from 'node:fs';
import type { Constellation, Season, Star } from '../../src/types';
import { CON_TABLE, ZODIAC } from './constellation-table';
import { Report, type Vec3, download, fromVec, norm360, raDelta, round, sepDeg, toVec, wikitext } from './lib';

export const D3C_BASE = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/';

/** A line vertex snaps to a catalog star no further away than this (degrees). */
export const SNAP_RADIUS = 0.7;
/** Within this radius of a vertex the brightest star wins (handles close pairs listed separately in HYG). */
export const SNAP_TIGHT = 0.1;
export const MAIN_STAR_MAG = 4.6;
export const MAIN_STAR_MIN = 4;
export const MAIN_STAR_MAX = 14;
/** Stars of a neighbouring constellation that traditionally complete a figure and so count as main stars. */
export const SHARED_MAIN: Record<string, string> = { Peg: 'Alpheratz', Aur: 'Elnath' };
/** Boundary edges are subdivided so no step is longer than this (degrees). */
export const BOUNDARY_STEP = 1;

interface Feature<G> { id: string; properties: Record<string, unknown>; geometry: G }
interface FC<G> { features: Feature<G>[] }
type Pt = [number, number];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function seasonOf(ra: number, dec: number): Season {
  if (dec > 60) return 'north-circumpolar';
  if (dec < -45) return 'far-south';
  const h = norm360(ra) / 15;
  if (h >= 3 && h < 9) return 'winter';
  if (h >= 9 && h < 15) return 'spring';
  if (h >= 15 && h < 21) return 'summer';
  return 'autumn';
}

// IAU boundaries are arcs of constant RA or Dec in the B1875.0 frame, so they are densified there.
const B1875 = Astronomy.MakeTime(2405889.25855 - 2451545.0);
const J2000_TO_B1875 = Astronomy.Rotation_EQJ_EQD(B1875);
const B1875_TO_J2000 = Astronomy.Rotation_EQD_EQJ(B1875);
function rotate(rot: Astronomy.RotationMatrix, p: Pt): Pt {
  const v = toVec(p[0], p[1]);
  const out = Astronomy.RotateVector(rot, new Astronomy.Vector(v[0], v[1], v[2], B1875));
  return fromVec([out.x, out.y, out.z] as Vec3);
}

interface DensifyStats { edges: number; notAxisAligned: number; removed: number; detail: string[] }

/** Subdivide a closed ring. Returns an open list of points (the consumer closes it). */
export function densifyBoundary(ring: Pt[], stats: DensifyStats): Pt[] {
  const pts = ring.slice();
  // drop the repeated closing vertex
  if (pts.length > 1 && sepDeg(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]) < 1e-6) pts.pop();
  let old = pts.map((p) => rotate(J2000_TO_B1875, p));
  // Repair: a vertex whose two edges both run diagonally in B1875 is not a real boundary corner (d3-celestial has a few
  // hand-inserted points on the +88° parallel between Cepheus and Ursa Minor). Drop it; the arc is re-created below.
  const diagonal = (a: Pt, b: Pt) => Math.abs(b[1] - a[1]) > 0.05 && Math.abs(raDelta(a[0], b[0])) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180)) > 0.05;
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < old.length && old.length > 3; i++) {
      const prev = old[(i + old.length - 1) % old.length];
      const next = old[(i + 1) % old.length];
      if (diagonal(prev, old[i]) && diagonal(old[i], next)) {
        old = old.filter((_, k) => k !== i);
        pts.splice(i, 1);
        stats.removed++;
        changed = true;
        break;
      }
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = old[i];
    const b = old[(i + 1) % pts.length];
    const dRa = raDelta(a[0], b[0]);
    const dDec = b[1] - a[1];
    const midCos = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
    stats.edges++;
    // in B1875 every edge should run along a meridian or a parallel
    if (Math.abs(dDec) > 0.05 && Math.abs(dRa) * midCos > 0.05) {
      stats.notAxisAligned++;
      stats.detail.push(`(${a[0].toFixed(2)}, ${a[1].toFixed(2)})→(${b[0].toFixed(2)}, ${b[1].toFixed(2)})`);
    }
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dDec), Math.abs(dRa) * midCos, Math.abs(dRa) / 5) / BOUNDARY_STEP));
    out.push([round(pts[i][0], 4), round(pts[i][1], 4)]);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = rotate(B1875_TO_J2000, [norm360(a[0] + dRa * t), a[1] + dDec * t]);
      out.push([round(p[0], 4), round(p[1], 4)]);
    }
  }
  return out;
}

/** Area of a spherical polygon in square degrees (smaller of the two sides). */
export function polygonAreaSqDeg(ring: Pt[]): number {
  // sum of signed areas of triangles (pole, p_i, p_i+1) via the "line integral of (1 − sin dec) dRA" form
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dRa = raDelta(a[0], b[0]) * (Math.PI / 180);
    const s = (Math.sin((a[1] * Math.PI) / 180) + Math.sin((b[1] * Math.PI) / 180)) / 2;
    sum += dRa * (1 - s);
  }
  const sr = Math.abs(sum);
  const area = Math.min(sr, 4 * Math.PI - sr);
  return area * (180 / Math.PI) ** 2;
}

export interface ConstellationsResult { constellations: Constellation[]; wikiAreaRevid?: number }

export async function buildConstellations(stars: Star[], report: Report): Promise<ConstellationsResult> {
  const [pNames, pLines, pBounds] = [
    await download('d3c-constellations.json', D3C_BASE + 'constellations.json'),
    await download('d3c-constellations.lines.json', D3C_BASE + 'constellations.lines.json'),
    await download('d3c-constellations.bounds.json', D3C_BASE + 'constellations.bounds.json'),
  ];
  const names = readJson<FC<{ type: 'Point'; coordinates: Pt }>>(pNames);
  const lines = readJson<FC<{ type: 'MultiLineString'; coordinates: Pt[][] }>>(pLines);
  const bounds = readJson<FC<{ type: 'Polygon'; coordinates: Pt[][] }>>(pBounds);

  report.section('Constellations (d3-celestial)');

  // spatial index of stars: 1° declination bands
  const bands = new Map<number, Star[]>();
  for (const s of stars) {
    const k = Math.floor(s.dec);
    let arr = bands.get(k);
    if (!arr) bands.set(k, (arr = []));
    arr.push(s);
  }
  function near(ra: number, dec: number, radius: number): { star: Star; d: number }[] {
    const out: { star: Star; d: number }[] = [];
    for (let k = Math.floor(dec - radius); k <= Math.floor(dec + radius); k++) {
      for (const s of bands.get(k) ?? []) {
        const d = sepDeg(ra, dec, s.ra, s.dec);
        if (d <= radius) out.push({ star: s, d });
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }
  const starById = new Map(stars.map((s) => [s.id, s]));
  const brightestByCon = new Map<string, Star>();
  for (const s of stars) if (!brightestByCon.has(s.con)) brightestByCon.set(s.con, s); // stars are sorted by mag

  const unsnapped: string[] = [];
  const looseSnaps: string[] = [];
  const foreign: string[] = [];
  const mainExceptions: string[] = [];
  const stats: DensifyStats = { edges: 0, notAxisAligned: 0, removed: 0, detail: [] };
  const areaNotes: string[] = [];
  const out: Constellation[] = [];

  for (const row of CON_TABLE) {
    const nameFeatures = names.features.filter((f) => f.id === row.id);
    const lineFeatures = lines.features.filter((f) => f.id === row.id);
    const boundFeatures = bounds.features.filter((f) => f.id === row.id);
    if (!nameFeatures.length || !lineFeatures.length || !boundFeatures.length) throw new Error(`d3-celestial is missing data for ${row.id}`);
    const props = nameFeatures[0].properties;
    // Serpens has two entries ("Serpens Caput", "Serpens Cauda"); we publish one "Serpens".
    const name = row.id === 'Ser' ? 'Serpens' : String(props.name);
    const genitive = String(props.gen ?? '');
    if (!genitive) throw new Error(`No genitive for ${row.id}`);
    // Label anchor: d3-celestial's label position (for Serpens, the head — Serpens Caput — which is listed first).
    const anchor = nameFeatures[0].geometry.coordinates;
    const ra = round(norm360(anchor[0]), 2);
    const dec = round(anchor[1], 2);

    // lines + figure stars
    const figure = new Map<number, Star>();
    const polylines: Pt[][] = [];
    for (const f of lineFeatures) {
      for (const line of f.geometry.coordinates) {
        const poly: Pt[] = [];
        for (const [lon, lat] of line) {
          const vra = norm360(lon);
          const cands = near(vra, lat, SNAP_RADIUS);
          if (!cands.length) {
            unsnapped.push(`${row.id} (${vra.toFixed(3)}, ${lat.toFixed(3)})`);
            poly.push([round(vra, 4), round(lat, 4)]);
            continue;
          }
          const tight = cands.filter((c) => c.d <= SNAP_TIGHT);
          const pick = tight.length ? tight.reduce((a, b) => (b.star.mag < a.star.mag ? b : a)) : cands[0];
          figure.set(pick.star.id, pick.star);
          if (pick.d > SNAP_TIGHT) {
            looseSnaps.push(`${row.id} (${vra.toFixed(3)}, ${lat.toFixed(3)}) → ${pick.star.name ?? pick.star.desig} at ${pick.d.toFixed(2)}°`);
            poly.push([round(vra, 4), round(lat, 4)]);
          } else {
            // draw the line exactly through the star
            poly.push([round(pick.star.ra, 4), round(pick.star.dec, 4)]);
          }
        }
        polylines.push(poly);
      }
    }
    const figureStars = [...figure.values()].sort((a, b) => a.mag - b.mag || a.id - b.id);
    for (const s of figureStars) if (s.con !== row.id) foreign.push(`${row.id}: ${s.name ?? s.desig} (${s.con})`);

    // main stars
    // (stars the figure borrows from a neighbour do not count, except the two traditional shared stars)
    const own = figureStars.filter((s) => s.con === row.id || (s.name !== undefined && SHARED_MAIN[row.id] === s.name));
    let main = own.filter((s) => s.mag <= MAIN_STAR_MAG);
    if (main.length < MAIN_STAR_MIN) main = own.slice(0, MAIN_STAR_MIN);
    main = main.slice(0, MAIN_STAR_MAX);
    if (main.length < 3) mainExceptions.push(`${row.id}: only ${main.length} main star(s) (figure has ${figureStars.length} star(s))`);

    // boundary
    const boundary = boundFeatures.flatMap((f) => f.geometry.coordinates.map((ring) => densifyBoundary(ring.map(([lon, lat]) => [norm360(lon), lat] as Pt), stats)));
    const polyArea = boundary.reduce((a, r) => a + polygonAreaSqDeg(r), 0);
    if (Math.abs(polyArea - row.area) / row.area > 0.01) areaNotes.push(`${row.id}: polygon ${polyArea.toFixed(1)} vs IAU ${row.area}`);

    const brightest = brightestByCon.get(row.id);
    if (!brightest) throw new Error(`No stars in ${row.id}`);

    out.push({
      id: row.id,
      name,
      genitive,
      english: row.english,
      ra,
      dec,
      areaSqDeg: row.area,
      lines: polylines,
      figureStars: figureStars.map((s) => s.id),
      mainStars: main.map((s) => s.id),
      boundary,
      brightest: brightest.id,
      season: seasonOf(ra, dec),
      hemisphere: dec >= 0 ? 'N' : 'S',
      zodiac: ZODIAC.has(row.id),
    });
  }

  // checks
  if (out.length !== 88) throw new Error(`Expected 88 constellations, got ${out.length}`);
  const totalArea = CON_TABLE.reduce((a, r) => a + r.area, 0);
  report.note(`constellations: ${out.length}; sum of IAU areas ${totalArea.toFixed(3)} sq deg (whole sky = 41252.961)`);
  report.note(`boundary edges: ${stats.edges}; spurious vertices removed: ${stats.removed}; edges not along a B1875 meridian/parallel: ${stats.notAxisAligned}${stats.detail.length ? ' — B1875 ' + stats.detail.join('; ') : ''}`);
  report.note(`boundary points after densifying: ${out.reduce((a, c) => a + c.boundary.reduce((x, r) => x + r.length, 0), 0)}`);
  report.note(`polygon area differs from IAU area by > 1%: ${areaNotes.length ? areaNotes.join('; ') : 'none'}`);
  report.note(`line vertices that did not snap to a star within ${SNAP_RADIUS}°: ${unsnapped.length ? unsnapped.join('; ') : 'none'}`);
  report.note(`line vertices snapped between ${SNAP_TIGHT}° and ${SNAP_RADIUS}° (line keeps its own position): ${looseSnaps.length ? looseSnaps.join('; ') : 'none'}`);
  report.note(`figure stars that belong to another constellation: ${foreign.length ? foreign.join('; ') : 'none'}`);
  report.note(`constellations with fewer than 3 main stars: ${mainExceptions.length ? mainExceptions.join('; ') : 'none'}`);
  report.note(`main stars per constellation: ${out.map((c) => `${c.id} ${c.mainStars.length}`).join(', ')}`);
  for (const c of out) for (const id of [...c.figureStars, c.brightest]) if (!starById.has(id)) throw new Error(`${c.id}: star ${id} missing`);

  // cross-check areas against Wikipedia
  let wikiAreaRevid: number | undefined;
  try {
    const w = await wikitext('IAU_designated_constellations_by_area');
    wikiAreaRevid = w.revid;
    const diffs: string[] = [];
    let seen = 0;
    const table = w.text.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
    for (const chunk of table.split(/\n\|-/)) {
      // cells are separated by "||" on one line or start a new line with "|"
      const cells = chunk.trim().replace(/^\|/, '').split(/\|\||\n\|/).map((c) => c.trim());
      if (cells.length < 4 || !/^\d+$/.test(cells[0]) || !/^[A-Za-z]{3}$/.test(cells[1])) continue;
      const row = CON_TABLE.find((r) => r.id === cells[1]);
      if (!row) { diffs.push(`unknown ${cells[1]}`); continue; }
      seen++;
      if (Math.abs(row.area - Number(cells[3])) > 0.0005) diffs.push(`${cells[1]}: ours ${row.area}, Wikipedia ${cells[3]}`);
    }
    report.note(`area cross-check with Wikipedia (rev ${w.revid}): ${seen} rows compared, ${diffs.length ? 'DIFFERENCES: ' + diffs.join('; ') : 'all equal'}`);
    if (seen !== 88 || diffs.length) throw new Error(`Constellation areas do not match Wikipedia: ${seen} rows, ${diffs.join('; ')}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Constellation areas')) throw e;
    report.note(`area cross-check with Wikipedia SKIPPED: ${(e as Error).message}`);
  }
  return { constellations: out, wikiAreaRevid };
}
