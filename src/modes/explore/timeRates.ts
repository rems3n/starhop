/** Pure time-control logic for the Explore time bar. Unit-tested in tests/explore-time.test.ts. */
import { zonedParts, zonedToUtc } from '@/lib/time';

/** Simulated seconds per real second, slowest-backwards to fastest-forwards. Pause is separate (rate 0). */
export const TIME_RATES = [-86400, -3600, -600, -60, 1, 60, 600, 3600, 86400] as const;
export const REAL_TIME_INDEX = TIME_RATES.indexOf(1);

/** Index of the fixed rate closest to an arbitrary rate (so an engine rate set elsewhere still maps to a step). */
export function rateIndex(rate: number): number {
  let best = REAL_TIME_INDEX;
  let bestD = Infinity;
  TIME_RATES.forEach((r, i) => {
    const d = Math.abs(r - rate);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Next rate one step faster (+1) or slower (−1); stays at the ends. */
export function stepRate(rate: number, dir: 1 | -1): number {
  const i = Math.min(TIME_RATES.length - 1, Math.max(0, rateIndex(rate) + dir));
  return TIME_RATES[i];
}

export function canStepRate(rate: number, dir: 1 | -1): boolean {
  const i = rateIndex(rate) + dir;
  return i >= 0 && i < TIME_RATES.length;
}

/** The rate in words: "Real time", "10 minutes per second", "1 day per second, backwards", "Paused". */
export function rateWords(rate: number): string {
  if (rate === 0) return 'Paused';
  if (rate === 1) return 'Real time';
  const a = Math.abs(rate);
  const [n, unit] = a >= 86400 ? [a / 86400, 'day'] : a >= 3600 ? [a / 3600, 'hour'] : a >= 60 ? [a / 60, 'minute'] : [a, 'second'];
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${num} ${unit}${n === 1 ? '' : 's'} per second${rate < 0 ? ', backwards' : ''}`;
}

/** Compact form for narrow screens: "1 min/s", "−1 day/s", "real time". */
export function rateShort(rate: number): string {
  if (rate === 0) return 'paused';
  if (rate === 1) return 'real time';
  const a = Math.abs(rate);
  const [n, unit] = a >= 86400 ? [a / 86400, 'day'] : a >= 3600 ? [a / 3600, 'hr'] : a >= 60 ? [a / 60, 'min'] : [a, 's'];
  return `${rate < 0 ? '−' : ''}${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}/s`;
}

export type StepUnit = 'hour' | 'day' | 'sidereal-day' | 'month' | 'year';

export const STEP_UNITS: { value: StepUnit; label: string; hint: string }[] = [
  { value: 'hour', label: 'Hour', hint: 'One hour: the sky turns 15°.' },
  { value: 'day', label: 'Day', hint: 'Same clock time on the next day: the stars have moved on by about 1°.' },
  { value: 'sidereal-day', label: 'Sidereal day', hint: '23 h 56 min, one full turn of the Earth: the stars return to exactly the same place, and only the Sun, Moon and planets move.' },
  { value: 'month', label: 'Month', hint: 'Same clock time a month later: the stars have shifted about 30° west.' },
  { value: 'year', label: 'Year', hint: 'Same date and time a year later: the stars are back, the planets are not.' },
];

/** One rotation of the Earth relative to the stars (23 h 56 min 4.09 s), in whole milliseconds. */
export const SIDEREAL_DAY_MS = 86164091;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Step the clock. Hours and sidereal days are exact durations; day, month and year keep the same wall-clock
 * time in the observer's time zone (so a step across a daylight-saving change still lands on "9 pm").
 */
export function stepTime(date: Date, unit: StepUnit, dir: 1 | -1, tz: string): Date {
  if (unit === 'hour') return new Date(date.getTime() + dir * 3600000);
  if (unit === 'sidereal-day') return new Date(date.getTime() + dir * SIDEREAL_DAY_MS);
  const p = zonedParts(date, tz);
  let { year, month, day } = p;
  if (unit === 'day') {
    const d = new Date(Date.UTC(year, month - 1, day + dir));
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  } else {
    if (unit === 'month') {
      month += dir;
      if (month > 12) (month = 1), year++;
      if (month < 1) (month = 12), year--;
    } else year += dir;
    day = Math.min(day, daysInMonth(year, month));
  }
  const t = zonedToUtc(year, month, day, p.hour, p.minute, tz);
  return new Date(t.getTime() + p.second * 1000 + (date.getTime() % 1000));
}

/** Value for <input type="datetime-local"> showing an instant in a time zone. */
export function toLocalInputValue(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const z = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${z(p.year, 4)}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

/** Parse a datetime-local value as wall-clock time in a time zone. Null if it is not a complete value. */
export function fromLocalInputValue(value: string, tz: string): Date | null {
  const m = /^(-?\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +m[4], +m[5]];
  if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59) return null;
  const t = zonedToUtc(y, mo, d, h, mi, tz);
  return isNaN(t.getTime()) ? null : t;
}

const WIND = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** "Looking SSE, 34° up" from the centre of an alt-az view. */
export function lookingWords(az: number, alt: number): string {
  const a = Math.round(alt);
  if (a >= 85) return 'Looking straight up';
  const dir = WIND[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
  if (a <= -1) return `Looking ${dir}, ${-a}° below the horizon`;
  return a === 0 ? `Looking ${dir}, at the horizon` : `Looking ${dir}, ${a}° up`;
}

/** "60° field", "2.5° field" */
export function fovWords(fov: number): string {
  return `${fov >= 10 ? Math.round(fov) : fov.toFixed(1)}° field of view`;
}
