/** How many catalog stars are above the horizon at or brighter than a limiting magnitude. Pure. */
import { makeAltAz } from '@/astro/frames';
import type { FaintStars, Observer, Star } from '@/types';

export function countStarsUp(stars: Pick<Star, 'ra' | 'dec' | 'mag'>[], faint: FaintStars | null | undefined, limitingMag: number, date: Date, observer: Observer): number {
  const altAz = makeAltAz(date, observer);
  let n = 0;
  for (const s of stars) {
    if (s.mag > limitingMag) break; // sorted brightest first
    if (altAz(s.ra, s.dec).alt > 0) n++;
  }
  if (faint) {
    for (let i = 0; i < faint.mag.length; i++) {
      if (faint.mag[i] > limitingMag) break;
      if (altAz(faint.ra[i], faint.dec[i]).alt > 0) n++;
    }
  }
  return n;
}

/** Round a count the way you would say it: 312 → "about 310", 2,487 → "about 2,500", 14 → "14". */
export function aboutCount(n: number): string {
  if (n < 30) return String(n);
  const step = n < 1000 ? 10 : 100;
  return `about ${(Math.round(n / step) * step).toLocaleString('en-US')}`;
}

/** What the Sun's altitude means for star counting. */
export function skyBrightness(sunAlt: number): 'day' | 'twilight' | 'night' {
  return sunAlt > -0.8 ? 'day' : sunAlt > -12 ? 'twilight' : 'night';
}
