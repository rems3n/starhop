import { describe, expect, it } from 'vitest';
import { formatDateTime, zonedParts } from '@/lib/time';
import { CITIES, fold, formatLatLon, isValidTimeZone, parseManualLocation, searchCities } from '@/modes/explore/cities';
import { aboutCount, countStarsUp, skyBrightness } from '@/modes/explore/skyCount';
import {
  REAL_TIME_INDEX, SIDEREAL_DAY_MS, TIME_RATES, canStepRate, fovWords, fromLocalInputValue, lookingWords, rateIndex, rateShort, rateWords, stepRate, stepTime, toLocalInputValue,
} from '@/modes/explore/timeRates';

const NY = 'America/New_York';

describe('time-rate stepping', () => {
  it('has the nine fixed rates, symmetric about real time', () => {
    expect([...TIME_RATES]).toEqual([-86400, -3600, -600, -60, 1, 60, 600, 3600, 86400]);
    expect(TIME_RATES[REAL_TIME_INDEX]).toBe(1);
  });
  it('steps faster and slower through every rate and stops at the ends', () => {
    let r = 1;
    const up: number[] = [];
    for (let i = 0; i < 6; i++) up.push((r = stepRate(r, 1)));
    expect(up).toEqual([60, 600, 3600, 86400, 86400, 86400]);
    r = 1;
    const down: number[] = [];
    for (let i = 0; i < 6; i++) down.push((r = stepRate(r, -1)));
    expect(down).toEqual([-60, -600, -3600, -86400, -86400, -86400]);
    expect(stepRate(-60, 1)).toBe(1);
    expect(canStepRate(86400, 1)).toBe(false);
    expect(canStepRate(86400, -1)).toBe(true);
    expect(canStepRate(-86400, -1)).toBe(false);
  });
  it('maps an arbitrary engine rate to the nearest step', () => {
    expect(rateIndex(0)).toBe(REAL_TIME_INDEX);
    expect(TIME_RATES[rateIndex(500)]).toBe(600);
    expect(TIME_RATES[rateIndex(-4000)]).toBe(-3600);
    expect(stepRate(500, 1)).toBe(3600);
  });
  it('says the rate in words', () => {
    expect(TIME_RATES.map(rateWords)).toEqual([
      '1 day per second, backwards', '1 hour per second, backwards', '10 minutes per second, backwards', '1 minute per second, backwards',
      'Real time', '1 minute per second', '10 minutes per second', '1 hour per second', '1 day per second',
    ]);
    expect(rateWords(0)).toBe('Paused');
    expect(rateShort(-600)).toBe('−10 min/s');
    expect(rateShort(86400)).toBe('1 day/s');
    expect(rateShort(1)).toBe('real time');
  });
});

describe('stepping the clock', () => {
  const t0 = new Date('2026-11-11T02:00:00Z'); // 9 pm EST, 10 Nov
  it('hour and sidereal day are exact durations', () => {
    expect(stepTime(t0, 'hour', 1, NY).getTime() - t0.getTime()).toBe(3600000);
    expect(stepTime(t0, 'hour', -1, NY).getTime() - t0.getTime()).toBe(-3600000);
    expect(stepTime(t0, 'sidereal-day', 1, NY).getTime() - t0.getTime()).toBe(SIDEREAL_DAY_MS);
    expect(SIDEREAL_DAY_MS / 1000).toBeCloseTo(86164.0905, 2);
  });
  it('day, month and year keep the wall-clock time', () => {
    expect(formatDateTime(stepTime(t0, 'day', 1, NY), NY)).toBe('Nov 11, 2026, 9:00 PM');
    expect(formatDateTime(stepTime(t0, 'month', 1, NY), NY)).toBe('Dec 10, 2026, 9:00 PM');
    expect(formatDateTime(stepTime(t0, 'month', -1, NY), NY)).toBe('Oct 10, 2026, 9:00 PM'); // across the end of daylight time
    expect(formatDateTime(stepTime(t0, 'year', 1, NY), NY)).toBe('Nov 10, 2027, 9:00 PM');
    expect(formatDateTime(stepTime(stepTime(t0, 'month', 1, NY), 'month', 1, NY), NY)).toBe('Jan 10, 2027, 9:00 PM');
  });
  it('a day step across the spring clock change is 23 hours', () => {
    const before = new Date('2026-03-08T02:00:00Z'); // 9 pm EST, 7 Mar; clocks go forward on 8 Mar
    const after = stepTime(before, 'day', 1, NY);
    expect((after.getTime() - before.getTime()) / 3600000).toBe(23);
    expect(zonedParts(after, NY)).toMatchObject({ month: 3, day: 8, hour: 21, minute: 0 });
  });
  it('clamps to the end of a shorter month and handles leap days', () => {
    const jan31 = new Date('2027-01-31T17:00:00Z');
    expect(zonedParts(stepTime(jan31, 'month', 1, 'UTC'), 'UTC')).toMatchObject({ year: 2027, month: 2, day: 28, hour: 17 });
    const leap = new Date('2028-02-29T12:00:00Z');
    expect(zonedParts(stepTime(leap, 'year', 1, 'UTC'), 'UTC')).toMatchObject({ year: 2029, month: 2, day: 28 });
    expect(zonedParts(stepTime(new Date('2026-01-01T00:30:00Z'), 'day', -1, 'UTC'), 'UTC')).toMatchObject({ year: 2025, month: 12, day: 31 });
  });
  it('forward then back returns to the start', () => {
    for (const unit of ['hour', 'day', 'sidereal-day', 'month', 'year'] as const) {
      expect(stepTime(stepTime(t0, unit, 1, NY), unit, -1, NY).getTime(), unit).toBe(t0.getTime());
    }
  });
  it('date-time picker values round-trip in the observer time zone', () => {
    expect(toLocalInputValue(t0, NY)).toBe('2026-11-10T21:00');
    expect(fromLocalInputValue('2026-11-10T21:00', NY)?.getTime()).toBe(t0.getTime());
    expect(fromLocalInputValue('2026-07-04T22:30', 'Australia/Sydney')?.toISOString()).toBe('2026-07-04T12:30:00.000Z');
    expect(fromLocalInputValue('', NY)).toBeNull();
    expect(fromLocalInputValue('2026-02-30T10:00', NY)).toBeNull();
    expect(fromLocalInputValue('2026-13-01T10:00', NY)).toBeNull();
  });
});

describe('view readout', () => {
  it('says where the view points', () => {
    expect(lookingWords(157, 34.2)).toBe('Looking SSE, 34° up');
    expect(lookingWords(359, 10)).toBe('Looking N, 10° up');
    expect(lookingWords(90, 0.2)).toBe('Looking E, at the horizon');
    expect(lookingWords(270, -12)).toBe('Looking W, 12° below the horizon');
    expect(lookingWords(10, 88)).toBe('Looking straight up');
    expect(fovWords(60.4)).toBe('60° field of view');
    expect(fovWords(2.54)).toBe('2.5° field of view');
  });
});

describe('city search', () => {
  it('has about 80 places with valid coordinates and time zones, spread over both hemispheres', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(CITIES.map((c) => `${c.name}|${c.country}`)).size).toBe(CITIES.length);
    for (const c of CITIES) {
      expect(Math.abs(c.lat), c.name).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon), c.name).toBeLessThanOrEqual(180);
      expect(isValidTimeZone(c.tz), `${c.name}: ${c.tz}`).toBe(true);
    }
    expect(CITIES.filter((c) => c.lat < 0).length).toBeGreaterThanOrEqual(20);
    expect(CITIES.filter((c) => c.lat > 60).length).toBeGreaterThanOrEqual(5);
    expect(CITIES.filter((c) => Math.abs(c.lat) < 10).length).toBeGreaterThanOrEqual(5);
    expect(CITIES.filter((c) => c.lat < -40).length).toBeGreaterThanOrEqual(4);
    for (const name of ['Brooklyn, NY', 'London', 'Tromsø', 'Reykjavík', 'Cairo', 'Nairobi', 'Singapore', 'Quito', 'Sydney', 'Cape Town', 'Punta Arenas']) {
      expect(CITIES.some((c) => c.name === name), name).toBe(true);
    }
  });
  it('time zones agree with longitude (catches a swapped sign)', () => {
    const jan = new Date('2026-01-15T12:00:00Z');
    for (const c of CITIES) {
      const p = zonedParts(jan, c.tz);
      let offset = p.hour + p.minute / 60 - 12;
      if (offset > 14) offset -= 24;
      if (offset < -12) offset += 24;
      let diff = offset - c.lon / 15;
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;
      expect(Math.abs(diff), `${c.name}: UTC${offset >= 0 ? '+' : ''}${offset} at longitude ${c.lon}`).toBeLessThan(3.6);
    }
  });
  it('matches without accents and puts name-prefix matches first', () => {
    expect(fold('Tromsø')).toBe('tromso');
    expect(fold('Reykjavík')).toBe('reykjavik');
    expect(searchCities('tromso')[0].name).toBe('Tromsø');
    expect(searchCities('REYK')[0].name).toBe('Reykjavík');
    expect(searchCities('sao')[0].name).toBe('São Paulo');
    expect(searchCities('york')[0]).toBeUndefined();
    expect(searchCities('ny')[0].name).toBe('Brooklyn, NY');
    expect(searchCities('san').slice(0, 4).map((c) => c.name).sort()).toEqual(['San Francisco', 'San Pedro de Atacama', 'Santiago'].sort());
    expect(searchCities('chile').map((c) => c.name).sort()).toEqual(['Punta Arenas', 'San Pedro de Atacama', 'Santiago']);
    expect(searchCities('')).toHaveLength(CITIES.length);
    expect(searchCities('zzzz')).toEqual([]);
  });
  it('validates manual entry', () => {
    expect(parseManualLocation({ name: '', lat: '40.7', lon: '-74', tz: NY })).toEqual({ observer: { name: '40.70° N, 74.00° W', lat: 40.7, lon: -74, tz: NY } });
    expect(parseManualLocation({ name: ' Roof ', lat: '-33,9', lon: '18.4', tz: 'Africa/Johannesburg' })).toMatchObject({ observer: { name: 'Roof', lat: -33.9 } });
    expect(parseManualLocation({ name: '', lat: '91', lon: '0', tz: NY })).toHaveProperty('error');
    expect(parseManualLocation({ name: '', lat: '', lon: '0', tz: NY })).toHaveProperty('error');
    expect(parseManualLocation({ name: '', lat: '10', lon: '181', tz: NY })).toHaveProperty('error');
    expect(parseManualLocation({ name: '', lat: '10', lon: '10', tz: 'Mars/Olympus' })).toHaveProperty('error');
    expect(formatLatLon(-33.87, 151.21)).toBe('33.87° S, 151.21° E');
  });
});

describe('star count', () => {
  const eq = { name: 'Equator', lat: 0, lon: 0, tz: 'UTC' };
  const pole = { name: 'Pole', lat: 89.99, lon: 0, tz: 'UTC' };
  const stars = [
    { ra: 0, dec: 80, mag: 1 }, { ra: 90, dec: 70, mag: 2 }, { ra: 180, dec: -70, mag: 3 }, { ra: 270, dec: -80, mag: 4 }, { ra: 10, dec: 60, mag: 5 },
  ];
  const date = new Date('2026-11-11T02:00:00Z');
  it('counts only stars above the horizon and at or brighter than the limit', () => {
    expect(countStarsUp(stars, null, 6, date, pole)).toBe(3); // the three northern ones
    expect(countStarsUp(stars, null, 2.5, date, pole)).toBe(2);
    expect(countStarsUp(stars, null, 0, date, pole)).toBe(0);
    const up = countStarsUp(stars, null, 6, date, eq);
    expect(up).toBeGreaterThanOrEqual(1);
    expect(up).toBeLessThanOrEqual(4);
  });
  it('adds faint stars only beyond the main catalog limit', () => {
    const faint = { ra: [0, 0], dec: [85, -85], mag: [6.8, 7.0], bv: [0.6, 0.6] };
    expect(countStarsUp(stars, faint, 6.5, date, pole)).toBe(3);
    expect(countStarsUp(stars, faint, 7.3, date, pole)).toBe(4);
  });
  it('rounds the way you would say it', () => {
    expect(aboutCount(14)).toBe('14');
    expect(aboutCount(312)).toBe('about 310');
    expect(aboutCount(2487)).toBe('about 2,500');
    expect(skyBrightness(10)).toBe('day');
    expect(skyBrightness(-8)).toBe('twilight');
    expect(skyBrightness(-20)).toBe('night');
  });
});
