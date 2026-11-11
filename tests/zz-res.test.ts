import { it } from 'vitest';
import { learnCatalog } from './learn-catalog';
it('r', () => { const c = learnCatalog(); for (const r of (process.env.REFS ?? '').split(',')) { const t = c.resolve(r); console.log(r, t ? `${t.name} ${t.ra.toFixed(1)} ${t.dec.toFixed(1)}` : 'NULL'); } });
