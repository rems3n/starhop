import { describe, expect, it } from 'vitest';
import { resolveCourse, prominence, SEASON_GROUPS, starhopsFor } from '@/content/course';
import { starhops } from '@/content';
import { learnCatalog } from './learn-catalog';

const NY = { name: 'New York', lat: 40.7, lon: -74, tz: 'America/New_York' };
const SYD = { name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' };
const UIO = { name: 'Quito', lat: -0.18, lon: -78.47, tz: 'America/Guayaquil' };

const anchorsOf = (o: typeof NY) => resolveCourse(o, learnCatalog()).modules.find((m) => m.kind === 'anchors')!.groups.flatMap((g) => g.constellations);
const groupsOf = (o: typeof NY, kind: string) => resolveCourse(o, learnCatalog()).modules.find((m) => m.kind === kind)!.groups;

describe('resolveCourse', () => {
  it('picks 15 familiar anchors at 40.7°N', () => {
    const a = anchorsOf(NY);
    expect(a).toHaveLength(15);
    for (const id of ['UMa', 'Cas', 'Ori', 'Tau', 'CMa', 'Gem', 'Leo', 'Boo', 'Vir', 'Lyr', 'Cyg', 'Aql', 'Aur']) expect(a).toContain(id);
  });
  it('picks the southern showpieces at 33.9°S', () => {
    const a = anchorsOf(SYD);
    expect(a).toHaveLength(15);
    for (const id of ['Cru', 'Cen', 'Car', 'Vel', 'Sco', 'Ori', 'CMa']) expect(a).toContain(id);
    for (const id of ['UMa', 'Cas', 'UMi']) expect(a).not.toContain(id);
  });
  it('mixes both hemispheres at the equator', () => {
    const a = anchorsOf(UIO);
    expect(a).toHaveLength(15);
    for (const id of ['Ori', 'Cru', 'Lyr', 'Cen', 'Sco']) expect(a).toContain(id);
  });
  it('places every constellation exactly once', () => {
    for (const o of [NY, SYD, UIO]) {
      const c = resolveCourse(o, learnCatalog());
      expect(c.allConstellations).toHaveLength(learnCatalog().constellations.length);
      expect(new Set(c.allConstellations).size).toBe(c.allConstellations.length);
    }
  });
  it('groups by evening months with hemisphere-neutral titles and a circumpolar group', () => {
    const ny = groupsOf(NY, 'seasons');
    expect(ny.map((g) => g.id)).toEqual(['dec-feb', 'mar-may', 'jun-aug', 'sep-nov', 'circumpolar']);
    expect(ny[0].title).toBe('December–February evenings');
    expect(ny.find((g) => g.id === 'circumpolar')!.constellations).toContain('UMi');
    // Orion is a December–February constellation from both hemispheres
    expect(groupsOf(NY, 'anchors').find((g) => g.constellations.includes('Ori'))!.id).toBe('dec-feb');
    expect(groupsOf(SYD, 'anchors').find((g) => g.constellations.includes('Ori'))!.id).toBe('dec-feb');
    expect(groupsOf(UIO, 'seasons').some((g) => g.id === 'circumpolar')).toBe(false);
    expect(SEASON_GROUPS.flatMap((g) => g.months).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('lists what never rises as beyond the horizon', () => {
    const ny = groupsOf(NY, 'beyond').flatMap((g) => g.constellations);
    expect(ny).toEqual(expect.arrayContaining(['Cru', 'Oct', 'Car']));
    const syd = groupsOf(SYD, 'beyond').flatMap((g) => g.constellations);
    expect(syd).toEqual(expect.arrayContaining(['UMi', 'Cas']));
    expect(syd).not.toContain('UMa');
  });
  it('orders groups by prominence and memoises per location', () => {
    const cat = learnCatalog();
    for (const g of groupsOf(NY, 'seasons')) {
      const scores = g.constellations.map((id) => prominence(cat.conById.get(id)!, cat));
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
    expect(resolveCourse(NY, cat)).toBe(resolveCourse({ ...NY, name: 'x' }, cat));
  });
  it('filters star-hops by hemisphere', () => {
    for (const lat of [40, -34, 0]) {
      const ids = starhopsFor(lat);
      const ranks = ids.map((id) => starhops.find((h) => h.id === id)!.rank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      if (lat > 15) for (const id of ids) expect(starhops.find((h) => h.id === id)!.hemisphere).not.toBe('S');
      if (lat < -15) for (const id of ids) expect(starhops.find((h) => h.id === id)!.hemisphere).not.toBe('N');
    }
  });
});
