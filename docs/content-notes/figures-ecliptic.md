# Figures for the ecliptic unit: notes and verification

21 new diagrams in `src/modes/learn/figures/diagrams/` (plus the shared helper `ecliptic-common.ts`) and 4 new photos
in `public/img/lessons/`. Every diagram reads the learner's location from `useSettings((s) => s.observer)` where
location matters (seasons, Moon phase view, moonrise chart, loop dates, meteor sky class); none hard-codes a city.
Checked at 1280 px and 390 px, with Brooklyn and Sydney (southern hemisphere) observers; screenshots
`docs/shots/figures/ecl-*.png`. `npx tsc --noEmit` clean; `npm run validate` 0 errors for all 7 lessons.

## Per lesson

| Lesson | Section | Figures | Boxes |
| --- | --- | --- | --- |
| ecliptic-and-zodiac | 0 | `zodiac-orbit-top` | check |
| | 1 | `signs-vs-constellations` | misconception (star sign) |
| | 2 | `seasons-tilt` | misconception (distance), think about it |
| planets-near-ecliptic | 0 | `solar-system-edge-on` | think about it (Milky Way vs ecliptic) |
| | 1 | `twinkle-point-vs-disc` | misconception (twinkling), check |
| | 2 | gallery Jupiter-2/Saturn-3/Mars-2, `solar-system-scale` | check |
| planet-motion | 0 | `inner-planet-elongation` | misconception (evening/morning star), check |
| | 1 | `outer-planet-configurations` | think about it (Earth from Mars), check |
| | 2 | `planet-zodiac-clock` | think about it |
| retrograde-motion | 0 | `mars-loop-sky`, `epicycle-model` | misconception (planet reverses) |
| | 1 | `retrograde-top-view` | check |
| | 2 | — | think about it, check (Mercury retrograde) |
| moon-phases | 0 | `moon-phase-orbit` | misconception (Earth's shadow), think about it (full Earth) |
| | 1 | `moonrise-times-chart` | check |
| | 2 | gallery Moon-1/Moon-2, image Moon-3 | misconception (dark side) |
| eclipses | 0 | `eclipse-shadows`, photo total-lunar-eclipse-2007 | think about it |
| | 1 | `eclipse-nodes` | misconception (every month), check |
| | 2 | `sun-moon-size`, gallery total-solar-eclipse-2017 + annular-solar-eclipse-2019 | think about it |
| meteor-showers | 0 | `meteor-stream-crossing` | think about it |
| | 1 | `meteor-radiant-perspective`, photo meteor-perseid-night-2014 | check |
| | 2 | `meteor-rate-estimate` | misconception |
| | 3 | `meteor-morning-side` | check |

Body text and end-of-lesson questions were not changed. One caption edit after checking the geometry: in
`retrograde-top-view` the westward stretch runs from numbered point 2 to point 6 (stations at −40 and +41 days).

## Numbers and where they come from

astronomy-engine 2.1.19 (computed live in the figures or in Node while authoring):
- Earth perihelion 2027-01-03 02:07 UT, 0.98333 AU (147.1 million km); aphelion 2027-07-05, 1.01673 AU (152.1).
- Sun's path across IAU boundaries in 2027 (J2000 ecliptic longitude / entry date), hard-coded in `ZODIAC`:
  Psc 351.8 (Mar 13), Ari 28.8 (Apr 19), Tau 53.6 (May 15), Gem 90.2 (Jun 22), Cnc 118.1 (Jul 21), Leo 138.2 (Aug 11),
  Vir 174.0 (Sep 17), Lib 217.9 (Nov 1), Sco 241.1 (Nov 24), Oph 247.6 (Nov 30), Sgr 266.4 (Dec 19), Cap 299.8 (Jan 20),
  Aqr 327.7 (Feb 17). Scorpius 6 days, Ophiuchus 19 days, Virgo 45 days, consistent with the lesson text.
- Precession for "2,000 years ago": 50.29″/yr → equinox 27.6° east of its J2000 place in AD 27.
- Seasons figure: noon altitude and day length from SearchHourAngle / SearchRiseSet for the learner's location
  (Brooklyn Jun 21: 73°, 15 h 05 min, matching the lesson; Sydney Jan 3: 79°, 14 h 20 min).
- Retrograde loops (daily J2000 ecliptic positions, stations and opposition refined to the hour, dates in the learner's
  time zone; Brooklyn shown): Mars stops Jan 10, opposition Feb 19, stops Apr 1 (20°, 81 days); Jupiter Dec 12 / Feb 10 /
  Apr 12 (10°); Saturn Aug 9 / Oct 17 / Dec 23 (7°). All match `lessons-motion-ecliptic.md`.
- Moon: lunar distance range in 2027 357,273–406,597 km (lunar apsides); ascending node 2027-01-10 at 320.3°,
  regression 19.34°/yr; 2027 eclipses Feb 6 annular, Feb 20 penumbral, Jul 18 penumbral, Aug 2 total, Aug 17 penumbral;
  next season Jan 12 2028 partial lunar + Jan 26 2028 annular. Moonrise chart: rise/set times for the learner's place,
  lunation new Moon 2027-04-06 → May 6.
- Umbra/penumbra at the Moon's mean distance (384,400 km): 2.7 and 4.8 Moon radii, from radii Sun 696,000, Earth 6,371,
  Moon 1,737.4 km with the conventional 2% atmospheric enlargement. Moon umbra length = Sun–Moon distance × RM/(RS − RM);
  totality needs the Moon closer than about 379,800 km (Moon's angular size ≥ Sun's at 1 AU, 32.0′).

NASA planetary fact sheet (fetched): diameters (km) Mercury 4,879, Venus 12,104, Earth 12,756, Mars 6,792,
Jupiter 142,984, Saturn 120,536, Uranus 51,118, Neptune 49,528; distances (10⁶ km) 57.9, 108.2, 149.6, 228.0, 778.5,
1,432.0, 2,867.0, 4,515.0; periods Mars 687 d, Jupiter 4,331 d, Saturn 10,747 d; inclinations 7.0, 3.4, 0, 1.8, 1.3,
2.5, 0.8, 1.8, Pluto 17.2. Sun diameter 1,391,400 km; Proxima Centauri 4.24 ly.
Scale model (computed): basketball Sun 24 cm → Earth 2.2 mm at 26 m, Jupiter 2.5 cm at 134 m, Neptune 779 m, Proxima
6,919 km; ping-pong Sun 4 cm → Earth 4.3 m away.

JPL SBDB (fetched): 109P/Swift–Tuttle q 0.96 AU, e 0.963, i 113°, Ω 139°, ω 153°, period 48,700 d (133 yr). The
descending node is at heliocentric longitude 319°, r ≈ 1.01 AU: Earth's position at solar longitude ≈ 140°, the Perseid
maximum (IMO), i.e. 12–13 August.

IMO calendar page (fetched): Perseids ZHR 100, radiant 03h12 +57.6°, 60 km/s; Geminids ZHR 150, 07h28 +32.2°;
Quadrantids ZHR 80.

## Not verified / simplifications (stated in the figures)

- **Population index r** in `meteor-rate-estimate` (Perseids 2.2, Geminids 2.6) is from the IMO working list as I
  recall it; the IMO calendar PDF could not be fetched (site maintenance), so this was not re-checked. The formula
  HR = ZHR · sin h / r^(6.5 − LM) is the standard one; the Bortle → limiting magnitude values copy `BORTLE` in src/types.ts.
- Activity curve in `meteor-stream-crossing`, the debris meter in `meteor-morning-side` and the twinkle traces are
  labelled schematic.
- Circular orbits in `inner-planet-elongation` (46° Venus, 23° Mercury; the readout notes Mercury's real 18°–28°),
  `outer-planet-configurations` (Jupiter and Saturn orbits drawn closer, labelled) and `epicycle-model`.
- Moon phase rise/set times in `moon-phase-orbit` are the 50-minutes-a-day rule ("roughly"); `moonrise-times-chart`
  gives the real times for the learner's place.
- Edge-on solar system: real orbits, log-compressed distances, view along ecliptic longitude 90°; Pluto is hidden when
  tilts are exaggerated (×5 would make its 17° orbit look polar).
- "Earth from the Moon is nearly four times wider than the Sun": 1.9° vs 0.53° (3.6×), computed.
- Image notes: the 2014 meteor photo's Commons description only says "Meteor" and was taken on 12 August 2014; the
  caption says "on the night of the 2014 Perseid maximum", not that it is a Perseid. The annular-eclipse photo's
  source does not say how it was filtered, so no filter is claimed.
