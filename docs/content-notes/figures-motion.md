# Figures for the "motion" unit (nightly-rotation, circumpolar-and-seasonal, seasonal-shift, latitude)

All diagrams read the learner's location from `useSettings((s) => s.observer)` (via `useObserver()` in
`diagrams/_motion-sky.ts`) and handle southern latitudes (south celestial pole, no Polaris, clockwise turn,
Orion upside down). No diagram hard-codes a city as the observer; Sydney / Tromsø / the poles / the equator
appear only as comparison presets.

## New diagrams (src/modes/learn/figures/diagrams/)

| id | used in | what it does | computed from |
|---|---|---|---|
| `celestial-sphere` | nightly-rotation §1 | Earth spinning inside a sphere of real bright stars; observer's horizon extended to the sky; time slider + Spin Earth | catalog stars (mag < 2.6), LST at 7 pm local on 15 Jan 2026 (astronomy-engine sidereal time), alt/az of Orion and Big Dipper / Southern Cross |
| `star-trails` | nightly-rotation §2 | "hours of exposure" drawing aimed at the visible celestial pole; every trail grows 15.04° per clock hour; angle wedge on Dubhe (north) / Acrux (south) | catalog stars mag < 4.3 precessed to date; stereographic projection centred on the pole |
| `horizon-paths` | nightly-rotation §3, latitude §2 | 180° panorama facing E/S/W/N, star paths for declinations −75…+75 with hourly dots; rise/set angle = 90° − |lat| measured on screen | equal-angle panorama (true angles at the horizon) |
| `sky-zones-latitude` | circumpolar §1 and §3, latitude §2 | meridian side view: pole at altitude = latitude, never-sets and never-rises caps, follow a star (hours up, highest altitude) | declinations from the catalog; hours up = 2·acos(−tanφ·tanδ)/15 |
| `circumpolar-cap` | circumpolar §2 | view toward the pole with all catalog stick figures, never-sets circle (radius = latitude), month slider at 9 pm local | catalog lines precessed to 2026; constellation is "inside" when all its figure stars have declination beyond 90° − |lat| |
| `sidereal-day` | seasonal-shift §1 | top-down: Earth turning while moving along its orbit; star overhead again after 23 h 56 min, Sun after 24 h | 360.986° per solar day; orbit step drawn ×20 (said in the figure) |
| `night-side-constellations` | seasonal-shift §2 | top-down orbit inside the ring of ecliptic constellations; date slider; up at night / evening-dawn / behind the Sun | Sun's J2000 ecliptic longitude (`sunLongitudeJ2000`); constellation spans by sampling the ecliptic every 0.5° with `constellationAt` (IAU boundaries) |
| `transit-time-chart` | seasonal-shift §3 | clock time a star is highest on each day of the year over shaded daylight, for the learner's place, in local standard time | sidereal time; sunrise/sunset with `SearchRiseSet` every 3 days |
| `polaris-altitude` | latitude §1 | Earth, observer, horizon tangent, parallel rays from Polaris; the two equal angles; inset of the observer's view | geometry only |
| `orion-orientation` | latitude §3 | Orion (catalog figure) from the learner's place and from the other hemisphere (Sydney, or London for southern learners); time slider ±4 h | hour angle → alt/az, local stereographic view following Orion's azimuth |

`diagrams/_motion-sky.ts` is a shared helper (geometry, time zones, place presets, `useObserver`). It is a
`.ts` file so the registry (`./diagrams/*.tsx`) does not treat it as a diagram.

## Checked numbers

- Sidereal rate 15.041°/h; solar day = 360.986° of turn (365.256-day year).
- Brooklyn: circumpolar limit +49.3°; Vega up 17.8 h, highest 88° (lesson says "about 18"); Antares up 8.6 h, highest 22.9° (lesson: "about 9", "two and a half fists"); each cap 12% of the sky.
- Alkaid (precessed to 2026, dec ≈ +49.2°) lowest altitude −0.1° from 40.7° N (airless); refraction (~0.5°) lifts it just above: "grazes the horizon" holds.
- Polaris is 0.6° from the pole in 2026 and ranks 48th in brightness in `public/data/stars.json` (box says "roughly the 50th").
- Sirius highest at about 11:00 pm EST on 15 Jan, 9:02 pm on 14 Feb (1 h 58 min earlier).
- Orion lost in the Sun's glare (elongation < 35°) roughly mid-May to late July; caption says "May to July".
- Capella +46.0°: not circumpolar from 35° N (limit +55°), dips about 9° below the horizon (quick check).

## Simplifications stated in the figures

Earth and the sky sphere not to scale; orbit step ×20 in `sidereal-day`; stars "vastly farther away" in the
top-down orbit; airless horizon (no refraction) in all altitude numbers; `transit-time-chart` uses local
standard time all year.

## Known limits

- `transit-time-chart`: at polar latitudes in polar day/night (no sunrise or sunset within 24 h) the daylight shading is approximate.
- `star-trails` / `circumpolar-cap` at |latitude| < 10°: the pole sits on the horizon, so half the picture is ground (correct, but less useful).
- `circumpolar-cap`: in some months part of Ursa Major / Canes Venatici labels are hidden behind the ground.
- Lesson body text still mentions Brooklyn in places (left for the later body-text pass, as instructed).
