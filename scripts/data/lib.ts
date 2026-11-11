/**
 * Shared helpers for the data pipeline: cached downloads, rounding, spherical maths, JSON output.
 * Downloaded files are untrusted data — they are only ever parsed (CSV / JSON / wikitext), never executed.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RAW_DIR = join(HERE, 'raw');
export const OUT_DIR = join(HERE, '..', '..', 'public', 'data');

export const USER_AGENT = 'StarhopDataPipeline/1.0 (educational planetarium build script; node-fetch)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ManifestEntry { url: string; fetchedAt: string; sha256: string; bytes: number }
type Manifest = Record<string, ManifestEntry>;
const MANIFEST_PATH = join(RAW_DIR, 'manifest.json');

export function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

let lastWikimedia = 0;

/**
 * Download `url` to scripts/data/raw/<name> unless it is already cached. Returns the file path.
 * Wikimedia hosts are throttled to one request every 1.5 s and retried on HTTP 429.
 */
export async function download(name: string, url: string): Promise<string> {
  mkdirSync(RAW_DIR, { recursive: true });
  const path = join(RAW_DIR, name);
  const manifest = readManifest();
  if (existsSync(path) && statSync(path).size > 0) {
    if (!manifest[name]) {
      const buf = readFileSync(path);
      manifest[name] = { url, fetchedAt: statSync(path).mtime.toISOString(), sha256: sha256(buf), bytes: buf.length };
      writeFileSync(MANIFEST_PATH, JSON.stringify(sortKeys(manifest), null, 1));
    }
    return path;
  }
  const wikimedia = /wiki[mp]edia\.org/.test(url);
  for (let attempt = 1; ; attempt++) {
    if (wikimedia) {
      const wait = lastWikimedia + 1500 - Date.now();
      if (wait > 0) await sleep(wait);
      lastWikimedia = Date.now();
    }
    console.log(`  download ${name}  ←  ${url}`);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error(`Empty response for ${url}`);
      writeFileSync(path, buf);
      manifest[name] = { url, fetchedAt: new Date().toISOString(), sha256: sha256(buf), bytes: buf.length };
      writeFileSync(MANIFEST_PATH, JSON.stringify(sortKeys(manifest), null, 1));
      return path;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      const retry = Number(res.headers.get('retry-after')) || 10 * attempt;
      console.log(`    HTTP ${res.status}; retrying in ${retry + 2}s`);
      await sleep((retry + 2) * 1000);
      continue;
    }
    throw new Error(`Download failed (${res.status}) for ${url}`);
  }
}

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** The wikitext of an English Wikipedia page, via the MediaWiki API (cached as wiki-<title>.json). */
export async function wikitext(title: string): Promise<{ text: string; revid: number; timestamp: string; title: string }> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content%7Cids%7Ctimestamp&rvslots=main' +
    `&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(title)}`;
  const path = await download(`wiki-${title}.json`, url);
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    query: { pages: { title: string; revisions: { revid: number; timestamp: string; slots: { main: { content: string } } }[] }[] };
  };
  const page = json.query.pages[0];
  const rev = page.revisions[0];
  return { text: rev.slots.main.content, revid: rev.revid, timestamp: rev.timestamp, title: page.title };
}

// ───────────── numbers ─────────────
export function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(x * f) / f;
  return r === 0 ? 0 : r; // no -0
}
export function roundSig(x: number, sig: number): number {
  if (x === 0 || !isFinite(x)) return x;
  const d = sig - 1 - Math.floor(Math.log10(Math.abs(x)));
  if (d >= 0) return round(x, d);
  const f = 10 ** -d;
  return Math.round(x / f) * f;
}
export function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return isFinite(n) ? n : undefined;
}
export const norm360 = (ra: number) => ((ra % 360) + 360) % 360;

// ───────────── sphere ─────────────
export type Vec3 = [number, number, number];
const D2R = Math.PI / 180;
export function toVec(ra: number, dec: number): Vec3 {
  const a = ra * D2R;
  const d = dec * D2R;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}
export function fromVec(v: Vec3): [number, number] {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [norm360(Math.atan2(v[1], v[0]) / D2R), Math.asin(Math.max(-1, Math.min(1, v[2] / r))) / D2R];
}
export function sepDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const a = toVec(ra1, dec1);
  const b = toVec(ra2, dec2);
  const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return (2 * Math.asin(Math.min(1, chord / 2))) / D2R;
}
/** Signed shortest RA difference b − a in (−180, 180]. */
export function raDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
/** "hh:mm:ss.s" → degrees */
export function hmsToDeg(s: string): number {
  const [h, m, sec] = s.split(':').map(Number);
  return (h + (m || 0) / 60 + (sec || 0) / 3600) * 15;
}
/** "+dd:mm:ss.s" → degrees */
export function dmsToDeg(s: string): number {
  const neg = s.trim().startsWith('-');
  const [d, m, sec] = s.replace(/^[+-]/, '').split(':').map(Number);
  const v = d + (m || 0) / 60 + (sec || 0) / 3600;
  return neg ? -v : v;
}

// ───────────── output ─────────────
export interface WrittenFile { file: string; bytes: number; gzipBytes: number; sha256: string }
export function writeJson(file: string, data: unknown, pretty = false): WrittenFile {
  mkdirSync(OUT_DIR, { recursive: true });
  const text = pretty ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(data);
  writeFileSync(join(OUT_DIR, file), text);
  const buf = Buffer.from(text);
  return { file, bytes: buf.length, gzipBytes: gzipSync(buf, { level: 9 }).length, sha256: sha256(buf) };
}

/** Collects human-readable notes during a build; printed at the end and saved to raw/build-report.txt. */
export class Report {
  lines: string[] = [];
  section(title: string) {
    this.lines.push('', `## ${title}`);
  }
  note(s: string) {
    this.lines.push(s);
  }
  toString() {
    return this.lines.join('\n').trimStart() + '\n';
  }
}

/** The 88 IAU constellation abbreviations. */
export const IAU88 = [
  'And', 'Ant', 'Aps', 'Aqr', 'Aql', 'Ara', 'Ari', 'Aur', 'Boo', 'Cae', 'Cam', 'Cnc', 'CVn', 'CMa', 'CMi', 'Cap', 'Car', 'Cas', 'Cen', 'Cep', 'Cet', 'Cha',
  'Cir', 'Col', 'Com', 'CrA', 'CrB', 'Crv', 'Crt', 'Cru', 'Cyg', 'Del', 'Dor', 'Dra', 'Equ', 'Eri', 'For', 'Gem', 'Gru', 'Her', 'Hor', 'Hya', 'Hyi', 'Ind',
  'Lac', 'Leo', 'LMi', 'Lep', 'Lib', 'Lup', 'Lyn', 'Lyr', 'Men', 'Mic', 'Mon', 'Mus', 'Nor', 'Oct', 'Oph', 'Ori', 'Pav', 'Peg', 'Per', 'Phe', 'Pic', 'Psc',
  'PsA', 'Pup', 'Pyx', 'Ret', 'Sge', 'Sgr', 'Sco', 'Scl', 'Sct', 'Ser', 'Sex', 'Tau', 'Tel', 'Tri', 'TrA', 'Tuc', 'UMa', 'UMi', 'Vel', 'Vir', 'Vol', 'Vul',
] as const;
export const IAU88_SET: ReadonlySet<string> = new Set(IAU88);
