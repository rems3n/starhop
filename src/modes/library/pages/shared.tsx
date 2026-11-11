import type { VisibilityClass } from '@/types';
import type { FilterSpec } from '../logic/table';

/** Compact distance for table cells: "8.6 ly", "1,340 ly", "2.5 million ly". */
export function formatLy(ly: number | undefined): string {
  if (ly == null || !isFinite(ly) || ly <= 0) return '—';
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(1)} billion ly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million ly`;
  if (ly >= 1000) return `${(Math.round(ly / 10) * 10).toLocaleString('en-US')} ly`;
  if (ly >= 100) return `${Math.round(ly)} ly`;
  return `${ly.toFixed(1)} ly`;
}

/**
 * "Visible from you": rises high enough at some time of year (geometry, instant), never does, or is in a dark
 * sky tonight (computed on demand, a few rows per tick, only when that option is chosen).
 */
export function visibilityFilter<R>(rises: (r: R) => boolean, tonight: (r: R) => VisibilityClass | undefined): FilterSpec<R> {
  return {
    id: 'visible',
    label: 'Visible from you',
    kind: 'select',
    anyLabel: 'Anywhere on Earth',
    options: [
      { value: 'yes', label: 'Rises high enough here' },
      { value: 'tonight', label: 'In tonight’s dark sky' },
      { value: 'never', label: 'Never rises high enough here' },
    ],
    test: (r, v) => {
      if (v === 'yes') return rises(r);
      if (v === 'never') return !rises(r);
      const c = tonight(r);
      return c != null && c !== 'not-visible';
    },
  };
}
