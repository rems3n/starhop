/**
 * Location tokens for authored text (docs/briefs/location-neutral-text.md). Filled in by <RichText>.
 *   {{place}} {{lat}} {{poleAltitude}} {{pole}} {{poleStar}} {{equatorSide}} {{circumpolarLimit}}
 */
import type { Observer } from '@/types';

export function locationTokens(o: Observer): Record<string, string> {
  const north = o.lat >= 0;
  const a = Math.abs(o.lat);
  const lim = Math.round(90 - a);
  return {
    place: o.name,
    lat: `${Math.round(a)}°${north ? 'N' : 'S'}`,
    poleAltitude: `${Math.round(a)}°`,
    pole: north ? 'north celestial pole' : 'south celestial pole',
    poleStar: north ? 'Polaris' : 'the south celestial pole (which has no bright pole star)',
    equatorSide: north ? 'south' : 'north',
    circumpolarLimit: north ? `+${lim}°` : `−${lim}°`,
  };
}

export function fillTokens(text: string, o: Observer): string {
  if (!text.includes('{{')) return text;
  const t = locationTokens(o);
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => t[k] ?? m);
}
