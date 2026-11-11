/**
 * Validates authored content against the schemas and the catalog.
 *
 *   npm run validate                    everything + coverage report
 *   npm run validate -- Ori Tau         only files whose path contains one of these strings
 *   npm run validate -- --links         also fetch every story link and report any that do not resolve
 *
 * Exit code 1 if any error is found.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import { buildCatalog, type Catalog } from '../src/data/catalog';
import {
  asterismSchema,
  constellationContentSchema,
  lessonSchema,
  monthlyGuideSchema,
  objectBlurbFileSchema,
  pathUnitSchema,
  showerSchema,
} from '../src/content/schema';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const checkLinks = args.includes('--links');
const filters = args.filter((a) => !a.startsWith('--'));
const wanted = (file: string) => filters.length === 0 || filters.some((f) => file.includes(f));

const errors: string[] = [];
const warnings: string[] = [];
const err = (file: string, msg: string) => errors.push(`${file}: ${msg}`);
const warn = (file: string, msg: string) => warnings.push(`${file}: ${msg}`);
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// Catalog (optional while data is still being built)
let catalog: Catalog | null = null;
const dataDir = join(root, 'public/data');
if (['stars.json', 'constellations.json', 'dsos.json'].every((f) => existsSync(join(dataDir, f)))) {
  catalog = buildCatalog({ stars: readJson(join(dataDir, 'stars.json')), constellations: readJson(join(dataDir, 'constellations.json')), dsos: readJson(join(dataDir, 'dsos.json')) });
} else {
  console.warn('! public/data is incomplete — skipping target-reference checks');
}

const when = { date: new Date('2026-11-10T02:00:00Z'), observer: { name: 'Brooklyn', lat: 40.6782, lon: -73.9442, tz: 'America/New_York' } };
function checkRef(file: string, ref: string, where: string) {
  if (!catalog) return;
  if (!catalog.resolve(ref, when)) err(file, `unresolved target "${ref}" (${where})`);
}
/** Walk any JSON value: check every [[ref|label]] inline link and every string that looks like a TargetRef field. */
function walk(file: string, value: unknown, path: string) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\[\[([^\]|]+)\|([^\]]*)\]\]/g)) checkRef(file, m[1].trim(), `${path} inline link`);
    if (/\[\[[^\]]*$/.test(value) || /\[\[[^|\]]*\]\]/.test(value)) err(file, `malformed [[ref|label]] link at ${path}`);
    if (/^(star|dso|con|body|asterism|radec|altaz|point):/.test(value)) checkRef(file, value, path);
    if (/<\/?[a-z][^>]*>/i.test(value)) err(file, `HTML is not allowed in text (${path})`);
    if (/^#{1,6}\s|\n[-*]\s/.test(value)) warn(file, `markdown heading/list in text (${path})`);
  } else if (Array.isArray(value)) value.forEach((v, i) => walk(file, v, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(file, v, path ? `${path}.${k}` : k);
}
function parse<T>(file: string, schema: ZodType<T>, data: unknown): T | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    for (const issue of r.error.issues.slice(0, 12)) err(file, `${issue.path.join('.')}: ${issue.message}`);
    return null;
  }
  return r.data;
}
function uniqueIds(file: string, ids: string[], what: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) err(file, `duplicate ${what} id "${id}"`);
    seen.add(id);
  }
}

const contentDir = join(root, 'src/content');
const links: { file: string; url: string }[] = [];

// Constellations
const conDir = join(contentDir, 'constellations');
const conFiles = existsSync(conDir) ? readdirSync(conDir).filter((f) => f.endsWith('.json')) : [];
const conDone = new Set<string>();
let storyCount = 0;
let wordCount = 0;
for (const f of conFiles) {
  const file = `constellations/${f}`;
  const id = basename(f, '.json');
  conDone.add(id);
  if (!wanted(file)) continue;
  let data: unknown;
  try {
    data = readJson(join(conDir, f));
  } catch (e) {
    err(file, `invalid JSON: ${(e as Error).message}`);
    continue;
  }
  const c = parse(file, constellationContentSchema, data);
  walk(file, data, '');
  if (!c) continue;
  if (c.id !== id) err(file, `id "${c.id}" does not match file name`);
  if (catalog && !catalog.conById.has(c.id)) err(file, `"${c.id}" is not an IAU constellation abbreviation in the catalog`);
  if (c.kind === 'ancient' && c.stories.length === 0) warn(file, 'ancient constellation with no stories');
  uniqueIds(file, c.stories.map((s) => s.id), 'story');
  for (const s of c.stories) {
    storyCount++;
    wordCount += s.retelling.join(' ').split(/\s+/).length;
    if (!s.id.startsWith(`${c.id}-`)) err(file, `story id "${s.id}" must start with "${c.id}-"`);
    uniqueIds(file, s.questions.map((q) => q.id), `question (story ${s.id})`);
    for (const q of s.questions) if (new Set(q.choices).size !== 4) err(file, `story ${s.id} question ${q.id}: choices must be distinct`);
    const words = s.retelling.join(' ').split(/\s+/).length;
    if (words < 280) warn(file, `story ${s.id} retelling is short (${words} words)`);
    if (s.link) links.push({ file, url: s.link.url });
    else warn(file, `story ${s.id} has no link`);
  }
  for (const ms of c.mainStars) if (catalog && catalog.resolve(ms.ref)?.kind !== 'star') err(file, `mainStars ref "${ms.ref}" is not a star`);
}

// Lessons
const lessonDir = join(contentDir, 'lessons');
const lessonIds = new Set<string>();
for (const f of existsSync(lessonDir) ? readdirSync(lessonDir).filter((x) => x.endsWith('.json')) : []) {
  const file = `lessons/${f}`;
  lessonIds.add(basename(f, '.json'));
  if (!wanted(file)) continue;
  const data = readJson(join(lessonDir, f));
  const l = parse(file, lessonSchema, data);
  walk(file, data, '');
  if (!l) continue;
  if (l.id !== basename(f, '.json')) err(file, `id "${l.id}" does not match file name`);
  uniqueIds(file, l.questions.map((q) => q.id), 'question');
  if (!l.sections.some((s) => s.demo)) err(file, 'lesson has no interactive demo');
  for (const s of l.sections) for (const st of s.demo?.steps ?? []) for (const h of st.highlights ?? []) if (h.type === 'constellation' && catalog && !catalog.conById.has(h.id)) err(file, `highlight constellation "${h.id}" unknown`);
}

// Single-file collections
function collection<T>(name: string, schema: ZodType<T>): T[] {
  const p = join(contentDir, name);
  if (!existsSync(p)) return [];
  const data = readJson(p) as unknown[];
  if (!wanted(name)) return data as T[];
  walk(name, data, '');
  return data.map((d, i) => parse(`${name}[${i}]`, schema, d)).filter((x): x is T => x != null);
}
const asterisms = collection('asterisms.json', asterismSchema);
const monthly = collection('monthly.json', monthlyGuideSchema);
const showers = collection('showers.json', showerSchema);
const path = collection('path.json', pathUnitSchema);
uniqueIds('asterisms.json', asterisms.map((a) => a.id), 'asterism');
if (monthly.length && monthly.length !== 12) err('monthly.json', `expected 12 guides, found ${monthly.length}`);
for (const g of monthly) for (const c of g.featured) if (catalog && !catalog.conById.has(c)) err('monthly.json', `month ${g.month}: unknown constellation "${c}"`);
for (const s of showers) if (catalog && !catalog.conById.has(s.radiant.con)) err('showers.json', `${s.id}: unknown constellation "${s.radiant.con}"`);

// Object blurbs
const objDir = join(contentDir, 'objects');
let blurbCount = 0;
for (const f of existsSync(objDir) ? readdirSync(objDir).filter((x) => x.endsWith('.json')) : []) {
  const file = `objects/${f}`;
  if (!wanted(file)) continue;
  const data = readJson(join(objDir, f));
  const parsed = parse(file, objectBlurbFileSchema, data);
  walk(file, data, '');
  if (parsed) {
    blurbCount += Object.keys(parsed).length;
    for (const k of Object.keys(parsed)) checkRef(file, k, 'key');
  }
}

// Coverage
const coverage: string[] = [];
if (filters.length === 0) {
  const allCons = catalog ? catalog.constellations.map((c) => c.id) : path.flatMap((u) => u.constellations);
  const missingCons = allCons.filter((c) => !conDone.has(c));
  const pathCons = path.flatMap((u) => u.constellations);
  if (catalog) {
    const notInPath = allCons.filter((c) => !pathCons.includes(c));
    if (notInPath.length) err('path.json', `constellations missing from the path: ${notInPath.join(', ')}`);
    for (const c of pathCons) if (!catalog.conById.has(c)) err('path.json', `unknown constellation "${c}"`);
  }
  const asterismIds = new Set(asterisms.map((a) => a.id));
  const missingLessons = [...new Set(path.flatMap((u) => u.lessons))].filter((l) => !lessonIds.has(l));
  const missingAsterisms = [...new Set(path.flatMap((u) => u.asterisms))].filter((a) => !asterismIds.has(a));
  coverage.push(`constellation pages: ${conDone.size}/${allCons.length}${missingCons.length ? ` — missing: ${missingCons.join(', ')}` : ''}`);
  coverage.push(`stories: ${storyCount} (${wordCount.toLocaleString()} words of retelling)`);
  coverage.push(`lessons: ${lessonIds.size}${missingLessons.length ? ` — path references missing lessons: ${missingLessons.join(', ')}` : ''}`);
  coverage.push(`asterisms: ${asterisms.length}${missingAsterisms.length ? ` — path references missing asterisms: ${missingAsterisms.join(', ')}` : ''}`);
  coverage.push(`monthly guides: ${monthly.length}/12, meteor showers: ${showers.length}, object blurbs: ${blurbCount}`);
}

// Links
if (checkLinks) {
  const unique = [...new Map(links.map((l) => [l.url, l])).values()];
  console.log(`Checking ${unique.length} links…`);
  let i = 0;
  const worker = async () => {
    while (i < unique.length) {
      const l = unique[i++];
      try {
        const res = await fetch(l.url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'StarhopLinkCheck/1.0' } });
        if (!res.ok) err(l.file, `link does not resolve (${res.status}): ${l.url}`);
      } catch (e) {
        err(l.file, `link does not resolve (${(e as Error).name}): ${l.url}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
for (const c of coverage) console.log(`•     ${c}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
