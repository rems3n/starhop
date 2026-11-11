/** Which constellations a quiz draws from. Pool specs are the strings stored in `QuizDifficulty.pool`. */
import { ANCHORS, type Constellation } from '@/types';

export interface PoolContext {
  constellations: Pick<Constellation, 'id' | 'season' | 'hemisphere'>[];
  units: { id: string; title: string; constellations: string[] }[];
  /** Ids of constellations visible tonight (from `tonight()`), needed for the `tonight` pool */
  tonightIds?: string[];
}

export const SEASON_LABEL: Record<string, string> = {
  winter: 'Winter evenings',
  spring: 'Spring evenings',
  summer: 'Summer evenings',
  autumn: 'Autumn evenings',
  'north-circumpolar': 'Around the north pole',
  'far-south': 'Far southern sky',
};

/**
 * Constellation ids for a pool spec:
 *   anchors · season:<Season> · hemisphere:<N|S> · tonight · unit:<path unit id> · all
 * Unknown ids are dropped; an unknown spec falls back to the anchors. Order: anchors and units keep their
 * authored order, `tonight` keeps the order given (best time first), the rest follow the catalog.
 */
export function buildPool(spec: string, ctx: PoolContext): string[] {
  const known = new Set(ctx.constellations.map((c) => c.id));
  const keep = (ids: readonly string[]) => [...new Set(ids)].filter((id) => known.has(id));
  const [kind, arg] = splitSpec(spec);
  switch (kind) {
    case 'all':
      return ctx.constellations.map((c) => c.id);
    case 'season':
      return ctx.constellations.filter((c) => c.season === arg).map((c) => c.id);
    case 'hemisphere':
      return ctx.constellations.filter((c) => c.hemisphere === arg).map((c) => c.id);
    case 'tonight':
      return keep(ctx.tonightIds ?? []);
    case 'unit':
      return keep(ctx.units.find((u) => u.id === arg)?.constellations ?? []);
    case 'anchors':
    default:
      return keep(ANCHORS);
  }
}

export function splitSpec(spec: string): [string, string] {
  const i = spec.indexOf(':');
  return i < 0 ? [spec, ''] : [spec.slice(0, i), spec.slice(i + 1)];
}

export function poolLabel(spec: string, ctx: Pick<PoolContext, 'units'>): string {
  const [kind, arg] = splitSpec(spec);
  switch (kind) {
    case 'all':
      return 'All 88 constellations';
    case 'season':
      return SEASON_LABEL[arg] ?? 'By season';
    case 'hemisphere':
      return arg === 'S' ? 'Southern hemisphere' : 'Northern hemisphere';
    case 'tonight':
      return "Tonight's sky";
    case 'unit':
      return ctx.units.find((u) => u.id === arg)?.title ?? 'Path unit';
    default:
      return 'The 15 anchors';
  }
}

/** Options for the pool selector, grouped. */
export function poolOptions(ctx: Pick<PoolContext, 'units'>): { group: string; options: { value: string; label: string }[] }[] {
  const opt = (value: string) => ({ value, label: poolLabel(value, ctx) });
  return [
    { group: 'Start here', options: [opt('anchors'), opt('tonight')] },
    { group: 'By season', options: ['winter', 'spring', 'summer', 'autumn', 'north-circumpolar', 'far-south'].map((s) => opt(`season:${s}`)) },
    { group: 'By hemisphere', options: [opt('hemisphere:N'), opt('hemisphere:S')] },
    { group: 'Path units', options: ctx.units.map((u) => opt(`unit:${u.id}`)) },
    { group: 'Everything', options: [opt('all')] },
  ];
}
