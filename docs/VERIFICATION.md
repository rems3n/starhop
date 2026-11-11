# Verification of the astronomy core

Every number below was produced by `tests/astro-verification.test.ts` and `tests/astro-events.test.ts`
against reference data stored in `tests/fixtures/`, so the tests run offline. Reference data was fetched on
2026-11-10. Nothing here is estimated: if a source could not be reached it is listed under "Not verified".

Observer for all comparisons: Brooklyn, NY — latitude 40.6782° N, longitude 73.9442° W, 10 m.

## Positions

| What | Reference | Dates (UTC) | Our function | Target | Worst difference |
| --- | --- | --- | --- | --- | --- |
| Azimuth/elevation of Sun, Moon, Mercury…Neptune (63 values) | JPL Horizons, quantity 4, apparent, airless | 2026-03-08 10:00 · 2026-07-15 01:30 (Jul 14 21:30 EDT) · 2026-08-12 17:54 · 2026-11-11 02:00 (Nov 10 21:00 EST) · 2027-02-19 05:00 · 2027-08-13 08:00 · 2027-12-21 17:00 | `getBody().alt/az` | 0.05° (Moon 0.1°) | **0.0043°** (Neptune). Moon 0.0012°, Sun 0.0006°, Venus 0.0037°, Saturn 0.0040° |
| Apparent RA/Dec of the same | JPL Horizons, quantity 2, airless apparent, equinox of date | same | `getBody().ra/dec` rotated to the equinox of date with `eqjToEqdMatrix` | 0.05° (Moon 0.1°) | **0.0043°** (Neptune). Moon 0.0012° |
| Angular diameter | JPL Horizons, quantity 13 | same | `getBody().angularDiameterArcsec` | 1 % | 0.21 % |
| Altitude/azimuth of Sirius, Vega, Arcturus, Polaris, Betelgeuse, Antares, Capella, Fomalhaut, Deneb, Canopus (40 values) | astropy 8.0.2, ICRS → AltAz, pressure 0, no proper motion, same J2000 input | 2026-11-11 02:00 · 2026-07-15 01:30 · 2027-02-19 05:00 · 2027-08-13 08:00 | `altAzOf()` | 0.05° | **0.0063°** (Deneb) |

Notes on comparing like with like:

- Horizons was asked for the topocentric site (`CENTER='coord@399'`, geodetic coordinates), `APPARENT='AIRLESS'`
  (no refraction), matching our airless altitudes. Its "apparent" coordinates include light-time, aberration,
  light deflection, precession and nutation. Ours include all of those except the Sun's light deflection (< 0.001°).
- Horizons' astrometric ICRF RA/Dec (quantity 1) differs from our J2000 positions only by aberration (≤ 0.006°),
  which we apply on purpose; the test checks that too.
- The residual 0.002–0.004° for planets is the accuracy of astronomy-engine's truncated planetary theory
  (it is designed for ±1 arcminute).
- astropy applies annual aberration (up to 0.0057°) to stars; Starhop's fixed-star path does not. That accounts
  for essentially all of the 0.006° star difference. astropy used its bundled Earth-orientation table with no
  downloads (UT1−UTC predicted for future dates; effect < 0.004°).
- **Proper motion** is applied on neither side, so the comparison tests the frame rotation only. Because the
  catalog holds year-2000 positions, real stars have moved: by 2027 α Centauri is off by 0.028°, Arcturus 0.017°,
  Sirius 0.010°; 61 Cygni and Groombridge 1830 (the fastest naked-eye stars) by 0.04–0.05°. All are far below
  what the eye or the screen can show.

## Rise, transit, set

| What | Reference | Local dates | Our function | Target | Worst difference |
| --- | --- | --- | --- | --- | --- |
| Rise, transit, set of Sun, Moon, Venus, Mars, Jupiter, Saturn (71 events) | JPL Horizons rise-transit-set mode, `STEP_SIZE='1m GEO'`, `APPARENT='REFRACTED'` | 2026-07-14 · 2026-11-10 · 2027-02-19 · 2027-08-12 | `riseSet(body, date, observer, { window: 'day' })` | 2 minutes | **0.96 min** (Moon set, 2027-08-12) |
| Transit altitude | same (refracted, sampled on the whole minute) | same | `RiseSet.transitAlt` | — | 0.041° |

Horizons prints whole minutes (the first minute at or after the event), so up to 1 minute of the difference is
its own resolution. `GEO` is the geometric horizon with refraction and no dip for the 10 m elevation, which is
what astronomy-engine computes; Horizons uses the refracted upper limb for the Sun and Moon, as we do.
One reference value is missing (Moon transit on 2026-07-14, not flagged by Horizons that day) and is skipped.
The USNO API was not used; Horizons covered everything required.

## Events

| Event | Independent source | Reference value | Ours |
| --- | --- | --- | --- |
| Solar eclipse of 2026-08-12 from New York | orbitalradar.com/eclipse/2026-august-12/new-york | Partial: begins 13:07, maximum 13:53, ends 14:38 EDT, 9 % of the Sun covered | Partial: 13:07:46, 13:54:05, 14:38:48 EDT, 9.4 % |
| same | JPL Horizons Sun and Moon positions and diameters at 17:54 UT (fixture) | Discs overlap; two-circle geometry gives 9.5 % covered | 9.4 % |
| Partial lunar eclipse of 2026-08-28 | earthsky.org (partial-lunar-eclipse-of-the-august-27-28-2026) | Partial begins 02:34, greatest 04:13, ends 05:52 UTC; about 96 % of the disc in the umbra | 02:33, 04:12:49, 05:52 UTC; 97 % |
| Quadrantids 2027 (λ☉ 283.15°, J2000) | American Meteor Society meteor shower calendar | "peak near 3:30 UT on January 4th" | 2027-01-04 03:34 UT |
| Perseids 2026 (λ☉ 140.0°) | American Meteor Society; IMO meteor activity outlook 8–14 Aug 2026 | Night of Aug 12–13; maximum on Aug 13 | 2026-08-13 02:09 UT |
| Geminids 2026 (λ☉ 262.2°) | American Meteor Society | Night of Dec 13–14 | 2026-12-14 13:49 UT (best night from Brooklyn: Dec 13–14) |
| J2000 vs of-date solar longitude | astronomy-engine `SearchSunLongitude` (of date) | — | Our J2000 search lands 8–10 h later in 2026, as the 0.37° of precession since 2000 requires; the Quadrantid time above confirms the J2000 reading is the right one |
| March equinox 2026 | test constant 2026-03-20 14:46 UTC | — | within 3 minutes |

Also asserted in the tests from first principles rather than an outside table: Moon–planet pairings are
re-checked with direct astronomy-engine calls (Sun below −3.5°, both above 4.5°, topocentric separation < 3°);
planet conjunctions are true minima under 2° with both planets ≥ 15° from the Sun.

### Not verified against an outside source

- **Mars opposition on 2027-02-19** (also Jupiter 2026-01-10 and 2027-02-11, Saturn 2026-10-04 and 2027-10-18):
  the dates are asserted in the tests as computed; no independent page was fetched for them in this pass. Mars's
  position on that night (2027-02-19 05:00 UTC) agrees with Horizons to 0.001°.
- Greatest elongations, Moon phases and the 2027 eclipses: computed by astronomy-engine, checked only for
  internal consistency.
- Meteor-shower solar longitudes and radiants in the tests are the IMO working-list values typed into
  `tests/fixtures/load.ts`; `src/content/showers.json` was still empty when this was written, so the shipped
  table has not been run through these checks.

## Known facts (Brooklyn unless noted) — `tests/astro-visibility.test.ts`

Polaris within 1° of the latitude and due north · Sirius culminates at 32.6° · Orion: evening in January and
February, not visible in June and July, morning in September · Scorpius: evening in July, not visible in
December · Ursa Major and Cassiopeia visible every month · Crux never visible · from Sydney, Crux visible every
month and Ursa Minor never · nights across both 2026 daylight-saving changes · midnight sun and polar night at
Tromsø, and a London June night with no astronomical darkness · computed evening season equals the catalog's
`season` for all non-circumpolar, non-far-south constellations · 88 × 12 calendar under 600 ms (measured ≈ 70 ms).

## Lasso rule (summary) — `tests/lasso.test.ts`

Correct when (a) at least 70 % of the target's main stars are inside (*n* ≤ 4: one miss allowed, never fewer
than 2), and (b) no more than `max(2, 50 % of the enclosed target stars)` main stars of other constellations
are inside the loop but outside the target's padded hull, and the loop's area is at most 4 × the padded hull
area. Padding = max(30 px, 15 % of the figure's extent). Full rule and constants: `docs/ASTRO.md`.

Checked on the real catalog with a stereographic projection centred on each constellation:

| Check | Result |
| --- | --- |
| Padded convex hull of the main stars is accepted | all 88, at 3 zoom levels × 3 limiting magnitudes (792 cases) |
| A loop 25 % more generous than that | accepted for the 15 anchor constellations. (At 50 % more, Pegasus is rejected: the loop then takes in 17 stars of other constellations, mostly Pisces.) |
| Loop around Orion + Taurus + Gemini, asked for Orion | rejected, `too-much-else` |
| Loop around Orion's Belt only | rejected (`too-small` / `missed-stars`), at two zoom levels |
| Padded hull of a neighbouring constellation | rejected for 30 named pairs, and for every constellation against its 3 nearest neighbours (264 cases, no exceptions) |

## How to re-run

```
npx vitest run tests/astro-*.test.ts tests/lasso.test.ts
VERIFY_REPORT=1 npx vitest run tests/astro-verification.test.ts   # prints the worst-case lines

# refresh the reference data (needs network; overwrites tests/fixtures)
python3 scripts/verify/fetch_horizons.py      # JPL Horizons → tests/fixtures/horizons/raw/*.txt + horizons.json
pip install astropy && python3 scripts/verify/astropy_stars.py   # → tests/fixtures/astropy-stars.json
```

The raw Horizons responses are kept unmodified in `tests/fixtures/horizons/raw/` (33 files); `horizons.json` is
parsed from them by the fetch script.
