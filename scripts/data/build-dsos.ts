/**
 * Deep-sky objects: OpenNGC (NGC.csv + addendum.csv) + Wikipedia's Messier / Caldwell list tables
 * (Caldwell mapping, distances, a few names and magnitudes) → public/data/dsos.json
 */
import * as Astronomy from 'astronomy-engine';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import type { Dso, DsoType, Equipment } from '../../src/types';
import { IAU88_SET, Report, dmsToDeg, download, hmsToDeg, num, round, wikitext } from './lib';

export const ONGC_BASE = 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/';
/** Every NGC/IC/addendum object at least this bright is included. */
export const DSO_MAG_LIMIT = 10.0;

/** OpenNGC type code → DsoType. `null` = not a deep-sky object for our purposes (skipped unless Messier/Caldwell/forced). */
export const TYPE_MAP: Record<string, DsoType | null> = {
  G: 'galaxy', GPair: 'galaxy', GTrpl: 'galaxy', GGroup: 'galaxy',
  OCl: 'open-cluster', GCl: 'globular-cluster', 'Cl+N': 'cluster-with-nebula',
  PN: 'planetary-nebula', HII: 'emission-nebula', EmN: 'emission-nebula', RfN: 'reflection-nebula',
  SNR: 'supernova-remnant', DrkN: 'dark-nebula', Neb: 'nebula',
  '*Ass': 'asterism', '**': 'double-star',
  '*': null, Nova: null, Other: null, Dup: null, NonEx: null,
};
/** OpenNGC codes too vague to trust when Wikipedia's list gives a specific type for a Messier/Caldwell object. */
const VAGUE_TYPES = new Set(['Neb', '*Ass', 'Other']);

/** Famous objects that must be present whatever their catalogued magnitude (OpenNGC row names). */
export const FORCE_INCLUDE = [
  'ESO056-115', 'NGC0281', 'NGC1365', 'NGC0891', 'NGC4565', 'NGC6946', 'NGC2403', 'NGC6744', 'NGC0055', 'NGC0300', 'NGC4945', 'NGC1316', 'NGC0292', 'C041', 'C099', 'B033', 'IC0434', 'C014', 'NGC0869', 'NGC0884', 'NGC7000', 'NGC6960', 'NGC6992',
  'NGC2237', 'NGC2244', 'NGC7293', 'NGC1499', 'IC1805', 'IC1848', 'NGC2024', 'Cl399', 'NGC3372', 'NGC2070', 'NGC5139',
  'NGC0104', 'NGC4755', 'Mel111',
];

/** Ids for objects better known by another catalogue or a plain name (keyed by OpenNGC row name). */
const ID_OVERRIDES: Record<string, { id: string; aka: string[] }> = {
  'ESO056-115': { id: 'LMC', aka: ['ESO 56-115'] },
  NGC0292: { id: 'SMC', aka: ['NGC 292'] },
  C041: { id: 'Mel25', aka: ['Mel 25', 'Cr 50'] },
  Cl399: { id: 'Cr399', aka: ['Cr 399'] },
  C014: { id: 'C14', aka: ['NGC 869', 'NGC 884'] },
  C009: { id: 'C9', aka: ['Sh2-155'] },
  B033: { id: 'B33', aka: ['Barnard 33'] },
};

/** Common names where OpenNGC's first name is not the familiar one (keyed by our id). `null` removes a misleading name. */
const NAME_OVERRIDES: Record<string, string | null> = {
  LMC: 'Large Magellanic Cloud',
  SMC: 'Small Magellanic Cloud',
  NGC104: '47 Tucanae',
  NGC5139: 'Omega Centauri',
  NGC4755: 'Jewel Box',
  NGC2070: 'Tarantula Nebula',
  NGC2237: 'Rosette Nebula',
  NGC6960: 'Western Veil Nebula',
  NGC6992: 'Eastern Veil Nebula',
  NGC3372: 'Carina Nebula',
  Cr399: 'Coathanger',
  C14: 'Double Cluster',
  Mel25: 'Hyades',
  C99: 'Coalsack Nebula',
  B33: 'Horsehead Nebula',
  IC434: null, // OpenNGC calls it "Orion B", which is the name of the whole molecular cloud
  M40: 'Winnecke 4',
  NGC869: 'h Persei', // OpenNGC: "h Persei Cluster"
  NGC884: 'Chi Persei', // OpenNGC: "chi Persei Cluster"
  IC4604: 'Rho Ophiuchi Nebula', // OpenNGC: "rho Oph Nebula"
};

/** Visible without optical aid from a dark site even though the catalogue magnitude is missing or misleading. */
const NAKED_EYE_IDS = new Set(['LMC', 'SMC', 'Mel25', 'C99', 'Mel111']);

type Row = Record<string, string>;

interface WikiInfo { name?: string; type?: string; distKly?: number; mag?: number; desigs: string[] }

function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{(?:efn|sfn|refn)[\s\S]*?\}\}/g, '');
}
function plain(s: string): string {
  return s
    .replace(/\{\{shy\|([^}]*)\}\}/g, (_m, a: string) => a.replace(/\|/g, ''))
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function cellsOf(rowText: string): string[] {
  return rowText
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|-') && !l.startsWith('|}'))
    .map((l) => l.slice(1).trim())
    .filter((c) => !/^(style="[^"]*"\s*\|)?\s*\[\[(File|Image):/i.test(c));
}
function numberIn(cell: string): number | undefined {
  const t = plain(cell).replace(/,/g, '').replace(/^[~≈]/, '').replace('−', '-').trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
}
function wikiType(text: string): DsoType | undefined {
  const t = text.toLowerCase();
  if (t.includes('cluster') && t.includes('nebula')) return 'cluster-with-nebula';
  if (t.includes('supernova')) return 'supernova-remnant';
  if (t.includes('planetary')) return 'planetary-nebula';
  if (t.includes('dark neb')) return 'dark-nebula';
  if (t.includes('h ii')) return 'emission-nebula';
  if (t.includes('globular')) return 'globular-cluster';
  if (t.includes('star cloud')) return 'star-cloud';
  if (t.includes('cluster')) return 'open-cluster';
  if (t.includes('double')) return 'double-star';
  if (t.includes('asterism')) return 'asterism';
  if (/galaxy|spiral|elliptical|spheroid|lenticular/.test(t)) return 'galaxy';
  return undefined;
}

/** Parse the table on Wikipedia's "Messier object" page. Distances there are in thousands of light-years. */
export function parseMessierTable(text: string): Map<number, WikiInfo> {
  const out = new Map<number, WikiInfo>();
  for (const chunk of text.split('! scope="row" |').slice(1)) {
    const row = stripWiki(chunk.split('\n|}')[0]);
    const head = /\[\[([^\]|]+)\|M(\d+)\]\]/.exec(row.split('\n')[0]);
    if (!head) continue;
    const n = Number(head[2]);
    const cells = cellsOf(row); // [designation, common name, type, distance, constellation, magnitude, size, RA, Dec]
    if (cells.length < 6) continue;
    const info: WikiInfo = { desigs: [...cells[0].matchAll(/(NGC|IC)\s*(\d+)/g)].map((m) => `${m[1]} ${Number(m[2])}`) };
    if (!/^Messier \d+$/.test(head[1])) info.name = head[1];
    // "{{dsv|2540}} |2,430–2,650" → the sort value is the central estimate; "{{nts|37,000}}"; or a plain number
    const d = cells[3];
    const dsv = /\{\{(?:dsv|nts)\|([\d.,]+)\}\}/.exec(d);
    info.distKly = dsv ? Number(dsv[1].replace(/,/g, '')) : numberIn(d);
    info.type = plain(cells[2].replace(/^\{\{dsv\|[^}]*\}\}\s*\|/, ''));
    info.mag = numberIn(cells[5]);
    out.set(n, info);
  }
  return out;
}

/** Parse the table on Wikipedia's "Caldwell catalogue" page. Distances there are in thousands of light-years. */
export function parseCaldwellTable(text: string): Map<number, WikiInfo> {
  const out = new Map<number, WikiInfo>();
  for (const chunk of text.split(/\{\{hs\|\d+\}\}C(?=\d)/).slice(1)) {
    const row = stripWiki(chunk.split('\n|-')[0]);
    const lines = row.split('\n');
    const n = Number(lines[0].trim());
    if (!n) continue;
    const cells = cellsOf(lines.slice(1).join('\n')); // [designation, common name, type, distance, constellation, magnitude]
    const info: WikiInfo = { desigs: [...cells[0].matchAll(/(NGC|IC)\s*(\d+)/g)].map((m) => `${m[1]} ${Number(m[2])}`) };
    info.desigs = [...new Set(info.desigs)];
    const nm = plain(cells[1] ?? '').split(/,| or /)[0].trim();
    if (nm && !/^style=/.test(nm)) info.name = nm;
    // distance = first purely numeric cell after the designation; magnitude = last cell if numeric
    const rest = cells.slice(1);
    const di = rest.findIndex((c) => numberIn(c) !== undefined);
    if (di >= 0 && di < rest.length - 1) {
      info.distKly = numberIn(rest[di]);
      if (di > 0) info.type = plain(rest[di - 1]);
    }
    info.mag = numberIn(rest[rest.length - 1]);
    out.set(n, info);
  }
  return out;
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

export function equipmentFor(d: { id: string; mag?: number; type: DsoType }): Equipment {
  if (NAKED_EYE_IDS.has(d.id)) return 'naked-eye';
  if (d.mag === undefined) return 'telescope';
  if (d.mag <= 4.6) return 'naked-eye';
  if (d.mag <= 7.6) return 'binoculars';
  if (d.mag <= 10) return 'small-telescope';
  return 'telescope';
}

export interface DsosResult { dsos: Dso[]; messierRevid: number; caldwellRevid: number }

export async function buildDsos(report: Report): Promise<DsosResult> {
  const pMain = await download('ongc-NGC.csv', ONGC_BASE + 'NGC.csv');
  const pAdd = await download('ongc-addendum.csv', ONGC_BASE + 'addendum.csv');
  const wm = await wikitext('Messier_object');
  const wc = await wikitext('Caldwell_catalogue');
  const messierWiki = parseMessierTable(wm.text);
  const caldwellWiki = parseCaldwellTable(wc.text);
  report.section('Deep-sky objects (OpenNGC + Wikipedia lists)');
  if (messierWiki.size !== 110) throw new Error(`Wikipedia Messier table: expected 110 rows, parsed ${messierWiki.size}`);
  if (caldwellWiki.size !== 109) throw new Error(`Wikipedia Caldwell table: expected 109 rows, parsed ${caldwellWiki.size}`);

  const opts = { columns: true, delimiter: ';', quote: false, skip_empty_lines: true, relax_column_count: true } as const;
  const rows = [...(parse(readFileSync(pMain), opts) as Row[]), ...(parse(readFileSync(pAdd), opts) as Row[])];
  const byName = new Map(rows.map((r) => [r.Name, r]));
  report.note(`OpenNGC rows: ${rows.length}`);

  const pad = (cat: string, n: string | number) => `${cat}${String(Number(n)).padStart(4, '0')}`;
  /** Follow "Dup" rows to the entry that carries the data. */
  function follow(r: Row): Row | undefined {
    let cur: Row | undefined = r;
    for (let i = 0; i < 4 && cur && cur.Type === 'Dup'; i++) {
      const target: string | undefined = cur.NGC ? pad('NGC', cur.NGC.split(',')[0]) : cur.IC ? pad('IC', cur.IC.split(',')[0]) : undefined;
      cur = target ? byName.get(target) : undefined;
    }
    return cur && cur.Type !== 'Dup' && cur.Type !== 'NonEx' ? cur : undefined;
  }

  interface Pick { row: Row; requested?: string; messier?: number; caldwell?: number; forced?: boolean }
  const picks = new Map<string, Pick>(); // keyed by the OpenNGC row that carries the data
  const problems: string[] = [];
  const pickRow = (row: Row): Pick => {
    let p = picks.get(row.Name);
    if (!p) picks.set(row.Name, (p = { row }));
    return p;
  };

  // 1. Messier
  for (let n = 1; n <= 110; n++) {
    let row: Row | undefined;
    if (n === 102) row = byName.get('NGC5866'); // M102 is disputed; we follow the common identification with NGC 5866
    else row = rows.find((r) => r.M && Number(r.M) === n && r.Type !== 'Dup' && r.Type !== 'NonEx');
    if (!row) { problems.push(`M${n} not found in OpenNGC`); continue; }
    pickRow(row).messier = n;
    const w = messierWiki.get(n)!;
    const mine = /^(NGC|IC)(\d+)/.exec(row.Name);
    if (mine && w.desigs.length && !w.desigs.includes(`${mine[1]} ${Number(mine[2])}`)) problems.push(`M${n}: OpenNGC ${row.Name} vs Wikipedia ${w.desigs.join('/')}`);
  }

  // 2. Caldwell (mapping from Wikipedia; cross-checked with OpenNGC's own "C nnn" identifiers)
  const ongcCaldwell = new Map<number, string>();
  for (const r of rows) {
    const m = /(?:^|,)C (\d{3})(?:,|$)/.exec(r.Identifiers ?? '');
    if (m) ongcCaldwell.set(Number(m[1]), r.Name);
    const a = /^C(\d{3})$/.exec(r.Name);
    if (a) ongcCaldwell.set(Number(a[1]), r.Name);
  }
  for (let n = 1; n <= 109; n++) {
    const w = caldwellWiki.get(n)!;
    let row: Row | undefined;
    let requested: string | undefined;
    if (w.desigs.length === 1) {
      const [cat, numStr] = w.desigs[0].split(' ');
      requested = pad(cat, numStr);
      const r0 = byName.get(requested);
      row = r0 ? follow(r0) : undefined;
    } else {
      row = byName.get(`C${String(n).padStart(3, '0')}`); // addendum entries: C9 Cave, C14 Double Cluster, C41 Hyades, C99 Coalsack
    }
    if (!row) { problems.push(`C${n} (${w.desigs.join(' & ') || 'no NGC/IC'}) not found in OpenNGC`); continue; }
    const p = pickRow(row);
    p.caldwell = n;
    if (requested && requested !== row.Name) p.requested = requested;
    const theirs = ongcCaldwell.get(n);
    if (theirs && theirs !== row.Name && theirs !== requested) problems.push(`C${n}: Wikipedia → ${row.Name}, OpenNGC identifiers → ${theirs}`);
  }

  // 3. Famous objects
  const forcedAdded: string[] = [];
  for (const name of FORCE_INCLUDE) {
    const r0 = byName.get(name);
    const row = r0 ? follow(r0) : undefined;
    if (!row) { problems.push(`forced object ${name} not found in OpenNGC`); continue; }
    const had = picks.has(row.Name);
    const p = pickRow(row);
    if (row.Name !== name && !p.requested) p.requested = name;
    if (!had) { p.forced = true; forcedAdded.push(name); }
  }

  // 4. Everything else bright enough
  const magOf = (r: Row) => num(r['V-Mag']) ?? num(r['B-Mag']);
  let sweep = 0;
  const skippedStars: string[] = [];
  for (const r of rows) {
    if (picks.has(r.Name)) continue;
    const mag = magOf(r);
    if (mag === undefined || mag > DSO_MAG_LIMIT) continue;
    if (r.Type === 'Dup' || r.Type === 'NonEx') continue;
    if (TYPE_MAP[r.Type] === undefined) throw new Error(`Unknown OpenNGC type "${r.Type}" on ${r.Name}`);
    if (TYPE_MAP[r.Type] === null || r.Type === '**') { skippedStars.push(`${r.Name}(${r.Type})`); continue; } // stars, double stars, novae, "other"
    if (/ NED\d+$/.test(r.Name)) continue; // sub-components of a parent entry
    pickRow(r);
    sweep++;
  }

  // Build entries
  const dsos: Dso[] = [];
  const pickedForForced = new Set(forcedAdded);
  const noMag: string[] = [];
  const wikiMag: string[] = [];
  const bMag: string[] = [];
  const conFixed: string[] = [];
  const typeRefined: string[] = [];
  const noDist: string[] = [];
  for (const p of picks.values()) {
    const r = p.row;
    const w = p.messier ? messierWiki.get(p.messier) : p.caldwell ? caldwellWiki.get(p.caldwell) : undefined;
    const override = ID_OVERRIDES[r.Name];
    const baseName = p.requested ?? r.Name;
    const id = p.messier ? `M${p.messier}` : override ? override.id : compactId(baseName);

    // other designations
    const aka: string[] = [];
    const add = (s: string) => { if (s && !aka.includes(s) && s.replace(/\s+/g, '') !== id) aka.push(s); };
    if (override) override.aka.forEach(add);
    if (p.requested) add(displayId(p.requested));
    if (!override || p.messier) { if (/^(NGC|IC|Mel|B|H|ESO|PGC|UGC|HCG|MWSC|Cl)\d/.test(r.Name)) add(displayId(r.Name)); }
    for (const x of (r.NGC ?? '').split(',').filter(Boolean)) add(`NGC ${Number(x) || x}`);
    for (const x of (r.IC ?? '').split(',').filter(Boolean)) add(`IC ${Number(x) || x}`);
    for (const ident of (r.Identifiers ?? '').split(',')) {
      let m = /^Mel 0*(\d+)$/.exec(ident.trim());
      if (m) add(`Mel ${m[1]}`);
      m = /^Cl 0*(\d+)$/.exec(ident.trim());
      if (m) add(`Cr ${m[1]}`);
      m = /^SH 2-0*(\d+)$/.exec(ident.trim());
      if (m) add(`Sh2-${m[1]}`);
    }

    // type
    let type: DsoType = TYPE_MAP[r.Type] ?? 'other';
    if (w?.type && (VAGUE_TYPES.has(r.Type) || TYPE_MAP[r.Type] === null)) {
      const wt = wikiType(w.type);
      if (wt && wt !== type) { typeRefined.push(`${id}: ${r.Type} → ${wt} ("${w.type}")`); type = wt; }
    }

    // magnitude: V, else B, else (Messier/Caldwell only) the Wikipedia list value
    let mag = num(r['V-Mag']);
    if (mag === undefined && num(r['B-Mag']) !== undefined) { mag = num(r['B-Mag']); bMag.push(id); }
    if (mag === undefined && w?.mag !== undefined) { mag = w.mag; wikiMag.push(`${id}=${w.mag}`); }
    if (mag === undefined) noMag.push(id);

    // name
    const ongcName = (r['Common names'] ?? '').split(',')[0].trim() || undefined;
    // Messier: the Wikipedia article title when the object has a named article; Caldwell: the name in Wikipedia's list;
    // otherwise OpenNGC's first common name.
    let name: string | undefined = w?.name ?? ongcName;
    if (id in NAME_OVERRIDES) name = NAME_OVERRIDES[id] ?? undefined;

    // constellation
    let con = (r.Const ?? '').trim().replace(/^Se[12]$/, 'Ser');
    const ra = hmsToDeg(r.RA);
    const dec = dmsToDeg(r.Dec);
    if (!isFinite(ra) || !isFinite(dec)) { problems.push(`${id}: no position`); continue; }
    if (!IAU88_SET.has(con)) { con = Astronomy.Constellation(ra / 15, dec).symbol; conFixed.push(`${id}→${con}`); }

    const maj = num(r.MajAx);
    const min = num(r.MinAx);
    const distLy = w?.distKly !== undefined ? Math.round(w.distKly * 1000) : undefined;
    if ((p.messier || p.caldwell) && distLy === undefined) noDist.push(id);

    const d: Dso = { id, aka, type, ra: round(ra, 4), dec: round(dec, 4), con, equip: 'telescope' };
    if (name) d.name = name;
    if (p.messier) d.messier = p.messier;
    if (p.caldwell) d.caldwell = p.caldwell;
    if (type === 'galaxy' && r.Hubble?.trim()) d.typeDetail = r.Hubble.trim();
    if (mag !== undefined) d.mag = round(mag, 2);
    if (maj !== undefined) d.sizeArcmin = [round(maj, 2), round(min ?? maj, 2)];
    if (distLy !== undefined) d.distLy = distLy;
    d.equip = equipmentFor(d);
    dsos.push(d);
  }

  // A Messier/Caldwell object owns its common name: the same name on a neighbouring catalogue entry
  // (IC 4703 "Eagle Nebula" next to M16, NGC 2238 "Rosette Nebula" next to C49) is dropped so name lookups are unambiguous.
  const owned = new Set(dsos.filter((d) => (d.messier || d.caldwell) && d.name).map((d) => d.name!.toLowerCase()));
  const namesDropped: string[] = [];
  for (const d of dsos) {
    if (!d.messier && !d.caldwell && d.name && owned.has(d.name.toLowerCase())) {
      namesDropped.push(`${d.id} ("${d.name}")`);
      delete d.name;
    }
  }

  // sort: brightest first, unknown magnitude last; Messier, then Caldwell, then id as tie-breakers
  const rank = (d: Dso) => (d.messier ? 0 : d.caldwell ? 1 : 2);
  dsos.sort((a, b) => (a.mag ?? 99) - (b.mag ?? 99) || rank(a) - rank(b) || (a.messier ?? 0) - (b.messier ?? 0) || (a.caldwell ?? 0) - (b.caldwell ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const ids = new Set<string>();
  for (const d of dsos) {
    if (ids.has(d.id)) throw new Error(`Duplicate DSO id ${d.id}`);
    ids.add(d.id);
  }
  const missingM = Array.from({ length: 110 }, (_, i) => i + 1).filter((n) => !dsos.some((d) => d.messier === n));
  const missingC = Array.from({ length: 109 }, (_, i) => i + 1).filter((n) => !dsos.some((d) => d.caldwell === n));
  if (missingM.length || missingC.length) throw new Error(`Missing Messier ${missingM.join(',')} / Caldwell ${missingC.join(',')}; ${problems.join('; ')}`);

  const byType = new Map<string, number>();
  for (const d of dsos) byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
  const byEquip = new Map<string, number>();
  for (const d of dsos) byEquip.set(d.equip, (byEquip.get(d.equip) ?? 0) + 1);
  report.note(`dsos.json: ${dsos.length} objects (110 Messier, 109 Caldwell, ${sweep} others with mag ≤ ${DSO_MAG_LIMIT}, ${forcedAdded.length} famous objects added by name)`);
  report.note(`by type: ${[...byType].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  report.note(`by equipment: ${[...byEquip].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  report.note(`famous objects that needed forcing (not Messier/Caldwell, no magnitude ≤ ${DSO_MAG_LIMIT}): ${[...pickedForForced].join(', ') || 'none'}`);
  report.note(`with a common name: ${dsos.filter((d) => d.name).length}; with distance: ${dsos.filter((d) => d.distLy !== undefined).length}; with size: ${dsos.filter((d) => d.sizeArcmin).length}`);
  report.note(`names dropped because a Messier/Caldwell object has the same name: ${namesDropped.join(', ') || 'none'}`);
  report.note(`no magnitude at all: ${noMag.join(', ') || 'none'}`);
  report.note(`magnitude is B (no V in OpenNGC): ${bMag.length} — ${bMag.join(', ')}`);
  report.note(`magnitude from the Wikipedia list (none in OpenNGC): ${wikiMag.join(', ') || 'none'}`);
  report.note(`Messier/Caldwell objects without a distance: ${noDist.join(', ') || 'none'}`);
  report.note(`type refined from the Wikipedia list: ${typeRefined.join('; ') || 'none'}`);
  report.note(`constellation computed from position: ${conFixed.join(', ') || 'none'}`);
  report.note(`stars / double stars / novae / "other" entries brighter than ${DSO_MAG_LIMIT} skipped: ${skippedStars.length}`);
  report.note(`problems: ${problems.join('; ') || 'none'}`);
  return { dsos, messierRevid: wm.revid, caldwellRevid: wc.revid };
}
