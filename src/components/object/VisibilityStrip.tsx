import { memo } from 'react';
import { yearVisibility } from '@/astro';
import { zonedParts } from '@/lib/time';
import type { BodyId, Observer, VisibilityClass } from '@/types';

export type VisibilityTarget = BodyId | { ra: number; dec: number } | { points: { ra: number; dec: number }[] };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Short text shown inside each cell (so the strip never relies on colour alone) and the legend wording. */
export const VISIBILITY_CELL: Record<VisibilityClass, { short: string; legend: string; cls: string }> = {
  evening: { short: 'eve', legend: 'Evening', cls: 'eve' },
  morning: { short: 'morn', legend: 'Morning, before dawn', cls: 'morn' },
  'all-night': { short: 'all', legend: 'All night', cls: 'all' },
  'not-visible': { short: '–', legend: 'Not visible', cls: 'none' },
};
const LEGEND_ORDER: VisibilityClass[] = ['evening', 'all-night', 'morning', 'not-visible'];

function targetKey(t: VisibilityTarget): string {
  if (typeof t === 'string') return t;
  if ('points' in t) {
    let h = 0;
    for (const p of t.points) h = (h * 31 + Math.round(p.ra * 100) * 7 + Math.round(p.dec * 100)) | 0;
    return `p${t.points.length}:${h}`;
  }
  return `${t.ra.toFixed(3)},${t.dec.toFixed(3)}`;
}

const cache = new Map<string, VisibilityClass[]>();
const CACHE_MAX = 600;

/** Visibility class for the 15th of each month, memoised per target, place and year. */
export function yearClasses(target: VisibilityTarget, observer: Observer, year: number): VisibilityClass[] {
  const fixed = typeof target !== 'string';
  // Fixed stars repeat every year, so the year is only part of the key for the Sun, Moon and planets.
  const key = `${targetKey(target)}|${observer.lat.toFixed(2)},${observer.lon.toFixed(2)},${observer.tz}|${fixed ? '' : year}`;
  let v = cache.get(key);
  if (!v) {
    v = yearVisibility(target, year, observer).map((x) => x.cls);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, v);
  }
  return v;
}

export interface VisibilityStripProps {
  target: VisibilityTarget;
  observer: Observer;
  year?: number;
  showLegend?: boolean;
}

function VisibilityStripImpl({ target, observer, year, showLegend }: VisibilityStripProps) {
  const now = zonedParts(new Date(), observer.tz);
  const y = year ?? now.year;
  const classes = yearClasses(target, observer, y);
  const currentMonth = y === now.year ? now.month : 0;
  return (
    <div className="obj-vis">
      <ol className="obj-vis-strip" aria-label={`When it is visible from ${observer.name}, month by month`}>
        {classes.map((cls, i) => {
          const c = VISIBILITY_CELL[cls];
          const current = i + 1 === currentMonth;
          return (
            <li key={i} className={`obj-vis-cell obj-vis-cell--${c.cls}${current ? ' is-current' : ''}`} aria-current={current ? 'date' : undefined} title={`${MONTH_LONG[i]}: ${c.legend.toLowerCase()}${current ? ' (this month)' : ''}`}>
              <span className="obj-vis-month" aria-hidden>{MONTH_SHORT[i][0]}</span>
              <span className="obj-vis-code" aria-hidden>{c.short}</span>
              <span className="sr-only">{`${MONTH_LONG[i]}: ${c.legend.toLowerCase()}`}</span>
            </li>
          );
        })}
      </ol>
      {showLegend && (
        <ul className="obj-vis-legend" aria-label="Legend">
          {LEGEND_ORDER.map((cls) => (
            <li key={cls}>
              <span className={`obj-vis-swatch obj-vis-cell--${VISIBILITY_CELL[cls].cls}`} aria-hidden>{VISIBILITY_CELL[cls].short}</span>
              {VISIBILITY_CELL[cls].legend}
            </li>
          ))}
          {currentMonth > 0 && (
            <li>
              <span className="obj-vis-swatch obj-vis-swatch--current" aria-hidden />
              This month
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function sameTarget(a: VisibilityTarget, b: VisibilityTarget): boolean {
  return a === b || targetKey(a) === targetKey(b);
}

/** Twelve-month strip: visible in the evening / morning / all night / not visible, computed for the observer. */
export const VisibilityStrip = memo(VisibilityStripImpl, (a, b) =>
  a.year === b.year && a.showLegend === b.showLegend && a.observer.lat === b.observer.lat && a.observer.lon === b.observer.lon && a.observer.tz === b.observer.tz && a.observer.name === b.observer.name && sameTarget(a.target, b.target),
);
