/** Time-zone helpers built on Intl only (no dependency). */
import type { Observer } from '@/types';

export interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; second: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute, second: out.second };
}

/** The instant at which the wall clock in `tz` reads the given local date/time. Month is 1–12. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let t = guess;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(t), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = asUtc - guess;
    if (diff === 0) break;
    t -= diff;
  }
  return new Date(t);
}

/**
 * Parse a lesson-demo time spec (see src/content/schema.ts):
 * "now" | "tonight HH:MM" | "YYYY-MM-DD HH:MM" | "month:<1-12> HH:MM"
 */
export function parseTimeSpec(spec: string, observer: Pick<Observer, 'tz'>, now: Date = new Date()): Date {
  if (spec === 'now') return now;
  const today = zonedParts(now, observer.tz);
  let m = /^tonight (\d{2}):(\d{2})$/.exec(spec);
  if (m) return zonedToUtc(today.year, today.month, today.day, +m[1], +m[2], observer.tz);
  m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(spec);
  if (m) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], observer.tz);
  m = /^month:(\d{1,2}) (\d{2}):(\d{2})$/.exec(spec);
  if (m) return zonedToUtc(today.year, +m[1], 15, +m[2], +m[3], observer.tz);
  throw new Error(`Bad time spec: ${spec}`);
}

export function formatTime(date: Date | null | undefined, tz: string): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatDate(date: Date, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(date);
}

export function formatDateTime(date: Date, tz: string): string {
  return `${formatDate(date, tz, { month: 'short', day: 'numeric', year: 'numeric' })}, ${formatTime(date, tz)}`;
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
