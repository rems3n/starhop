/**
 * How to present an object the learner asked for by name (search, assistant, links): the live sky if it is up in a
 * dark sky now, otherwise tonight at its best time, otherwise the atlas (no horizon, no clock). Pure logic.
 */
import { altAzOf, bestMonths, currentNightDate, getBody, visibilityOn } from '@/astro';
import { monthRanges } from '@/components/object/describe';
import { visTargetOf } from '@/components/object/targets';
import type { Catalog } from '@/data/catalog';
import { formatTime } from '@/lib/time';
import type { Observer, ResolvedTarget } from '@/types';

/** Below this altitude an object is too low to count as "up" when there is a better time tonight */
export const UP_MIN_ALT = 10;
/** The Sun must be at least this far down for the live sky to show stars */
export const DARK_ENOUGH_SUN_ALT = -6;

export type Presentation =
  | { mode: 'live' }
  /** Move the clock to `time` (tonight, when the object is highest in a dark sky) */
  | { mode: 'time'; time: Date; message: string }
  /** Not visible tonight at all: show it on the atlas */
  | { mode: 'atlas'; message: string };

export function choosePresentation(t: ResolvedTarget, date: Date, observer: Observer, catalog: Catalog): Presentation {
  if (t.kind === 'point') return { mode: 'live' };
  const pos = t.body ? getBody(t.body, date, observer) : altAzOf(t.ra, t.dec, date, observer);
  const sunAlt = getBody('Sun', date, observer).alt;
  if (t.body === 'Sun') return pos.alt > 0 ? { mode: 'live' } : { mode: 'atlas', message: `The Sun is below the horizon from ${observer.name} right now. Showing where it is on the atlas.` };
  const dark = sunAlt <= DARK_ENOUGH_SUN_ALT || t.body === 'Moon';
  if (pos.alt >= UP_MIN_ALT && dark) return { mode: 'live' };
  const vt = visTargetOf(t, catalog);
  const v = visibilityOn(vt, currentNightDate(date, observer), observer);
  if (v.bestTime && v.cls !== 'not-visible') {
    const why = pos.alt < UP_MIN_ALT ? (pos.alt <= 0 ? 'is below the horizon right now' : 'is very low right now') : 'is lost in daylight right now';
    return { mode: 'time', time: v.bestTime, message: `${t.name} ${why}. Showing tonight at ${formatTime(v.bestTime, observer.tz)}, when it is highest in a dark sky.` };
  }
  if (pos.alt > 0 && dark) return { mode: 'live' };
  let when = '';
  if (!t.body) {
    try {
      const months = bestMonths(vt, observer);
      when = months.length ? ` Best seen in the evening: ${monthRanges(months)}.` : ` It never rises high enough from ${observer.name}.`;
    } catch { /* optional */ }
  }
  return { mode: 'atlas', message: `${t.name} is not visible from ${observer.name} tonight.${when} Showing it on the atlas, which has no horizon or time of day.` };
}
