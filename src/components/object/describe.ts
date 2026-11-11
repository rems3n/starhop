/**
 * Pure wording helpers for the object panel: no React, no DOM. Everything here is computed from catalog
 * data, so it is the fallback whenever authored content (blurbs, constellation pages) has not been written.
 * Unit-tested in tests/explore-describe.test.ts.
 */
import { angularSeparation, positionAngle } from '@/astro/frames';
import type { Catalog } from '@/data/catalog';
import { EQUIPMENT_LABEL, formatDistanceLy, handSpan } from '@/lib/format';
import { MONTH_NAMES } from '@/lib/time';
import { BORTLE, type BodyId, type Constellation, type Dso, type DsoType, type Equipment, type ResolvedTarget, type Star, type VisibilityClass } from '@/types';

// ───────────────────────────── Stars: spectral type in plain words ─────────────────────────────

export type LuminosityClass = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export interface SpectralInfo {
  /** Temperature letter O B A F G K M, or a special class W (Wolf–Rayet) C (carbon) S D (white dwarf) */
  letter: string;
  lum?: LuminosityClass;
  /** "red", "blue-white" … (lower case) */
  colour: string;
  /** "about 3,700 K or cooler" */
  temperature: string;
  /** "much cooler than the Sun" */
  vsSun: string;
  /** "supergiant", "giant", "main-sequence star" … ("star" when the luminosity class is unknown) */
  sizeWord: string;
  /** "Red supergiant star" — the headline kind */
  title: string;
  /** One sentence explaining the size class */
  sizeNote?: string;
}

const TEMP: Record<string, { colour: string; temperature: string; vsSun: string }> = {
  O: { colour: 'blue', temperature: 'hotter than 30,000 K', vsSun: 'far hotter than the Sun' },
  B: { colour: 'blue-white', temperature: 'about 10,000–30,000 K', vsSun: 'much hotter than the Sun' },
  A: { colour: 'white', temperature: 'about 7,500–10,000 K', vsSun: 'hotter than the Sun' },
  F: { colour: 'yellow-white', temperature: 'about 6,000–7,500 K', vsSun: 'a little hotter than the Sun' },
  G: { colour: 'yellow', temperature: 'about 5,200–6,000 K', vsSun: 'about as hot as the Sun' },
  K: { colour: 'orange', temperature: 'about 3,700–5,200 K', vsSun: 'cooler than the Sun' },
  M: { colour: 'red', temperature: 'about 3,700 K or cooler', vsSun: 'much cooler than the Sun' },
};

const SIZE: Record<LuminosityClass, { word: string; note: string }> = {
  I: { word: 'supergiant', note: 'Supergiants are the largest and most luminous stars: massive stars near the end of their lives.' },
  II: { word: 'bright giant', note: 'Bright giants are swollen, ageing stars, between ordinary giants and supergiants in power.' },
  III: { word: 'giant', note: 'A giant is an ageing star that has swollen to many times its earlier size after using up the hydrogen in its core.' },
  IV: { word: 'subgiant', note: 'A subgiant is a star that has begun to swell as it leaves the long, stable middle part of its life.' },
  V: { word: 'main-sequence star', note: 'Main-sequence stars are in the long, stable middle of their lives, fusing hydrogen in their cores as the Sun does. Astronomers also call them dwarfs.' },
  VI: { word: 'subdwarf', note: 'A subdwarf is a little fainter than an ordinary main-sequence star of the same colour.' },
};

const SPECIAL: Record<string, { title: string; colour: string; note: string }> = {
  W: { title: 'Wolf–Rayet star', colour: 'blue', note: 'A Wolf–Rayet star is a very hot, massive star that is blowing its outer layers into space in a strong wind.' },
  C: { title: 'Carbon star', colour: 'deep red', note: 'A carbon star is a cool giant with a carbon-rich atmosphere, which makes it look deep red.' },
  S: { title: 'S-type giant star', colour: 'red', note: 'An S-type star is a cool red giant whose chemistry lies between ordinary red giants and carbon stars.' },
  D: { title: 'White dwarf', colour: 'white', note: 'A white dwarf is the dense, roughly Earth-sized remnant left when a Sun-like star dies.' },
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lumOf(token: string | undefined): LuminosityClass | undefined {
  if (!token) return undefined;
  if (token.startsWith('III')) return 'III';
  if (token.startsWith('II')) return 'II';
  if (token.startsWith('IV')) return 'IV';
  if (token.startsWith('VI')) return 'VI';
  if (token.startsWith('V')) return 'V';
  if (token.startsWith('I')) return 'I';
  return undefined;
}

/** Colour word from the B−V colour index, for stars with no usable spectral type. */
export function colourFromBv(bv: number): string {
  if (bv < -0.1) return 'blue';
  if (bv < 0.15) return 'blue-white';
  if (bv < 0.3) return 'white';
  if (bv < 0.5) return 'yellow-white';
  if (bv < 0.8) return 'yellow';
  if (bv < 1.4) return 'orange';
  return 'red';
}

/**
 * Read a spectral type string such as "M1-2Ia-Iab", "A0Vvar", "K3III+B2V", "G0 III", "dF3", "WC8 + O9I".
 * Only the primary (first) star is described. Returns null when the string cannot be read.
 */
export function parseSpectral(sp: string | undefined): SpectralInfo | null {
  if (!sp) return null;
  const s = sp.trim();
  // Carbon stars were once classed R and N; DA/DB… are white dwarfs.
  const special = /^(W[NCO]?|C|N|R|S|D[ABCOQZ]?)(?![a-z])/.exec(s);
  if (special && !/^[OBAFGKM]/.test(s)) {
    const key = special[1][0] === 'N' || special[1][0] === 'R' ? 'C' : special[1][0];
    const sp = SPECIAL[key];
    return { letter: key, colour: sp.colour, temperature: '', vsSun: '', sizeWord: 'star', title: sp.title, sizeNote: sp.note };
  }
  const m = /^(sd|d|g|c)?([OBAFGKM])\s*(\d(?:\.\d)?)?(?:\s*[-/]\s*(?:[OBAFGKM])?\d(?:\.\d)?)?:?\s*(IV|VI|V|I{1,3})?/.exec(s);
  if (!m) return null;
  const letter = m[2];
  const t = TEMP[letter];
  let lum = lumOf(m[4]);
  if (!lum && m[1]) lum = m[1] === 'sd' ? 'VI' : m[1] === 'd' ? 'V' : m[1] === 'g' ? 'III' : 'I';
  const size = lum ? SIZE[lum] : undefined;
  const sizeWord = size?.word ?? 'star';
  const title = cap(`${t.colour} ${sizeWord}${sizeWord.endsWith('star') ? '' : ' star'}`);
  return { letter, lum, colour: t.colour, temperature: t.temperature, vsSun: t.vsSun, sizeWord, title, sizeNote: size?.note };
}

/** Headline kind for a star, e.g. "Red supergiant star"; falls back to the colour index, then to "Star". */
export function starKind(star: Pick<Star, 'sp' | 'bv'>): string {
  const info = parseSpectral(star.sp);
  if (info) return info.title;
  if (star.bv != null) return cap(`${colourFromBv(star.bv)} star`);
  return 'Star';
}

/** One or two sentences explaining a spectral type to a beginner. */
export function spectralExplanation(star: Pick<Star, 'sp' | 'bv'>): string | null {
  const info = parseSpectral(star.sp);
  if (!info) {
    if (star.bv == null) return null;
    return `Its colour is ${colourFromBv(star.bv)}. A star's colour shows its surface temperature: blue stars are the hottest, red the coolest.`;
  }
  if (!info.temperature) return info.sizeNote ?? null;
  const first = `Class ${info.letter} means ${/^[aeiou]/i.test(info.colour) ? 'an' : 'a'} ${info.colour} star with a surface at ${info.temperature} — ${info.vsSun}.`;
  return info.sizeNote ? `${first} ${info.sizeNote}` : first;
}

// ───────────────────────────── Brightness ─────────────────────────────

/** What an apparent magnitude means for a star-like point of light. */
export function magnitudeGloss(mag: number): string {
  if (mag <= -3) return 'brighter than any star — unmistakable, even in twilight';
  if (mag <= 0) return 'brilliant — among the very brightest lights in the night sky';
  if (mag <= 1.5) return 'one of the brightest stars in the sky, easy even from a city';
  if (mag <= 3.0) return 'easy to see with the naked eye, even from a city';
  if (mag <= 4.3) return 'visible to the naked eye from the suburbs; hard from a city centre';
  if (mag <= 6.0) return 'visible to the naked eye only under a dark country sky';
  if (mag <= 6.5) return 'at the very limit of the naked eye under a perfect sky';
  if (mag <= 9.5) return 'too faint for the naked eye — needs binoculars';
  return 'needs a telescope';
}

/** Minimum equipment for a point of light of this magnitude under a dark sky. */
export function equipmentForMagnitude(mag: number): Equipment {
  if (mag <= 6.0) return 'naked-eye';
  if (mag <= 9.5) return 'binoculars';
  if (mag <= 12) return 'small-telescope';
  return 'telescope';
}

function bortleOf(n: number) {
  return BORTLE[Math.min(9, Math.max(1, Math.round(n))) - 1];
}

/** Can a star of this magnitude be seen with the naked eye at this Bortle class? */
export function nakedEyeAtBortle(mag: number, bortle: number): boolean {
  return mag <= bortleOf(bortle).limitingMag;
}

/** Sentence about a star (or planet) at the user's light-pollution setting. */
export function bortleSentence(mag: number, bortle: number): string {
  const b = bortleOf(bortle);
  const where = `your current sky setting (Bortle ${b.n}, ${b.label.toLowerCase()})`;
  if (mag <= b.limitingMag) return `Visible to the naked eye at ${where}.`;
  if (mag <= 6.0) {
    const need = [...BORTLE].reverse().find((x) => mag <= x.limitingMag);
    return `Too faint for the naked eye at ${where}${need ? `; it shows from Bortle ${need.n} (${need.label.toLowerCase()}) or darker` : ''}. Binoculars will show it from anywhere.`;
  }
  return `Not a naked-eye object at ${where}, or anywhere else.`;
}

/** Visual luminosity compared with the Sun from absolute magnitude (Sun: +4.83). */
export function luminosityVsSun(absMag: number): number {
  return Math.pow(10, (4.83 - absMag) / 2.5);
}

/** "about 14,000 times the Sun's light", "about 1/50 of the Sun's light" */
export function luminosityWords(absMag: number): string {
  const l = luminosityVsSun(absMag);
  const round = (x: number) => {
    if (x >= 1000) return (Math.round(x / Math.pow(10, Math.floor(Math.log10(x)) - 1)) * Math.pow(10, Math.floor(Math.log10(x)) - 1)).toLocaleString('en-US');
    if (x >= 10) return String(Math.round(x));
    return x.toFixed(1).replace(/\.0$/, '');
  };
  if (l >= 1.15) return `about ${round(l)} times the Sun's light`;
  if (l > 0.87) return 'about the same light as the Sun';
  return `about 1/${round(1 / l)} of the Sun's light`;
}

// ───────────────────────────── Deep-sky objects ─────────────────────────────

export const DSO_KIND: Record<DsoType, { label: string; gloss: string }> = {
  galaxy: { label: 'Galaxy', gloss: 'a separate system of millions to billions of stars, outside our own Milky Way' },
  'open-cluster': { label: 'Open cluster', gloss: 'a loose family of stars born together from the same cloud' },
  'globular-cluster': { label: 'Globular cluster', gloss: 'a tight ball of tens of thousands to a million ancient stars' },
  'emission-nebula': { label: 'Emission nebula', gloss: 'a cloud of gas set glowing by hot young stars' },
  'reflection-nebula': { label: 'Reflection nebula', gloss: 'a cloud of dust lit by reflecting the light of nearby stars' },
  'planetary-nebula': { label: 'Planetary nebula', gloss: 'a shell of gas thrown off by a dying Sun-like star (nothing to do with planets)' },
  'supernova-remnant': { label: 'Supernova remnant', gloss: 'the expanding wreckage of a star that exploded' },
  'dark-nebula': { label: 'Dark nebula', gloss: 'a cloud of dust that blocks the light of the stars behind it' },
  nebula: { label: 'Nebula', gloss: 'a cloud of gas and dust between the stars' },
  'cluster-with-nebula': { label: 'Star cluster with nebula', gloss: 'a young star cluster still wrapped in the gas cloud it formed from' },
  'star-cloud': { label: 'Star cloud', gloss: 'a dense, bright patch of the Milky Way' },
  'double-star': { label: 'Double star', gloss: 'two stars that appear close together' },
  asterism: { label: 'Asterism', gloss: 'a recognisable pattern of stars, not necessarily related to each other' },
  other: { label: 'Deep-sky object', gloss: 'an object beyond the solar system that is not a single star' },
};

export function dsoKind(dso: Pick<Dso, 'type'>): string {
  const k = DSO_KIND[dso.type] ?? DSO_KIND.other;
  return `${k.label} — ${k.gloss}`;
}

const DIFFUSE: DsoType[] = ['galaxy', 'emission-nebula', 'reflection-nebula', 'supernova-remnant', 'dark-nebula', 'nebula', 'cluster-with-nebula'];

/**
 * `Dso.equip` is derived from total magnitude alone. A large nebula or galaxy spreads that light so thinly
 * that it disappears in any light pollution: flag those wider than 60′.
 */
export function dsoNeedsDarkSky(dso: Pick<Dso, 'type' | 'sizeArcmin'>): boolean {
  return DIFFUSE.includes(dso.type) && !!dso.sizeArcmin && Math.max(dso.sizeArcmin[0], dso.sizeArcmin[1]) > 60;
}

/** Physical width in light-years from apparent size and distance (small-angle rule). */
export function physicalSizeLy(sizeArcmin: number, distLy: number): number {
  return distLy * sizeArcmin * (Math.PI / 10800);
}

export function physicalSizeWords(dso: Pick<Dso, 'sizeArcmin' | 'distLy'>): string | null {
  if (!dso.sizeArcmin || !dso.distLy) return null;
  const ly = physicalSizeLy(Math.max(dso.sizeArcmin[0], dso.sizeArcmin[1]), dso.distLy);
  if (!isFinite(ly) || ly <= 0) return null;
  const n = ly >= 1000 ? (Math.round(ly / 100) * 100).toLocaleString('en-US') : ly >= 10 ? String(Math.round(ly)) : ly.toFixed(1);
  return `about ${n} light-years across`;
}

/** Compare an apparent size with the full Moon (about 31′ wide). */
export function moonWidths(arcmin: number): string | null {
  const r = arcmin / 31;
  if (r >= 1.5) return `about ${r >= 10 ? Math.round(r) : r.toFixed(1).replace(/\.0$/, '')} times the width of the full Moon`;
  if (r >= 0.75) return 'about as wide as the full Moon';
  if (r >= 0.2) return `about ${r >= 0.4 ? 'half' : 'a third of'} the width of the full Moon`;
  return null;
}

export function equipmentSentence(equip: Equipment): string {
  switch (equip) {
    case 'naked-eye': return 'Visible without any equipment under a reasonably dark sky.';
    case 'binoculars': return 'Ordinary binoculars are enough under a reasonably dark sky.';
    case 'small-telescope': return 'Needs a small telescope (60–100 mm) under a reasonably dark sky.';
    default: return 'Needs a larger telescope (150 mm or more) and a dark sky.';
  }
}
export { EQUIPMENT_LABEL };

// ───────────────────────────── Sun, Moon, planets ─────────────────────────────

export const BODY_KIND: Record<BodyId, string> = {
  Sun: 'Star — the star at the centre of the solar system',
  Moon: "Moon — Earth's natural satellite",
  Mercury: 'Planet — the smallest planet and the closest to the Sun',
  Venus: 'Planet — a rocky world wrapped in bright, unbroken cloud',
  Mars: 'Planet — a rocky world coloured by rusty dust',
  Jupiter: 'Planet — a gas giant, the largest planet',
  Saturn: 'Planet — a gas giant circled by bright rings',
  Uranus: 'Planet — an ice giant',
  Neptune: 'Planet — an ice giant, the most distant planet',
};

export const BODY_ABOUT: Record<BodyId, string> = {
  Sun: 'The Sun is the star at the centre of the solar system. It is an ordinary yellow main-sequence star; it only looks different from the other stars because it is so close.',
  Moon: "The Moon is Earth's natural satellite. It shines by reflected sunlight, and we see a changing part of its sunlit half as it circles the Earth about once a month.",
  Mercury: 'Mercury is the smallest planet and the closest to the Sun. It never strays far from the Sun in the sky, so it is only seen low in twilight.',
  Venus: 'Venus is a rocky planet about the size of Earth, covered in bright cloud that reflects most of the sunlight falling on it. That makes it the brightest planet in the sky.',
  Mars: 'Mars is a rocky planet about half as wide as Earth. Its orange-red colour comes from rusty dust on its surface.',
  Jupiter: 'Jupiter is a gas giant and the largest planet. Its four large moons are visible in binoculars as a line of faint points beside it.',
  Saturn: 'Saturn is a gas giant circled by bright rings of ice. The rings are visible in a small telescope.',
  Uranus: 'Uranus is an ice giant far beyond Saturn. It is at the very limit of the naked eye and shows as a faint point in binoculars.',
  Neptune: 'Neptune is an ice giant and the most distant planet. It is too faint for the naked eye.',
};

/** "In its crescent phase", "nearly full" … for anything with a lit fraction. */
export function litWords(fraction: number): string {
  const pct = Math.round(fraction * 100);
  if (pct >= 99) return 'fully lit';
  if (pct <= 1) return 'almost entirely dark';
  return `${pct}% lit`;
}

// ───────────────────────────── How to find it (computed fallback) ─────────────────────────────

const SKY_DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
/** Eight-point direction word for a position angle (0 = celestial north, 90 = east). */
export function skyDirection(pa: number): string {
  return SKY_DIRECTIONS[Math.round((((pa % 360) + 360) % 360) / 45) % 8];
}

/** Stars brighter than this are the "signposts" a beginner can find first. */
export const SIGNPOST_MAG = 2.5;

export interface Signpost {
  star: Star;
  /** Degrees from the signpost star to the target */
  separation: number;
  /** Direction from the star to the target, as a word */
  direction: string;
}

/** Nearest star brighter than magnitude 2.5 to a position, optionally skipping one star (the target itself). */
export function nearestSignpost(pos: { ra: number; dec: number }, catalog: Pick<Catalog, 'stars'>, excludeId?: number): Signpost | null {
  let best: Star | null = null;
  let bestSep = Infinity;
  for (const s of catalog.stars) {
    if (s.mag >= SIGNPOST_MAG) break; // sorted brightest first
    if (s.id === excludeId) continue;
    const sep = angularSeparation(pos, s);
    if (sep < bestSep) {
      bestSep = sep;
      best = s;
    }
  }
  if (!best) return null;
  return { star: best, separation: bestSep, direction: skyDirection(positionAngle(best, pos)) };
}

const DIRECTION_NOTE = 'On the sky, north is the direction towards the North Star and west is the way the stars drift during the night.';

function starLink(s: Star): string {
  return `[[star:${s.id}|${s.name ?? s.desig}]]`;
}

function offsetPhrase(sp: Signpost, conName: (id: string) => string, targetCon?: string): string {
  const where = sp.star.con !== targetCon ? ` in ${conName(sp.star.con)}` : '';
  if (sp.separation < 1) return `right beside ${starLink(sp.star)}${where}`;
  return `${handSpan(sp.separation)} ${sp.direction} of ${starLink(sp.star)}${where}`;
}

/**
 * Directions built only from the catalog: the constellation, then the offset and direction from the nearest
 * star brighter than magnitude 2.5. Uses [[ref|label]] links (render with <RichText>).
 */
export function fallbackHowToFind(t: ResolvedTarget, catalog: Pick<Catalog, 'stars' | 'conById' | 'starById'>, opts?: { con?: string }): string {
  const conName = (id: string) => catalog.conById.get(id)?.name ?? id;
  const conLink = (id: string) => `[[con:${id}|${conName(id)}]]`;

  if (t.kind === 'constellation' && t.constellation) {
    const c = t.constellation;
    const b = catalog.starById.get(c.brightest);
    const parts: string[] = [];
    if (b) {
      const bright = b.mag < SIGNPOST_MAG;
      parts.push(`Start from its brightest star, ${starLink(b)} (magnitude ${b.mag.toFixed(1)})${bright ? '' : ', which is not a bright one'}.`);
      const sp = nearestSignpost(b, catalog, b.id);
      if (sp && (!bright || sp.star.con !== c.id)) parts.push(`${b.name ?? b.desig} is ${offsetPhrase(sp, conName, c.id)}.`);
    } else {
      const sp = nearestSignpost(t, catalog);
      if (sp) parts.push(`Its centre is ${offsetPhrase(sp, conName, c.id)}.`);
    }
    parts.push(DIRECTION_NOTE);
    return parts.join(' ');
  }

  const con = opts?.con ?? t.star?.con ?? t.dso?.con;
  const sp = nearestSignpost(t, catalog, t.star?.id);
  const parts: string[] = [];
  const name = t.name;
  if (t.kind === 'body') {
    if (con) parts.push(`${name} is in ${conLink(con)} at the moment.`);
    if (sp) parts.push(`Look ${offsetPhrase(sp, conName, con)}.`);
    if (t.body !== 'Sun') parts.push(t.body === 'Moon' ? 'The Moon moves about its own width against the stars every hour, so this changes quickly.' : 'Planets drift against the stars, so this changes over days and weeks.');
    return parts.join(' ');
  }
  if (t.star && t.star.mag < SIGNPOST_MAG) {
    const c = catalog.conById.get(t.star.con);
    const rank = c ? c.figureStars.map((id) => catalog.starById.get(id)).filter((s): s is Star => !!s).sort((a, b) => a.mag - b.mag).findIndex((s) => s.id === t.star!.id) : -1;
    parts.push(`${name} is ${rank === 0 || c?.brightest === t.star.id ? 'the brightest star' : 'one of the bright stars'} of ${conLink(t.star.con)}, bright enough to pick out directly.`);
    if (sp) parts.push(`It is ${offsetPhrase(sp, conName, con)}.`);
  } else {
    if (con) parts.push(`${name} is in ${conLink(con)}.`);
    if (sp) parts.push(`Look ${offsetPhrase(sp, conName, con)}.`);
  }
  if (sp && sp.separation >= 1) parts.push(DIRECTION_NOTE);
  return parts.join(' ');
}

// ───────────────────────────── Fallback "what it is" ─────────────────────────────

export function fallbackAbout(t: ResolvedTarget, catalog: Pick<Catalog, 'conById' | 'starById'>): string {
  const conName = (id: string) => catalog.conById.get(id)?.name ?? id;
  if (t.body) return BODY_ABOUT[t.body];
  if (t.star) {
    const s = t.star;
    const info = parseSpectral(s.sp);
    const kind = starKind(s).toLowerCase();
    const dist = s.distLy ? `, about ${formatDistanceLy(s.distLy)} away` : '';
    const first = `${t.name} is ${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind} in ${conName(s.con)}${dist}.`;
    return info?.sizeNote ? `${first} ${info.sizeNote}` : first;
  }
  if (t.dso) {
    const d = t.dso;
    const k = DSO_KIND[d.type] ?? DSO_KIND.other;
    const dist = d.distLy ? `, about ${formatDistanceLy(d.distLy)} away` : '';
    const article = /^[aeiou]/i.test(k.label) ? 'an' : 'a';
    return `${t.name} is ${article} ${k.label.toLowerCase()} in ${conName(d.con)}${dist}: ${k.gloss}.`;
  }
  if (t.constellation) {
    const c = t.constellation;
    const b = catalog.starById.get(c.brightest);
    const rank = [...catalog.conById.values()].sort((x, y) => y.areaSqDeg - x.areaSqDeg).findIndex((x) => x.id === c.id) + 1;
    const size = rank > 0 ? ` It covers ${Math.round(c.areaSqDeg).toLocaleString('en-US')} square degrees of sky, which ranks ${ordinal(rank)} of the 88 constellations by area.` : '';
    const zodiac = c.zodiac ? ' It is one of the zodiac constellations: the Sun, Moon and planets pass through it.' : '';
    const star = b ? ` Its brightest star is ${b.name ?? b.desig} (magnitude ${b.mag.toFixed(1)}).` : '';
    return `${c.name} is the constellation of ${c.english.replace(/^the /i, 'the ')}.${size}${star}${zodiac}`;
  }
  return '';
}

export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10];
  return `${n}${suffix}`;
}

/** How many of a constellation's figure stars show to the naked eye at a limiting magnitude. */
export function figureStarsVisible(c: Constellation, catalog: Pick<Catalog, 'starById'>, limitingMag: number): { visible: number; total: number } {
  let visible = 0;
  let total = 0;
  for (const id of c.figureStars) {
    const s = catalog.starById.get(id);
    if (!s) continue;
    total++;
    if (s.mag <= limitingMag) visible++;
  }
  return { visible, total };
}

// ───────────────────────────── When it is visible ─────────────────────────────

export const VISIBILITY_WORDS: Record<VisibilityClass, string> = {
  'all-night': 'Up for most of the night',
  evening: 'An evening object',
  morning: 'A morning object (before dawn)',
  'not-visible': 'Not visible in a dark sky',
};

/** [12, 1, 2, 3] → "December to March"; [6] → "June"; [1,2,7,8] → "January to February and July to August" */
export function monthRanges(months: number[]): string {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (!set.size) return '';
  if (set.size === 12) return 'all year';
  const name = (m: number) => MONTH_NAMES[m - 1];
  // start each run at a month whose predecessor is absent
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  const runs = starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== start) end = end === 12 ? 1 : end + 1;
    return start === end ? name(start) : `${name(start)} to ${name(end)}`;
  });
  // put a run that wraps the new year first only if it is the only one; otherwise calendar order reads best
  return runs.length <= 1 ? runs.join('') : `${runs.slice(0, -1).join(', ')} and ${runs[runs.length - 1]}`;
}
