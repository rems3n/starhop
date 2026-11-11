/**
 * Row builders for the library's collections. Pure: everything location-dependent takes the observer's
 * latitude (or month) as an argument. Tested in tests/library-rows.test.ts.
 */
import type { ConstellationContent, Starhop, Story } from '@/content/schema';
import type { Constellation, Dso, DsoType, Equipment, Star } from '@/types';
import { fold } from './table';

/** Smallest altitude that counts as "up" for a fixed point (same rule as src/astro visibility). */
export const MIN_ALT = 10;

/** Highest altitude a fixed J2000 declination ever reaches from latitude `lat` (precession ignored). */
export function maxAltitude(dec: number, lat: number): number {
  return 90 - Math.abs(lat - dec);
}

export type Reach = 'yes' | 'partly' | 'never';
export const REACH_LABEL: Record<Reach, string> = { yes: 'Yes', partly: 'Partly', never: 'Never' };

/** Can the learner see it at some time of year? 'partly' = some of its main stars never get 10° up. */
export function reachOf(decs: number[], lat: number): Reach {
  if (!decs.length) return 'never';
  const up = decs.filter((d) => maxAltitude(d, lat) >= MIN_ALT).length;
  return up === decs.length ? 'yes' : up === 0 ? 'never' : 'partly';
}

export function hemisphereOf(lat: number): 'N' | 'S' {
  return lat >= 0 ? 'N' : 'S';
}

// ───────────── Constellations ─────────────
export interface ConRow {
  id: string;
  name: string;
  english: string;
  genitive: string;
  areaSqDeg: number;
  /** 1 = largest */
  areaRank: number;
  brightestName: string;
  brightestRef: string;
  brightestMag: number | null;
  hemisphere: 'N' | 'S';
  zodiac: boolean;
  /** null while the page's content has not loaded or was not written */
  kind: 'ancient' | 'modern' | null;
  myths: number;
  /** Declinations of the main stars, for the reach test */
  mainDecs: number[];
}

export function buildConRows(cons: Constellation[], starById: Map<number, Star>, contentById: Map<string, ConstellationContent>): ConRow[] {
  const rank = new Map([...cons].sort((a, b) => b.areaSqDeg - a.areaSqDeg).map((c, i) => [c.id, i + 1]));
  return cons.map((c) => {
    const b = starById.get(c.brightest);
    const content = contentById.get(c.id);
    const main = (c.mainStars.length ? c.mainStars : c.figureStars).map((id) => starById.get(id)).filter((s): s is Star => !!s);
    return {
      id: c.id,
      name: c.name,
      english: c.english,
      genitive: c.genitive,
      areaSqDeg: c.areaSqDeg,
      areaRank: rank.get(c.id)!,
      brightestName: b ? b.name ?? b.desig : '—',
      brightestRef: b ? `star:${b.id}` : '',
      brightestMag: b ? b.mag : null,
      hemisphere: c.hemisphere,
      zodiac: c.zodiac,
      kind: content?.kind ?? null,
      myths: content?.stories.length ?? 0,
      mainDecs: main.length ? main.map((s) => s.dec) : [c.dec],
    };
  });
}

// ───────────── Myths ─────────────
export interface MythRow {
  id: string;
  title: string;
  con: string;
  conName: string;
  culture: string;
  /** Broad family for the filter: "Greek", "Roman", "Chinese", "Syrian" … */
  cultureFamily: string;
  authors: string[];
  /** "Hyginus, Poetic Astronomy 2.34; Ovid, Metamorphoses 2" */
  sources: string;
  characters: string[];
  summary: string;
  hasLink: boolean;
  story: Story;
}

/** "Greek (Athenian)" → Greek, "Hellenistic Greek (…)" → Greek, "Syrian, as told by …" → Syrian. */
export function cultureFamily(culture: string): string {
  const c = culture.trim();
  if (/^hellenistic greek/i.test(c)) return 'Greek';
  const m = /^[A-Za-z]+/.exec(c);
  return m ? m[0][0].toUpperCase() + m[0].slice(1).toLowerCase() : c;
}

/** Author names written two ways in the sources are merged ("Germanicus Caesar" → "Germanicus"). */
const AUTHOR_SAME: Record<string, string> = { 'Germanicus Caesar': 'Germanicus', 'Apollonius of Rhodes': 'Apollonius Rhodius' };
export function authorKey(author: string): string {
  return AUTHOR_SAME[author.trim()] ?? author.trim();
}

export function buildMythRows(contents: ConstellationContent[], conName: (id: string) => string): MythRow[] {
  return contents.flatMap((c) =>
    c.stories.map((s) => ({
      id: s.id,
      title: s.title,
      con: c.id,
      conName: conName(c.id),
      culture: s.culture,
      cultureFamily: cultureFamily(s.culture),
      authors: [...new Set(s.ancientSources.map((a) => authorKey(a.author)))],
      sources: s.ancientSources.map((a) => `${a.author}, ${a.work}`).join('; '),
      characters: s.characters,
      summary: s.summary,
      hasLink: !!s.link,
      story: s,
    })),
  );
}

/** Distinct values with how many rows have each, most common first then alphabetical. */
export function tally(values: string[][]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const list of values) for (const v of new Set(list)) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Does any of the row's characters contain the typed text? */
export function hasCharacter(characters: string[], q: string): boolean {
  const f = fold(q);
  return !f || characters.some((c) => fold(c).includes(f));
}

// ───────────── Stars ─────────────
export interface StarRow {
  ref: string;
  id: number;
  /** Proper name, or the designation when it has none */
  title: string;
  proper?: string;
  desig: string;
  con: string;
  conName: string;
  mag: number;
  sp?: string;
  /** O B A F G K M, or '' when unknown */
  spLetter: string;
  colour: string;
  distLy?: number;
  dec: number;
  hasWriteup: boolean;
}

/** Stars the library lists: every star with a proper name, plus Bayer-lettered stars brighter than 3.5. */
export function isLibraryStar(s: Star): boolean {
  return !!s.name || (!!s.bayer && s.mag < 3.5);
}

export const SPECTRAL_LETTERS = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const;
const LETTER_COLOUR: Record<string, string> = { O: 'blue', B: 'blue-white', A: 'white', F: 'yellow-white', G: 'yellow', K: 'orange', M: 'red' };
export function spectralLetter(sp: string | undefined): string {
  const m = /^(?:sd|d|g|c)?([OBAFGKM])/.exec((sp ?? '').trim());
  return m ? m[1] : '';
}
/** Colour as the eye sees it: from the B−V index when known (some catalogue spectral types describe a companion), else the class letter. */
export function colourOf(s: Pick<Star, 'sp' | 'bv'>): string {
  if (s.bv == null) {
    const l = spectralLetter(s.sp);
    return l ? LETTER_COLOUR[l] : '';
  }
  const bv = s.bv;
  return bv < -0.1 ? 'blue' : bv < 0.15 ? 'blue-white' : bv < 0.3 ? 'white' : bv < 0.5 ? 'yellow-white' : bv < 0.8 ? 'yellow' : bv < 1.4 ? 'orange' : 'red';
}

export function buildStarRows(stars: Star[], conName: (id: string) => string, written: Set<string>): StarRow[] {
  return stars.filter(isLibraryStar).map((s) => ({
    ref: `star:${s.id}`,
    id: s.id,
    title: s.name ?? s.desig,
    proper: s.name,
    desig: s.desig,
    con: s.con,
    conName: conName(s.con),
    mag: s.mag,
    sp: s.sp,
    spLetter: spectralLetter(s.sp),
    colour: colourOf(s),
    distLy: s.distLy,
    dec: s.dec,
    hasWriteup: written.has(`star:${s.id}`),
  }));
}

export type MagBand = 'lt1' | '1-2' | '2-3' | 'gt3';
export const MAG_BANDS: { value: MagBand; label: string }[] = [
  { value: 'lt1', label: 'Brighter than 1' },
  { value: '1-2', label: '1 to 2' },
  { value: '2-3', label: '2 to 3' },
  { value: 'gt3', label: 'Fainter than 3' },
];
export function magBand(mag: number): MagBand {
  return mag < 1 ? 'lt1' : mag < 2 ? '1-2' : mag < 3 ? '2-3' : 'gt3';
}

// ───────────── Deep-sky objects ─────────────
export type DsoGroup = 'galaxy' | 'open-cluster' | 'globular-cluster' | 'nebula' | 'planetary-nebula' | 'other';
export const DSO_GROUP_LABEL: Record<DsoGroup, string> = {
  galaxy: 'Galaxies',
  'open-cluster': 'Open clusters',
  'globular-cluster': 'Globular clusters',
  nebula: 'Nebulae',
  'planetary-nebula': 'Planetary nebulae',
  other: 'Other',
};
export function dsoGroup(t: DsoType): DsoGroup {
  switch (t) {
    case 'galaxy':
    case 'open-cluster':
    case 'globular-cluster':
    case 'planetary-nebula':
      return t;
    case 'emission-nebula':
    case 'reflection-nebula':
    case 'supernova-remnant':
    case 'dark-nebula':
    case 'nebula':
    case 'cluster-with-nebula':
      return 'nebula';
    case 'star-cloud':
      return 'open-cluster';
    default:
      return 'other';
  }
}

export type DsoCatalogue = 'messier' | 'caldwell' | 'other';
export interface DsoRow {
  ref: string;
  /** Short id: "M42", "C14", "NGC 869" */
  label: string;
  name?: string;
  /** Every id, for search: "M42 NGC 1976" */
  ids: string;
  type: DsoType;
  group: DsoGroup;
  con: string;
  conName: string;
  mag?: number;
  sizeArcmin?: number;
  distLy?: number;
  equip: Equipment;
  catalogue: DsoCatalogue;
  messier?: number;
  caldwell?: number;
  dec: number;
  hasImage: boolean;
  hasWriteup: boolean;
}

export function dsoLabel(d: Pick<Dso, 'messier' | 'caldwell' | 'aka' | 'id'>): string {
  if (d.messier) return `M${d.messier}`;
  if (d.caldwell) return `C${d.caldwell}`;
  return d.aka[0] ?? d.id.replace(/^(NGC|IC)(\d)/, '$1 $2');
}

export function buildDsoRows(dsos: Dso[], conName: (id: string) => string, hasImage: (ref: string) => boolean, written: Set<string>): DsoRow[] {
  return dsos.map((d) => {
    const ref = `dso:${d.id}`;
    const label = dsoLabel(d);
    const ids = [label, d.messier ? `Messier ${d.messier}` : '', d.caldwell ? `C${d.caldwell} Caldwell ${d.caldwell}` : '', d.id, ...d.aka].filter(Boolean).join(' ');
    return {
      ref,
      label,
      name: d.name,
      ids,
      type: d.type,
      group: dsoGroup(d.type),
      con: d.con,
      conName: conName(d.con),
      mag: d.mag,
      sizeArcmin: d.sizeArcmin?.[0],
      distLy: d.distLy,
      equip: d.equip,
      catalogue: d.messier ? 'messier' : d.caldwell ? 'caldwell' : 'other',
      messier: d.messier,
      caldwell: d.caldwell,
      dec: d.dec,
      hasImage: hasImage(ref),
      hasWriteup: written.has(ref),
    };
  });
}

export const EQUIP_RANK: Record<Equipment, number> = { 'naked-eye': 0, binoculars: 1, 'small-telescope': 2, telescope: 3 };

// ───────────── Star-hops ─────────────
/** Months when a hop is well placed for this observer (by hemisphere), and whether it is usable at all from here. */
export function hopMonths(h: Pick<Starhop, 'monthsNorth' | 'monthsSouth'>, lat: number): number[] {
  return hemisphereOf(lat) === 'N' ? h.monthsNorth : h.monthsSouth;
}
export function hopSuitsHemisphere(h: Pick<Starhop, 'hemisphere'>, lat: number): boolean {
  return h.hemisphere === 'both' || h.hemisphere === hemisphereOf(lat);
}
/** Usable on this month's evenings from the observer's hemisphere. */
export function hopUsableNow(h: Pick<Starhop, 'hemisphere' | 'monthsNorth' | 'monthsSouth'>, lat: number, month: number): boolean {
  return hopSuitsHemisphere(h, lat) && hopMonths(h, lat).includes(month);
}

export const TOP_N = 10;

/**
 * Which part of a hop's path a written step talks about: the [[ref|…]] links in the step text that are on the
 * path give the span of path indices; a step naming one point means the leg arriving there (or leaving the
 * start). A step naming none is matched by position. Returns [from, to] path indices, from < to.
 */
export function stepSpan(stepText: string, stepIndex: number, stepCount: number, pathCanon: string[], canon: (ref: string) => string | null): [number, number] {
  const legs = pathCanon.length - 1;
  const idx = new Set<number>();
  for (const m of stepText.matchAll(/\[\[([^\]|]+)\|/g)) {
    const c = canon(m[1].trim());
    if (!c) continue;
    pathCanon.forEach((p, i) => p === c && idx.add(i));
  }
  if (idx.size >= 2) {
    const s = [...idx].sort((a, b) => a - b);
    return [s[0], s[s.length - 1]];
  }
  if (idx.size === 1) {
    const k = [...idx][0];
    return k === 0 ? [0, 1] : [k - 1, k];
  }
  const leg = stepCount <= 1 ? 0 : Math.round((stepIndex * (legs - 1)) / (stepCount - 1));
  return [leg, leg + 1];
}
