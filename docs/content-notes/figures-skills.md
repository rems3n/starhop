# Figure notes: unit "skills" lessons

Author: figure author for the skills unit (brief: `docs/FIGURES.md`). Files touched: the 7 lesson JSONs below,
18 new diagrams in `src/modes/learn/figures/diagrams/`, 4 photos in `public/img/lessons/`.

All new diagrams read the learner's location from `useSettings((s) => s.observer)` (no Brooklyn hard-coding) and
handle the southern hemisphere where it matters. New captions/boxes avoid "Brooklyn"/"New York"; existing body
paragraphs were not rewritten (left for the location pass).

## Per lesson

| Lesson | Figures (section → id / image) | Boxes |
|---|---|---|
| dark-adaptation | S0 `eye-retina` (existing) + photo `retina-rods-cones-sem.jpg`; S1 `dark-adaptation-curve` (existing) + **`rod-cone-sensitivity`**; S2 `eye-retina` (existing) | S0 misconception (existing); S1 think (existing) + check `check-red-light`; S2 check (existing) |
| cardinal-directions | S0 **`pointers-to-polaris`** + photo `star-trails-north-pole.jpg`; S1 **`sunrise-directions`**; S2 **`sky-chart-flip`** | S0 misconception (Polaris brightest) + check `check-pointers`; S1 think + check `check-sunrise-june`; S2 think |
| hand-angles | S0 **`hand-angle-geometry`**; S1 **`hand-on-dipper`**; S2 **`moon-size-scale`** | S0 think; S1 check `check-hand-dipper`; S2 misconception (Moon illusion) |
| star-hopping | S1–S4 **`star-hop`** with `hop` = pointers / arcturus / belt / triangle | S0 check `check-hop-parts`; S2 think; S3 think (southern view of Orion); S4 misconception (bright "stars" that are planets) |
| reading-magnitude | S0 **`magnitude-ratio`**; S1 **`magnitude-ruler`**; S2 **`little-dipper-gauge`**; S3 **`apparent-absolute`** | S0 misconception + check `check-mag-steps`; S1 think; S2 check `check-limit`; S3 think |
| altitude-azimuth | S0 **`alt-az-dome`** (mode point); S1 **`alt-az-dome`** (mode daily); S2 **`altaz-time-place`** | S0 check `check-altaz-read`; S1 misconception (North Star overhead); S2 think |
| light-pollution | S0 **`skyglow`** + photo `earth-at-night-nasa.jpg`; S1 **`point-vs-diffuse`** + photo `light-pollution-country-vs-city.jpg`; S3 **`airmass-glow`** | S0 misconception; S1 think (Andromeda); S2 check `check-city-targets` |

## How numbers were computed or checked

- Star positions/magnitudes/distances: `public/data/stars.json` (HYG, J2000), copied into the diagrams that need
  fixed stars; background stars from `useCatalog()`. Separations are computed in code (great circles), never typed.
- Alt/az, sunrise/sunset azimuths and times, noon altitude, Sun altitude for twilight shading: `astronomy-engine`
  (`Horizon`, `Equator`, `SearchRiseSet`, `SearchHourAngle`) for the observer in settings. Spot checks match
  `lessons-skills.md` (Brooklyn: sunrise az 58°/121° at solstices; Aug 15 21:00 Altair 47° az 129°).
- Southern hemisphere check (Sydney): south celestial pole 34° up; Gacrux→Acrux line reaches the pole 27° beyond
  Acrux; noon Sun due north in November.
- Rod/cone curves: CIE 1924 photopic V(λ) (peak 555 nm) and CIE 1951 scotopic V′(λ) (peak 507 nm) standard tables at
  10 nm steps. The tabulated values are the standard published ones; I typed them from the standard tables and did
  not re-download the CIE files (Wikipedia's article confirms the peaks/normalisation but not every value).
- Magnitude anchors (Wikipedia "Apparent magnitude", fetched): Sun −26.8, full Moon −12.74, Venus about −4.2,
  Sirius −1.46, naked-eye limit +6.5, Hubble about +31.5. Bortle limits = `src/types.ts` BORTLE.
- m = M + 5 log10(d / 10 pc); Sun M = 4.83 at 1 AU gives −26.7. Rigel vs Sirius: 8.4 mag in absolute terms ≈ 2,200×.
- Moon size: 2·atan(1737.4 km / distance), tonight's distance from `GeoMoon`; range from 356,400–406,700 km.
- Air along the line of sight: uniform shell 8.4 km thick on a 6,371 km Earth; gives 39× at the horizon, 2.0× at 30°,
  5.7× at 10°.
- Hand geometry: angle = 2·atan(w / 2d) with illustrative adult sizes (eye–hand 60 cm; finger 1.0, three fingers 5.2,
  fist 10.5, spread hand 22 cm), child = ¾ of each; labelled "typical, for illustration" in the figure.
- "More than a third of humanity cannot see the Milky Way" — Falchi et al. 2016, *Science Advances* (world atlas of
  artificial night sky brightness); from memory of the abstract, not re-fetched.
- Andromeda total magnitude ≈ 3.4 and size several Moon widths: standard values, not re-fetched.

## Illustrative (not physical) values, stated in the figures

- `skyglow` glow levels and star dimming; `point-vs-diffuse` surface-brightness levels ("levels illustrative").
- `airmass-glow` drawing exaggerates the air layer ~100× (stated); the graph uses the real model.
- `sky-chart-flip` star pattern is decorative, not a real chart.

## Verification

- `npx tsc --noEmit` clean; `npm run validate -- lessons/<all 7>` 0 errors, 0 warnings.
- Screenshots in `docs/shots/figures/` (desktop 1280 and 390 px, 2+ control states each, plus Sydney observer for
  the hemisphere-dependent figures). During part of the session another agent's in-progress course-module change
  crashed `LessonPage` (`module.lessons` undefined in course logic), so most shots were taken with a private harness
  that renders a lesson section's figures and boxes through the real `LessonFigure`/box components; the real lesson
  page was re-checked once it recovered (light-pollution S1, star-hopping S3: no console errors).

## Known limits

- `alt-az-dome`: in the oblique view a low star in the front (southern) sky projects over the ground disc; the
  altitude arc makes it readable but it is a limitation of drawing a dome in 2-D.
- `pointers-to-polaris` near the equator (|lat| < ~5°) shows the pole almost on the horizon; still correct, cramped.
- `little-dipper-gauge` is a northern-hemisphere test; from southern latitudes its readout says so.
- Star counts in `magnitude-ruler` for Bortle 1–3 exceed the catalog's 6.5 limit; the readout says "every one of the
  8,920 stars in Starhop's catalog and thousands more" rather than inventing a number.
