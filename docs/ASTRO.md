# Astronomy core (`src/astro`)

Pure TypeScript on top of [`astronomy-engine`](https://github.com/cosinekitty/astronomy). No React, no DOM.
Import everything from `@/astro`. Result types live in `src/types.ts`.

Conventions: all angles in degrees; RA 0–360 (not hours); azimuth 0 = north, 90 = east; positions are
J2000 unless a name says otherwise; `Date` objects are UTC instants; "local" always means `observer.tz`.

## frames.ts — coordinate frames

| Export | What it does |
| --- | --- |
| `type Mat3` | 9 numbers, row-major rotation matrix. |
| `eqjToHorMatrix(date, observer)` | Rotation J2000 equatorial → local horizon. Horizon vector axes: **x = north, y = west, z = zenith** (so `az = atan2(−y, x)`, `alt = asin z`). Uses `Rotation_EQJ_HOR`, so precession, nutation and Earth rotation are included. |
| `horToEqjMatrix(date, observer)` | The inverse (transpose). |
| `eqjToEqdMatrix(date)` | J2000 → true equator and equinox of date (to compare with "apparent" RA/Dec). |
| `raDecToVec(ra, dec)` / `vecToRaDec(v)` | Unit vector ⇄ RA/Dec. |
| `applyMat3(m, v)`, `mulMat3`, `transposeMat3`, `fromRotation` | Matrix helpers. |
| `horVecToAltAz(h)` / `altAzToHorVec(az, alt)` | Horizon vector ⇄ altitude/azimuth. |
| `altAzOf(ra, dec, date, observer, { refraction? })` | Altitude/azimuth of a J2000 position. Airless by default; `refraction: true` adds standard refraction. |
| `raDecOfAltAz(az, alt, date, observer)` | J2000 position of a point given by azimuth and airless altitude. |
| `makeAltAz(date, observer)` | Returns `(ra, dec) => { alt, az }` for many stars at one instant (one matrix, 9 multiplications per star). |
| `angularSeparation(a, b)` | Angle between two positions. |
| `positionAngle(from, to)` | Direction from one position to another: 0 = celestial north, 90 = east. |
| `localSiderealTimeDeg(date, lon)` | Apparent local sidereal time in degrees. |
| `refractionDeg(alt)` | How much the atmosphere lifts an object at a given true altitude. |
| `meanDirection(points)` | Middle of a set of positions. |
| `norm360`, `norm180`, `DEG`, `RAD`, `toAstroObserver` | Small utilities. |

## bodies.ts — Sun, Moon, planets

| Export | What it does |
| --- | --- |
| `getBody(id, date, observer): BodyState` | Topocentric J2000 RA/Dec (light-time and aberration corrected, so it lines up with the catalog stars on screen), airless alt/az, visual magnitude, distance, lit fraction, elongation from the Sun, angular diameter, IAU constellation. |
| `getBodies(date, observer)` | All nine, in the order Sun, Moon, Mercury … Neptune. |
| `bodyRaDec`, `bodyVector` | Position only (cheaper). |
| `moonPhase(date): MoonPhase` | Phase angle (0 new, 90 first quarter, 180 full, 270 last quarter), lit fraction, name. "New", "Full" and the quarters are used within ±6.5° of the exact phase (about ±12 hours). |
| `eclipticPath(n = 180)` | The ecliptic as J2000 points, **n + 1 points, the last repeats the first** so it draws as a closed line. |
| `eclipticToRaDec(lon, lat)` | One J2000 ecliptic position → RA/Dec. |
| `constellationAt(ra, dec)` | IAU abbreviation at a J2000 position. Tested to produce exactly the catalog's 88 ids (Serpens is `Ser` for both halves). |
| `BODY_IDS`, `PLANET_IDS`, `NAKED_EYE_PLANETS`, `BODY_RADIUS_KM`, `isBodyId` | Constants and guard. |

## visibility.ts — what is up, and when

A target (`VisTarget`) is a `BodyId`, one position `{ ra, dec }`, or a constellation `{ points: [{ ra, dec }, …] }`
(its main stars; `constellationPoints(constellation, catalog)` builds that).

| Export | What it does |
| --- | --- |
| `nightWindow(date, observer): NightWindow` | Sunset, civil/nautical/astronomical dusk and dawn (Sun at −6°, −12°, −18°), sunrise for **the night that begins on the local calendar date of `date`**. Events that do not happen (midnight sun, polar night, bright summer nights) are `null`. |
| `currentNightDate(now, observer)` | The date to pass when you mean "the night I am in": between midnight and sunrise it returns yesterday. |
| `riseSet(target, date, observer, { window? }): RiseSet` | Rise, transit, set, transit altitude, circumpolar / never-rises flags. `window: 'night'` (default, except for the Sun) = the pass whose transit falls between local noon and the next local noon, with the rise before it and the set after it. `window: 'day'` (default for the Sun) = first rise, transit and set between local midnight and the next (almanac style; `null` if none). Standard definition: 34′ refraction, upper limb for Sun and Moon. |
| `visibilityOn(target, date, observer): VisibilityInfo` | Classifies that night (rule below). |
| `yearVisibility(target, year, observer)` | 12 entries, the night of the 15th of each month. |
| `eveningSeason(target, observer, { year? })` | `'winter' \| 'spring' \| 'summer' \| 'autumn' \| 'all-year' \| 'never'` — rule below. |
| `bestMonths(target, observer, { year? })` | Months 1–12 (ascending) when it is well placed around 21:00–22:00 — rule below. |
| `seasonOfMonth(month, lat)` | Meteorological season of a month in the observer's hemisphere. |
| `tonight(date, observer, catalog)` | `{ night, moon: { phase, rise, set }, planets, constellations, brightStars }`. Each list holds **every** candidate (7 planets, 88 constellations, stars of magnitude ≤ 1.5): visible ones first, sorted by best time, then the `not-visible` ones. Each item has a ready-made `note` ("Evening sky. Best around 9:10 PM, high in the south."). Planets and stars carry `rise`/`set`. |
| `upNow(date, observer, catalog)` | Constellations with at least one main star above the horizon now, highest first, with `fractionUp`. |
| `whereWords(alt, az)` | "low in the southwest", "nearly overhead". |
| `clearVisibilityCache()` | Drops cached nights. |

### The visibility rule

The night is sampled every **5 minutes** from local noon to the next local noon.

1. **Dark** means the Sun is below **−12°** (end of nautical twilight). For Mercury, Venus and the Moon — bright
   objects you look for in twilight — the limit is **−6°**.
2. **Up** means: a star or other fixed point at or above **10°**; a planet or the Moon at or above **5°**;
   a constellation when at least **60 %** of its points are at or above 10° at the same moment.
3. `darkHours` = time both dark and up. `darkTotal` = time dark.
4. Classification, in this order:
   - no dark time at all, or `darkHours` < **45 minutes** (20 minutes for Mercury and Venus) → `not-visible`
   - `darkHours` ≥ **80 %** of `darkTotal` → `all-night`
   - otherwise compare the average time of the up-and-dark samples with the middle of the dark period:
     earlier → `evening`, later → `morning`.
5. `bestTime` = the up-and-dark sample with the highest altitude (for a constellation, of the middle of its
   stars); `bestAlt`/`bestAz` are the position then. When `not-visible`, `bestTime` is `null` and
   `bestAlt`/`bestAz` give the highest position reached while dark (possibly below the horizon; 0/0 if it never gets dark).

Special cases: the **Sun** is always `not-visible` (this is a night-sky classification; use `riseSet('Sun')`
or `nightWindow`). The **Moon** uses the −6°/5° limits, its position is recomputed through the night, and it is
`not-visible` when less than 1 % of its disc is lit.

Named constants: `DARK_SUN_ALT`, `TWILIGHT_SUN_ALT`, `MIN_ALT_FIXED`, `MIN_ALT_BODY`, `CONSTELLATION_UP_FRACTION`,
`STEP_MINUTES`, `MIN_VISIBLE_MINUTES`, `MIN_VISIBLE_MINUTES_INNER`, `ALL_NIGHT_FRACTION`, `MIN_MOON_ILLUMINATION`.

Things worth knowing when showing the result:

- A low southern constellation can be `not-visible` or have a very short season even though its bright star is
  easy. From Brooklyn, four of Scorpius's 14 main stars never reach 10° and three more barely do, so "60 % up"
  holds only briefly each night around June and July; Antares alone is an evening star from June to August.
- Something centred on the middle of the night but up for less than 80 % of it gets `evening` or `morning`
  by a small margin. That is inherent in a four-way label.

### Evening season and best months

Both look at the 5th, 15th and 25th of every month of one year (fixed stars give the same answer every year;
for planets pass `year`, default the current year).

- `bestMonths` looks at **21:00 and 22:00 local clock time**, or at the end of nautical twilight if the sky is
  not yet dark then (June in New York). Score = altitude if the target is up (rule 2 above), else 0. A month
  qualifies when its mean score is at least **70 %** of the best score of the year. If none qualifies (a target
  that barely clears the horizon) the single best month is returned; a target never up returns `[]`.
- `eveningSeason` looks at **22:00, 23:00 and midnight** (same twilight adjustment), sums the scores over
  December–February, March–May, June–August and September–November and returns the season with the largest sum.
  The later hours are deliberate: they reproduce the traditional seasonal labels (Summer Triangle = summer,
  Boötes = spring) and agree with the catalog's `season` field for every non-circumpolar, non-far-south
  constellation from Brooklyn (tested). `'all-year'` = up at every sample and never below **60 %** of its best
  score (Ursa Minor); `'never'` = never up in the evening from here.
- **Season names are the observer's own.** South of the equator December–February is `'summer'`, so Orion is a
  summer constellation from Sydney.
- The Moon returns `'all-year'`, the Sun `'never'`.

## events.ts — the sky calendar

`yearEvents(start, observer, showers, months = 12): SkyEvent[]`, sorted by date. Every `detail` is a few plain
sentences with local times (`observer.tz`) and a direction to look. `visibleHere` is false when the event
cannot be seen from the observer's location.

| Kind | What is listed | `visibleHere` |
| --- | --- | --- |
| `opposition` | Mars, Jupiter, Saturn, Uranus, Neptune. | Transit altitude ≥ 10°. |
| `greatest-elongation` | Mercury and Venus, title says evening or morning sky. | Planet ≥ 5° up when the Sun is at −6°. |
| `conjunction` (planets) | Closest approach of any two planets if < 2° (`CONJUNCTION_MAX_SEP`) and both ≥ 15° from the Sun (`CONJUNCTION_MIN_ELONGATION`). | Both ≥ 5° up with the Sun below −6° (−12° if Uranus or Neptune is involved) on the nearest night. |
| `conjunction` (Moon) | Moon within 3° (`MOON_PLANET_MAX_SEP`) of Mercury…Saturn **as seen from the observer**, only at moments when both are ≥ 5° up and the Sun is below −4° (`PAIRING_SUN_ALT`). The event time is the closest such moment. | Always true (others are not listed). |
| `lunar-eclipse` | All, with type and local times of each phase; phases with the Moon below the horizon are flagged. | Moon above the horizon during some of the umbral phase (penumbral: at maximum). |
| `solar-eclipse` | All global eclipses. If the Sun is eclipsed above this observer's horizon: local start/maximum/end and percentage covered; the event date is then the local maximum. | Local circumstances exist. |
| `equinox`, `solstice` | Four a year, with local sunrise/sunset. | true |
| `moon-phase` | New and Full Moons. | Full: true. New: false (it marks the dark-sky nights). |
| `meteor-shower` | One peak per shower per year. | Radiant above the horizon in a dark sky for ≥ 1 hour on the peak night. |

Meteor showers: `peakSolarLongitude` is the Sun's longitude for the **J2000.0** equinox (IMO convention).
astronomy-engine's `SearchSunLongitude` works in the equinox **of date**, which by 2026 is 0.37° away — nine
hours of solar motion — so it is not used. `sunLongitudeJ2000(date)` rotates the Sun's J2000 vector into the
J2000 ecliptic and `dateOfSolarLongitudeJ2000(lon, year)` solves for the instant. The peak night is the local
noon-to-noon window containing the peak; the description gives the hours the radiant is above the horizon with
the Sun below −12°, when it is highest, and the Moon's lit fraction and whether it is up during those hours.

Other exports: `showerPeaks`, `showerNight`, `localSolarEclipse(peak, observer)`.

## lasso.ts — "circle the constellation"

Works in flat screen pixels. `scoreLasso({ polygon, targets, others, minPadPx?, targetName?, conNames? })`
returns `{ correct, recall, enclosedTargets, missedTargets, intruders, areaRatio, reason, message }`.

The rule:

1. The path is closed automatically. Fewer than 3 points, an enclosed area under 64 px² (`LASSO_MIN_AREA_PX2`),
   or no targets → `invalid`. Containment uses the non-zero winding rule, so drawing direction and a loop that
   overlaps itself where the ends meet do not matter.
2. **Enough of the figure**: with *n* target stars, `need = ceil(0.7 · n)` (`LASSO_RECALL`); for *n* ≤ 4 one
   miss is allowed but never fewer than 2 inside (*n* = 2 → 2, 3 → 2, 4 → 3). Fewer than `need` inside →
   `missed-stars`, or `too-small` when the loop is under 30 % (`LASSO_TOO_SMALL_RATIO`) of the padded hull area.
3. **Not too much else** (→ `too-much-else`):
   - *intruders* ≤ `max(2, 50 % of the enclosed target stars)` (`LASSO_FREE_INTRUDERS`, `LASSO_INTRUDER_FRACTION`).
     An intruder is a main star of another constellation inside the loop **and outside the target's own padded
     hull**. Stars inside the target's outline cannot be avoided (Ophiuchus inside Serpens, Corvus and Crater
     under Hydra) and are not counted.
   - loop area ≤ **4 ×** (`LASSO_MAX_AREA_RATIO`) the area of the padded convex hull of the target stars.
4. **Padding**: the hull is grown outward by `max(minPadPx, 15 % of the figure's extent)` (`LASSO_PAD_FRACTION`;
   extent = largest distance between two target stars; `minPadPx` default 30). The padded area is exact:
   hull area + perimeter × pad + π × pad². A two-star or needle-thin figure therefore gets a capsule-shaped
   allowance rather than zero.

`message` is one sentence, e.g. "You got 5 of 7 main stars of Orion, but the loop also took in most of Taurus."

`scoreConstellationLasso({ polygon, constellation, catalog, project, limitingMag, minPadPx? })` prepares the input:

- **Targets** = the constellation's main stars at or brighter than `max(limitingMag, magnitude of its
  4th-brightest main star)` (`lassoTargetCutoff`). Under a city sky the learner is not asked for stars that are
  not drawn, but there are always up to four stars to find, even for faint constellations.
- Target stars count even when off-screen (frame the constellation before asking).
- **Others** = main stars of all other constellations that `project()` reports as visible and that are at or
  brighter than `limitingMag`.

Helpers: `pointInPolygon`, `polygonArea`, `enclosedArea`, `convexHull`, `distanceToHull`, `hullMetrics`,
`lassoPad`, `paddedHullArea`, `padHull` (the accepted outline as a polygon — useful when revealing the answer),
`lassoNeed`, `lassoIntruderAllowance`.

## Accuracy and limits

Measured differences are in `docs/VERIFICATION.md`. In short: planets within 0.005°, the Moon within 0.002°,
stars within 0.007°, rise/set within a minute.

- **Refraction.** Altitudes are airless unless you ask for refraction. Rise and set times include the standard
  34′. Real refraction near the horizon varies with weather by several arcminutes, so rise/set times are good to
  about a minute at best. Hills, buildings and the height of the observer are ignored.
- **Proper motion.** Catalog positions are for the year 2000 and are not moved. By 2027 the largest errors are
  α Centauri 0.028° (3.7″ a year), Arcturus 0.017°, Sirius 0.010°; the fastest naked-eye stars, 61 Cygni and
  Groombridge 1830, are off by 0.04–0.05°. Every other star is well under a tenth of the Moon's width.
- **Aberration of starlight** (up to 0.006°) is applied to the Sun, Moon and planets but not to catalog stars,
  so stars and planets are consistent to that level.
- **ΔT** (the slowly changing difference between clock time and the Earth's rotation) comes from
  astronomy-engine's model, about 69 s now. An error of 1 s shifts the sky by 0.004°; predictions are good for
  some decades either side of the present and degrade slowly beyond.
- **Dates far from the present.** astronomy-engine is designed for roughly ±a few thousand years at ±1′;
  the visibility calendar ignores proper motion but includes precession.
- **Time zones** come from the browser's `Intl` database via `src/lib/time.ts`; noon-to-noon windows are 23 or
  25 hours long on daylight-saving change days and are handled as such.

## Performance

- A night is computed once per (local date, observer) and cached (96 nights): one exact rotation matrix, the
  rest by rotating about the pole at the sidereal rate, plus the Sun's altitude at each sample. Sun and planet
  positions are interpolated between 6-hour nodes, the Moon between 30-minute nodes.
- 88 constellations × 12 months: about 70 ms cold, 15 ms warm (budget in the tests: 600 ms).
- `tonight()` about 25 ms; `yearEvents()` for 12 months about 150–300 ms — call it once and keep the result.
- `makeAltAz` is the per-frame path for star fields.
