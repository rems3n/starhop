/** Which constellations a quiz draws from. Pool specs are the strings stored in `QuizDifficulty.pool`. */
import { ANCHORS, type Constellation } from '@/types';

export interface PoolContext {
  constellations: Pick<Constellation, 'id' | 'season' | 'hemisphere'>[];
  units: { id: string; title: string; constellations: string[] }[];
  /** Ids of constellations visible tonight (from `tonight()`), needed for the `tonight` pool */
  tonightIds?: string[];
  /** Course constellation groups for the learner's location (resolveCourse), for `group:<id>` */
  groups?: { id: string; title: string; constellations: string[] }[];
}

export const SEASON_LABEL: Record<string, string> = {
  // evening visibility by month is the same in both hemispheres, so seasons are named by months
  winter: 'December–February evenings',
  spring: 'March–May evenings',
  summer: 'June–August evenings',
  autumn: 'September–November evenings',
  'north-circumpolar': 'Around the north celestial pole',
  'far-south': 'Around the south celestial pole',
};

/**
 * Constellation ids for a pool spec:
 *   anchors · season:<Season> · hemisphere:<N|S> · tonight · group:<course group id> · unit:<path unit id> (legacy) · all
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
    case 'group': {
      const g = ctx.groups?.find((x) => x.id === arg);
      if (g) return keep(g.constellations);
      return keep(ANCHORS);
    }
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

export function poolLabel(spec: string, ctx: Pick<PoolContext, 'units' | 'groups'>): string {
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
    case 'group':
      return ctx.groups?.find((g) => g.id === arg)?.title ?? 'The 15 anchors';
    case 'unit':
      return ctx.units.find((u) => u.id === arg)?.title ?? 'Path unit';
    default:
      return 'The 15 anchors';
  }
}

/** Options for the pool selector, grouped. */
export function poolOptions(ctx: Pick<PoolContext, 'units' | 'groups'>): { group: string; options: { value: string; label: string }[] }[] {
  const opt = (value: string) => ({ value, label: poolLabel(value, ctx) });
  return [
    { group: 'Start here', options: [opt('anchors'), opt('tonight')] },
    ...(ctx.groups?.length ? [{ group: 'Course groups for your location', options: ctx.groups.map((g) => opt(`group:${g.id}`)) }] : []),
    { group: 'By season', options: ['winter', 'spring', 'summer', 'autumn', 'north-circumpolar', 'far-south'].map((s) => opt(`season:${s}`)) },
    { group: 'By hemisphere', options: [opt('hemisphere:N'), opt('hemisphere:S')] },
    { group: 'Everything', options: [opt('all')] },
  ];
}
