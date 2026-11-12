import { describe, expect, it } from 'vitest';
import { altAzOf, getBody } from '@/astro';
import { choosePresentation, defaultSkyTime } from '@/modes/explore/present';
import { DEFAULT_OBSERVER } from '@/types';
import { learnCatalog } from './learn-catalog';

const catalog = learnCatalog();
const bk = DEFAULT_OBSERVER;
const sydney = { name: 'Sydney', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' };
const at = (iso: string) => new Date(iso);
const t = (ref: string, date: Date, obs = bk) => catalog.resolve(ref, { date, observer: obs })!;
const eveningNov = at('2026-11-12T00:00:00Z'); // 7 pm EST, 11 Nov
const afternoonNov = at('2026-11-11T19:00:00Z'); // 2 pm EST

describe('how a searched object is presented', () => {
  it('uses the live sky when the object is up in the dark', () => {
    expect(choosePresentation(t('star:Vega', eveningNov), eveningNov, bk, catalog)).toEqual({ mode: 'live' });
    expect(choosePresentation(t('con:Cas', eveningNov), eveningNov, bk, catalog)).toEqual({ mode: 'live' });
  });
  it('moves to the best time tonight when it is below the horizon now but rises later', () => {
    const p = choosePresentation(t('con:Ori', eveningNov), eveningNov, bk, catalog);
    expect(p.mode).toBe('time');
    if (p.mode !== 'time') return;
    expect(p.message).toMatch(/Orion is below the horizon right now\. Showing tonight at \d+:\d\d [AP]M/);
    const o = t('con:Ori', p.time);
    expect(altAzOf(o.ra, o.dec, p.time, bk).alt).toBeGreaterThan(40);
    expect(p.time.getTime() - eveningNov.getTime()).toBeLessThan(14 * 3600e3);
  });
  it('moves to tonight when the object is up but it is daytime', () => {
    const p = choosePresentation(t('star:Vega', afternoonNov), afternoonNov, bk, catalog);
    expect(p.mode).toBe('time');
    if (p.mode === 'time') expect(p.message).toMatch(/daylight/);
  });
  it('uses the atlas for something that never rises here, and says so', () => {
    const p = choosePresentation(t('con:Cru', eveningNov), eveningNov, bk, catalog);
    expect(p.mode).toBe('atlas');
    if (p.mode === 'atlas') expect(p.message).toMatch(/Crux is not visible from Brooklyn, NY tonight\. It never rises high enough/);
  });
  it('uses the atlas for an out-of-season object and names its months', () => {
    const p = choosePresentation(t('con:Sco', eveningNov), eveningNov, bk, catalog);
    expect(p.mode).toBe('atlas');
    if (p.mode === 'atlas') expect(p.message).toMatch(/Best seen in the evening: .*(June|July)/);
  });
  it('depends on where you are', () => {
    const d = at('2026-11-11T10:30:00Z'); // 9:30 pm in Sydney
    expect(choosePresentation(t('con:Cru', d, sydney), d, sydney, catalog).mode).not.toBe('atlas');
    expect(choosePresentation(t('con:UMi', d, sydney), d, sydney, catalog).mode).toBe('atlas');
  });
  it('handles the Sun, Moon and planets', () => {
    expect(choosePresentation(t('body:Sun', afternoonNov), afternoonNov, bk, catalog)).toEqual({ mode: 'live' });
    expect(choosePresentation(t('body:Sun', eveningNov), eveningNov, bk, catalog).mode).toBe('atlas');
    expect(['live', 'time']).toContain(choosePresentation(t('body:Saturn', eveningNov), eveningNov, bk, catalog).mode);
  });
});

describe('the time the sky map opens at', () => {
  it('stays on the live clock when it is already dark', () => {
    expect(defaultSkyTime(eveningNov, bk)).toBeNull();
    expect(defaultSkyTime(at('2026-11-12T08:00:00Z'), bk)).toBeNull(); // 3 am EST
  });
  it('opens at the coming dusk in the afternoon, with the Sun 18 degrees down', () => {
    const d = defaultSkyTime(afternoonNov, bk)!;
    expect(d.time.getTime()).toBeGreaterThan(afternoonNov.getTime());
    expect(d.time.getTime() - afternoonNov.getTime()).toBeLessThan(6 * 3600e3);
    expect(getBody('Sun', d.time, bk).alt).toBeCloseTo(-18, 0);
    expect(d.message).toMatch(/The stars are not out yet in Brooklyn, NY\. Showing tonight's sky at \d+:\d\d PM/);
  });
  it('opens at this evening, not last night, in the morning', () => {
    const morning = at('2026-11-11T12:30:00Z'); // 7:30 am EST, after sunrise
    const d = defaultSkyTime(morning, bk)!;
    expect(d.time.getTime()).toBeGreaterThan(morning.getTime());
    expect(d.time.getTime() - morning.getTime()).toBeLessThan(13 * 3600e3);
  });
  it('works in the southern hemisphere, and uses the darkest dusk there is on bright summer nights', () => {
    const noonSydney = at('2026-11-11T01:00:00Z');
    expect(getBody('Sun', defaultSkyTime(noonSydney, sydney)!.time, sydney).alt).toBeCloseTo(-18, 0);
    const juneNoon = at('2026-06-20T12:00:00Z');
    const london = { name: 'London', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' };
    expect(getBody('Sun', defaultSkyTime(juneNoon, london)!.time, london).alt).toBeCloseTo(-12, 0);
    const edinburgh = { name: 'Edinburgh', lat: 55.9533, lon: -3.1883, tz: 'Europe/London' };
    expect(getBody('Sun', defaultSkyTime(juneNoon, edinburgh)!.time, edinburgh).alt).toBeCloseTo(-6, 0);
  });
  it('stays live where it does not get dark at all', () => {
    const tromso = { name: 'Tromsø', lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };
    expect(defaultSkyTime(at('2026-06-20T12:00:00Z'), tromso)).toBeNull();
  });
});
