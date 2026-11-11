/** Tonight panel: grouping by time of night and plain-language phrases. Pure. */
import { compassWord } from '@/lib/format';
import { zonedParts } from '@/lib/time';
import type { NightWindow, TonightItem, VisibilityClass } from '@/types';

export type NightPart = 'early-evening' | 'late-evening' | 'after-midnight' | 'before-dawn';

export const NIGHT_PARTS: { id: NightPart; title: string; hint: string }[] = [
  { id: 'early-evening', title: 'Early evening', hint: 'from dusk to about 9:30 pm' },
  { id: 'late-evening', title: 'Late evening', hint: '9:30 pm to midnight' },
  { id: 'after-midnight', title: 'After midnight', hint: 'midnight to 4 am' },
  { id: 'before-dawn', title: 'Before dawn', hint: 'the last hours of the night' },
];

/** Which part of the night a moment falls in, by the local clock. */
export function nightPartOf(time: Date, tz: string): NightPart {
  const p = zonedParts(time, tz);
  const h = p.hour + p.minute / 60;
  if (h >= 12 && h < 21.5) return 'early-evening';
  if (h >= 21.5) return 'late-evening';
  if (h < 4) return 'after-midnight';
  return 'before-dawn';
}

/** "around 9 pm", "around 9:30 pm", "around midnight" — rounded to the half hour. */
export function aroundTime(time: Date, tz: string): string {
  const p = zonedParts(time, tz);
  let mins = Math.round((p.hour * 60 + p.minute) / 30) * 30;
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0 && m === 0) return 'around midnight';
  if (h === 12 && m === 0) return 'around noon';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `around ${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** "low in the southwest", "high in the south", "nearly overhead". */
export function heightWords(alt: number, az: number): string {
  if (alt >= 75) return 'nearly overhead';
  const height = alt >= 50 ? 'high' : alt >= 25 ? 'halfway up' : 'low';
  return `${height} in the ${compassWord(az)}`;
}

/** "high in the southeast around 9 pm" */
export function placePhrase(item: Pick<TonightItem, 'visibility'>, tz: string): string {
  const v = item.visibility;
  if (v.cls === 'not-visible' || !v.bestTime) return 'not visible tonight';
  return `${heightWords(v.bestAlt, v.bestAz)} ${aroundTime(v.bestTime, tz)}`;
}

export const CLASS_LABEL: Record<VisibilityClass, string> = {
  'all-night': 'All night',
  evening: 'Evening',
  morning: 'Morning',
  'not-visible': 'Not visible',
};

export interface TonightGroup {
  part: NightPart;
  title: string;
  hint: string;
  planets: TonightItem[];
  stars: TonightItem[];
  constellations: TonightItem[];
  count: number;
}

export interface TonightGroups {
  groups: TonightGroup[];
  hidden: { planets: TonightItem[]; stars: TonightItem[]; constellations: TonightItem[] };
}

/** Split what is up by the part of the night when each thing is best placed. Things not visible go to `hidden`. */
export function groupTonight(t: { planets: TonightItem[]; brightStars: TonightItem[]; constellations: TonightItem[] }, tz: string): TonightGroups {
  const groups: TonightGroup[] = NIGHT_PARTS.map((p) => ({ part: p.id, title: p.title, hint: p.hint, planets: [], stars: [], constellations: [], count: 0 }));
  const hidden: TonightGroups['hidden'] = { planets: [], stars: [], constellations: [] };
  const place = (items: TonightItem[], key: 'planets' | 'stars' | 'constellations') => {
    for (const it of items) {
      const bt = it.visibility.bestTime;
      if (it.visibility.cls === 'not-visible' || !bt) {
        hidden[key].push(it);
        continue;
      }
      const g = groups.find((x) => x.part === nightPartOf(bt, tz))!;
      g[key].push(it);
      g.count++;
    }
  };
  place(t.planets, 'planets');
  place(t.brightStars, 'stars');
  place(t.constellations, 'constellations');
  const byTime = (a: TonightItem, b: TonightItem) => a.visibility.bestTime!.getTime() - b.visibility.bestTime!.getTime() || b.visibility.bestAlt - a.visibility.bestAlt;
  for (const g of groups) {
    g.planets.sort(byTime);
    g.stars.sort(byTime);
    g.constellations.sort(byTime);
  }
  return { groups, hidden };
}

/** One sentence on when it gets dark. */
export function darknessSentence(night: NightWindow, fmt: (d: Date | null) => string): string {
  if (!night.sunset) return night.sunrise ? 'The Sun does not set tonight.' : 'The Sun does not rise today; it is dark all day.';
  if (!night.nauticalDusk) return `The Sun sets at ${fmt(night.sunset)}, but the sky never gets fully dark tonight.`;
  return `The Sun sets at ${fmt(night.sunset)}. The sky is dark enough for stars by ${fmt(night.nauticalDusk)}${night.astroDusk ? ` and fully dark at ${fmt(night.astroDusk)}` : ''}.`;
}

/** Fraction-lit and name → "Waxing gibbous, 82% lit". */
export function moonSentence(name: string, illumination: number): string {
  return `${name[0]}${name.slice(1).toLowerCase()}, ${Math.round(illumination * 100)}% lit`;
}
