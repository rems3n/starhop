# Lessons: motion + ecliptic units — verification notes

All positions computed with astronomy-engine 2.1.19 in Node (topocentric, refraction on). Brooklyn = 40.6782, −73.9442,
America/New_York (EST/EDT handled via the same Intl-based conversion as src/lib/time.ts). Star altitudes use J2000
coordinates. `month:N` steps were evaluated for 2027 (star altitudes repeat each year to well under 1°; such steps
never name a planet or the Moon).

## Computed dates used in the lessons (Eastern time unless noted)

Planets
- Mars: stationary (retrograde begins) 2027-01-10 08:01 EST; opposition 2027-02-19 10:44 EST (Leo, mag −1.2, 0.678 AU);
  stationary (ends) 2027-04-01 10:10 EDT. Retrograde 81 days, 19.5° of ecliptic longitude. Next opposition 2029-03-25.
- Jupiter: stationary 2026-12-12 19:58 EST (Dec 13 UT); opposition 2027-02-10 19:17 EST (Leo); stationary 2027-04-12 22:13 EDT (Apr 13 UT). 10.0°.
- Saturn: stationary 2027-08-09 13:52 EDT; opposition 2027-10-17 20:18 EDT (Pisces); stationary 2027-12-23 21:49 EST (Dec 24 UT). 6.9°.
- Saturn conjunction with the Sun 2027-04-07 (2.3° from Sun at noon). Jupiter conj. 2027-08-31; Mars conj. 2028-03-20.
- Venus greatest elongation: 2027-01-03 morning 47.0°; 2028-03-22 evening 46.1°. Mercury: 2027-02-03 evening 18.3°.
- Stations are in geocentric ecliptic longitude of date (bisection on the sign of dλ/dt).

Sun / zodiac (2027, IAU boundaries via Astronomy.Constellation): Scorpius Nov 24–30, Ophiuchus Nov 30–Dec 19,
Virgo Sep 17–Nov 1, Taurus May 15–Jun 22. Noon altitude at Brooklyn: Jun 21 72.8°, Mar 20 49.3°, Dec 21 25.9°.

Moon (2027): new Apr 6 19:51, first quarter Apr 13 18:57, full Apr 20 18:27 EDT. Apr 20: sunset 19:40, moonrise 19:49;
Apr 23 moonrise 23:09. Ecliptic latitude +4.6° (Apr 10) → node crossing Apr 14–15 → −4.4° (Apr 19).
Full Moon 2027-12-13: 74.6° high at midnight; full Moon 2027-06-18/19: 21.6° at 01:00.

Lunar eclipses after Nov 2026 (SearchLunarEclipse; Moon altitude at Brooklyn)
- 2027-02-20 penumbral, peak 18:12 EST, Moon 6.5° (not used). 2027-07-18 penumbral, below horizon. 2027-08-17 penumbral 03:13 EDT, 27.5° (not used).
- 2028-01-11 partial (umbral obscuration 2.7%), partial phase 22:43–23:42 EST, peak 23:13, Moon 68.6° — USED.
- 2028-07-06 partial and 2028-12-31 total: Moon below horizon at Brooklyn.
- 2029-06-25/26 total: partial 21:32–01:12 EDT, totality 22:30–00:13, peak 23:22; Moon 9.6° → 16.6° → 21.3° → 24.2° → 25.2°, in Sagittarius — USED (whole eclipse visible).
- 2029-12-20 total, peak 17:41 EST with Moon 11.7° (rises eclipsed; not used).

Solar eclipses
- Global: 2027-02-06 annular, 2027-08-02 total, 2028-01-26 annular, 2028-07-22 total.
- Local Brooklyn (SearchLocalSolarEclipse): 2028-01-26 partial, obscuration 3%, peak 10:01 EST, Sun 23.8° (mentioned only as context in notes, not used);
  2029-01-14 partial, obscuration 40.6%, 11:25–14:10 EST, peak 12:50, Sun 27.3° — USED. Next after that: 2033-03-30 (0.7%).
- Luxor (25.6872 N, 32.6396 E, Africa/Cairo) 2027-08-02: total, peak 13:05 local, Sun 81.8°; computed totality 10:01:55–10:08:20 UT (6 m 25 s).
  Lesson says "about 6 minutes 20 seconds" because published maximum duration for this eclipse is 6 m 23 s.

Meteors: Perseid radiant taken as RA 48°, Dec +58°; Geminid radiant RA 112°, Dec +33°.
2027-08-13 03:30 EDT: Perseid radiant 55° up, Moon set (−11.7°). 2026-12-13 23:00 EST: Geminid radiant 54.7°, Moon set; 02:00: 82°.

## Altitude check for every demo step

| lesson | demo #step | time @ observer | Sun alt | highlighted targets: altitude (deg) |
|---|---|---|---|---|
| nightly-rotation | Facing north with the clock running #1 | 2027-01-15 20:00 @ Brooklyn | Sun -34.6° | Polaris 41.3 |
| nightly-rotation | Facing north with the clock running #2 | 2027-01-15 20:00 @ Brooklyn | Sun -34.6° | Polaris 41.3 |
| nightly-rotation | Facing north with the clock running #3 | 2027-01-16 01:00 @ Brooklyn | Sun -67° | Polaris 40.8 |
| nightly-rotation | Facing south, east and west #1 | 2027-01-15 20:00 @ Brooklyn | Sun -34.6° | Sirius 18.9 |
| nightly-rotation | Facing south, east and west #2 | 2027-01-15 20:00 @ Brooklyn | Sun -34.6° | Regulus 3.3 |
| nightly-rotation | Facing south, east and west #3 | 2027-01-15 21:00 @ Brooklyn | Sun -45.9° | Moon 41.8 |
| circumpolar-and-seasonal | The never-set circle #1 | month:10 21:00 @ Brooklyn | Sun -31.2° | — |
| circumpolar-and-seasonal | The never-set circle #2 | month:10 21:00 @ Brooklyn | Sun -31.2° | Alkaid 15.1 |
| circumpolar-and-seasonal | The never-set circle #3 | month:10 21:00 @ Brooklyn | Sun -31.2° | Capella 14.7 |
| circumpolar-and-seasonal | The never-set circle #4 | month:2 21:00 @ Brooklyn | Sun -39.5° | Canopus -2.9, Sirius 32.6 |
| circumpolar-and-seasonal | Slide your latitude #1 | month:10 21:00 @ Brooklyn | Sun -31.2° | Polaris 40.8 |
| seasonal-shift | Same clock time, different month #1 | month:1 21:00 @ Brooklyn | Sun -45.9° | — |
| seasonal-shift | Same clock time, different month #2 | month:2 19:00 @ Brooklyn | Sun -17° | — |
| seasonal-shift | Same clock time, different month #3 | month:2 21:00 @ Brooklyn | Sun -39.5° | — |
| seasonal-shift | Same clock time, different month #4 | month:4 21:00 @ Brooklyn | Sun -15.3° | — |
| seasonal-shift | Same clock time, different month #5 | month:6 22:00 @ Brooklyn | Sun -13.5° | Antares 18.2, Arcturus 67.8 |
| seasonal-shift | Daylight switched off #1 | month:5 13:00 @ Brooklyn | Sun 68.2° | Sun 68.2 |
| seasonal-shift | Daylight switched off #2 | 2027-06-21 13:00 @ Brooklyn | Sun 72.8° | — |
| latitude | North to south #1 | month:1 21:00 @ Brooklyn | Sun -45.9° | Polaris 41.3 |
| latitude | North to south #2 | month:1 21:00 @ Tromsø, Norway | Sun -34.5° | Polaris 70.2 |
| latitude | North to south #3 | month:2 21:30 @ Sydney, Australia | Sun -19.6° | Rigel 60.8, Betelgeuse 48.5 |
| latitude | North to south #4 | month:2 21:30 @ Sydney, Australia | Sun -19.6° | Canopus 71.1 |
| latitude | Pole and equator #1 | month:1 21:00 @ North Pole | Sun -20.6° | Capella 46.1, Betelgeuse 7.5 |
| latitude | Pole and equator #2 | month:1 21:00 @ Quito, Ecuador | Sun -35.6° | Procyon 41.4 |
| latitude | Pole and equator #3 | month:1 21:00 @ Quito, Ecuador | Sun -35.6° | Polaris 0.8, Capella 42.4 |
| ecliptic-and-zodiac | The Sun among the stars #1 | 2027-06-21 13:00 @ Brooklyn | Sun 72.8° | — |
| ecliptic-and-zodiac | The Sun among the stars #2 | 2027-12-05 12:00 @ Brooklyn | Sun 26.9° | — |
| ecliptic-and-zodiac | High path, low path #1 | 2027-06-21 13:00 @ Brooklyn | Sun 72.8° | — |
| ecliptic-and-zodiac | High path, low path #2 | 2027-12-13 23:59 @ Brooklyn | Sun -72.3° | Moon 74.6 |
| ecliptic-and-zodiac | High path, low path #3 | 2027-06-19 01:00 @ Brooklyn | Sun -25.4° | Moon 21.6 |
| planets-near-ecliptic | Planets on the line #1 | 2027-02-12 20:00 @ Brooklyn | Sun -29.1° | Saturn 14.8, Moon 41.5 |
| planets-near-ecliptic | Planets on the line #2 | 2027-02-12 20:00 @ Brooklyn | Sun -29.1° | Jupiter 32.1, Mars 22.2, Regulus 23.9 |
| planets-near-ecliptic | The extra stars in Leo #1 | 2027-02-12 22:00 @ Brooklyn | Sun -50.4° | Jupiter 53.3, Mars 44.5 |
| planets-near-ecliptic | The extra stars in Leo #2 | 2027-02-12 22:00 @ Brooklyn | Sun -50.4° | Regulus 45.6 |
| planets-near-ecliptic | Venus and Mercury in twilight #1 | 2027-01-03 06:15 @ Brooklyn | Sun -11.4° | Venus 23.9, Moon 17.3, Spica 37.9 |
| planets-near-ecliptic | Venus and Mercury in twilight #2 | 2027-02-03 18:00 @ Brooklyn | Sun -8.2° | Mercury 8.4, Saturn 40.5 |
| planet-motion | Venus either side of the Sun #1 | 2028-03-22 19:45 @ Brooklyn | Sun -6.7° | Venus 37.3 |
| planet-motion | Venus either side of the Sun #2 | 2027-01-03 06:15 @ Brooklyn | Sun -11.4° | Venus 23.9 |
| planet-motion | Mars at opposition: up all night #1 | 2027-02-19 18:30 @ Brooklyn | Sun -10.5° | Mars 13, Jupiter 21.1, Regulus 12.1 |
| planet-motion | Mars at opposition: up all night #2 | 2027-02-20 00:15 @ Brooklyn | Sun -60.1° | Mars 64.8, Jupiter 63.1 |
| planet-motion | Mars at opposition: up all night #3 | 2027-02-20 06:00 @ Brooklyn | Sun -8.3° | Mars 12.3 |
| planet-motion | Mars at opposition: up all night #4 | 2027-04-07 12:00 @ Brooklyn | Sun 53.9° | Sun 53.9, Saturn 51.6 |
| retrograde-motion | Mars loops in Leo, 2026–27 #1 | 2026-12-02 03:00 @ Brooklyn | Sun -44.7° | Mars 46.7, Regulus 47.7 |
| retrograde-motion | Mars loops in Leo, 2026–27 #2 | 2027-01-10 23:00 @ Brooklyn | Sun -66.7° | Mars 24.7, Regulus 33.3 |
| retrograde-motion | Mars loops in Leo, 2026–27 #3 | 2027-02-19 23:00 @ Brooklyn | Sun -56.4° | Mars 60.2, Regulus 57.7 |
| retrograde-motion | Mars loops in Leo, 2026–27 #4 | 2027-04-01 21:00 @ Brooklyn | Sun -18.5° | Mars 64.2, Regulus 55.6 |
| retrograde-motion | Mars loops in Leo, 2026–27 #5 | 2027-05-15 21:30 @ Brooklyn | Sun -13.5° | Mars 52.4, Regulus 51.2 |
| retrograde-motion | Mars loops in Leo, 2026–27 #6 | 2026-11-16 04:00 @ Brooklyn | Sun -30.6° | Mars 51.7, Regulus 47.3 |
| retrograde-motion | Jupiter and Saturn do it too #1 | 2027-02-10 23:00 @ Brooklyn | Sun -59.1° | Jupiter 60.2, Mars 52.4, Regulus 53.5 |
| retrograde-motion | Jupiter and Saturn do it too #2 | 2027-10-17 23:00 @ Brooklyn | Sun -51.4° | Saturn 48.9 |
| moon-phases | Two weeks of evenings #1 | 2027-04-09 20:30 @ Brooklyn | Sun -11.4° | Moon 24.6 |
| moon-phases | Two weeks of evenings #2 | 2027-04-13 20:30 @ Brooklyn | Sun -10.6° | Moon 66.2 |
| moon-phases | Two weeks of evenings #3 | 2027-04-16 20:30 @ Brooklyn | Sun -9.9° | Moon 51.9 |
| moon-phases | Two weeks of evenings #4 | 2027-04-20 20:30 @ Brooklyn | Sun -9.1° | Moon 5.9 |
| moon-phases | Two weeks of evenings #5 | 2027-04-23 20:30 @ Brooklyn | Sun -8.5° | — |
| moon-phases | 13° a day #1 | 2027-04-12 21:00 @ Brooklyn | Sun -15.9° | — |
| eclipses | A total lunar eclipse over Brooklyn #1 | 2029-06-25 21:32 @ Brooklyn | Sun -9.4° | Moon 9.6 |
| eclipses | A total lunar eclipse over Brooklyn #2 | 2029-06-25 22:30 @ Brooklyn | Sun -16.7° | Moon 16.6 |
| eclipses | A total lunar eclipse over Brooklyn #3 | 2029-06-25 23:22 @ Brooklyn | Sun -21.7° | Moon 21.3 |
| eclipses | A total lunar eclipse over Brooklyn #4 | 2028-01-11 23:13 @ Brooklyn | Sun -68.1° | Moon 68.6 |
| eclipses | The Moon's tilted path #1 | 2027-04-14 21:00 @ Brooklyn | Sun -15.5° | — |
| eclipses | Two solar eclipses #1 | 2029-01-14 12:50 @ Brooklyn | Sun 27.3° | Sun 27.3, Moon 27.5 |
| eclipses | Two solar eclipses #2 | 2027-08-02 13:05 @ Luxor, Egypt | Sun 81.8° | Sun 81.8, Moon 81.8 |
| meteor-showers | Two radiants #1 | 2027-08-13 03:30 @ Brooklyn | Sun -24.2° | radec 55 |
| meteor-showers | Two radiants #2 | 2027-08-13 03:30 @ Brooklyn | Sun -24.2° | radec 55 |
| meteor-showers | Two radiants #3 | 2026-12-13 23:00 @ Brooklyn | Sun -69.4° | radec 54.7, Castor 52.9 |

Additional star checks: Dubhe 26.8° → 58° along its trail (Jan 15 20:00 → Jan 16 06:00); Sirius trail 10° (19:00) → 0.5° (04:00), transit ≈ 23:10;
Regulus trail 3.3° → 55.8°; Alkaid minimum 1.4° around midnight in mid-October (dec +49.31 vs limit +49.32);
Betelgeuse at 21:00: Jan 53° az 150, Feb 19:00 53° az 150 (identical), Feb 21:00 az 202, Apr 30° az 252;
Sydney Feb 21:30: Acrux 28.5° az 149; Quito: Betelgeuse 66.5° az 71.

## Deliberately low or below-horizon targets (stated in the captions)

- Canopus −2.9° (circumpolar #4: the point is that it never rises; ground layer off).
- Mercury 8.4° (its best 2027 evening apparition), Saturn 14.8°, Mars 13°/12° at rising and setting on opposition night,
  Regulus 3.3° at the start of its rising trail, full Moon 5.9° just after moonrise, Moon 9.6° at start of the 2029 eclipse,
  Polaris 0.8° from Quito, Betelgeuse 7.5° from the North Pole.
- moon-phases "Two weeks of evenings" #5 intentionally shows a Moonless sky.

## Uncertain / not verifiable here

- Demos could not be previewed. Assumptions: `point:scp` resolves (it does in src/data/catalog.ts though the brief lists only ncp);
  stars below the horizon are drawn when `ground` is off; horizon-frame trails may use a different date from the step time;
  rate 86164 / 430820 steps use the equatorial mount so stars stay fixed whatever the player does.
- Whether the renderer draws Earth's shadow on the Moon or the Moon's disc over the Sun is unknown; eclipse captions describe the real sky.
- `asterism:` refs were avoided (asterisms.json was empty when written); the Dipper is drawn as a star polyline.
- General figures stated from memory, not fetched: meteor ZHRs and parent bodies, orbital inclinations and periods, planet brightness descriptions,
  city/dark-site meteor counts (rough), Earth 30 km/s vs Mars 24 km/s.
