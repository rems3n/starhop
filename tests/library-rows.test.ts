import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ConstellationContent, Starhop } from '@/content/schema';
import {
  buildConRows, buildDsoRows, buildMythRows, buildStarRows, cultureFamily, dsoGroup, dsoLabel, hasCharacter, hopUsableNow, hopSuitsHemisphere, isLibraryStar,
  magBand, maxAltitude, reachOf, spectralLetter, stepSpan, tally, colourOf,
} from '@/modes/library/logic/rows';
import { learnCatalog } from './learn-catalog';

const conDir = fileURLToPath(new URL('../src/content/constellations/', import.meta.url));
const contents: ConstellationContent[] = readdirSync(conDir).map((f) => JSON.parse(readFileSync(conDir + f, 'utf8')));
const cat = learnCatalog();
const conName = (id: string) => cat.conById.get(id)?.name ?? id;

/** Temporary fixtures shaped like src/content/starhops.json (not written to that file). */
const hop = (o: Partial<Starhop>): Starhop => ({
  id: 'x', name: 'X hop', rank: 1, method: 'line', from: 'star:Dubhe', to: 'star:Polaris', summary: 'A summary that is at least thirty characters.', steps: ['a', 'b'],
  path: ['star:Merak', 'star:Dubhe', 'star:Polaris'], distanceDeg: 28, hemisphere: 'N', monthsNorth: [1, 2, 3], monthsSouth: [], constellations: ['UMa', 'UMi'], next: [], ...o,
});

describe('library rows', () => {
  it('reach: geometry of the highest point a declination reaches', () => {
    expect(maxAltitude(89, 40)).toBeCloseTo(41);
    expect(maxAltitude(-60, 40)).toBeCloseTo(-10);
    expect(reachOf([10, 20], 40)).toBe('yes');
    expect(reachOf([10, -45], 40)).toBe('partly'); // -45 tops out at 5°
    expect(reachOf([-70, -80], 40)).toBe('never');
    expect(reachOf([80, 85], -33.9)).toBe('never'); // Ursa Minor from Sydney
    expect(reachOf([], 0)).toBe('never');
  });

  it('constellation rows: 88, ranked by area, with myth counts and kind from content', () => {
    const rows = buildConRows(cat.constellations, cat.starById, new Map(contents.map((c) => [c.id, c])));
    expect(rows).toHaveLength(88);
    expect(rows.find((r) => r.id === 'Hya')!.areaRank).toBe(1);
    expect(rows.find((r) => r.id === 'Cru')!.areaRank).toBe(88);
    const ori = rows.find((r) => r.id === 'Ori')!;
    expect(ori.myths).toBeGreaterThan(0);
    expect(ori.kind).toBe('ancient');
    expect(['Rigel', 'Betelgeuse']).toContain(ori.brightestName);
    expect(reachOf(rows.find((r) => r.id === 'Cru')!.mainDecs, 40.7)).toBe('never');
    expect(reachOf(rows.find((r) => r.id === 'Cru')!.mainDecs, -33.9)).toBe('yes');
  });

  it('myth rows: every story, with culture families and merged author names', () => {
    const rows = buildMythRows(contents, conName);
    expect(rows.length).toBe(contents.reduce((n, c) => n + c.stories.length, 0));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(cultureFamily('Greek (Athenian)')).toBe('Greek');
    expect(cultureFamily('Hellenistic Greek (Ptolemaic Egypt): a court legend')).toBe('Greek');
    expect(cultureFamily('Syrian, as told by a Roman writer')).toBe('Syrian');
    expect(rows.flatMap((r) => r.authors)).not.toContain('Germanicus Caesar');
    const t = tally(rows.map((r) => [r.cultureFamily]));
    expect(t[0].value).toBe('Greek');
    expect(hasCharacter(['Zeus', 'Hera'], 'zeu')).toBe(true);
    expect(hasCharacter(['Zeus'], 'apollo')).toBe(false);
  });

  it('star rows: proper names plus Bayer stars brighter than 3.5', () => {
    const rows = buildStarRows(cat.stars, conName, new Set(['star:' + cat.resolve('star:Vega')!.star!.id]));
    expect(rows.length).toBe(cat.stars.filter(isLibraryStar).length);
    expect(rows.length).toBeGreaterThan(400);
    const vega = rows.find((r) => r.proper === 'Vega')!;
    expect(vega.hasWriteup).toBe(true);
    expect(vega.spLetter).toBe('A');
    expect(spectralLetter('M1-2Ia-Iab')).toBe('M');
    expect(spectralLetter('dF3')).toBe('F');
    expect(spectralLetter('WC8')).toBe('');
    expect(colourOf({ sp: undefined, bv: 1.6 })).toBe('red');
    expect(colourOf({ sp: 'M1: comp', bv: 0.795 })).toBe('yellow'); // Capella
    expect(colourOf({ sp: 'K0III', bv: undefined })).toBe('orange');
    expect(magBand(-1.4)).toBe('lt1');
    expect(magBand(2.5)).toBe('2-3');
  });

  it('deep-sky rows: labels, groups, catalogues', () => {
    const rows = buildDsoRows(cat.dsos, conName, () => false, new Set());
    expect(rows).toHaveLength(cat.dsos.length);
    expect(rows.filter((r) => r.catalogue === 'messier')).toHaveLength(110);
    const m42 = rows.find((r) => r.label === 'M42')!;
    expect(m42.ids).toMatch(/NGC ?1976/);
    expect(dsoLabel({ id: 'NGC869', aka: [] })).toBe('NGC 869');
    expect(dsoGroup('supernova-remnant')).toBe('nebula');
    expect(dsoGroup('star-cloud')).toBe('open-cluster');
  });

  it('star-hops: hemisphere and this-month usability', () => {
    const north = hop({ hemisphere: 'N', monthsNorth: [3, 4], monthsSouth: [] });
    const both = hop({ hemisphere: 'both', monthsNorth: [1], monthsSouth: [7] });
    expect(hopUsableNow(north, 40, 3)).toBe(true);
    expect(hopUsableNow(north, 40, 9)).toBe(false);
    expect(hopUsableNow(north, -30, 3)).toBe(false);
    expect(hopSuitsHemisphere(north, -30)).toBe(false);
    expect(hopUsableNow(both, -30, 7)).toBe(true);
    expect(hopUsableNow(both, -30, 1)).toBe(false);
  });

  it('star-hop steps map to the part of the path they talk about', () => {
    const path = ['star:1', 'star:2', 'star:3', 'star:4'];
    const canon = (r: string) => (r.startsWith('star:') ? r : null);
    expect(stepSpan('From [[star:1|A]] to [[star:3|C]]', 0, 3, path, canon)).toEqual([0, 2]);
    expect(stepSpan('Find [[star:3|C]]', 1, 3, path, canon)).toEqual([1, 2]);
    expect(stepSpan('Start at [[star:1|A]]', 0, 3, path, canon)).toEqual([0, 1]);
    // no links: matched by position across the legs
    expect(stepSpan('Look up', 0, 3, path, canon)).toEqual([0, 1]);
    expect(stepSpan('Look up', 2, 3, path, canon)).toEqual([2, 3]);
    expect(stepSpan('Look up', 1, 2, ['star:1', 'star:2'], canon)).toEqual([0, 1]);
  });
});
