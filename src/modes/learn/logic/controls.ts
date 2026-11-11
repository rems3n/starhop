/** Pure helpers behind the demo control widgets (time scrub, ± day, ± month, latitude, Bortle). */
import { zonedParts, zonedToUtc } from '@/lib/time';
import { BORTLE, type Observer } from '@/types';

/** Rate used by the play button when the step itself has no `rate`: half an hour of sky per second. */
export const DEFAULT_PLAY_RATE = 1800;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Same wall-clock time, `days` later (or earlier) in the observer's time zone. Daylight-saving safe. */
export function shiftLocalDays(date: Date, days: number, tz: string): Date {
  const p = zonedParts(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p.hour, p.minute, tz);
}

/** Same wall-clock time and day of month, `months` later. The 31st becomes the last day of a shorter month. */
export function shiftLocalMonths(date: Date, months: number, tz: string): Date {
  const p = zonedParts(date, tz);
  const idx = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(idx / 12);
  const month = (((idx % 12) + 12) % 12) + 1;
  return zonedToUtc(year, month, Math.min(p.day, daysInMonth(year, month)), p.hour, p.minute, tz);
}

export const SCRUB_STEP_MIN = 5;

/**
 * The span the time-scrub slider covers. For an evening or night-time step: 4 pm to 8 am around that
 * night. For a daytime step (the Sun's path, an eclipse): the whole local day, midnight to midnight.
 */
export function scrubRange(time: Date, tz: string): { start: Date; end: Date; minutes: number } {
  const p = zonedParts(time, tz);
  const at = (dayOffset: number, hour: number) => {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
    return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, 0, tz);
  };
  let start: Date, end: Date;
  if (p.hour >= 16) [start, end] = [at(0, 16), at(1, 8)];
  else if (p.hour < 8) [start, end] = [at(-1, 16), at(0, 8)];
  else [start, end] = [at(0, 0), at(1, 0)];
  return { start, end, minutes: Math.round((end.getTime() - start.getTime()) / 60000) };
}

export function scrubValue(time: Date, range: { start: Date; minutes: number }): number {
  const m = Math.round((time.getTime() - range.start.getTime()) / 60000 / SCRUB_STEP_MIN) * SCRUB_STEP_MIN;
  return Math.min(range.minutes, Math.max(0, m));
}

export function scrubTime(value: number, range: { start: Date }): Date {
  return new Date(range.start.getTime() + value * 60000);
}

/** "41°N", "34°S", "the equator". */
export function latitudeLabel(lat: number): string {
  const r = Math.round(lat);
  if (r === 0) return 'the equator (0°)';
  if (r === 90) return 'the North Pole (90°N)';
  if (r === -90) return 'the South Pole (90°S)';
  return `${Math.abs(r)}°${r > 0 ? 'N' : 'S'}`;
}

/** The step's observer moved to another latitude (same longitude and clock). */
export function observerAtLatitude(base: Observer, lat: number): Observer {
  const clamped = Math.min(90, Math.max(-90, lat));
  return { ...base, lat: clamped, name: Math.round(clamped) === Math.round(base.lat) ? base.name : `Latitude ${latitudeLabel(clamped)}` };
}

export function bortleLabel(n: number): string {
  const b = BORTLE[Math.min(9, Math.max(1, Math.round(n))) - 1];
  return `Bortle ${b.n}: ${b.label.toLowerCase()}`;
}
