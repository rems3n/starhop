/** Test helpers: the real catalog from public/data (null until the data pipeline has run) and sample observers. */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Constellation, Observer, Star } from '@/types';
import type { MeteorShower } from '@/content/schema';

export interface TestCatalog { stars: Star[]; constellations: Constellation[]; starById: Map<number, Star>; conById: Map<string, Constellation> }

const path = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));

export function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(path(`tests/fixtures/${name}`), 'utf8')) as T;
}

let cached: TestCatalog | null | undefined;
export function loadTestCatalog(): TestCatalog | null {
  if (cached !== undefined) return cached;
  const s = path('public/data/stars.json'), c = path('public/data/constellations.json');
  if (!existsSync(s) || !existsSync(c)) return (cached = null);
  const stars = JSON.parse(readFileSync(s, 'utf8')) as Star[];
  const constellations = JSON.parse(readFileSync(c, 'utf8')) as Constellation[];
  return (cached = { stars, constellations, starById: new Map(stars.map((x) => [x.id, x])), conById: new Map(constellations.map((x) => [x.id, x])) });
}

export const BROOKLYN: Observer = { name: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, tz: 'America/New_York', elevationM: 10 };
export const SYDNEY: Observer = { name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney', elevationM: 20 };
export const TROMSO: Observer = { name: 'Tromsø', lat: 69.65, lon: 18.96, tz: 'Europe/Oslo', elevationM: 10 };

const shower = (id: string, name: string, lon: number, ra: number, dec: number, con: string, zhr: number): MeteorShower => ({
  id, name, peakSolarLongitude: lon, activeFrom: '01-01', activeTo: '01-02', zhr, radiant: { ra, dec, con }, speedKmS: 40, parent: 'test', note: 'test', source: 'IMO working list values',
});
/** Solar longitudes (J2000) and radiants as published in the IMO working list of visual meteor showers. */
export const TEST_SHOWERS: MeteorShower[] = [
  shower('quadrantids', 'Quadrantids', 283.15, 230, 49, 'Boo', 80),
  shower('perseids', 'Perseids', 140.0, 48, 58, 'Per', 100),
  shower('geminids', 'Geminids', 262.2, 112, 33, 'Gem', 150),
];
