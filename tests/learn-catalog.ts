/** The full catalog (with `resolve`) for Learn tests, built from public/data like the app does. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCatalog, type Catalog } from '@/data/catalog';

const read = (f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${f}`, import.meta.url)), 'utf8'));
let cached: Catalog | undefined;
export function learnCatalog(): Catalog {
  return (cached ??= buildCatalog({ stars: read('stars.json'), constellations: read('constellations.json'), dsos: read('dsos.json') }));
}
