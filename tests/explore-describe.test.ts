import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bortleSentence, dsoKind, dsoNeedsDarkSky, equipmentForMagnitude, fallbackAbout, fallbackHowToFind, figureStarsVisible, luminosityVsSun, luminosityWords,
  magnitudeGloss, monthRanges, moonWidths, nakedEyeAtBortle, nearestSignpost, ordinal, parseSpectral, physicalSizeWords, skyDirection, spectralExplanation, starKind,
} from '@/components/object/describe';
import { visTargetOf } from '@/components/object/targets';
import { buildCatalog } from '@/data/catalog';
import type { Constellation, Dso, Star } from '@/types';

const read = <T,>(f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${f}`, import.meta.url)), 'utf8')) as T;
const cat = buildCatalog({ stars: read<Star[]>('stars.json'), constellations: read<Constellation[]>('constellations.json'), dsos: read<Dso[]>('dsos.json') });
const R = (ref: string) => {
  const t = cat.resolve(ref);
  if (!t) throw new Error(`unresolved ${ref}`);
  return t;
};

describe('star type wording from the spectral class', () => {
  const cases: [string, string][] = [
    ['M2Ib', 'Red supergiant star'],
    ['M1-2Ia-Iab', 'Red supergiant star'],
    ['A0Vvar', 'White main-sequence star'],
    ['A0m...', 'White star'],
    ['G2V', 'Yellow main-sequence star'],
    ['K2IIIp', 'Orange giant star'],
    ['K5III', 'Orange giant star'],
    ['G0 III', 'Yellow giant star'],
    ['B8Ia', 'Blue-white supergiant star'],
    ['F5IV-V', 'Yellow-white subgiant star'],
    ['B0.5IV', 'Blue-white subgiant star'],
    ['B2II', 'Blue-white bright giant star'],
    ['O9.5Ib SB', 'Blue supergiant star'],
    ['K3III+B2V', 'Orange giant star'],
    ['F7:Ib-IIv SB', 'Yellow-white supergiant star'],
    ['B1II/III', 'Blue-white bright giant star'],
    ['dF3', 'Yellow-white main-sequence star'],
    ['WC8 + O9I', 'Wolf–Rayet star'],
    ['C5II', 'Carbon star'],
    ['N0v', 'Carbon star'],
    ['DAn...', 'White dwarf'],
    ['S5.3 SB:', 'S-type giant star'],
  ];
  it.each(cases)('%s → %s', (sp, title) => expect(starKind({ sp })).toBe(title));

  it('reads the luminosity class, not a stray letter', () => {
    expect(parseSpectral('K0IIIb')?.lum).toBe('III');
    expect(parseSpectral('K2IIb-IIIa')?.lum).toBe('II');
    expect(parseSpectral('A2IV')?.lum).toBe('IV');
    expect(parseSpectral('M5III')?.lum).toBe('III');
    expect(parseSpectral('A0p')?.lum).toBeUndefined();
    expect(parseSpectral('pec')).toBeNull();
    expect(parseSpectral(undefined)).toBeNull();
  });
  it('falls back to the colour index, then to plain "Star"', () => {
    expect(starKind({ bv: 1.6 })).toBe('Red star');
    expect(starKind({ bv: 0.0 })).toBe('Blue-white star');
    expect(starKind({ sp: 'pec', bv: 0.65 })).toBe('Yellow star');
    expect(starKind({})).toBe('Star');
  });
  it('explains colour, temperature and size class', () => {
    const e = spectralExplanation({ sp: 'M2Ib' })!;
    expect(e).toMatch(/red star/);
    expect(e).toMatch(/cooler than the Sun/);
    expect(e).toMatch(/Supergiants/);
    expect(spectralExplanation({ sp: 'G2V' })).toMatch(/about as hot as the Sun.*Main-sequence/);
    expect(spectralExplanation({})).toBeNull();
  });
  it('every catalog star gets a kind without throwing', () => {
    for (const s of cat.stars) expect(starKind(s)).toMatch(/[Ss]tar|dwarf/);
  });
});

describe('brightness wording', () => {
  it('glosses magnitudes', () => {
    expect(magnitudeGloss(-4.4)).toMatch(/brighter than any star/);
    expect(magnitudeGloss(0.45)).toMatch(/brightest stars/);
    expect(magnitudeGloss(2.0)).toMatch(/even from a city/);
    expect(magnitudeGloss(5.5)).toMatch(/dark country sky/);
    expect(magnitudeGloss(7.8)).toMatch(/binoculars/);
  });
  it('equipment and Bortle', () => {
    expect(equipmentForMagnitude(6.0)).toBe('naked-eye');
    expect(equipmentForMagnitude(7.8)).toBe('binoculars');
    expect(nakedEyeAtBortle(4.0, 8)).toBe(true);
    expect(nakedEyeAtBortle(4.5, 8)).toBe(false);
    expect(bortleSentence(2, 9)).toMatch(/^Visible to the naked eye/);
    expect(bortleSentence(5.0, 8)).toMatch(/Too faint.*Bortle 6/);
    expect(bortleSentence(7.0, 5)).toMatch(/Not a naked-eye object/);
  });
  it('luminosity against the Sun', () => {
    expect(luminosityVsSun(4.83)).toBeCloseTo(1, 6);
    expect(luminosityVsSun(-0.17)).toBeCloseTo(100, 3);
    expect(luminosityWords(-5.47)).toBe("about 13,000 times the Sun's light");
    expect(luminosityWords(1.45)).toBe("about 22 times the Sun's light");
    expect(luminosityWords(4.8)).toBe('about the same light as the Sun');
    expect(luminosityWords(9.83)).toBe("about 1/100 of the Sun's light");
  });
});

describe('deep-sky wording', () => {
  it('kinds read as plain words', () => {
    expect(dsoKind({ type: 'globular-cluster' })).toMatch(/^Globular cluster — a tight ball/);
    expect(dsoKind({ type: 'planetary-nebula' })).toMatch(/nothing to do with planets/);
  });
  it('flags large faint nebulae and galaxies but not clusters', () => {
    for (const id of ['NGC7000', 'NGC1499', 'NGC6960', 'M31', 'M33', 'NGC2237']) expect(dsoNeedsDarkSky(cat.dsoById.get(id)!), id).toBe(true);
    for (const id of ['M45', 'Mel25', 'M44', 'M13', 'M57']) expect(dsoNeedsDarkSky(cat.dsoById.get(id)!), id).toBe(false);
  });
  it('sizes', () => {
    expect(physicalSizeWords({ sizeArcmin: [16.5, 16.5], distLy: 22200 })).toBe('about 107 light-years across');
    expect(physicalSizeWords({ distLy: 100 })).toBeNull();
    expect(moonWidths(178)).toBe('about 5.7 times the width of the full Moon');
    expect(moonWidths(30)).toBe('about as wide as the full Moon');
    expect(moonWidths(2)).toBeNull();
  });
});

describe('fallback "how to find it"', () => {
  it('direction words', () => {
    expect(skyDirection(0)).toBe('north');
    expect(skyDirection(100)).toBe('east');
    expect(skyDirection(225)).toBe('southwest');
    expect(skyDirection(-45)).toBe('northwest');
  });
  it('nearest signpost star is brighter than 2.5 and never the target itself', () => {
    const betelgeuse = R('star:Betelgeuse');
    const sp = nearestSignpost(betelgeuse, cat, betelgeuse.star!.id)!;
    expect(sp.star.id).not.toBe(betelgeuse.star!.id);
    expect(sp.star.mag).toBeLessThan(2.5);
    expect(sp.star.name).toBe('Bellatrix');
    expect(sp.separation).toBeGreaterThan(6);
    expect(sp.separation).toBeLessThan(9);
    expect(sp.direction).toBe('east'); // Betelgeuse is east of Bellatrix
  });
  it('M13: constellation, hand-span offset and direction from a bright star, with sky links', () => {
    const text = fallbackHowToFind(R('dso:M13'), cat);
    expect(text).toMatch(/^Hercules Globular Cluster is in \[\[con:Her\|Hercules\]\]\./);
    expect(text).toMatch(/Look about [a-z -]+\(\d+°\) (north|south|east|west|northeast|northwest|southeast|southwest) of \[\[star:\d+\|[A-Z][a-z]+\]\] in [A-Z]/);
    expect(text).toMatch(/north is the direction towards the North Star/);
  });
  it('M42 sits just south of the Belt', () => {
    const text = fallbackHowToFind(R('dso:M42'), cat);
    expect(text).toMatch(/in \[\[con:Ori\|Orion\]\]/);
    expect(text).toMatch(/about (two|three) fingers \(\d°\) south(west|east)? of \[\[star:\d+\|(Alnitak|Alnilam)\]\]\./);
  });
  it('a bright star is described as bright, a faint one gets an offset', () => {
    expect(fallbackHowToFind(R('star:Sirius'), cat)).toMatch(/Sirius is the brightest star of \[\[con:CMa\|Canis Major\]\]/);
    expect(fallbackHowToFind(R('star:Albireo'), cat)).toMatch(/^Albireo is in \[\[con:Cyg\|Cygnus\]\]\. Look about /);
  });
  it('planets say where they are now and that it changes', () => {
    const t = cat.resolve('body:Jupiter', { date: new Date('2026-11-11T02:00:00Z'), observer: { name: 'B', lat: 40.68, lon: -73.94, tz: 'America/New_York' } })!;
    const text = fallbackHowToFind(t, cat, { con: 'Leo' });
    expect(text).toMatch(/^Jupiter is in \[\[con:Leo\|Leo\]\] at the moment\. Look .*Planets drift/);
  });
  it('constellations start from the brightest star', () => {
    expect(fallbackHowToFind(R('con:Lyr'), cat)).toMatch(/^Start from its brightest star, \[\[star:\d+\|Vega\]\] \(magnitude 0\.0\)\./);
    expect(fallbackHowToFind(R('con:Cnc'), cat)).toMatch(/which is not a bright one\. .* is about .* of \[\[star:/);
  });
  it('every constellation and every DSO produces a sentence', () => {
    for (const c of cat.constellations) expect(fallbackHowToFind(R(`con:${c.id}`), cat).length, c.id).toBeGreaterThan(40);
    for (const d of cat.dsos) {
      const text = fallbackHowToFind(R(`dso:${d.id}`), cat);
      expect(text, d.id).toMatch(/ is in \[\[con:/);
      expect(text, d.id).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('fallback "what it is" and small helpers', () => {
  it('builds a sentence from type data', () => {
    expect(fallbackAbout(R('dso:M13'), cat)).toBe('Hercules Globular Cluster is a globular cluster in Hercules, about 22,200 light-years away: a tight ball of tens of thousands to a million ancient stars.');
    expect(fallbackAbout(R('star:Betelgeuse'), cat)).toMatch(/^Betelgeuse is a red supergiant star in Orion, about 498 light-years away\. Supergiants/);
    expect(fallbackAbout(R('con:Ori'), cat)).toMatch(/^Orion is the constellation of the Hunter\. It covers 594 square degrees of sky, which ranks 26th of the 88/);
    expect(fallbackAbout(R('con:Leo'), cat)).toMatch(/zodiac/);
  });
  it('ordinals and month ranges', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 88].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '88th']);
    expect(monthRanges([12, 1, 2, 3])).toBe('December to March');
    expect(monthRanges([6])).toBe('June');
    expect(monthRanges([6, 7, 8])).toBe('June to August');
    expect(monthRanges([1, 2, 7, 8])).toBe('January to February and July to August');
    expect(monthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
    expect(monthRanges([])).toBe('');
  });
  it('counts figure stars at a limiting magnitude', () => {
    const ori = cat.conById.get('Ori')!;
    const city = figureStarsVisible(ori, cat, 3.8);
    const dark = figureStarsVisible(ori, cat, 7.3);
    expect(dark.visible).toBe(dark.total);
    expect(city.visible).toBeLessThan(dark.visible);
    expect(city.visible).toBeGreaterThanOrEqual(7); // the seven bright stars survive an inner-city sky
  });
  it('visibility targets: body id, constellation stars, single position', () => {
    expect(visTargetOf(R('body:Mars'), cat)).toBe('Mars');
    const con = visTargetOf(R('con:Ori'), cat);
    expect(typeof con === 'object' && 'points' in con && con.points.length).toBeGreaterThan(4);
    const ast = visTargetOf(R('asterism:big-dipper'), cat);
    expect(typeof ast === 'object' && 'points' in ast && ast.points.length).toBe(7);
    expect(visTargetOf(R('dso:M13'), cat)).toEqual({ ra: 250.4235, dec: 36.4613 });
  });
});
