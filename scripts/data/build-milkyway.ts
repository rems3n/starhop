/**
 * Milky Way brightness contours: d3-celestial mw.json → public/data/milkyway.json
 *
 * Source structure: five features "ol1" … "ol5" (ol1 = outermost and faintest, ol5 = innermost and brightest),
 * each a MultiPolygon whose rings are contour outlines. We keep every ring as one polygon of [ra, dec] and
 * thin the points (Douglas–Peucker on the unit sphere).
 */
import { readFileSync } from 'node:fs';
import type { MilkyWay } from '../../src/types';
import { D3C_BASE } from './build-constellations';
import { Report, type Vec3, download, norm360, round, toVec } from './lib';

/** Points closer than this to the simplified outline are dropped (degrees). */
export const MW_TOLERANCE = 0.06;
/** Rings with fewer points than this after thinning are dropped (specks). */
export const MW_MIN_POINTS = 4;

function distToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  let t = len2 === 0 ? 0 : (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

/** Douglas–Peucker on an open chain of unit vectors; tolerance is a chord length. */
function simplify(vecs: Vec3[], tol: number): number[] {
  const keep = new Uint8Array(vecs.length);
  keep[0] = keep[vecs.length - 1] = 1;
  const stack: [number, number][] = [[0, vecs.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = -1;
    let worstD = tol;
    for (let k = i + 1; k < j; k++) {
      const d = distToSegment(vecs[k], vecs[i], vecs[j]);
      if (d > worstD) { worstD = d; worst = k; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([i, worst], [worst, j]);
    }
  }
  const idx: number[] = [];
  keep.forEach((k, i) => { if (k) idx.push(i); });
  return idx;
}

interface MwFeature { id: string; geometry: { type: string; coordinates: [number, number][][][] } }

export async function buildMilkyWay(report: Report): Promise<MilkyWay> {
  const path = await download('d3c-mw.json', D3C_BASE + 'mw.json');
  const json = JSON.parse(readFileSync(path, 'utf8')) as { features: MwFeature[] };
  report.section('Milky Way (d3-celestial)');
  const tol = 2 * Math.sin((MW_TOLERANCE * Math.PI) / 360);
  const levels: MilkyWay['levels'] = [];
  for (const f of json.features) {
    const m = /^ol(\d)$/.exec(f.id);
    if (!m || f.geometry.type !== 'MultiPolygon') throw new Error(`Unexpected Milky Way feature ${f.id} (${f.geometry.type})`);
    const level = Number(m[1]);
    const polygons: [number, number][][] = [];
    let before = 0;
    let dropped = 0;
    for (const poly of f.geometry.coordinates) {
      for (const ring of poly) {
        const pts = ring.map(([lon, lat]) => [norm360(lon), lat] as [number, number]);
        // drop the repeated closing vertex
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        before += pts.length;
        // simplify as a closed chain: split at the point furthest from the first so both halves are anchored
        const vecs = pts.map((p) => toVec(p[0], p[1]));
        let far = 0;
        let farD = -1;
        vecs.forEach((v, i) => {
          const d = Math.hypot(v[0] - vecs[0][0], v[1] - vecs[0][1], v[2] - vecs[0][2]);
          if (d > farD) { farD = d; far = i; }
        });
        const first = simplify(vecs.slice(0, far + 1), tol);
        const second = simplify([...vecs.slice(far), vecs[0]], tol).map((i) => i + far);
        const idx = [...first, ...second.slice(1, -1)];
        if (idx.length < MW_MIN_POINTS) { dropped++; continue; }
        polygons.push(idx.map((i) => [round(pts[i][0], 2), round(pts[i][1], 2)]));
      }
    }
    // biggest outlines first; stable for equal sizes
    polygons.sort((a, b) => b.length - a.length);
    const after = polygons.reduce((a, p) => a + p.length, 0);
    report.note(`level ${level}: ${polygons.length} rings, ${before} → ${after} points (${dropped} specks dropped)`);
    levels.push({ level, polygons });
  }
  levels.sort((a, b) => a.level - b.level);
  if (levels.length !== 5) throw new Error(`Expected 5 Milky Way levels, got ${levels.length}`);
  return { levels };
}
