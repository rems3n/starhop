/**
 * The catalog: stars, constellations, deep-sky objects, Milky Way, images — plus `resolveTarget`,
 * which turns any TargetRef string into a position on the sky.
 *
 * Browser: `await loadCatalog()` (fetches public/data/*.json once, cached) or the `useCatalog()` hook.
 * Node (tests, validator): `buildCatalog(raw)` with JSON read from disk.
 */
import * as Astronomy from 'astronomy-engine';
import { useEffect, useState } from 'react';
import asterismsJson from '@/content/asterisms.json';
import type { BodyId, Constellation, Dso, FaintStars, MilkyWay, Observer, ResolvedTarget, SkyImage, Star } from '@/types';

export interface RawCatalog {
  stars: Star[];
  constellations: Constellation[];
  dsos: Dso[];
  milkyWay?: MilkyWay;
  images?: Record<string, SkyImage[]>;
}

export interface Catalog extends RawCatalog {
  starById: Map<number, Star>;
  /** Index of each star id in `stars` (which is sorted by magnitude) */
  starIndex: Map<number, number>;
  conById: Map<string, Constellation>;
  dsoById: Map<string, Dso>;
  images: Record<string, SkyImage[]>;
  /** Resolve a ref. Bodies, altaz: and point: refs need `when` (defaults: now, Brooklyn). Returns null if unknown. */
  resolve(ref: string, when?: { date: Date; observer: Observer }): ResolvedTarget | null;
  /** All refs that mean the same object, most canonical first — use for blurb/image lookup. */
  aliases(ref: string): string[];
  /** Images for an object (tries every alias). */
  imagesFor(ref: string): SkyImage[];
  /** Search by name/designation for the search box. */
  search(query: string, limit?: number): ResolvedTarget[];
}

export const BODIES: BodyId[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

const GREEK: [string, string, string][] = [
  ['α', 'alpha', 'alp'], ['β', 'beta', 'bet'], ['γ', 'gamma', 'gam'], ['δ', 'delta', 'del'], ['ε', 'epsilon', 'eps'], ['ζ', 'zeta', 'zet'],
  ['η', 'eta', 'eta'], ['θ', 'theta', 'the'], ['ι', 'iota', 'iot'], ['κ', 'kappa', 'kap'], ['λ', 'lambda', 'lam'], ['μ', 'mu', 'mu'],
  ['ν', 'nu', 'nu'], ['ξ', 'xi', 'xi'], ['ο', 'omicron', 'omi'], ['π', 'pi', 'pi'], ['ρ', 'rho', 'rho'], ['σ', 'sigma', 'sig'],
  ['τ', 'tau', 'tau'], ['υ', 'upsilon', 'ups'], ['φ', 'phi', 'phi'], ['χ', 'chi', 'chi'], ['ψ', 'psi', 'psi'], ['ω', 'omega', 'ome'],
];
const GREEK_LOOKUP = new Map<string, string>();
for (const [g, long, short] of GREEK) {
  GREEK_LOOKUP.set(g, g);
  GREEK_LOOKUP.set(long, g);
  GREEK_LOOKUP.set(short, g);
}
const SUPER: Record<string, string> = { '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6' };

/** Common names that differ from the IAU proper name in the star catalog. */
const STAR_ALIASES: Record<string, string> = {
  'alpha centauri': 'Rigil Kentaurus',
  'rigil kent': 'Rigil Kentaurus',
  'beta centauri': 'Hadar',
  'pole star': 'Polaris',
  'north star': 'Polaris',
  'dog star': 'Sirius',
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalise a Bayer/Flamsteed designation to "<greek><index> <con>" / "<number> <con>" lower-case key. */
function desigKey(s: string): string | null {
  const cleaned = s.trim().replace(/[¹²³⁴⁵⁶]/g, (c) => SUPER[c]);
  const m = /^([^\s\d]+|\d+)\s*-?\s*(\d)?\s+([A-Za-z]{3})$/.exec(cleaned);
  if (!m) return null;
  const head = m[1].toLowerCase();
  const con = m[3].toLowerCase();
  if (/^\d+$/.test(head)) return `${head} ${con}`;
  const g = GREEK_LOOKUP.get(head);
  if (!g) return null;
  return `${g}${m[2] ?? ''} ${con}`;
}

function sphToVec(raDeg: number, decDeg: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}
function vecToSph(v: [number, number, number]): { ra: number; dec: number } {
  const ra = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return { ra: (ra + 360) % 360, dec: (Math.asin(v[2] / Math.hypot(v[0], v[1], v[2])) * 180) / Math.PI };
}
/** Mean direction of a set of positions. */
export function centroid(points: { ra: number; dec: number }[]): { ra: number; dec: number } {
  const s: [number, number, number] = [0, 0, 0];
  for (const p of points) {
    const v = sphToVec(p.ra, p.dec);
    s[0] += v[0];
    s[1] += v[1];
    s[2] += v[2];
  }
  return vecToSph(s);
}
/** Angular separation in degrees. */
export function separation(a: { ra: number; dec: number }, b: { ra: number; dec: number }): number {
  const va = sphToVec(a.ra, a.dec);
  const vb = sphToVec(b.ra, b.dec);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

const DEFAULT_WHEN_OBSERVER: Observer = { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York' };

function bodyPosition(body: BodyId, date: Date, observer: Observer): { ra: number; dec: number } {
  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.elevationM ?? 0);
  const eq = Astronomy.Equator(body as Astronomy.Body, date, obs, false, true);
  return { ra: eq.ra * 15, dec: eq.dec };
}

function horizonToEqj(az: number, alt: number, date: Date, observer: Observer): { ra: number; dec: number } {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(observer.lat, observer.lon, observer.elevationM ?? 0);
  const hor = Astronomy.VectorFromHorizon(new Astronomy.Spherical(alt, az, 1), time, '');
  const eqj = Astronomy.RotateVector(Astronomy.Rotation_HOR_EQJ(time, obs), hor);
  const e = Astronomy.EquatorFromVector(eqj);
  return { ra: e.ra * 15, dec: e.dec };
}

interface AsterismLite { id: string; name: string; lines: string[][] }

export function buildCatalog(raw: RawCatalog): Catalog {
  const starById = new Map<number, Star>();
  const starIndex = new Map<number, number>();
  const starByName = new Map<string, Star>();
  const starByDesig = new Map<string, Star>();
  const starByHip = new Map<number, Star>();
  raw.stars.forEach((s, i) => {
    starById.set(s.id, s);
    starIndex.set(s.id, i);
    if (s.name && !starByName.has(norm(s.name))) starByName.set(norm(s.name), s);
    if (s.hip) starByHip.set(s.hip, s);
    if (s.bayer) {
      const k = desigKey(`${s.bayer} ${s.con}`);
      if (k && !starByDesig.has(k)) starByDesig.set(k, s);
      // "α Cen" also finds "α1 Cen": stars are sorted brightest first, so the bare letter maps to the brightest component.
      const bare = desigKey(`${s.bayer.replace(/\d+$/, '')} ${s.con}`);
      if (bare && !starByDesig.has(bare)) starByDesig.set(bare, s);
    }
    if (s.flam) {
      const k = `${s.flam} ${s.con.toLowerCase()}`;
      if (!starByDesig.has(k)) starByDesig.set(k, s);
    }
  });
  const conById = new Map(raw.constellations.map((c) => [c.id, c]));
  const conByLower = new Map(raw.constellations.flatMap((c) => [[c.id.toLowerCase(), c] as const, [norm(c.name), c] as const]));
  const dsoById = new Map<string, Dso>();
  const dsoByKey = new Map<string, Dso>();
  const dkey = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
  for (const d of raw.dsos) {
    dsoById.set(d.id, d);
    dsoByKey.set(dkey(d.id), d);
    if (d.messier) dsoByKey.set(`m${d.messier}`, d);
    if (d.caldwell) dsoByKey.set(`c${d.caldwell}`, d);
    for (const a of d.aka) if (!dsoByKey.has(dkey(a))) dsoByKey.set(dkey(a), d);
    if (d.name && !dsoByKey.has(dkey(d.name))) dsoByKey.set(dkey(d.name), d);
  }
  const asterisms = asterismsJson as unknown as AsterismLite[];
  const asterismById = new Map(asterisms.map((a) => [a.id, a]));
  const images = raw.images ?? {};

  function findStar(q: string): Star | null {
    const t = q.trim();
    if (/^\d+$/.test(t)) return starById.get(Number(t)) ?? null;
    let m = /^hip\s*(\d+)$/i.exec(t);
    if (m) return starByHip.get(Number(m[1])) ?? null;
    m = /^(hr|hd)\s*(\d+)$/i.exec(t);
    if (m) {
      const n = Number(m[2]);
      const key = m[1].toLowerCase() as 'hr' | 'hd';
      return raw.stars.find((s) => s[key] === n) ?? null;
    }
    const alias = STAR_ALIASES[norm(t)];
    if (alias) return findStar(alias);
    const byName = starByName.get(norm(t));
    if (byName) return byName;
    const k = desigKey(t);
    return (k && starByDesig.get(k)) || null;
  }

  function starTarget(s: Star): ResolvedTarget {
    return { kind: 'star', ref: `star:${s.id}`, name: s.name ?? s.desig, ra: s.ra, dec: s.dec, fov: 30, star: s };
  }
  function dsoTarget(d: Dso): ResolvedTarget {
    const size = d.sizeArcmin ? d.sizeArcmin[0] / 60 : 0.2;
    return { kind: 'dso', ref: `dso:${d.id}`, name: d.name ?? (d.messier ? `M${d.messier}` : d.aka[0] ?? d.id), ra: d.ra, dec: d.dec, fov: Math.min(40, Math.max(8, size * 12)), dso: d };
  }
  function conTarget(c: Constellation): ResolvedTarget {
    return { kind: 'constellation', ref: `con:${c.id}`, name: c.name, ra: c.ra, dec: c.dec, fov: Math.min(110, Math.max(35, Math.sqrt(c.areaSqDeg) * 2.6)), constellation: c };
  }

  function resolve(ref: string, when?: { date: Date; observer: Observer }): ResolvedTarget | null {
    const i = ref.indexOf(':');
    if (i < 0) return null;
    const scheme = ref.slice(0, i);
    const rest = ref.slice(i + 1).trim();
    const date = when?.date ?? new Date();
    const observer = when?.observer ?? DEFAULT_WHEN_OBSERVER;
    switch (scheme) {
      case 'star': {
        const s = findStar(rest);
        return s ? starTarget(s) : null;
      }
      case 'dso': {
        const d = dsoByKey.get(dkey(rest));
        return d ? dsoTarget(d) : null;
      }
      case 'con': {
        const c = conById.get(rest) ?? conByLower.get(norm(rest));
        return c ? conTarget(c) : null;
      }
      case 'body': {
        const b = BODIES.find((x) => x.toLowerCase() === rest.toLowerCase());
        if (!b) return null;
        const p = bodyPosition(b, date, observer);
        return { kind: 'body', ref: `body:${b}`, name: b, ra: p.ra, dec: p.dec, fov: 40, body: b };
      }
      case 'asterism': {
        const a = asterismById.get(rest);
        if (!a) return null;
        const pts = a.lines.flat().map((r) => resolve(r, when)).filter((t): t is ResolvedTarget => !!t);
        if (!pts.length) return null;
        const c = centroid(pts);
        const radius = Math.max(...pts.map((p) => separation(c, p)));
        return { kind: 'asterism', ref: `asterism:${a.id}`, name: a.name, ra: c.ra, dec: c.dec, fov: Math.min(150, Math.max(30, radius * 3)) };
      }
      case 'radec': {
        const [ra, dec] = rest.split(',').map(Number);
        if (!isFinite(ra) || !isFinite(dec)) return null;
        return { kind: 'point', ref, name: 'Point', ra, dec };
      }
      case 'altaz': {
        const [az, alt] = rest.split(',').map(Number);
        if (!isFinite(az) || !isFinite(alt)) return null;
        return { kind: 'point', ref, name: 'Point', ...horizonToEqj(az, alt, date, observer) };
      }
      case 'point': {
        const names: Record<string, string> = { zenith: 'Zenith', north: 'North', south: 'South', east: 'East', west: 'West', ncp: 'North celestial pole', scp: 'South celestial pole' };
        if (!(rest in names)) return null;
        if (rest === 'ncp') return { kind: 'point', ref, name: names[rest], ra: 0, dec: 90 };
        if (rest === 'scp') return { kind: 'point', ref, name: names[rest], ra: 0, dec: -90 };
        const azAlt: Record<string, [number, number]> = { zenith: [0, 90], north: [0, 0], east: [90, 0], south: [180, 0], west: [270, 0] };
        const [az, alt] = azAlt[rest];
        return { kind: 'point', ref, name: names[rest], ...horizonToEqj(az, alt, date, observer) };
      }
      default:
        return null;
    }
  }

  function aliases(ref: string): string[] {
    const t = resolve(ref);
    if (!t) return [ref];
    const out = [t.ref];
    if (t.star) {
      const s = t.star;
      if (s.name) out.push(`star:${s.name}`);
      if (s.bayer) out.push(`star:${s.bayer} ${s.con}`);
      if (s.flam) out.push(`star:${s.flam} ${s.con}`);
      if (s.hip) out.push(`star:HIP${s.hip}`);
    }
    if (t.dso) {
      const d = t.dso;
      if (d.messier) out.push(`dso:M${d.messier}`);
      if (d.caldwell) out.push(`dso:C${d.caldwell}`);
      for (const a of d.aka) out.push(`dso:${a.replace(/\s+/g, '')}`);
    }
    if (!out.includes(ref)) out.push(ref);
    return out;
  }

  const imagesLower = new Map(Object.entries(images).map(([k, v]) => [k.toLowerCase(), v]));
  function imagesFor(ref: string): SkyImage[] {
    for (const a of aliases(ref)) {
      const hit = imagesLower.get(a.toLowerCase());
      if (hit?.length) return hit;
    }
    return [];
  }

  function search(query: string, limit = 12): ResolvedTarget[] {
    const q = norm(query);
    if (!q) return [];
    const out: { t: ResolvedTarget; score: number }[] = [];
    const push = (t: ResolvedTarget, label: string, bonus: number) => {
      const l = label.toLowerCase();
      const at = l.indexOf(q);
      if (at < 0) return;
      out.push({ t, score: (l === q ? 0 : at === 0 ? 1 : 2) * 100 + bonus });
    };
    for (const b of BODIES) {
      if (!b.toLowerCase().includes(q)) continue;
      const t = resolve(`body:${b}`);
      if (t) push(t, b, 0);
    }
    for (const c of raw.constellations) {
      push(conTarget(c), c.name, 1);
      push(conTarget(c), c.english, 3);
      if (c.id.toLowerCase() === q) out.push({ t: conTarget(c), score: 2 });
    }
    for (const a of asterisms) {
      const t = resolve(`asterism:${a.id}`);
      if (t) push(t, a.name, 2);
    }
    for (const s of raw.stars) {
      if (s.name) push(starTarget(s), s.name, 4 + s.mag);
      else if (s.mag < 5.5) push(starTarget(s), s.desig, 20 + s.mag);
    }
    for (const d of raw.dsos) {
      const t = dsoTarget(d);
      if (d.name) push(t, d.name, 6);
      if (d.messier) push(t, `M${d.messier}`, 5), push(t, `Messier ${d.messier}`, 5);
      if (d.caldwell) push(t, `Caldwell ${d.caldwell}`, 9);
      push(t, d.id, 8);
      for (const a of d.aka) push(t, a, 10), push(t, a.replace(/\s+/g, ''), 10);
    }
    const exact = desigKey(query);
    if (exact && starByDesig.has(exact)) out.push({ t: starTarget(starByDesig.get(exact)!), score: -1 });
    const seen = new Set<string>();
    return out
      .sort((a, b) => a.score - b.score)
      .filter((o) => (seen.has(o.t.ref) ? false : (seen.add(o.t.ref), true)))
      .slice(0, limit)
      .map((o) => o.t);
  }

  return { ...raw, images, starById, starIndex, conById, dsoById, resolve, aliases, imagesFor, search };
}

// ───────────── Browser loading ─────────────
const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
async function getJson<T>(file: string, optional = false): Promise<T | undefined> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) {
    if (optional) return undefined;
    throw new Error(`Could not load data/${file} (${res.status})`);
  }
  try {
    return (await res.json()) as T;
  } catch (e) {
    // A dev server may answer a missing optional file with index.html (status 200).
    if (optional) return undefined;
    throw e;
  }
}

let catalogPromise: Promise<Catalog> | null = null;
export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= (async () => {
    const [stars, constellations, dsos, milkyWay, images] = await Promise.all([
      getJson<Star[]>('stars.json'),
      getJson<Constellation[]>('constellations.json'),
      getJson<Dso[]>('dsos.json'),
      getJson<MilkyWay>('milkyway.json', true),
      getJson<Record<string, SkyImage[]>>('images.json', true),
    ]);
    return buildCatalog({ stars: stars!, constellations: constellations!, dsos: dsos!, milkyWay, images });
  })();
  return catalogPromise;
}

let faintPromise: Promise<FaintStars | undefined> | null = null;
/** Stars fainter than 6.5 (for dark-sky Bortle classes). Loaded on demand. */
export function loadFaintStars(): Promise<FaintStars | undefined> {
  faintPromise ??= getJson<FaintStars>('stars-faint.json', true);
  return faintPromise;
}

/** React hook: the catalog, or null while loading. Throws load errors to the nearest error boundary. */
export function useCatalog(): Catalog | null {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => {
    let live = true;
    loadCatalog().then((c) => live && setCat(c), (e) => live && setErr(e));
    return () => {
      live = false;
    };
  }, []);
  if (err) throw err;
  return cat;
}
